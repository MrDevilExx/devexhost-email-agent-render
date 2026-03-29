// src/services/emailHunter.js
// ═══════════════════════════════════════════════════════════════════
//  EMAIL HUNTING SOURCES (সব পাবলিক ও লিগ্যাল):
//
//  1. GitHub Profiles    → location:Bangladesh যাদের public email আছে
//  2. BASIS Directory    → Bangladesh IT/Software companies (1000+)
//  3. e-CAB Members      → eCommerce businesses in BD (2000+)
//  4. Yellow Pages BD    → Local business directory
//  5. DuckDuckGo Search  → "contact@" site:.com.bd
// ═══════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios   = require('axios');
const cheerio = require('cheerio');
const connectDB = require('../config/db');
const Lead    = require('../models/Lead');
const { Unsubscribe } = require('../models/Models');
const telegramNotifier = require('./telegramNotifier');

const EMAIL_REGEX  = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const BD_KEYWORDS  = ['bangladesh','dhaka','chittagong','sylhet','rajshahi','khulna','bd'];
const BD_TLDS      = ['.com.bd','.net.bd','.org.bd','.edu.bd','.gov.bd'];
const SKIP_WORDS   = ['noreply','no-reply','donotreply','example','test','sentry','wix','github.com','githubusercontent'];

const isBD = (s='') => BD_KEYWORDS.some(k => s.toLowerCase().includes(k)) || BD_TLDS.some(t => s.includes(t));

const cleanEmails = (arr=[]) => arr.filter(e =>
  e && e.length < 80 && e.includes('@') && !e.includes('..') &&
  !SKIP_WORDS.some(s => e.toLowerCase().includes(s))
);

const detectNiche = (text='', url='') => {
  const t = (text+' '+url).toLowerCase();
  if (/shop|store|ecommerce|cart|buy|sell/.test(t))       return 'ecommerce';
  if (/agency|design|creative|branding|marketing/.test(t)) return 'agency';
  if (/software|tech|saas|app|startup|it\s|ict/.test(t))  return 'tech_startup';
  if (/school|university|education|academy/.test(t))       return 'education';
  if (/hospital|clinic|doctor|health|medical/.test(t))     return 'healthcare';
  if (/restaurant|food|catering|cafe/.test(t))             return 'food';
  if (/hotel|travel|tour|resort/.test(t))                  return 'travel';
  if (/ngo|charity|nonprofit|foundation/.test(t))          return 'ngo';
  if (/fashion|clothing|garments|textile/.test(t))         return 'fashion';
  if (/real.?estate|property|apartment/.test(t))           return 'real_estate';
  return 'general';
};

const fetchPage = async (url) => {
  try {
    const res = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
        'Accept': 'text/html',
      },
      maxRedirects: 3,
    });
    return res.data || '';
  } catch { return ''; }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────
// SOURCE 1: GitHub — location:Bangladesh public profiles
// ─────────────────────────────────────────────────────────────
const huntGitHub = async (max=60) => {
  const leads = [];
  if (!process.env.GITHUB_TOKEN) {
    console.log('  ⚠️  GitHub: No token, skipping');
    return leads;
  }

  const queries = ['location:Bangladesh','location:Dhaka','location:Chittagong'];
  for (const q of queries) {
    try {
      const res = await axios.get('https://api.github.com/search/users', {
        params: { q, per_page: Math.ceil(max/queries.length), sort:'joined' },
        headers: { 'Authorization':`token ${process.env.GITHUB_TOKEN}`, 'User-Agent':'DevExHost' },
        timeout: 15000,
      });
      for (const user of (res.data.items || [])) {
        try {
          const p = await axios.get(`https://api.github.com/users/${user.login}`, {
            headers: { 'Authorization':`token ${process.env.GITHUB_TOKEN}`, 'User-Agent':'DevExHost' },
            timeout: 8000,
          });
          if (p.data.email) leads.push({
            email: p.data.email.toLowerCase().trim(),
            website: p.data.blog || `https://github.com/${p.data.login}`,
            business_name: p.data.name || p.data.company || p.data.login,
            niche: detectNiche(p.data.bio||'', p.data.blog||''),
            source: 'github',
          });
          await sleep(500);
        } catch {}
      }
    } catch (e) { console.warn(`  ⚠️  GitHub (${q}):`, e.message); }
  }
  console.log(`  🐙 GitHub: ${leads.length} found`);
  return leads;
};

