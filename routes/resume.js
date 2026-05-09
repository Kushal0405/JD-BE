const express = require('express');
const multer = require('multer');
const Resume = require('../models/Resume');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ResumeService = require('../services/ResumeService');

const router = express.Router();

// In-memory multer (swap to S3 via multer-s3 when ready)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// GET /api/resume/my-text — return parsedText of user's default resume (for ATS scoring)
router.get('/my-text', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('defaultResume');
    let resume = null;
    if (user?.defaultResume) {
      resume = await Resume.findById(user.defaultResume).select('+parsedText');
    }
    // Fallback: find any resume with isDefault:true for this user
    if (!resume) {
      resume = await Resume.findOne({ user: req.user._id, isDefault: true }).select('+parsedText');
      // Sync the user's defaultResume field to fix the inconsistency
      if (resume) {
        await User.findByIdAndUpdate(req.user._id, { defaultResume: resume._id });
      }
    }
    // Last resort: use the most recent resume
    if (!resume) {
      resume = await Resume.findOne({ user: req.user._id }).sort({ createdAt: -1 }).select('+parsedText');
      if (resume) {
        resume.isDefault = true;
        await resume.save();
        await User.findByIdAndUpdate(req.user._id, { defaultResume: resume._id });
      }
    }
    res.json({ text: resume?.parsedText || '' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/resume — list user's resumes
router.get('/', auth, async (req, res) => {
  try {
    const resumes = await Resume.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ resumes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/resume/upload — upload + auto-parse
router.post('/upload', auth, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded (pdf or docx only, max 5MB)' });

    const fileType = req.file.mimetype.includes('pdf') ? 'pdf' : 'docx';
    const base64 = req.file.buffer.toString('base64');

    // Parse skills using AI
    const parsed = await ResumeService.parse(base64, fileType);

    const isFirst = (await Resume.countDocuments({ user: req.user._id })) === 0;
    const resume = await Resume.create({
      user: req.user._id,
      label: req.body.label || 'My Resume',
      fileBase64: base64,
      fileType,
      isDefault: isFirst,
      skills: parsed.skills,
      experienceYears: parsed.experienceYears,
      currentRole: parsed.currentRole,
      summary: parsed.summary,
      parsedText: parsed.rawText,
    });

    // Sync skills to user profile
    if (isFirst) {
      await User.findByIdAndUpdate(req.user._id, {
        skills: parsed.skills,
        defaultResume: resume._id,
      });
    }

    res.status(201).json({ resume: { ...resume.toObject(), fileBase64: undefined } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/resume/:id/match/:jobId — score resume against a specific job
router.post('/:id/match/:jobId', auth, async (req, res) => {
  try {
    const [resume, Job] = await Promise.all([
      Resume.findOne({ _id: req.params.id, user: req.user._id }).select('+parsedText'),
      require('../models/Job').findById(req.params.jobId),
    ]);
    if (!resume) return res.status(404).json({ message: 'Resume not found' });
    if (!Job) return res.status(404).json({ message: 'Job not found' });

    const match = await ResumeService.matchToJob(resume, Job);
    res.json({ match });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/resume/:id/set-default
router.patch('/:id/set-default', auth, async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id });
    if (!resume) return res.status(404).json({ message: 'Resume not found' });
    resume.isDefault = true;
    await resume.save();
    await User.findByIdAndUpdate(req.user._id, { defaultResume: resume._id });
    res.json({ resume });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/resume/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Resume.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Resume deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;