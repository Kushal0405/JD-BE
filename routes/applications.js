const express = require('express');
const Application = require('../models/Application');
const Job = require('../models/Job');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/applications — list applications for the authenticated user
// Optional query: ?stage=applied&page=1&limit=20
router.get('/', auth, async (req, res) => {
  try {
    const { stage, page = 1, limit = 20 } = req.query;
    const userFilter = { user: req.user._id };
    const filter = { ...userFilter };
    if (stage) filter.stage = stage;

    const [applications, total, stageCounts] = await Promise.all([
      Application.find(filter)
        .populate('job', 'title companyName location')
        .populate('resume', 'label currentRole skills')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Application.countDocuments(filter),
      // Count per stage for the current user (independent of stage filter)
      Application.aggregate([
        { $match: { user: req.user._id } },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
      ]),
    ]);

    const summary = stageCounts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    res.json({ applications, total, page: Number(page), pages: Math.ceil(total / limit), summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/applications — create an application for the authenticated user
router.post('/', auth, async (req, res) => {
  try {
    // Accept both `job` and `jobId` field names from clients
    const body = { ...req.body };
    if (body.jobId && !body.job) { body.job = body.jobId; delete body.jobId; }
    const payload = { ...body, user: req.user._id };

    // If job id provided, ensure job exists
    if (payload.job) {
      const job = await Job.findById(payload.job).select('_id');
      if (!job) return res.status(404).json({ message: 'Job not found' });
    }

    const application = await Application.create(payload);
    res.status(201).json({ application });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Application for this job already exists' });
    res.status(400).json({ message: err.message });
  }
});

// GET /api/applications/:id — get single application (owner only)
router.get('/:id', auth, async (req, res) => {
  try {
    const app = await Application.findById(req.params.id)
      .populate('job', 'title companyName location salaryMin salaryMax skills')
      .populate('resume', 'label currentRole skills');
    if (!app) return res.status(404).json({ message: 'Application not found' });
    if (String(app.user) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    res.json({ application: app });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/applications/:id/stage — change stage (owner only)
router.patch('/:id/stage', auth, async (req, res) => {
  try {
    const { stage } = req.body;
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: 'Application not found' });
    if (String(app.user) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });

    app.stage = stage;
    app.activity = app.activity || [];
    app.activity.push({ stage, note: req.body.note || '' });
    await app.save();
    res.json({ application: app });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/applications/:id — update application fields (owner only)
router.patch('/:id', auth, async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: 'Application not found' });
    if (String(app.user) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });

    const updatable = ['coverLetter', 'notes', 'recruiterName', 'recruiterEmail', 'followUpAt', 'resume'];
    updatable.forEach((k) => {
      if (req.body[k] !== undefined) app[k] = req.body[k];
    });

    await app.save();
    res.json({ application: app });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/applications/:id — delete application (owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: 'Application not found' });
    if (String(app.user) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    await app.deleteOne();
    res.json({ message: 'Application deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;