require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '10mb' }));  // 10mb for base64 resume payloads

// Ensure DB is connected on every request (serverless-safe via connection caching)
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/jobs', require('./routes//jobRoutes'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/ats-score', require('./routes/atsScore'));

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

// Vercel Cron endpoint — called by vercel.json schedule (daily 00:00 UTC)
// Secured with CRON_SECRET env variable set in Vercel dashboard
app.get('/api/cron/scrape', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const JobScraper = require('./services/JobScraper');
    const total = await JobScraper.run();
    res.json({ ok: true, scraped: total });
  } catch (err) {
    console.error('[Cron] scrape failed:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// Vercel Cron endpoint — daily fetch of JSearch jobs (3:00 UTC = 8:30 AM IST)
app.get('/api/cron/fetch-jobs', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const jobRoutes = require('./routes/jobRoutes');
    const { fetchDailyJobs } = jobRoutes;
    const result = await fetchDailyJobs({ query: 'React Developer', location: 'Hyderabad, India' });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Cron] fetch-jobs failed:', err.message);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// Start server only when running locally (not on Vercel)
if (process.env.VERCEL !== '1') {
  const { startCronJobs } = require('./cron/midnight');
  const PORT = process.env.PORT || 5000;
  const mongoose = require('mongoose');
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log('MongoDB connected');
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        startCronJobs();
      });
    })
    .catch((err) => {
      console.error('MongoDB connection failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;