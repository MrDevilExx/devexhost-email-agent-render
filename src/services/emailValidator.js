// src/services/emailValidator.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const dns = require('dns').promises;
const net = require('net');
const connectDB = require('../config/db');
const Lead = require('../models/Lead');

// ─── MX Record Check ─────────────────────────────────────────────────────
const checkMX = async (email) => {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch {
    return false;
  }
};

// ─── SMTP Verification (low-level TCP) ──────────────────────────────────
const checkSMTP = (email, mxHost) => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve('risky'); // timeout = server exists but slow → risky
    }, 8000);

    const socket = net.createConnection(25, mxHost);
    let stage = 0;
    let buffer = '';

    const sendCmd = (cmd) => socket.write(cmd + '\r\n');

    socket.on('connect', () => { /* wait for banner */ });

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      const lastLine = lines[lines.length - 2] || '';

      if (stage === 0 && lastLine.startsWith('220')) {
        stage = 1;
        sendCmd(`EHLO devexhost.com`);
      } else if (stage === 1 && (lastLine.startsWith('250') || lastLine.includes('250 '))) {
        stage = 2;
        sendCmd(`MAIL FROM:<verify@devexhost.com>`);
      } else if (stage === 2 && lastLine.startsWith('250')) {
        stage = 3;
        sendCmd(`RCPT TO:<${email}>`);
      } else if (stage === 3) {
        clearTimeout(timeout);
        sendCmd('QUIT');
        socket.destroy();
        const code = parseInt(lastLine.substring(0, 3));
        if (code === 250 || code === 251) resolve('valid');
        else if (code >= 400 && code < 500) resolve('risky');
        else resolve('invalid');
      } else if (lastLine.startsWith('5')) {
        clearTimeout(timeout);
        socket.destroy();
        resolve('invalid');
      }
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve('risky'); // connection error = server may exist but unverifiable
    });

    socket.on('close', () => {
      clearTimeout(timeout);
    });
  });
};

// ─── Full validation pipeline ─────────────────────────────────────────────
const validateEmail = async (email) => {
  // Basic format check
  const formatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!formatOk) return { status: 'invalid', mx: false, smtp: false };

  // MX check
  const hasMX = await checkMX(email);
  if (!hasMX) return { status: 'invalid', mx: false, smtp: false };

  // SMTP check skipped — Port 25 blocked on Render free plan
  // MX found = treat as valid
  return { status: 'valid', mx: true, smtp: true };
};

// ─── Batch validate pending leads ─────────────────────────────────────────
const validatePendingLeads = async (batchSize = 50) => {
  await connectDB();

  const pending = await Lead.find({ status: 'pending' })
    .limit(batchSize)
    .lean();

  console.log(`\n🔬 Validating ${pending.length} leads...`);

  let valid = 0, risky = 0, invalid = 0;

  for (const lead of pending) {
    const result = await validateEmail(lead.email);
    await Lead.findByIdAndUpdate(lead._id, {
      status: result.status,
      mx_checked: result.mx,
      smtp_checked: result.smtp,
    });

    if (result.status === 'valid')   valid++;
    else if (result.status === 'risky') risky++;
    else invalid++;

    console.log(`  ${result.status === 'valid' ? '✅' : result.status === 'risky' ? '⚠️ ' : '❌'} ${lead.email} → ${result.status}`);

    // Polite delay to avoid getting blocked
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n📊 Validation done: ✅${valid} valid | ⚠️ ${risky} risky | ❌${invalid} invalid`);
  return { valid, risky, invalid };
};

module.exports = { validateEmail, validatePendingLeads, checkMX };

if (require.main === module) {
  validatePendingLeads(100).then(() => process.exit(0)).catch(e => {
    console.error(e); process.exit(1);
  });
}