// ─────────────────────────────────────────────────────────────
// SOURCE 2: BASIS — Bangladesh IT company directory
// ─────────────────────────────────────────────────────────────
const huntBASIS = async (max=40) => {
  const leads = [];
  try {
    for (let page = 1; page <= Math.ceil(max/15); page++) {
      const html = await fetchPage(`https://basis.org.bd/company-list?page=${page}`);
      if (!html) break;
      const $ = cheerio.load(html);
      const emails = cleanEmails(html.match(EMAIL_REGEX)||[]);
      const names  = [];
      $('h3,h4,.company-name,.business-name').each((_,el) => names.push($(el).text().trim()));

      emails.forEach((email, i) => {
        if (leads.length < max) leads.push({
          email, website: 'https://basis.org.bd',
          business_name: names[i] || 'BASIS Member Company',
          niche: 'tech_startup', source: 'basis',
        });
      });
      await sleep(2000);
    }
  } catch (e) { console.warn('  ⚠️  BASIS:', e.message); }
  console.log(`  🏢 BASIS: ${leads.length} found`);
  return leads;
};

// ─────────────────────────────────────────────────────────────
// SOURCE 3: e-CAB — eCommerce businesses in Bangladesh
// ─────────────────────────────────────────────────────────────
const huntECAB = async (max=40) => {
  const leads = [];
  try {
    const pages = ['https://e-cab.net/members/', 'https://e-cab.net/members/?page=2'];
    for (const url of pages) {
      const html = await fetchPage(url);
      if (!html) continue;
      const $ = cheerio.load(html);
      const emails = cleanEmails(html.match(EMAIL_REGEX)||[]);
      const names  = [];
      $('.member-name, .company-name, h3, h4').each((_,el) => names.push($(el).text().trim()));

      emails.forEach((email, i) => {
        if (leads.length < max) leads.push({
          email, website: 'https://e-cab.net',
          business_name: names[i] || 'e-CAB Member',
          niche: 'ecommerce', source: 'ecab',
        });
      });
      await sleep(2000);
    }
  } catch (e) { console.warn('  ⚠️  e-CAB:', e.message); }
  console.log(`  🛒 e-CAB: ${leads.length} found`);
  return leads;
};

// ─────────────────────────────────────────────────────────────
// SOURCE 4: Yellow Pages BD — local business directory
// ─────────────────────────────────────────────────────────────
const huntYellowPagesBD = async (max=40) => {
  const leads = [];
  const categories = ['web-design','software-company','it-company','digital-marketing','graphic-design','ecommerce'];
  try {
    for (const cat of categories.slice(0, 4)) {
      const html = await fetchPage(`https://www.yellowpages.com.bd/category/${cat}`);
      if (!html) continue;
      const $ = cheerio.load(html);
      const emails = cleanEmails(html.match(EMAIL_REGEX)||[]);
      const names  = [];
      $('.business-name,.listing-title,h3').each((_,el) => names.push($(el).text().trim()));

      emails.forEach((email, i) => {
        if (leads.length < max) leads.push({
          email, website: `https://www.yellowpages.com.bd/category/${cat}`,
          business_name: names[i] || `BD ${cat.replace(/-/g,' ')} Business`,
          niche: detectNiche(cat, ''), source: 'yellowpages',
        });
      });
      await sleep(2500);
    }
  } catch (e) { console.warn('  ⚠️  Yellow Pages BD:', e.message); }
  console.log(`  📒 Yellow Pages BD: ${leads.length} found`);
  return leads;
};

