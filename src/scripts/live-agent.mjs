/**
 * live-agent.mjs - 24/7 Autonomous Real-Time Live Ingestion & Sync Agent
 * 
 * Automatically tracks and ingests:
 * 1. Latest Government Jobs (Sarkari Naukri / Vacancies)
 * 2. Exam Results (Sarkari Result / Selection Lists)
 * 3. Admit Cards / Hall Tickets / Exam Dates
 * 4. Government Schemes & Yojanas (Central & State Level)
 * 5. Answer Keys & Response Sheets
 * 
 * Features:
 * - Real-time RSS & Official Feeds (PIB, Govt Portals, Real-time News Feeds)
 * - Auto Deduplication & Schema Formatting
 * - Background Continuous Daemon Mode (checks every X minutes)
 * - Auto-trigger sitemap generator upon new content discovery
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT, 'src/data');

const JOBS_FILE = path.join(DATA_DIR, 'latest-jobs.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const ADMIT_CARDS_FILE = path.join(DATA_DIR, 'admit-cards.json');
const YOJANA_FILE = path.join(DATA_DIR, 'yojana.json');
const ANSWER_KEYS_FILE = path.join(DATA_DIR, 'answer-keys.json');

// Read JSON helper
function readJSON(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf-8');
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[Live Agent] Error reading ${path.basename(filePath)}:`, err.message);
  }
  return fallback;
}

// Write JSON helper
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`✓ [Live Agent] Saved ${path.basename(filePath)} (${data.length} total entries)`);
  } catch (err) {
    console.error(`[Live Agent] Error saving ${path.basename(filePath)}:`, err.message);
  }
}

// Slug generator
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Strip HTML tags & entities
function cleanText(str) {
  return (str || '')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Quality gate: reject garbage/low-quality titles before ingestion
function isQualityTitle(title) {
  // Must have at least 3 real words
  const words = title.split(/\s+/).filter(w => w.length > 1);
  if (words.length < 3) return false;
  // Must be at least 15 chars long
  if (title.length < 15) return false;
  // Reject if 70%+ characters are numbers or symbols
  const alphaChars = (title.match(/[a-zA-Z\u0900-\u097F]/g) || []).length;
  if (alphaChars / title.length < 0.3) return false;
  return true;
}

// Real-Time High Priority Feed Channels
const REALTIME_FEEDS = [
  {
    type: 'jobs',
    name: 'Real-Time Sarkari Naukri & Vacancies Feed',
    url: 'https://news.google.com/rss/search?q=sarkari+naukri+OR+recruitment+vacancy+when:1d&hl=en-IN&gl=IN&ceid=IN:en'
  },
  {
    type: 'results',
    name: 'Real-Time Sarkari Results & Merit Lists Feed',
    url: 'https://news.google.com/rss/search?q=sarkari+result+declared+OR+merit+list+when:1d&hl=en-IN&gl=IN&ceid=IN:en'
  },
  {
    type: 'admit-cards',
    name: 'Real-Time Admit Cards & Hall Tickets Feed',
    url: 'https://news.google.com/rss/search?q=admit+card+download+OR+hall+ticket+released+when:1d&hl=en-IN&gl=IN&ceid=IN:en'
  },
  {
    type: 'yojana',
    name: 'Real-Time Sarkari Yojana & Schemes Feed',
    url: 'https://news.google.com/rss/search?q=pradhan+mantri+yojana+OR+sarkari+yojana+when:2d&hl=hi&gl=IN&ceid=IN:hi'
  },
  {
    type: 'answer-keys',
    name: 'Real-Time Answer Keys & Response Sheets Feed',
    url: 'https://news.google.com/rss/search?q=answer+key+released+sarkari+when:2d&hl=en-IN&gl=IN&ceid=IN:en'
  },
  {
    type: 'pib',
    name: 'Press Information Bureau (PIB Official Releases)',
    url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1'
  }
];

async function fetchFeed(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

// Clean title from news portal suffixes like " - Times of India" or " - Jagran"
function cleanTitle(rawTitle) {
  return rawTitle.replace(/\s+-\s+[A-Za-z0-9\s.,&|]+$/gi, '').trim();
}

// Detect Organization
function detectOrganization(title) {
  if (/upsc/i.test(title)) return 'UPSC';
  if (/ssc/i.test(title)) return 'SSC';
  if (/rrb|railway/i.test(title)) return 'Railway Recruitment Board';
  if (/sbi|ibps|rbi|bank/i.test(title)) return 'Banking Sector';
  if (/nda|cds|army|navy|air force|drdo|defence/i.test(title)) return 'Defence / Armed Forces';
  if (/nta|neet|jee|cuet/i.test(title)) return 'National Testing Agency (NTA)';
  if (/bpsc/i.test(title)) return 'BPSC';
  if (/uppsc|uprvunl|uppcl/i.test(title)) return 'Uttar Pradesh Govt';
  if (/rpsc/i.test(title)) return 'Rajasthan PSC';
  if (/mppsc/i.test(title)) return 'Madhya Pradesh PSC';
  return 'Govt of India';
}

// Detect Category
function detectCategory(title) {
  if (/bank|sbi|ibps|rbi/i.test(title)) return 'banking';
  if (/railway|rrb|loco/i.test(title)) return 'railway';
  if (/defence|army|navy|airforce|crpf|bsf|cisf/i.test(title)) return 'defence';
  if (/police|constable|si/i.test(title)) return 'police';
  if (/teacher|tgt|pgt|prt|kvs|nvs/i.test(title)) return 'teaching';
  if (/upsc|ssc/i.test(title)) return 'central';
  return 'other';
}

export async function runLiveAgent() {
  const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
  console.log(`\n======================================================`);
  console.log(`⚡ [Live Agent 24/7] Real-Time Scan Started at ${timestamp} IST`);
  console.log(`======================================================`);

  const existingJobs = readJSON(JOBS_FILE);
  const existingResults = readJSON(RESULTS_FILE);
  const existingAdmitCards = readJSON(ADMIT_CARDS_FILE);
  const existingYojanas = readJSON(YOJANA_FILE);
  const existingAnswerKeys = readJSON(ANSWER_KEYS_FILE);

  const existingJobSlugs = new Set(existingJobs.map(j => j.slug));
  const existingResultSlugs = new Set(existingResults.map(r => r.slug));
  const existingAdmitCardSlugs = new Set(existingAdmitCards.map(a => a.slug));
  const existingYojanaSlugs = new Set(existingYojanas.map(y => y.slug));
  const existingAnswerKeySlugs = new Set(existingAnswerKeys.map(k => k.slug));

  let stats = { jobs: 0, results: 0, admitCards: 0, yojanas: 0, answerKeys: 0 };

  for (const feed of REALTIME_FEEDS) {
    console.log(`📡 Scanning: ${feed.name}...`);
    const xml = await fetchFeed(feed.url);
    if (!xml) {
      console.log(`   ⚠️ Timeout or unreachable (skipping for next cycle).`);
      continue;
    }

    const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    console.log(`   Received ${items.length} items.`);

    for (const itemXml of items) {
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || itemXml.match(/<title>(.*?)<\/title>/i);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i) || itemXml.match(/<guid[^>]*>(.*?)<\/guid>/i);
      const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) || itemXml.match(/<description>(.*?)<\/description>/i);
      const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i);

      if (!titleMatch || !titleMatch[1]) continue;

      const rawTitle = cleanText(titleMatch[1]);
      const title = cleanTitle(rawTitle);
      const rawLink = linkMatch ? cleanText(linkMatch[1]) : '';
      const description = descMatch ? cleanText(descMatch[1]) : '';
      const pubDate = dateMatch ? new Date(dateMatch[1]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      if (!isQualityTitle(title)) continue;
      const baseSlug = slugify(title).slice(0, 50);

      // 1. Sarkari Yojana
      if (feed.type === 'yojana' || /yojana|pradhan mantri|pm-|kisan|awas|subsidy|ration|ayushman/i.test(title)) {
        const slug = `${baseSlug}-yojana`;
        if (!existingYojanaSlugs.has(slug)) {
          existingYojanas.unshift({
            name: title,
            slug,
            category: /kisan|farmer|krishi/i.test(title) ? 'farmers' : /awas|ghar/i.test(title) ? 'housing' : /health|swasthya|ayushman/i.test(title) ? 'health' : 'welfare',
            launchDate: pubDate,
            ministry: 'Government of India',
            budget: 'As per latest scheme notification',
            eligibility: 'भारतीय नागरिक जो योजना के अंतर्गत निर्धारित पात्रता नियमों को पूरा करते हैं।',
            benefits: description || `${title} के तहत पात्र नागरिकों को वित्तीय सहायता और सरकारी लाभ प्रदान किए जाते हैं।`,
            applicationProcess: [
              'आधिकारिक वेबसाइट या नजदीकी CSC केंद्र पर जाएँ',
              'आधार कार्ड और मोबाइल नंबर से रजिस्ट्रेशन करें',
              'आवेदन फॉर्म भरें और आवश्यक दस्तावेज अपलोड करें',
              'आवेदन सबमिट करें और पावती रसीद सुरक्षित रखें'
            ],
            documents: ['आधार कार्ड', 'आय प्रमाण पत्र', 'निवास प्रमाण पत्र', 'बैंक पासबुक', 'पासपोर्ट फोटो'],
            officialWebsite: rawLink || 'https://www.india.gov.in',
            helpline: '1800-11-0001 (National Portal)',
            shortDescription: `${title} — सरकारी योजना विवरण, पात्रता, लाभ व ऑनलाइन आवेदन।`,
            importantDates: [`Notification Date: ${pubDate}`, 'Status: Active'],
            importantLinks: [
              { label: 'Official Portal', url: rawLink || 'https://www.india.gov.in' },
              { label: 'Scheme Details', url: rawLink || 'https://www.india.gov.in' }
            ],
            stateImplementation: 'National / All States',
            autoSynced: true
          });
          existingYojanaSlugs.add(slug);
          stats.yojanas++;
        }
      }
      // 2. Sarkari Results
      else if (feed.type === 'results' || /result|merit list|score card|marks list/i.test(title)) {
        const slug = `${baseSlug}-result-2026`;
        if (!existingResultSlugs.has(slug)) {
          const org = detectOrganization(title);
          existingResults.unshift({
            slug,
            title: `${title} 2026`,
            shortTitle: title.slice(0, 40),
            organization: org,
            category: detectCategory(title),
            releaseDate: pubDate,
            resultUrl: rawLink || 'https://govtjob.salarypitcher.com/results/',
            status: 'Declared',
            autoSynced: true
          });
          existingResultSlugs.add(slug);
          stats.results++;
        }
      }
      // 3. Admit Cards
      else if (feed.type === 'admit-cards' || /admit card|hall ticket|call letter|exam city/i.test(title)) {
        const slug = `${baseSlug}-admit-card-2026`;
        if (!existingAdmitCardSlugs.has(slug)) {
          const org = detectOrganization(title);
          existingAdmitCards.unshift({
            slug,
            title: `${title} 2026`,
            shortTitle: title.slice(0, 40),
            organization: org,
            category: detectCategory(title),
            releaseDate: pubDate,
            downloadUrl: rawLink || 'https://govtjob.salarypitcher.com/admit-cards/',
            status: 'Released',
            autoSynced: true
          });
          existingAdmitCardSlugs.add(slug);
          stats.admitCards++;
        }
      }
      // 4. Answer Keys
      else if (feed.type === 'answer-keys' || /answer key|response sheet|objection/i.test(title)) {
        const slug = `${baseSlug}-answer-key-2026`;
        if (!existingAnswerKeySlugs.has(slug)) {
          const org = detectOrganization(title);
          existingAnswerKeys.unshift({
            slug,
            title: `${title} 2026`,
            shortTitle: title.slice(0, 40),
            organization: org,
            releaseDate: pubDate,
            downloadUrl: rawLink || 'https://govtjob.salarypitcher.com/answer-keys/',
            status: 'Available',
            autoSynced: true
          });
          existingAnswerKeySlugs.add(slug);
          stats.answerKeys++;
        }
      }
      // 5. Latest Jobs
      else if (/recruitment|vacancy|vacancies|posts|officer|clerk|constable|teacher|engineer|apply/i.test(title)) {
        const slug = `${baseSlug}-2026`;
        if (!existingJobSlugs.has(slug)) {
          const org = detectOrganization(title);
          existingJobs.unshift({
            slug,
            title: `${title} Recruitment 2026`,
            shortTitle: title.slice(0, 40),
            organization: org,
            category: detectCategory(title),
            vacancies: 500,
            postDate: pubDate,
            startDate: pubDate,
            lastDate: 'Check Official Notification',
            applyUrl: rawLink || 'https://govtjob.salarypitcher.com/latest-jobs/',
            salary: 'As per 7th Pay Commission Matrix',
            qualify: '10th / 12th / Graduate / Diploma',
            feeGeneral: 'Check Notification',
            feeSC_ST: 'Check Notification',
            feePH: 'Check Notification',
            ageMin: 18,
            ageMax: 40,
            examDate: 'To be announced',
            resultDate: 'To be announced',
            howToApply: [
              'Visit the official website of the recruiting organization.',
              'Find the relevant recruitment notification.',
              'Register and fill the online application form.',
              'Upload required documents (photograph, signature, certificates).',
              'Pay the application fee online.',
              'Submit the form and save/print the confirmation.',
            ],
            selectionProcess: ['Written Examination', 'Skill/Physical Test (if applicable)', 'Document Verification', 'Final Merit List'],
            importantLinks: [
              { label: 'Apply Online', url: rawLink || '#' },
              { label: 'Download Notification', url: '#' },
              { label: 'Official Website', url: '#' },
            ],
            examPattern: [
              {
                stage: 'Prelims',
                subjects: 'Reasoning, English, Quantitative Aptitude, General Awareness',
                questions: 200,
                maxMarks: 200,
                duration: '120 minutes'
              },
              {
                stage: 'Mains',
                subjects: 'Economic & Social Issues, Agriculture & Rural Development, English, Computer Knowledge',
                questions: 200,
                maxMarks: 200,
                duration: '120 minutes'
              }
            ],
            salaryDetails: {
              payScale: 'As per 7th Pay Commission Matrix',
              grossSalary: '₹60,000 to ₹70,000 (including allowances)',
              allowances: 'Dearness Allowance, HRA, Special Allowance, Medical Benefits'
            },
            faq: [
              {
                question: `${title.slice(0, 40)} ka exam kab hoga?`,
                answer: 'Exam date abhi officially announce nahi hui hai. Official notification aane ke baad date confirm hogi.'
              },
              {
                question: `${title.slice(0, 40)} mein kitni vacancy hai?`,
                answer: 'Is recruitment mein total 500 posts hain. Detailed vacancy breakdown official notification mein hai.'
              },
              {
                question: `${title.slice(0, 40)} ke liye online apply kaise karein?`,
                answer: 'Official website par jaake registration karein, form fill karein, documents upload karein aur fee pay karein.'
              },
              {
                question: `${title.slice(0, 40)} ki eligibility kya hai?`,
                answer: 'Educational qualification: 10th / 12th / Graduate / Diploma. Age limit: 18-40 years. Age relaxation SC/ST: 5 yrs, OBC: 3 yrs, PH: 10 yrs.'
              },
              {
                question: `${title.slice(0, 40)} ki last date kya hai?`,
                answer: 'Online apply ki last date abhi officially announce nahi hui hai. Check official notification.'
              }
            ],
            socialLinks: {
              telegram: '#',
              whatsapp: '#',
              facebook: '#'
            },
            autoSynced: true
          });
          existingJobSlugs.add(slug);
          stats.jobs++;
        }
      }
    }
  }

  // Persist files if changes exist
  let hasUpdates = false;
  if (stats.jobs > 0) { writeJSON(JOBS_FILE, existingJobs); hasUpdates = true; }
  if (stats.results > 0) { writeJSON(RESULTS_FILE, existingResults); hasUpdates = true; }
  if (stats.admitCards > 0) { writeJSON(ADMIT_CARDS_FILE, existingAdmitCards); hasUpdates = true; }
  if (stats.yojanas > 0) { writeJSON(YOJANA_FILE, existingYojanas); hasUpdates = true; }
  if (stats.answerKeys > 0) { writeJSON(ANSWER_KEYS_FILE, existingAnswerKeys); hasUpdates = true; }

  if (hasUpdates) {
    try {
      console.log('🔄 Regenerating Sitemap...');
      const sitemapScript = path.join(ROOT, 'src/scripts/generate-sitemap.mjs');
      if (fs.existsSync(sitemapScript)) {
        execSync(`node "${sitemapScript}"`, { stdio: 'ignore' });
        console.log('✓ Sitemap regenerated successfully.');
      }

      // Auto-ping Google Indexing API
      const pingScript = path.join(ROOT, 'src/scripts/google-index-ping.mjs');
      if (fs.existsSync(pingScript)) {
        console.log('🚀 [Live Agent] Auto-submitting latest updates to Google Indexing API...');
        execSync(`node "${pingScript}" --limit=20`, { stdio: 'inherit' });
      }
    } catch (e) {
      console.warn('⚠️ Post-update hook warning:', e.message);
    }
  }

  console.log(`\n📊 [Live Agent Report] New Updates Added:`);
  console.log(`   🟢 Latest Jobs:   +${stats.jobs}`);
  console.log(`   🟢 Results:       +${stats.results}`);
  console.log(`   🟢 Admit Cards:   +${stats.admitCards}`);
  console.log(`   🟢 Sarkari Yojana:+${stats.yojanas}`);
  console.log(`   🟢 Answer Keys:   +${stats.answerKeys}`);
  console.log(`======================================================\n`);

  return stats;
}

// Command-line execution
const args = process.argv.slice(2);
const isDaemon = args.includes('--daemon');
const intervalArg = args.find(a => a.startsWith('--interval='));
const intervalMinutes = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : 15;

if (isDaemon) {
  console.log(`🚀 [Live Agent Daemon] Running in background mode (Scanning every ${intervalMinutes} minutes)...`);
  runLiveAgent().catch(console.error);

  setInterval(() => {
    runLiveAgent().catch(console.error);
  }, intervalMinutes * 60 * 1000);
} else {
  runLiveAgent().catch(console.error);
}
