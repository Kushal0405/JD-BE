const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, default: 'My Resume' },  // "ATS version", "Branded PDF" etc.

    // file storage — store as base64 string or a cloud URL (S3 / Cloudinary)
    fileUrl: { type: String },                        // cloud storage URL
    fileBase64: { type: String, select: false },      // local fallback (don't return by default)
    fileType: { type: String, enum: ['pdf', 'docx'], default: 'pdf' },

    // AI-parsed fields (auto-populated by ResumeService)
    parsedText: { type: String, select: false },      // raw text, excluded from default queries
    skills: [{ type: String }],                       // ["React", "TypeScript", ...]
    experienceYears: { type: Number },
    currentRole: { type: String },
    summary: { type: String },

    isDefault: { type: Boolean, default: false },     // which resume is used for matching by default
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Ensure only one resume is default per user
resumeSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('Resume', resumeSchema);