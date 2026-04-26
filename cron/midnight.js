const cron = require('node-cron');
const JobScraper = require('../services/JobScraper');

function startCronJobs() {
  // Runs every day at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Midnight job fetch triggered:', new Date().toISOString());
    await JobScraper.run();
  }, {
    timezone: 'Asia/Kolkata', // IST midnight
  });

  console.log('[Cron] Midnight job scraper scheduled (IST 00:00)');
}

module.exports = { startCronJobs };