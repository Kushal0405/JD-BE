const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, select: false },
    googleId: { type: String, sparse: true },

    // job preference profile
    targetRoles: [{ type: String }],           // ["Frontend Developer", "React Engineer"]
    targetLocations: [{ type: String }],       // ["Hyderabad", "Remote"]
    expectedSalaryMin: { type: Number },
    expectedSalaryMax: { type: Number },
    experienceYears: { type: Number },
    noticePeriod: { type: String },            // "immediate", "30 days", etc.

    skills: [{ type: String }],               // synced from default resume on upload

    defaultResume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },

    // notification prefs
    emailReminders: { type: Boolean, default: true },
    reminderFrequency: { type: String, enum: ['daily', 'weekly', 'off'], default: 'weekly' },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);