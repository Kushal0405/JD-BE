const express = require('express');
const Job = require('../models/Job');
const auth = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;