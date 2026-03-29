// src/scheduler.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const cron = require('node-cron');
const { runDailyAutomation } = require('./automation');
const telegramNotifier = require('./services/telegramNotifier');

console.log('⏰ DevExHost Email Agent — Scheduler Starting...');
console.log('🕕 Runs daily at 9:00 AM Bangladesh Time (BST = UTC+6)');

// ─── Daily automation at 9:00 AM BST (3:00 AM UTC) ───────────────────────
cron.schedule('0 3 * * *', async () => {
  console.log('\n⏰ Cron triggered — Starting daily automation...');
  try {
    await runDailyAutomation();
  } catch (err) {
    console.error('💥 Scheduler error:', err.message);
    await telegramNotifier.send(`💥 *Scheduler Error*\n${err.message}`);
  }
}, {
  scheduled: true,
  timezone: 'UTC',
});

// ─── Follow-up check at 3:00 PM BST (9:00 AM UTC) ────────────────────────
cron.schedule('0 9 * * *', async () => {
  console.log('\n🔁 Follow-up check triggered...');
  try {
    const { runDailySend } = require('./services/emailSender');
    const { selectCampaignForToday } = require('./services/campaignManager');
    const connectDB = require('./config/db');
    await connectDB();
    const campaign = await selectCampaignForToday();
    const campaignType = campaign?.type || 'free_domain';
    await runDailySend(campaignType);
  } catch (err) {
    console.error('💥 Follow-up error:', err.message);
  }
}, {
  scheduled: true,
  timezone: 'UTC',
});

// ─── Health check every hour ──────────────────────────────────────────────
cron.schedule('0 * * * *', () => {
  console.log(`✅ Scheduler healthy — ${new Date().toISOString()}`);
});

console.log('✅ Scheduler is running. Press Ctrl+C to stop.\n');

// Graceful shutdown
process.on('SIGINT',  () => { console.log('\n👋 Scheduler stopped.'); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n👋 Scheduler stopped.'); process.exit(0); });
