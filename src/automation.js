// src/automation.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('./config/db');
const { runDailyHunt }          = require('./services/emailHunter');
const { validatePendingLeads }  = require('./services/emailValidator');
const { selectCampaignForToday, seedCampaigns } = require('./services/campaignManager');
const { runDailySend }          = require('./services/emailSender');
const telegramNotifier          = require('./services/telegramNotifier');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const runDailyAutomation = async () => {
  const startTime = Date.now();
  console.log('\n' + '═'.repeat(60));
  console.log('🤖 DevExHost Email Agent — Daily Automation Started');
  console.log('📅 Date:', new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' }));
  console.log('═'.repeat(60) + '\n');

  await connectDB();
  await seedCampaigns();

  await telegramNotifier.send('🤖 *DevExHost Agent Started*\nDaily automation beginning...');

  const report = {
    hunt: null,
    validate: null,
    campaign: null,
    send: null,
    errors: [],
  };

  // ── Step 1: Collect new emails ─────────────────────────────────────────
  console.log('📌 STEP 1: Email Hunting');
  try {
    report.hunt = await runDailyHunt();
    console.log(`   ✅ Hunt complete: ${report.hunt.newCount} new leads`);
  } catch (err) {
    console.error('   ❌ Hunt failed:', err.message);
    report.errors.push(`Hunt: ${err.message}`);
  }

  await sleep(3000);

  // ── Step 2 & 3: Validate emails ────────────────────────────────────────
  console.log('\n📌 STEP 2-3: Email Validation');
  try {
    report.validate = await validatePendingLeads(100);
    console.log(`   ✅ Validation: ${report.validate.valid} valid | ${report.validate.risky} risky | ${report.validate.invalid} invalid`);
  } catch (err) {
    console.error('   ❌ Validation failed:', err.message);
    report.errors.push(`Validation: ${err.message}`);
  }

  await sleep(2000);

  // ── Step 4: Select campaign ────────────────────────────────────────────
  console.log('\n📌 STEP 4: Campaign Selection');
  try {
    const campaign = await selectCampaignForToday('general');
    report.campaign = campaign?.type || 'free_domain';
    console.log(`   ✅ Today's campaign: ${campaign?.name || report.campaign}`);
  } catch (err) {
    report.campaign = 'free_domain';
    console.warn('   ⚠️  Campaign select failed, using default:', err.message);
  }

  await sleep(1000);

  // ── Step 5: Generate & Send emails ────────────────────────────────────
  console.log('\n📌 STEP 5: Sending Campaign Emails');
  try {
    report.send = await runDailySend(report.campaign);
    console.log(`   ✅ Sent: ${report.send.sent} | Failed: ${report.send.failed}`);
  } catch (err) {
    console.error('   ❌ Send failed:', err.message);
    report.errors.push(`Send: ${err.message}`);
  }

  // ── Final report ───────────────────────────────────────────────────────
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const summaryMsg = `
✅ *Daily Automation Complete*
━━━━━━━━━━━━━━━━━━━━
📧 New Leads: ${report.hunt?.newCount || 0}
🔬 Validated: ${report.validate?.valid || 0} valid
🎯 Campaign: ${report.campaign}
📤 Emails Sent: ${report.send?.sent || 0}
❌ Errors: ${report.errors.length}
⏱  Duration: ${elapsed}s
━━━━━━━━━━━━━━━━━━━━
`;

  console.log('\n' + summaryMsg.replace(/\*/g, '').replace(/━/g, '─'));
  await telegramNotifier.send(summaryMsg);

  return report;
};

module.exports = { runDailyAutomation };

if (require.main === module) {
  runDailyAutomation().then(() => process.exit(0)).catch(e => {
    console.error('💥 Automation crashed:', e);
    process.exit(1);
  });
}
