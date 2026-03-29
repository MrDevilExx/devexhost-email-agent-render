// src/admin/server.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const connectDB = require('../config/db');
const Lead      = require('../models/Lead');
const { EmailLog, Campaign, Unsubscribe } = require('../models/Models');

const app  = express();
const PORT = parseInt(process.env.PORT) || 3000;
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'devexhost2025';
const RENDER_URL  = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ═══════════════════════════════════════════════════════
// RENDER KEEP-ALIVE — ফ্রি plan sleep না করার জন্য
// প্রতি ১৪ মিনিটে নিজেকে ping করে জাগিয়ে রাখে
// ═══════════════════════════════════════════════════════
const startKeepAlive = () => {
  setInterval(async () => {
    try {
      await axios.get(`${RENDER_URL}/health`, { timeout: 5000 });
      console.log(`💓 Keep-alive: ${new Date().toLocaleTimeString('en-BD', { timeZone: 'Asia/Dhaka' })}`);
    } catch {}
  }, 14 * 60 * 1000);
};

// ─── Basic Auth ───────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const openPaths = ['/health', '/track/', '/unsubscribe/'];
  if (openPaths.some(p => req.path.startsWith(p))) return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="DevExHost Admin"');
    return res.status(401).send(`
      <html><body style="font-family:Arial;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;margin:0">
      <div style="text-align:center;color:#e2e8f0">
        <div style="font-size:28px;font-weight:900;margin-bottom:8px">DevEx<span style="color:#16a34a">Host</span></div>
        <p style="color:#94a3b8">Admin Panel — Please Login</p>
      </div></body></html>`);
  }
  const [user, pass] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="DevExHost Admin"');
  return res.status(401).send('Wrong credentials');
};
app.use(authMiddleware);

