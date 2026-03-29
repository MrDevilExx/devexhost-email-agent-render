// src/services/emailSender.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const connectDB = require('../config/db');
const Lead = require('../models/Lead');
const { EmailLog, Unsubscribe } = require('../models/Models');
const { generateEmailContent, CTA_VARIANTS, pick } = require('./grokAI');
const { buildHtmlEmail, buildPlainTextEmail } = require('./emailTemplate');
const telegramNotifier = require('./telegramNotifier');

// ─── SMTP Transporter ─────────────────────────────────────────────────────
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST  || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool: true,
    maxConnections: 5,
    rateDelta: 1000,
    rateLimit: 5, // max 5 emails/sec
  });
  return transporter;
};

// ─── Check if lead is eligible to receive email ──────────────────────────
const isEligible = async (lead) => {
  if (lead.unsubscribed) return { ok: false, reason: 'unsubscribed' };
  if (lead.status === 'invalid') return { ok: false, reason: 'invalid_email' };
  if (lead.followups_sent >= parseInt(process.env.MAX_FOLLOWUPS || 2) && lead.emails_sent > 0) {
    return { ok: false, reason: 'max_followups_reached' };
  }
  if (lead.replied) return { ok: false, reason: 'replied' };

  // Time gap check
  const minDays = parseInt(process.env.MIN_DAYS_BETWEEN_EMAILS || 5);
  if (lead.last_sent_at) {
    const daysSince = (Date.now() - new Date(lead.last_sent_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < minDays) return { ok: false, reason: `cooldown (${Math.ceil(minDays - daysSince)}d left)` };
  }

  // Check unsub list
  const unsub = await Unsubscribe.findOne({ email: lead.email });
  if (unsub) {
    await Lead.findByIdAndUpdate(lead._id, { unsubscribed: true });
    return { ok: false, reason: 'unsubscribed' };
  }

  return { ok: true };
};

// ─── Send one email ───────────────────────────────────────────────────────
const sendEmail = async ({ lead, campaignType, isFollowup = false }) => {
  const eligibility = await isEligible(lead);
  if (!eligibility.ok) {
    return { success: false, reason: eligibility.reason };
  }

  const abVariant = lead.ab_variant || (Math.random() > 0.5 ? 'A' : 'B');
  const ctaText   = pick(CTA_VARIANTS);
  const trackingId = uuidv4();

  const baseUrl = process.env.BASE_URL || 'https://devexhost.com';
  const unsubLink = `${process.env.TRACKING_URL || baseUrl}/unsubscribe/${lead.email}`;
  const ctaLink   = baseUrl;

  let subject, body;
  try {
    const generated = await generateEmailContent({
      businessName: lead.business_name,
      businessType: lead.niche,
      campaignType,
      ctaText,
      abVariant,
    });
    subject = generated.subject;
    body    = generated.body;

    // Follow-up: prepend context
    if (isFollowup) {
      subject = `Re: ${subject}`;
      body = `Just a quick follow-up on my previous message...\n\n${body}`;
    }
  } catch (err) {
    return { success: false, reason: `Grok API error: ${err.message}` };
  }

  const htmlEmail = buildHtmlEmail({
    businessName: lead.business_name,
    subject,
    bodyText: body,
    ctaText,
    ctaLink,
    trackingId,
    campaignType,
    unsubLink,
  });

  const plainText = buildPlainTextEmail({
    businessName: lead.business_name,
    bodyText: body,
    ctaText,
    ctaLink,
  });

  const mailOptions = {
    from: `"${process.env.SMTP_FROM_NAME || 'DevExHost Team'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
    to: lead.email,
    subject,
    text: plainText,
    html: htmlEmail,
    headers: {
      'X-Campaign': campaignType,
      'X-Tracking-ID': trackingId,
      'List-Unsubscribe': `<${unsubLink}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };

  try {
    await getTransporter().sendMail(mailOptions);

    // Update lead
    await Lead.findByIdAndUpdate(lead._id, {
      $inc: {
        emails_sent: 1,
        followups_sent: isFollowup ? 1 : 0,
      },
      last_sent_at: new Date(),
      last_campaign: campaignType,
      ab_variant: abVariant,
    });

    // Log
    await new EmailLog({
      lead_id:       lead._id,
      email:         lead.email,
      campaign:      campaignType,
      subject,
      body_preview:  body.substring(0, 200),
      ab_variant:    abVariant,
      cta_text:      ctaText,
      status:        'sent',
      tracking_id:   trackingId,
      is_followup:   isFollowup,
      followup_number: isFollowup ? lead.followups_sent + 1 : 0,
    }).save();

    return { success: true, email: lead.email, subject, trackingId };
  } catch (err) {
    await new EmailLog({
      lead_id:       lead._id,
      email:         lead.email,
      campaign:      campaignType,
      subject,
      body_preview:  body.substring(0, 200),
      ab_variant:    abVariant,
      cta_text:      ctaText,
      status:        'failed',
      tracking_id:   trackingId,
      error_message: err.message,
    }).save();
    return { success: false, reason: err.message };
  }
};

// ─── Daily batch send ─────────────────────────────────────────────────────
const runDailySend = async (campaignType = 'free_domain') => {
  await connectDB();

  const limit = parseInt(process.env.DAILY_SEND_LIMIT || 100);

  // Get valid leads not yet mailed today, or eligible for follow-up
  const minDays = parseInt(process.env.MIN_DAYS_BETWEEN_EMAILS || 5);
  const cutoffDate = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000);

  const leads = await Lead.find({
    status:        { $in: ['valid', 'risky'] },
    unsubscribed:  false,
    replied:       false,
    $or: [
      { last_sent_at: null },
      { last_sent_at: { $lt: cutoffDate } },
    ],
  })
  .sort({ emails_sent: 1, date_added: 1 })
  .limit(limit)
  .lean();

  console.log(`\n📤 Sending campaign "${campaignType}" to ${leads.length} leads...`);

  let sent = 0, failed = 0, skipped = 0;
  const results = [];

  for (const lead of leads) {
    const isFollowup = lead.emails_sent > 0;
    const result = await sendEmail({ lead, campaignType, isFollowup });

    if (result.success) {
      sent++;
      console.log(`  ✅ Sent to ${lead.email}`);
    } else if (result.reason && result.reason.includes('cooldown')) {
      skipped++;
    } else {
      failed++;
      console.log(`  ❌ Failed for ${lead.email}: ${result.reason}`);
    }

    results.push(result);

    // Delay between sends (avoid spam flags)
    await new Promise(r => setTimeout(r, 1500));
  }

  const summary = `📤 *Campaign: ${campaignType}*\n✅ Sent: ${sent}\n❌ Failed: ${failed}\n⏭  Skipped: ${skipped}`;
  console.log('\n' + summary.replace(/\*/g, ''));
  await telegramNotifier.send(summary);

  return { sent, failed, skipped, total: leads.length };
};

module.exports = { sendEmail, runDailySend };

if (require.main === module) {
  const campaign = process.argv[2] || 'free_domain';
  runDailySend(campaign).then(() => process.exit(0)).catch(e => {
    console.error(e); process.exit(1);
  });
}
