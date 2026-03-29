// src/services/telegramNotifier.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios = require('axios');

const send = async (message) => {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return; // silently skip if not configured

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id:    chatId,
      text:       message,
      parse_mode: 'Markdown',
    }, { timeout: 8000 });
  } catch (err) {
    console.warn('⚠️  Telegram notification failed:', err.message);
  }
};

const sendNewLeadsAlert = async (count, source = 'daily hunt') => {
  await send(`🆕 *New Leads Collected*\n📧 Count: ${count}\n📍 Source: ${source}\n🕐 Time: ${new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })}`);
};

const sendCampaignReport = async ({ campaign, sent, failed }) => {
  await send(`📊 *Daily Campaign Report*\n🎯 Campaign: ${campaign}\n✅ Sent: ${sent}\n❌ Failed: ${failed}\n📅 Date: ${new Date().toLocaleDateString('en-BD')}`);
};

module.exports = { send, sendNewLeadsAlert, sendCampaignReport };