// ─────────────────────────────────────────────────────────────
// SOURCE 5: DuckDuckGo Search — "contact@" site:.com.bd
// ─────────────────────────────────────────────────────────────
const huntFromSearch = async (max=30) => {
  const leads = [];
  const queries = [
    'contact email software company Bangladesh',
    'info@ ecommerce shop Bangladesh site:com.bd',
    'email address IT company Dhaka contact',
  ];
  for (const q of queries) {
    try {
      const html = await fetchPage(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
      if (!html) continue;
      const $ = cheerio.load(html);
      const pageText = $('body').text();
      const emails = cleanEmails((pageText.match(EMAIL_REGEX)||[]).filter(e => isBD(e) || e.includes('.bd')));

      for (const email of emails.slice(0, Math.ceil(max/queries.length))) {
        if (leads.length < max) leads.push({
          email, website: '',
          business_name: email.split('@')[1]?.split('.')[0] || 'BD Business',
          niche: 'general', source: 'search',
        });
      }
      await sleep(3000);
    } catch (e) { console.warn(`  ⚠️  Search:`, e.message); }
  }
  console.log(`  🔎 Search: ${leads.length} found`);
  return leads;
};

// ─── Save to MongoDB (dedup) ───────────────────────────────────────────────
const saveLeads = async (leads) => {
  const unsubSet = new Set(
    (await Unsubscribe.find({}, 'email').lean()).map(u => u.email)
  );
  const seen = new Set();
  let newCount = 0, dupCount = 0;

  for (const lead of leads) {
    if (!lead.email?.includes('@')) continue;
    const email = lead.email.toLowerCase().trim();
    if (seen.has(email) || unsubSet.has(email)) { dupCount++; continue; }
    seen.add(email);

    try {
      const existing = await Lead.findOneAndUpdate(
        { email },
        { $setOnInsert: { ...lead, email, status: 'pending', date_added: new Date() } },
        { upsert: true, new: false }
      );
      if (!existing) newCount++; else dupCount++;
    } catch (e) {
      if (e.code === 11000) dupCount++;
    }
  }
  return { newCount, dupCount };
};

// ─── Main ─────────────────────────────────────────────────────────────────
const runDailyHunt = async () => {
  console.log('\n🔍 Daily Email Hunt Starting...');
  console.log('📍 Sources: GitHub | BASIS | e-CAB | Yellow Pages BD | Search\n');
  await connectDB();

  const MAX = parseInt(process.env.MAX_EMAILS_PER_HUNT) || 200;

  const [r1, r2, r3, r4, r5] = await Promise.allSettled([
    huntGitHub(Math.floor(MAX * 0.25)),
    huntBASIS(Math.floor(MAX * 0.20)),
    huntECAB(Math.floor(MAX * 0.20)),
    huntYellowPagesBD(Math.floor(MAX * 0.20)),
    huntFromSearch(Math.floor(MAX * 0.15)),
  ]);

  const all = [
    ...(r1.status==='fulfilled' ? r1.value : []),
    ...(r2.status==='fulfilled' ? r2.value : []),
    ...(r3.status==='fulfilled' ? r3.value : []),
    ...(r4.status==='fulfilled' ? r4.value : []),
    ...(r5.status==='fulfilled' ? r5.value : []),
  ].slice(0, MAX);

  console.log(`\n📦 Total raw: ${all.length}`);
  const { newCount, dupCount } = await saveLeads(all);

  const msg = `📬 *Hunt Complete*\n✅ New: ${newCount}\n♻️ Dup: ${dupCount}\n📦 Total: ${all.length}\n\n📍 GitHub: ${r1.value?.length||0} | BASIS: ${r2.value?.length||0} | e-CAB: ${r3.value?.length||0} | YPBD: ${r4.value?.length||0} | Search: ${r5.value?.length||0}`;
  console.log('\n' + msg.replace(/\*/g,''));
  await telegramNotifier.send(msg);

  return { newCount, dupCount, total: all.length };
};

module.exports = { runDailyHunt, detectNiche, isBD };

if (require.main === module) {
  runDailyHunt().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
