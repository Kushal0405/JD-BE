const mongoose = require('mongoose');

const discoveredJobSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    company: { type: String, default: '' },
    location: { type: String, default: '' },
    description: { type: String, default: '' },
    applyLink: { type: String, default: '' },
    source: { type: String, default: 'jsearch' },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model('DiscoveredJob', discoveredJobSchema);
