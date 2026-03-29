// src/models/Campaign.js
const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['free_domain', 'free_hosting', 'vps_speed', 'reseller', 'discount'],
    required: true,
  },
  target_niche: [String],                 // ['ecommerce','agency','startup','general']
  subject_variants: [String],             // A/B subject lines
  cta_variants: [String],                 // ['START NOW','GET FREE DOMAIN','TRY NOW','CLAIM OFFER']
  active: { type: Boolean, default: true },
  priority: { type: Number, default: 1 },
  last_used: { type: Date, default: null },
}, { timestamps: true });

// -----------------------------------------------
// src/models/EmailLog.js
const emailLogSchema = new mongoose.Schema({
  lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  email: { type: String, required: true },
  campaign: { type: String, required: true },
  subject: { type: String, required: true },
  body_preview: { type: String },         // first 200 chars
  ab_variant: { type: String, default: 'A' },
  cta_text: { type: String, default: 'START NOW' },
  status: {
    type: String,
    enum: ['sent', 'failed', 'bounced', 'opened', 'clicked'],
    default: 'sent',
  },
  opened_at: { type: Date, default: null },
  tracking_id: { type: String, unique: true },
  error_message: { type: String, default: null },
  is_followup: { type: Boolean, default: false },
  followup_number: { type: Number, default: 0 },
  sent_at: { type: Date, default: Date.now },
}, { timestamps: true });

// -----------------------------------------------
// src/models/Unsubscribe.js
const unsubscribeSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  reason: { type: String, default: 'user_request' },
  unsubscribed_at: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = {
  Campaign: mongoose.model('Campaign', campaignSchema),
  EmailLog: mongoose.model('EmailLog', emailLogSchema),
  Unsubscribe: mongoose.model('Unsubscribe', unsubscribeSchema),
};
