const cron = require("node-cron");
const Job = require("../models/Job");

const startCron = () => {
  cron.schedule("0 * * * *", async () => {
    console.log("Running follow-up check...");

    const now = new Date();

    const jobs = await Job.find({
      followUpDate: { $lte: now },
      status: "Applied",
    });

    jobs.forEach((job) => {
      console.log(`Follow up with ${job.company} for ${job.role}`);
    });
  });
};

module.exports = startCron;