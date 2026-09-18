# 📲 Sarkari Sahayak — WhatsApp Channel Auto-Poster

Website ke naye jobs, results, admit cards aur yojana automatically WhatsApp Channel pe post karta hai.

---

## ⚡ Kaise Kaam Karta Hai

```
Har 2 Ghante
     ↓
GitHub Actions (Free Cloud)
     ↓
Python Bot — nayi entries detect karta hai
     ↓
Green-API se WhatsApp Channel pe post
     ↓
posted_ids.json update (duplicate prevention)
```

---

## 🛠️ Setup — Step by Step

### Step 1: WhatsApp Channel Banao

1. WhatsApp app open karo
2. **New Chat → New Channel** pe tap karo
3. Channel ka naam rakho: **"Sarkari Sahayak"**
4. Channel create karo
5. Channel ke settings mein jaao → Channel link copy karo
   - Link kuch aisa hoga: `https://whatsapp.com/channel/0029Va...`

> ⚠️ Channel ID alag hota hai link se — Step 3 mein milega

---

### Step 2: Green-API Account Banao (Free)

1. **https://green-api.com** pe jaao
2. **"Register"** → Free plan select karo
3. Account verify karo
4. Dashboard mein **"Create Instance"** pe click karo
5. **Instance ID** aur **API Token** note karo (ye dono chahiye)

---

### Step 3: WhatsApp Connect Karo (QR Scan)

1. Green-API dashboard mein apni instance pe click karo
2. **"Scan QR"** button pe click karo
3. WhatsApp app → Linked Devices → Link a Device
4. QR code scan karo
5. ✅ "Authorized" dikhne lage toh connected!

> 💡 **WhatsApp Channel ID kaise pata kare:**
> Ek test message apne connected WhatsApp pe bhejo aur Channel info check karo.
> Format hoga: `120363xxxxxxxxxx@newsletter`

---

### Step 4: GitHub Secrets Set Karo

Apne GitHub repo mein jaao:
**Settings → Secrets and variables → Actions → New repository secret**

Teen secrets add karo:

| Secret Name | Value | Kahan Milega |
|---|---|---|
| `GREENAPI_ID_INSTANCE` | `1101234567` | Green-API Dashboard |
| `GREENAPI_API_TOKEN` | `abc123xyz...` | Green-API Dashboard |
| `WHATSAPP_CHANNEL_ID` | `120363xxxxx@newsletter` | Step 3 se |

---

### Step 5: Test Karo

GitHub repo mein jaao:
**Actions → "WhatsApp Channel Auto-Poster" → Run workflow**

✅ **"Send test message only?"** checkbox ko tick karo → **Run workflow**

WhatsApp Channel pe test message aayega!

---

## 📨 Message Examples

### 🔴 Job Post
```
🔴 नई सरकारी नौकरी | New Sarkari Job
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏛️ *SSC CGL 2025 Recruitment*

🏛️ Org: Staff Selection Commission
👥 Vacancies: 17,727
📅 Last Date: 15 Oct 2025
🎓 Qualification: Graduation

🔗 Full Details & Apply:
https://sarkarisahayak.in/latest-jobs/ssc-cgl-2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📲 Sarkari Sahayak — सरकारी नौकरी की सच्ची जानकारी
#SarkariNaukri #GovtJob #SarkariSahayak
```

---

## ⚙️ Configuration

`whatsapp_poster.py` ke top mein ya GitHub Secrets mein ye variables set kar sakte ho:

| Variable | Default | Description |
|---|---|---|
| `MAX_POSTS_PER_RUN` | `3` | Ek run mein kitne posts |
| `POST_DELAY_SECONDS` | `8` | Messages ke beech delay |
| `MAX_AGE_DAYS` | `3` | Kitne purane entries post kare |

---

## 🔧 Manual Commands

```bash
# Sab kuch post karo
python whatsapp_poster.py

# Sirf jobs post karo
python whatsapp_poster.py --category jobs

# Test message bhejo
python whatsapp_poster.py --test

# Dry run (koi actual post nahi)
python whatsapp_poster.py --dry-run

# 5 posts ek run mein
python whatsapp_poster.py --max-posts 5
```

---

## 📅 Auto Schedule

| Event | WhatsApp Bot Trigger |
|---|---|
| Data sync complete (har 2 ghante) | ✅ Auto trigger |
| Cron backup (har 2 ghante, offset) | ✅ Auto run |
| Manual GitHub Actions | ✅ 1-click |

---

## ❓ Troubleshooting

**Bot chal raha hai lekin message nahi aa raha?**
- Green-API instance "Authorized" state mein hai? Check karo
- `WHATSAPP_CHANNEL_ID` sahi format mein hai? (`12036...@newsletter`)
- WhatsApp Channel pe aap admin ho?

**"Missing Green-API credentials" error?**
- GitHub Secrets sahi se set kiye hain? Case-sensitive hain

**Duplicate posts aa rahe hain?**
- `posted_ids.json` properly commit ho raha hai? Check GitHub Actions logs

---

## 🆓 Free Tier Limits

| Service | Free Limit |
|---|---|
| Green-API | 3,000 messages/month |
| GitHub Actions | 2,000 min/month |
| **Estimated Usage** | ~360 msgs/month (3 posts × 4 runs/day × 30 days) |

✅ Free tier mein fit ho jayega!
