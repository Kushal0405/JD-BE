const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    // --- existing fields you likely have ---
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    // --- extended for job application platform ---
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    companyName: { type: String, trim: true }, // denormalized for fast display

    location: { type: String, default: 'Remote' },
    locationType: { type: String, enum: ['remote', 'hybrid', 'onsite'], default: 'remote' },

    salaryMin: { type: Number },
    salaryMax: { type: Number },
    currency: { type: String, default: 'INR' },

    experienceMin: { type: Number, default: 0 },
    experienceMax: { type: Number, default: 10 },

    skills: [{ type: String, trim: true }],          // ["React", "TypeScript", ...]
    tags: [{ type: String, trim: true }],             // ["frontend", "startup", ...]

    externalId: { type: String, sparse: true },        // external job ID (from JSearch etc.)
    jdUrl: { type: String },                          // original job posting URL
    source: { type: String, enum: ['manual', 'linkedin', 'naukri', 'indeed', 'company_site', 'jsearch'], default: 'manual' },

    isActive: { type: Boolean, default: true },
    postedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },

    // AI-generated match summary (populated when resume is matched)
    matchScore: { type: Number, min: 0, max: 100 },
    matchSummary: { type: String },
    status: {
      type: String,
      enum: ["Applied", "Interview", "Rejected", "Offer"],
      default: "Applied",
    },
  },
  { timestamps: true }
);

jobSchema.index({ skills: 1 });
jobSchema.index({ isActive: 1, postedAt: -1 });
jobSchema.index({ companyName: 'text', title: 'text', skills: 'text' });

module.exports = mongoose.model('Job', jobSchema);