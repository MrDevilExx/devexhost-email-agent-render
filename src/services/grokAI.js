// src/services/grokAI.js (powered by Groq — Auto Model Select)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios = require('axios');

const GROQ_CHAT_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';

// Priority list — first available model wins
const PREFERRED_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama3-70b-8192',
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
];

let _selectedModel = null;

// Auto-select best available Groq model
const getModel = async () => {
  if (_selectedModel) return _selectedModel;
  try {
    const res = await axios.get(GROQ_MODELS_URL, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      timeout: 10000,
    });
    const available = res.data.data.map(m => m.id);
    console.log('Groq available models:', available.join(', '));
    _selectedModel = PREFERRED_MODELS.find(m => available.includes(m)) || available[0];
    console.log('Auto-selected model:', _selectedModel);
  } catch (err) {
    _selectedModel = 'llama-3.1-8b-instant';
    console.log('Model fetch failed, fallback:', _selectedModel);
  }
  return _selectedModel;
};

const CAMPAIGN_META = {
  free_domain:  { label: 'Free Domain Offer',       offer: 'Get a FREE .com.bd domain for your Bangladesh business', value: 'Save 2,500 BDT with a free domain registration' },
  free_hosting: { label: 'Free Hosting Trial',       offer: '30-day FREE hosting trial — no credit card required',   value: 'Launch your website at zero cost for 30 days' },
  vps_speed:    { label: 'VPS Speed Offer',          offer: 'Blazing-fast VPS hosting starting at 999 BDT/month',    value: '10x faster than shared hosting' },
  reseller:     { label: 'Reseller Business Offer',  offer: 'Start your own hosting business with our Reseller plan', value: 'White-label hosting — unlimited clients' },
  discount:     { label: 'Special Discount Campaign',offer: '50% OFF on all hosting plans — limited time',            value: 'Premium hosting at half the price' },
};

const CTA_VARIANTS = ['START NOW', 'GET FREE DOMAIN', 'TRY NOW', 'CLAIM OFFER', 'GET STARTED'];

const SUBJECT_VARIANTS = {
  free_domain:  ['Free .com.bd Domain for {business_name}', 'Your free domain is waiting, {business_name}!', 'Claim your FREE domain today — DevExHost', 'A domain name for {business_name} — no cost'],
  free_hosting: ['30 days free hosting for {business_name}', 'Launch {business_name} online — FREE for a month', 'No credit card. No risk. Free hosting for you!', 'Free web hosting for {business_name}'],
  vps_speed:    ['Is your website slow? Fix it for 999 BDT/month', 'VPS hosting for Bangladesh businesses', '{business_name}: Upgrade to VPS today', '10x faster website for {business_name}'],
  reseller:     ['Start a hosting business from Bangladesh today', 'Earn monthly income reselling DevExHost plans', '{business_name} can now offer hosting to clients!', 'White-label hosting — build your brand'],
  discount:     ['50% OFF hosting for {business_name}', 'Half price hosting — grab it now', 'Special deal for {business_name}: 50% discount', 'Limited time discount inside'],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const callGrok = async (systemPrompt, userPrompt) => {
  const model = await getModel();
  const response = await axios.post(
    GROQ_CHAT_URL,
    { model, max_tokens: 800, temperature: 0.85, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] },
    { headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  return response.data.choices[0].message.content.trim();
};

const generateEmailContent = async ({ businessName = 'Business Owner', businessType = 'general business', campaignType = 'free_domain', ctaText = 'START NOW', abVariant = 'A' }) => {
  const meta = CAMPAIGN_META[campaignType] || CAMPAIGN_META.free_domain;
  const systemPrompt = `You are an expert email copywriter for DevExHost, a web hosting company in Bangladesh. Write professional, warm, short (150-220 words) marketing emails. Return ONLY the email body. No subject line. No markdown. Plain text only.`;
  const userPrompt = `Write a marketing email for DevExHost.\nBusiness: "${businessName}" (${businessType}) in Bangladesh\nCampaign: ${meta.label}\nOffer: ${meta.offer}\nValue: ${meta.value}\nCTA: ${ctaText}\nWebsite: https://devexhost.com\nFocus: ${abVariant === 'A' ? 'benefits' : 'urgency'}\nStructure: greeting, hook, offer details, why DevExHost, CTA, sign-off from DevExHost Team.`;
  const body = await callGrok(systemPrompt, userPrompt);
  const subject = pick(SUBJECT_VARIANTS[campaignType] || SUBJECT_VARIANTS.free_domain).replace('{business_name}', businessName);
  return { subject, body, ctaText };
};

const detectNicheWithAI = async (website, description = '') => {
  try {
    const result = await callGrok('You are a business categorization AI.', `Classify this business into ONE word: ecommerce, agency, tech_startup, education, healthcare, food, travel, ngo, legal, general.\nURL: "${website}" Description: "${description}"\nRespond with ONLY the niche word.`);
    const validNiches = ['ecommerce','agency','tech_startup','education','healthcare','food','travel','ngo','legal','general'];
    return validNiches.find(n => result.toLowerCase().includes(n)) || 'general';
  } catch { return 'general'; }
};

module.exports = { generateEmailContent, detectNicheWithAI, CTA_VARIANTS, SUBJECT_VARIANTS, CAMPAIGN_META, pick };
