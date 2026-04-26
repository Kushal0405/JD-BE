const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    website: { type: String },
    linkedinUrl: { type: String },
    glassdoorUrl: { type: String },
    careersUrl: { type: String },
    industry: { type: String },
    size: { type: String, enum: ['1-10', '11-50', '51-200', '201-500', '500-1000', '1000+'] },
    location: { type: String },
    isTargeted: { type: Boolean, default: false },
    targetedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    notes: { type: String },
    logoUrl: { type: String },
    techStack: [{ type: String }],
  },
  { timestamps: true }
);

companySchema.index({ name: 'text' });

module.exports = mongoose.model('Company', companySchema);
