const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const auth = require('../middleware/auth');

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const parseJSON = (text) => {
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
};

// POST /api/ats-score
// Body: { jobDescription: string, cvText: string }
// Returns: { score: number, matchedKeywords: string[], missingKeywords: string[] }
router.post('/', auth, async (req, res) => {
  try {
    const { jobDescription, cvText } = req.body;

    if (!jobDescription?.trim()) {
      return res.status(400).json({ message: 'jobDescription is required' });
    }
    if (!cvText?.trim()) {
      return res.status(400).json({ message: 'cvText is required' });
    }

    const prompt = `You are an ATS (Applicant Tracking System) analyzer. Compare the candidate's CV against the job description and produce a realistic ATS compatibility score.

Return ONLY valid JSON, no explanation, no markdown.
Format:
{
  "score": number,
  "matchedKeywords": string[],
  "missingKeywords": string[]
}

Rules:
- score: integer 0–100 reflecting realistic ATS behavior (keyword density, skills overlap, role relevance, seniority match)
- matchedKeywords: important keywords/skills from the JD that appear in the CV (max 15)
- missingKeywords: important keywords/skills from the JD that are absent from the CV (max 15)
- Be realistic: a 90+ score means an almost perfect match; a 40- means major gaps

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

CANDIDATE CV:
${cvText.slice(0, 3000)}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const result = parseJSON(message.content[0].text);

    // Validate and sanitize
    const score = Math.min(100, Math.max(0, Math.round(Number(result.score) || 0)));
    const matchedKeywords = Array.isArray(result.matchedKeywords) ? result.matchedKeywords.slice(0, 15) : [];
    const missingKeywords = Array.isArray(result.missingKeywords) ? result.missingKeywords.slice(0, 15) : [];

    res.json({ score, matchedKeywords, missingKeywords });
  } catch (err) {
    console.error('ATS score error:', err.message);
    res.status(500).json({ message: 'Failed to compute ATS score' });
  }
});

module.exports = router;
