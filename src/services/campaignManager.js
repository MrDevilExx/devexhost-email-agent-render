// src/services/campaignManager.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const connectDB = require('../config/db');
const { Campaign } = require('../models/Models');

// ─── Default campaigns seed data ─────────────────────────────────────────
const DEFAULT_CAMPAIGNS = [
  {
    name: 'Free Domain Campaign',
    type: 'free_domain',
    target_niche: ['general', 'ecommerce', 'agency', 'ngo', 'legal'],
    subject_variants: [
      '🎁 Free .com.bd Domain — Limited Time!',
      'Your free domain is ready, {{name}}!',
      'Claim a FREE domain for your Bangladesh business',
    ],
    cta_variants: ['GET FREE DOMAIN', 'CLAIM NOW', 'START NOW'],
    active: true,
    priority: 1,
  },
  {
    name: 'Free Hosting Trial',
    type: 'free_hosting',
    target_niche: ['general', 'tech_startup', 'education', 'healthcare'],
    subject_variants: [
      '30-Day FREE Hosting Trial — No Card Needed!',
      'Launch your website free for a month',
      'Try DevExHost FREE — zero risk!',
    ],
    cta_variants: ['TRY NOW', 'START FREE', 'CLAIM OFFER'],
    active: true,
    priority: 2,
  },
  {
    name: 'VPS Speed Campaign',
    type: 'vps_speed',
    target_niche: ['tech_startup', 'ecommerce', 'agency'],
    subject_variants: [
      '⚡ VPS Hosting that actually flies in Bangladesh',
      'Is your site slow? Fix it with VPS at ৳999/mo',
      '10x faster hosting — upgrade now',
    ],
    cta_variants: ['UPGRADE NOW', 'GET VPS', 'START NOW'],
    active: true,
    priority: 3,
  },
  {
    name: 'Reseller Business Offer',
    type: 'reseller',
    target_niche: ['agency', 'tech_startup', 'general'],
    subject_variants: [
      'Build your own hosting business in Bangladesh',
      'Earn monthly income reselling DevExHost!',
      'White-label hosting reseller opportunity',
    ],
    cta_variants: ['BECOME A RESELLER', 'START NOW', 'LEARN MORE'],
    active: true,
    priority: 4,
  },
  {
    name: 'Mega Discount Campaign',
    type: 'discount',
    target_niche: ['general', 'ecommerce', 'education', 'food', 'travel'],
    subject_variants: [
      '🔥 50% OFF — This week only!',
      '⏳ Half-price hosting expires soon!',
      'Special deal: 50% discount for Bangladesh businesses',
    ],
    cta_variants: ['CLAIM DISCOUNT', 'GET 50% OFF', 'START NOW'],
    active: true,
    priority: 5,
  },
];

// ─── Seed campaigns if not present ───────────────────────────────────────
const seedCampaigns = async () => {
  for (const c of DEFAULT_CAMPAIGNS) {
    await Campaign.findOneAndUpdate(
      { type: c.type },
      { $setOnInsert: c },
      { upsert: true, new: false }
    );
  }
  console.log('✅ Campaigns seeded');
};

// ─── Rotation logic: pick campaign that hasn't run recently ───────────────
const selectCampaignForToday = async (niche = 'general') => {
  await connectDB();

  // Try niche-matched first
  let campaign = await Campaign.findOne({
    active: true,
    target_niche: niche,
    $or: [
      { last_used: null },
      { last_used: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    ],
  }).sort({ priority: 1, last_used: 1 });

  // Fallback: any active campaign
  if (!campaign) {
    campaign = await Campaign.findOne({ active: true })
      .sort({ last_used: 1 });
  }

  if (campaign) {
    await Campaign.findByIdAndUpdate(campaign._id, { last_used: new Date() });
  }

  return campaign;
};

// ─── Get matching campaign for a specific niche ───────────────────────────
const getCampaignForNiche = async (niche) => {
  const campaign = await Campaign.findOne({
    active: true,
    $or: [
      { target_niche: niche },
      { target_niche: 'general' },
    ],
  }).sort({ priority: 1 });

  return campaign || { type: 'free_domain', name: 'Default' };
};

module.exports = { seedCampaigns, selectCampaignForToday, getCampaignForNiche, DEFAULT_CAMPAIGNS };

if (require.main === module) {
  connectDB().then(async () => {
    await seedCampaigns();
    const today = await selectCampaignForToday();
    console.log('Today\'s Campaign:', today);
    process.exit(0);
  });
}
