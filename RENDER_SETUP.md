# 🚀 Render-এ DevExHost Email Agent Deploy করার গাইড

## কী কী লাগবে (সব ফ্রি)
- Render account → render.com
- MongoDB Atlas account → cloud.mongodb.com
- Gmail account (App Password)
- Grok API key → console.x.ai
- GitHub account (optional, email hunting-এর জন্য)

---

## ধাপ ১ — MongoDB Atlas (ফ্রি database)

1. [cloud.mongodb.com](https://cloud.mongodb.com) → Create account
2. **Create Cluster** → M0 Free Tier → Create
3. **Database Access** → Add new user:
   - Username: `devexhost`
   - Password: যেকোনো strong password
4. **Network Access** → Add IP Address → **Allow Access from Anywhere** (0.0.0.0/0)
5. **Connect** → Drivers → Copy connection string
   ```
   mongodb+srv://devexhost:<password>@cluster0.xxxxx.mongodb.net/devexhost_agent
   ```
   `<password>` replace করুন আপনার password দিয়ে

---

## ধাপ ২ — GitHub-এ Code Push করুন

```bash
# Terminal/CMD-এ:
cd devexhost-agent
git init
git add .
git commit -m "DevExHost Email Agent v1"
git remote add origin https://github.com/YOUR_USERNAME/devexhost-agent.git
git push -u origin main
```

---

## ধাপ ৩ — Render-এ Deploy করুন

1. [render.com](https://render.com) → Sign up (GitHub দিয়ে)
2. **New +** → **Web Service**
3. **Connect your GitHub repo** → devexhost-agent select করুন
4. Settings:
   ```
   Name: devexhost-email-agent
   Runtime: Node
   Build Command: npm install
   Start Command: node src/index.js
   Plan: Free
   ```
5. **Add Environment Variables** (একটা একটা করে):

| Variable | Value |
|---|---|
| `GROK_API_KEY` | আপনার Grok API key |
| `MONGODB_URI` | Atlas connection string |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | আপনার Gmail |
| `SMTP_PASS` | Gmail App Password |
| `SMTP_FROM_EMAIL` | `noreply@devexhost.com` |
| `ADMIN_PASSWORD` | আপনার admin password |
| `GITHUB_TOKEN` | GitHub PAT (optional) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |
| `TELEGRAM_CHAT_ID` | আপনার chat ID (optional) |

6. **Create Web Service** → Deploy শুরু হবে (2-3 মিনিট)

---

## ধাপ ৪ — Admin Panel অ্যাক্সেস

Deploy শেষ হলে Render আপনাকে একটা URL দেবে:
```
https://devexhost-email-agent.onrender.com
```

Browser-এ open করুন:
- Username: `admin`
- Password: আপনার `ADMIN_PASSWORD`

---

## Gmail App Password কীভাবে পাবেন

1. [myaccount.google.com](https://myaccount.google.com) → Security
2. **2-Step Verification** চালু করুন
3. **App Passwords** → Mail → Windows Computer
4. 16-digit password copy করুন → `SMTP_PASS`-এ দিন

---

## ⚠️ Render Free Plan সীমাবদ্ধতা

| বিষয় | ফ্রি Plan |
|---|---|
| Sleep after idle | 15 মিনিট (agent নিজেই জাগিয়ে রাখে) |
| Monthly hours | 750 hours (যথেষ্ট) |
| RAM | 512MB |
| দাম | ফ্রি |

Agent-এর built-in keep-alive সিস্টেম প্রতি 14 মিনিটে ping করে sleep ঠেকায়।

---

## Email Hunting কোথা থেকে হয়

| Source | কী পায় |
|---|---|
| 🐙 **GitHub** | BD developers যাদের public email আছে |
| 🏢 **BASIS** | Bangladesh IT/software companies |
| 🛒 **e-CAB** | eCommerce businesses in BD |
| 📒 **Yellow Pages BD** | Local BD business directory |
| 🔎 **DuckDuckGo** | `.com.bd` domains থেকে email |

---

## ✅ সব ঠিকমতো হলে

- Admin Panel চলবে: `https://your-app.onrender.com`
- প্রতিদিন সকাল ৯টায় (BST) automation চলবে
- Telegram-এ notification আসবে
- MongoDB-তে leads সেভ হবে
- Gmail দিয়ে emails যাবে

কোনো সমস্যা হলে Render → Logs দেখুন।
