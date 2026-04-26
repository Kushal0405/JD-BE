const express = require('express');
const Company = require('../models/Company');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/companies
router.get('/', auth, async (req, res) => {
  try {
    const { targeted, q } = req.query;
    const filter = {};
    if (targeted === 'true') filter.targetedBy = req.user._id;
    if (q) filter.$text = { $search: q };

    const companies = await Company.find(filter).sort({ name: 1 });
    res.json({ companies });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/companies/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json({ company });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/companies
router.post('/', auth, async (req, res) => {
  try {
    const company = await Company.create({
      ...req.body,
      targetedBy: [req.user._id],
      isTargeted: true,
    });
    res.status(201).json({ company });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/companies/:id/target — toggle target
router.patch('/:id/target', auth, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const isTargeted = company.targetedBy.includes(req.user._id);
    if (isTargeted) {
      company.targetedBy.pull(req.user._id);
    } else {
      company.targetedBy.push(req.user._id);
    }
    await company.save();
    res.json({ company, targeted: !isTargeted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/companies/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.json({ company });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/companies/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Company.findByIdAndDelete(req.params.id);
    res.json({ message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;