// ─── Health check (Render keep-alive ping endpoint) ───────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ─── Dashboard ────────────────────────────────────────────────────────────
app.get('/', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalLeads, validLeads, riskyLeads, pendingLeads,
      totalSent, sentToday, openedCount,
      campaigns, recentLogs, topNiches, unsubCount, todayHunt,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'valid' }),
      Lead.countDocuments({ status: 'risky' }),
      Lead.countDocuments({ status: 'pending' }),
      EmailLog.countDocuments({ status: 'sent' }),
      EmailLog.countDocuments({ status: 'sent', sent_at: { $gte: todayStart } }),
      EmailLog.countDocuments({ status: 'opened' }),
      Campaign.find({ active: true }).sort({ priority: 1 }),
      EmailLog.find().sort({ sent_at: -1 }).limit(15).lean(),
      Lead.aggregate([
        { $group: { _id: '$niche', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 6 },
      ]),
      Unsubscribe.countDocuments(),
      Lead.countDocuments({ date_added: { $gte: todayStart } }),
    ]);

    const openRate = totalSent > 0 ? (openedCount / totalSent * 100).toFixed(1) : '0.0';

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>DevExHost — Email Agent</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
  .nav{background:#1e293b;padding:14px 28px;display:flex;align-items:center;gap:12px;border-bottom:2px solid #16a34a;position:sticky;top:0;z-index:100}
  .logo{font-size:20px;font-weight:900}.logo span{color:#16a34a}
  .badge{background:#16a34a;color:#fff;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}
  .dot{width:7px;height:7px;background:#16a34a;border-radius:50%;display:inline-block;animation:blink 1.5s infinite}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
  .wrap{padding:24px 28px;max-width:1280px;margin:0 auto}
  h2{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px}
  .g6{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:24px}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
  @media(max-width:900px){.g6{grid-template-columns:repeat(3,1fr)}.g2{grid-template-columns:1fr}}
  @media(max-width:500px){.g6{grid-template-columns:repeat(2,1fr)}}
  .scard{background:#1e293b;border-radius:12px;padding:18px 20px;border:1px solid #334155}
  .snum{font-size:30px;font-weight:800;line-height:1;margin-bottom:5px}
  .slabel{font-size:11px;color:#64748b;font-weight:500;text-transform:uppercase;letter-spacing:.5px}
  .g{color:#16a34a}.b{color:#3b82f6}.y{color:#f59e0b}.p{color:#8b5cf6}.w{color:#f1f5f9}
  .card{background:#1e293b;border-radius:12px;border:1px solid #334155;overflow:hidden;margin-bottom:20px}
  .ch{padding:14px 20px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between}
  .cb{padding:18px 20px}
  .btn{padding:8px 16px;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;
       text-decoration:none;display:inline-flex;align-items:center;gap:5px;transition:.15s;white-space:nowrap}
  .btn:hover{opacity:.8}
  .bg{background:#16a34a;color:#fff}.bb{background:#2563eb;color:#fff}.bghost{background:#334155;color:#e2e8f0}
  .bsm{padding:5px 11px;font-size:11px}
  .acts{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}
  table{width:100%;border-collapse:collapse}
  th{padding:9px 14px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;background:#0f172a}
  td{padding:10px 14px;border-bottom:1px solid #0f172a;font-size:12px}
  tr:last-child td{border:none}
  tr:hover td{background:#ffffff08}
  .pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700}
  .pg{background:#14532d;color:#4ade80}.pb{background:#1e3a8a;color:#93c5fd}
  .py{background:#78350f;color:#fcd34d}.pr{background:#7f1d1d;color:#fca5a5}
  .pgray{background:#334155;color:#94a3b8}
  .bw{background:#0f172a;border-radius:6px;height:5px;margin-top:6px}
  .bbar{background:#16a34a;height:100%;border-radius:6px}
  .np{display:inline-block;background:#1e293b;border:1px solid #334155;padding:1px 8px;border-radius:10px;font-size:10px;color:#64748b;margin:1px}
  input[type=number]{background:#0f172a;border:1px solid #334155;color:#e2e8f0;padding:7px 11px;border-radius:8px;width:110px;font-size:13px}
  input[type=number]:focus{outline:none;border-color:#16a34a}
</style>
</head>
<body>

<nav class="nav">
  <div class="logo">DevEx<span>Host</span></div>
  <span class="badge">Email Agent</span>
  <span style="margin-left:auto;font-size:11px;color:#475569;display:flex;align-items:center;gap:8px">
    <span class="dot"></span> Live
    &nbsp;|&nbsp; ${new Date().toLocaleString('en-BD',{timeZone:'Asia/Dhaka',hour12:true,hour:'2-digit',minute:'2-digit'})} BST
    &nbsp;|&nbsp; Refresh: 60s
  </span>
</nav>

<div class="wrap">

  <!-- Stats -->
  <div class="g6" style="margin-top:22px">
    <div class="scard"><div class="snum w">${totalLeads.toLocaleString()}</div><div class="slabel">Total Leads</div></div>
    <div class="scard"><div class="snum g">${validLeads.toLocaleString()}</div><div class="slabel">Valid</div></div>
    <div class="scard"><div class="snum y">${pendingLeads.toLocaleString()}</div><div class="slabel">Pending</div></div>
    <div class="scard"><div class="snum p">${totalSent.toLocaleString()}</div><div class="slabel">Total Sent</div></div>
    <div class="scard"><div class="snum b">${sentToday}</div><div class="slabel">Sent Today</div></div>
    <div class="scard"><div class="snum g">${openRate}%</div><div class="slabel">Open Rate</div></div>
  </div>

  <!-- Quick Actions -->
  <div style="margin-bottom:22px">
    <h2>⚡ Quick Actions</h2>
    <div class="acts">
      <form method="POST" action="/api/run-automation"><button class="btn bg">🤖 Full Automation</button></form>
      <form method="POST" action="/api/run-hunt"><button class="btn bb">🔍 Hunt Emails</button></form>
      <form method="POST" action="/api/run-validate"><button class="btn bghost">🔬 Validate (${pendingLeads})</button></form>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <input id="test-email-input" type="email" placeholder="test@gmail.com" style="padding:8px 12px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#fff;font-size:13px;">
        <button onclick="sendTestEmail()" class="btn" style="background:#7c3aed;">📧 Send Test Email</button>
      </div>
      <div id="test-result" style="font-size:12px;color:#94a3b8;"></div>
      <script>
      async function sendTestEmail() {
        const email = document.getElementById('test-email-input').value;
        if (!email) { alert('Email দাও!'); return; }
        document.getElementById('test-result').textContent = '⏳ Sending...';
        const res = await fetch('/api/test-email', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email}) });
        const data = await res.json();
        document.getElementById('test-result').textContent = data.ok ? '✅ Sent! Subject: ' + data.subject : '❌ Error: ' + data.error;
      }
      </script>
      <a href="/api/leads/export" class="btn bghost">📥 Export CSV</a>
      <a href="/api/stats" class="btn bghost" target="_blank">📊 Stats JSON</a>
    </div>
  </div>

  <div class="g2">
    <!-- Campaigns -->
    <div class="card">
      <div class="ch"><h2 style="margin:0">🎯 Campaigns</h2><span style="font-size:11px;color:#475569">${campaigns.length} active</span></div>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Action</th></tr></thead>
        <tbody>
          ${campaigns.map(c => `<tr>
            <td style="font-weight:600">${c.name}</td>
            <td><span class="np">${c.type}</span></td>
            <td><form method="POST" action="/api/send-campaign">
              <input type="hidden" name="campaign" value="${c.type}">
              <button class="btn bg bsm">▶ Send</button>
            </form></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <!-- Niches -->
    <div class="card">
      <div class="ch"><h2 style="margin:0">🏷️ Lead Breakdown</h2><span style="font-size:11px;color:#475569">+${todayHunt} today</span></div>
      <div class="cb">
        ${topNiches.map(n => `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span style="text-transform:capitalize">${n._id}</span>
            <span class="g" style="font-weight:700">${n.count}</span>
          </div>
          <div class="bw"><div class="bbar" style="width:${Math.min(100,(n.count/Math.max(totalLeads,1)*100)).toFixed(0)}%"></div></div>
        </div>`).join('')}
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #334155;font-size:11px;color:#475569;display:flex;gap:16px">
          <span>⚠️ Risky: ${riskyLeads}</span>
          <span>🔴 Unsub: ${unsubCount}</span>
          <span>📬 Opened: ${openedCount}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Email Logs -->
  <div class="card">
    <div class="ch">
      <h2 style="margin:0">📧 Recent Emails</h2>
      <a href="/api/logs" class="btn bghost bsm" target="_blank">View All</a>
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>Email</th><th>Campaign</th><th>Subject</th><th>CTA</th><th>A/B</th><th>Status</th><th>Time</th></tr></thead>
        <tbody>
          ${recentLogs.map(log => {
            const cls = {sent:'pb',failed:'pr',opened:'pg',bounced:'py'}[log.status]||'pgray';
            return `<tr>
              <td style="font-weight:500;color:#cbd5e1">${log.email}</td>
              <td><span class="np">${log.campaign}</span></td>
              <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b" title="${log.subject}">${log.subject}</td>
              <td style="font-size:10px;color:#475569">${log.cta_text||'START NOW'}</td>
              <td style="color:#64748b">${log.ab_variant||'A'}</td>
              <td><span class="pill ${cls}">${log.status.toUpperCase()}</span></td>
              <td style="color:#475569;font-size:11px">${new Date(log.sent_at).toLocaleString('en-BD',{timeZone:'Asia/Dhaka',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Settings -->
  <div class="card">
    <div class="ch"><h2 style="margin:0">⚙️ Settings</h2></div>
    <div class="cb">
      <form method="POST" action="/api/settings" style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
        <div>
          <label style="font-size:11px;color:#64748b;display:block;margin-bottom:5px">Daily Send Limit</label>
          <input type="number" name="daily_limit" value="${process.env.DAILY_SEND_LIMIT||100}">
        </div>
        <div>
          <label style="font-size:11px;color:#64748b;display:block;margin-bottom:5px">Min Days Between Emails</label>
          <input type="number" name="min_days" value="${process.env.MIN_DAYS_BETWEEN_EMAILS||5}">
        </div>
        <div>
          <label style="font-size:11px;color:#64748b;display:block;margin-bottom:5px">Max Follow-ups</label>
          <input type="number" name="max_followups" value="${process.env.MAX_FOLLOWUPS||2}">
        </div>
        <button type="submit" class="btn bg">💾 Save</button>
      </form>
    </div>
  </div>

  <div style="text-align:center;padding:16px 0;font-size:11px;color:#334155">
    DevExHost Email Agent &nbsp;•&nbsp; <a href="https://devexhost.com" style="color:#16a34a;text-decoration:none">devexhost.com</a>
  </div>
</div>

</body>
</html>`);
  } catch (err) {
    res.status(500).send(`<pre style="background:#0f172a;color:#ef4444;padding:24px;min-height:100vh">Error: ${err.message}\n${err.stack}</pre>`);
  }
});

// ─── API ──────────────────────────────────────────────────────────────────

app.post('/api/run-automation', (req, res) => {
  res.json({ ok: true, message: 'Full automation started' });
  require('../automation').runDailyAutomation().catch(console.error);
});

app.post('/api/run-hunt', (req, res) => {
  res.json({ ok: true, message: 'Email hunt started' });
  require('../services/emailHunter').runDailyHunt().catch(console.error);
});

app.post('/api/run-validate', (req, res) => {
  res.json({ ok: true, message: 'Validation started' });
  require('../services/emailValidator').validatePendingLeads(100).catch(console.error);
});

app.post('/api/send-campaign', (req, res) => {
  const campaign = req.body.campaign || 'free_domain';
  res.redirect('/');
  require('../services/emailSender').runDailySend(campaign).catch(console.error);
});

app.get('/api/leads', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.niche)  filter.niche  = req.query.niche;
  const [leads, total] = await Promise.all([
    Lead.find(filter).sort({ date_added: -1 }).skip((page-1)*limit).limit(limit).lean(),
    Lead.countDocuments(filter),
  ]);
  res.json({ leads, total, page, pages: Math.ceil(total/limit) });
});

app.get('/api/leads/export', async (req, res) => {
  const leads = await Lead.find({ status: { $in: ['valid','risky'] }, unsubscribed: false }).lean();
  const csv = ['email,business_name,niche,website,status,source,date_added',
    ...leads.map(l => `${l.email},"${(l.business_name||'').replace(/"/g,'')}", ${l.niche},${l.website||''},${l.status},${l.source||'web'},${new Date(l.date_added).toISOString().split('T')[0]}`)
  ].join('\n');
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename=devexhost-leads.csv');
  res.send(csv);
});

app.get('/api/logs', async (req, res) => {
  const logs = await EmailLog.find().sort({ sent_at: -1 }).limit(100).lean();
  res.json(logs);
});

app.get('/api/stats', async (req, res) => {
  const [total, valid, risky, invalid, pending, sent, opened, failed, unsub] = await Promise.all([
    Lead.countDocuments(), Lead.countDocuments({status:'valid'}),
    Lead.countDocuments({status:'risky'}), Lead.countDocuments({status:'invalid'}),
    Lead.countDocuments({status:'pending'}), EmailLog.countDocuments({status:'sent'}),
    EmailLog.countDocuments({status:'opened'}), EmailLog.countDocuments({status:'failed'}),
    Unsubscribe.countDocuments(),
  ]);
  res.json({ leads:{total,valid,risky,invalid,pending}, emails:{sent,opened,failed,open_rate:sent>0?(opened/sent*100).toFixed(2)+'%':'0%'}, unsubscribes:unsub });
});

// ─── Test Email ───────────────────────────────────────────────────────────
app.post('/api/test-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ ok: false, error: 'Email required' });
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST  || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const { generateEmailContent, CTA_VARIANTS, pick } = require('../services/grokAI');
    const { buildHtmlEmail, buildPlainTextEmail } = require('../services/emailTemplate');
    const { v4: uuidv4 } = require('uuid');
    const generated = await generateEmailContent({
      businessName: 'Test Business',
      businessType: 'general business',
      campaignType: 'free_domain',
      ctaText: pick(CTA_VARIANTS),
      abVariant: 'A',
    });
    const trackingId = uuidv4();
    const baseUrl = process.env.BASE_URL || 'https://devexhost.com';
    const htmlEmail = buildHtmlEmail({
      businessName: 'Test Business',
      subject: generated.subject,
      bodyText: generated.body,
      ctaText: generated.ctaText,
      ctaLink: baseUrl,
      trackingId,
      campaignType: 'free_domain',
      unsubLink: baseUrl + '/unsubscribe/test',
    });
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'DevExHost Team'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: email,
      subject: '[TEST] ' + generated.subject,
      text: buildPlainTextEmail({ businessName: 'Test Business', bodyText: generated.body, ctaText: generated.ctaText, ctaLink: baseUrl }),
      html: htmlEmail,
    });
    console.log('✅ Test email sent to ' + email);
    res.json({ ok: true, message: 'Test email sent to ' + email, subject: generated.subject });
  } catch (err) {
    console.error('❌ Test email failed:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  const { daily_limit, min_days, max_followups } = req.body;
  if (daily_limit)   process.env.DAILY_SEND_LIMIT        = daily_limit;
  if (min_days)      process.env.MIN_DAYS_BETWEEN_EMAILS = min_days;
  if (max_followups) process.env.MAX_FOLLOWUPS            = max_followups;
  res.redirect('/');
});

// Tracking pixel
app.get('/track/:id', async (req, res) => {
  try {
    const log = await EmailLog.findOneAndUpdate(
      { tracking_id: req.params.id, status: 'sent' },
      { status: 'opened', opened_at: new Date() }, { new: true }
    );
    if (log) await Lead.findByIdAndUpdate(log.lead_id, { opened: true });
  } catch {}
  res.set('Content-Type','image/gif')
     .send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'));
});

// Unsubscribe
app.get('/unsubscribe/:email', async (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase();
  try {
    await Promise.all([
      Unsubscribe.findOneAndUpdate({ email }, { email }, { upsert: true }),
      Lead.findOneAndUpdate({ email }, { unsubscribed: true }),
    ]);
  } catch {}
  res.send(`<html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;margin:0">
    <div style="text-align:center;color:#e2e8f0;padding:40px">
      <div style="font-size:48px;margin-bottom:16px">✅</div>
      <h2 style="margin-bottom:8px">Unsubscribed Successfully</h2>
      <p style="color:#64748b;margin-bottom:24px">You won't receive emails from DevExHost anymore.</p>
      <a href="https://devexhost.com" style="color:#16a34a;font-weight:600;text-decoration:none">Visit devexhost.com →</a>
    </div></body></html>`);
});

// Start
const startServer = async () => {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌐 Admin: http://localhost:${PORT}`);
    console.log(`🔗 Render URL: ${RENDER_URL}`);
    console.log(`👤 Login: ${ADMIN_USER} / ${ADMIN_PASS}\n`);
  });
  setTimeout(startKeepAlive, 30000); // start keep-alive after 30s
};

startServer().catch(console.error);
module.exports = app;
