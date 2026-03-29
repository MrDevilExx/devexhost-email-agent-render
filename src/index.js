// src/index.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('./config/db');
const { seedCampaigns } = require('./services/campaignManager');
const telegramNotifier = require('./services/telegramNotifier');

console.log(`
╔══════════════════════════════════════════════╗
║   DevExHost AI Email Marketing Agent v1.0    ║
║   Powered by Grok AI + MongoDB + Node.js     ║
╚══════════════════════════════════════════════╝
`);

const startAll = async () => {
  // Connect DB first
  await connectDB();
  await seedCampaigns();

  // Start admin panel
  require('./admin/server');

  // Start scheduler
  require('./scheduler');

  await telegramNotifier.send('🚀 *DevExHost Email Agent is LIVE!*\nAdmin panel and scheduler started.');
};

startAll().catch(err => {
  console.error('💥 Fatal startup error:', err.message);
  process.exit(1);
});
