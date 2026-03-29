// src/models/Lead.js
const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  website: { type: String, default: '' },
  business_name: { type: String, default: 'Unknown Business' },
  niche: { type: String, default: 'general' },           // e.g. ecommerce, agency, startup
  source: { type: String, default: 'web' },              // 'web' | 'github'
  location: { type: String, default: 'Bangladesh' },

  // Validation
  status: {
    type: String,
    enum: ['valid', 'risky', 'invalid', 'pending'],
    default: 'pending',
  },
  mx_checked: { type: Boolean, default: false },
  smtp_checked: { type: Boolean, default: false },

  // Sending tracking
  emails_sent: { type: Number, default: 0 },
  followups_sent: { type: Number, default: 0 },
  last_sent_at: { type: Date, default: null },
  last_campaign: { type: String, default: null },
  opened: { type: Boolean, default: false },
  replied: { type: Boolean, default: false },
  unsubscribed: { type: Boolean, default: false },

  // A/B test
  ab_variant: { type: String, default: 'A' },

  date_added: { type: Date, default: Date.now },
}, { timestamps: true });

leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ date_added: -1 });
leadSchema.index({ niche: 1 });

module.exports = mongoose.model('Lead', leadSchema);
