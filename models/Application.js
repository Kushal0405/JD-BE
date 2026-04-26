const mongoose = require('mongoose');

const STAGES = ['saved', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'];

const activitySchema = new mongoose.Schema(
  {
    stage: { type: String, enum: STAGES },
    note: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User',  },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job',  },
    resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },

    stage: { type: String, enum: STAGES, default: 'saved' },

    appliedAt: { type: Date },
    followUpAt: { type: Date },           // reminder date

    coverLetter: { type: String },
    referralContact: { type: String },    // name of referral if any

    // per-application custom notes
    notes: { type: String },

    // recruiter / HR contact
    recruiterName: { type: String },
    recruiterEmail: { type: String },

    // auto-populated from Job at apply time (snapshot so job edits don't affect history)
    jobSnapshot: {
      title: String,
      companyName: String,
      location: String,
      salaryMin: Number,
      salaryMax: Number,
    },

    // activity log — every stage change appended here
    activity: [activitySchema],

    // AI match score at time of application
    matchScore: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true }
);

applicationSchema.index({ user: 1, stage: 1 });
applicationSchema.index({ user: 1, job: 1 }, { unique: true }); // one application per job per user

// Auto-snapshot job details on save
applicationSchema.pre('save', async function (next) {
  if (this.isNew && this.job) {
    const Job = mongoose.model('Job');
    const job = await Job.findById(this.job).select('title companyName location salaryMin salaryMax');
    if (job) {
      this.jobSnapshot = {
        title: job.title,
        companyName: job.companyName,
        location: job.location,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
      };
    }
  }
  next();
});

module.exports = mongoose.model('Application', applicationSchema);
module.exports.STAGES = STAGES;