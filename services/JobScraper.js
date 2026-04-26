const axios = require('axios');
const Job = require('../models/Job');
const Company = require('../models/Company');

const JobScraper = {

  /**
   * Main entry — runs all scrapers and returns total saved
   */
  async run() {
    console.log('[JobScraper] Starting midnight job fetch...');
    let total = 0;

    try { total += await this.fetchRemotive(); } catch (e) { console.error('[JobScraper] Remotive failed:', e.message); }
    try { total += await this.fetchArbeitnow(); } catch (e) { console.error('[JobScraper] Arbeitnow failed:', e.message); }

    console.log(`[JobScraper] Done. ${total} new jobs saved.`);
    return total;
  },

  /**
   * Remotive — free remote jobs API, no key needed
   * https://remotive.com/api/remote-jobs
   */
  async fetchRemotive() {
    const keywords = ['frontend', 'react', 'typescript'];
    let saved = 0;

    for (const keyword of keywords) {
      const { data } = await axios.get('https://remotive.com/api/remote-jobs', {
        params: { category: 'software-dev', search: keyword, limit: 20 },
        timeout: 10000,
      });

      for (const job of data.jobs ?? []) {
        const exists = await Job.findOne({ jdUrl: job.url });
        if (exists) continue;

        await Job.create({
          title: job.title,
          companyName: job.company_name,
          description: job.description?.slice(0, 1000) ?? '',
          location: job.candidate_required_location || 'Remote',
          locationType: 'remote',
          skills: this.extractSkills(job.tags ?? []),
          tags: job.tags ?? [],
          jdUrl: job.url,
          source: 'indeed', // closest enum match
          postedAt: new Date(job.publication_date),
          isActive: true,
          currency: 'INR',
        });
        saved++;
      }
    }

    console.log(`[JobScraper] Remotive: ${saved} new jobs`);
    return saved;
  },

  /**
   * Arbeitnow — another free jobs API
   * https://www.arbeitnow.com/api/job-board-api
   */
  async fetchArbeitnow() {
    const { data } = await axios.get('https://www.arbeitnow.com/api/job-board-api', {
      timeout: 10000,
    });

    const frontendKeywords = ['react', 'frontend', 'front-end', 'typescript', 'next.js', 'vue'];
    let saved = 0;

    for (const job of data.data ?? []) {
      const titleLower = job.title.toLowerCase();
      const tagLower = (job.tags ?? []).join(' ').toLowerCase();
      const isFrontend = frontendKeywords.some(k => titleLower.includes(k) || tagLower.includes(k));
      if (!isFrontend) continue;

      const exists = await Job.findOne({ jdUrl: job.url });
      if (exists) continue;

      await Job.create({
        title: job.title,
        companyName: job.company_name,
        description: job.description?.slice(0, 1000) ?? '',
        location: job.location || 'Remote',
        locationType: job.remote ? 'remote' : 'onsite',
        skills: this.extractSkills(job.tags ?? []),
        tags: job.tags ?? [],
        jdUrl: job.url,
        source: 'linkedin',
        postedAt: new Date(job.created_at * 1000),
        isActive: true,
        currency: 'INR',
      });
      saved++;
    }

    console.log(`[JobScraper] Arbeitnow: ${saved} new jobs`);
    return saved;
  },

  /**
   * Extract known tech skills from tag array
   */
  extractSkills(tags) {
    const knownSkills = [
      'React', 'TypeScript', 'JavaScript', 'Next.js', 'Vue', 'Angular',
      'Node.js', 'GraphQL', 'REST', 'Tailwind', 'CSS', 'HTML',
      'Redux', 'Jest', 'Playwright', 'Vite', 'Webpack', 'Git',
    ];
    const tagStr = tags.join(' ').toLowerCase();
    return knownSkills.filter(s => tagStr.includes(s.toLowerCase()));
  },
};

module.exports = JobScraper;