const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const parseJSON = (text) => {
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

const ResumeService = {
  /**
   * Parse a resume file (base64) and extract structured data using Claude.
   * Returns: { skills, experienceYears, currentRole, summary, rawText }
   */
  async parse(base64, fileType) {
    const mimeType = fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const prompt = `You are a resume parser. Extract structured information from this resume.
Return ONLY valid JSON, no markdown, no explanation.
Schema:
{
  "skills": string[],
  "experienceYears": number,
  "currentRole": string,
  "summary": string,
  "rawText": string
}`;

    try {
      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType, data: base64 } },
      ]);
      return parseJSON(result.response.text());
    } catch (err) {
      console.error('ResumeService.parse error:', err.message);
      return { skills: [], experienceYears: 0, currentRole: '', summary: '', rawText: '' };
    }
  },

  /**
   * Score a resume against a job description.
   * Returns: { score, matchedSkills, missingSkills, recommendation, summary }
   */
  async matchToJob(resume, job) {
    const prompt = `You are a job-fit analyzer. Compare this resume and job description.
Return ONLY valid JSON, no markdown, no explanation.
Schema:
{
  "score": number,
  "matchedSkills": string[],
  "missingSkills": string[],
  "recommendation": "strong" | "good" | "partial" | "weak",
  "summary": string
}

RESUME:
Skills: ${resume.skills?.join(', ') || 'Not parsed'}
Current role: ${resume.currentRole || 'Unknown'}
Experience: ${resume.experienceYears || '?'} years
Summary: ${resume.summary || ''}

JOB:
Title: ${job.title}
Company: ${job.companyName || 'Unknown'}
Required skills: ${job.skills?.join(', ') || 'Not specified'}
Experience: ${job.experienceMin}–${job.experienceMax} years
Description: ${job.description?.slice(0, 800) || 'Not provided'}`;

    try {
      const result = await model.generateContent(prompt);
      return parseJSON(result.response.text());
    } catch (err) {
      console.error('ResumeService.matchToJob error:', err.message);
      throw new Error('AI matching failed. Try again.');
    }
  },

  /**
   * Given a user's resume skills, suggest the best matching jobs from a list.
   * Returns sorted jobs with matchScore attached.
   */
  async rankJobs(userSkills, jobs) {
    if (!userSkills?.length || !jobs?.length) return jobs;

    const userSkillsLower = userSkills.map((s) => s.toLowerCase());

    return jobs
      .map((job) => {
        const jobSkills = (job.skills || []).map((s) => s.toLowerCase());
        const matched = jobSkills.filter((s) => userSkillsLower.some((us) => us.includes(s) || s.includes(us)));
        const score = jobSkills.length ? Math.round((matched.length / jobSkills.length) * 100) : 0;
        return { ...job.toObject?.() ?? job, matchScore: score };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  },
};

module.exports = ResumeService;