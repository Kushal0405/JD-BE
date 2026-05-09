const express = require('express');
const axios = require('axios');
const Job = require('../models/Job');
const DiscoveredJob = require('../models/DiscoveredJob');
const Application = require('../models/Application');
const auth = require('../middleware/auth');

const router = express.Router();

// ---------------------------------------------------------------------------
// Shared logic: fetch jobs from JSearch and upsert into DiscoveredJob collection
// ---------------------------------------------------------------------------
async function fetchDailyJobs({ query = 'React Developer', location = 'Hyderabad, India' } = {}) {
  // JSearch requires location to be embedded in the query string — no separate location param
  const searchQuery = location ? `${query} in ${location}` : query;

  const { data } = await axios.get('https://jsearch.p.rapidapi.com/search', {
    params: { query: searchQuery, num_pages: '1', page: '1' },
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
    timeout: 15000,
  });

  const jobs = (data.data ?? []).map((job) => ({
    externalId: job.job_id,
    title: job.job_title ?? '',
    company: job.employer_name ?? '',
    location: [job.job_city, job.job_country].filter(Boolean).join(', '),
    description: job.job_description ?? '',
    applyLink: job.job_apply_link ?? '',
    source: 'jsearch',
    fetchedAt: new Date(),
  }));

  if (!jobs.length) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;
  try {
    const result = await DiscoveredJob.insertMany(jobs, { ordered: false });
    inserted = result.length;
    skipped = jobs.length - inserted;
  } catch (err) {
    // ordered: false — partial inserts succeed; duplicates throw BulkWriteError
    if (err.writeErrors) {
      inserted = jobs.length - err.writeErrors.length;
      skipped = err.writeErrors.length;
    } else {
      throw err;
    }
  }
  return { inserted, skipped };
}

// POST /api/jobs/fetch-daily — fetch from JSearch and save (cron-secured)
router.post('/fetch-daily', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const { query, location } = req.body;
    const result = await fetchDailyJobs({ query, location });
    res.json(result);
  } catch (err) {
    console.error('[fetch-daily]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/jobs/discovered — paginated list for the Discover page (JWT-protected)
router.get('/discovered', auth, async (req, res) => {
  try {
    const { role, location, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.title = new RegExp(role, 'i');
    if (location) filter.location = new RegExp(location, 'i');

    const [jobs, total] = await Promise.all([
      DiscoveredJob.find(filter)
        .sort({ fetchedAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      DiscoveredJob.countDocuments(filter),
    ]);

    res.json({ jobs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/jobs/discovered/:id/apply — add a discovered job to the user's tracker
router.post('/discovered/:id/apply', auth, async (req, res) => {
  try {
    const discovered = await DiscoveredJob.findById(req.params.id).lean();
    if (!discovered) return res.status(404).json({ message: 'Discovered job not found' });

    // Upsert a Job document so the application can reference it
    let job = await Job.findOne({ externalId: discovered.externalId });
    if (!job) {
      job = await Job.create({
        title: discovered.title,
        companyName: discovered.company,
        location: discovered.location,
        description: discovered.description,
        jdUrl: discovered.applyLink,
        source: 'jsearch',
        isActive: true,
        postedAt: discovered.fetchedAt,
        externalId: discovered.externalId,
      });
    }

    // Create Application (unique constraint will reject duplicates)
    const application = await Application.create({
      user: req.user._id,
      job: job._id,
      stage: 'saved',
      jobSnapshot: {
        title: discovered.title,
        companyName: discovered.company,
        location: discovered.location,
      },
    });

    res.status(201).json({ application });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Already in your tracker' });
    res.status(500).json({ message: err.message });
  }
});

// GET /api/jobs — browse with filters
// Query: ?skills=React,TypeScript&location=remote&salaryMin=900000&page=1&limit=20&q=frontend
router.get('/', auth, async (req, res) => {
  try {
    const { skills, location, locationType, salaryMin, salaryMax, source, q, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };

    if (q) filter.$text = { $search: q };
    if (locationType) filter.locationType = locationType;
    if (source) filter.source = source;
    if (salaryMin) filter.salaryMax = { $gte: Number(salaryMin) };
    if (salaryMax) filter.salaryMin = { $lte: Number(salaryMax) };
    if (skills) {
      const skillArr = skills.split(',').map((s) => s.trim());
      filter.skills = { $in: skillArr.map((s) => new RegExp(s, 'i')) };
    }
    if (location) filter.location = new RegExp(location, 'i');

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate('company', 'name logoUrl website')
        .sort({ postedAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Job.countDocuments(filter),
    ]);

    res.json({ jobs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/jobs/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('company');
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json({ job });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/jobs/parse-jd — extract structured fields from raw JD text using AI
router.post('/parse-jd', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'JD text is required' });
    const ResumeService = require('../services/ResumeService');
    const parsed = await ResumeService.parseJD(text);
    res.json({ parsed });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/jobs — create (admin or manual add)
router.post('/', auth, async (req, res) => {
  try {
    const job = await Job.create(req.body);
    res.status(201).json({ job });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/jobs/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json({ job });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/jobs/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Job deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.fetchDailyJobs = fetchDailyJobs;
module.exports = router;