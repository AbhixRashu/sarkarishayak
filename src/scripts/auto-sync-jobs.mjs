/**
 * auto-sync-jobs.mjs
 * 24/7 Automated Government Job & Notification Ingestion Engine
 * Fetches latest updates from public RSS/API feeds, formats, validates,
 * deduplicates against local JSON data, and updates datasets.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT, 'src/data');

const JOBS_FILE = path.join(DATA_DIR, 'latest-jobs.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const ADMIT_CARDS_FILE = path.join(DATA_DIR, 'admit-cards.json');

// Helper to safely read JSON (with BOM strip)
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
    console.error(`Error reading ${filePath}:`, err.message);
  }
  return fallback;
}

// Helper to write JSON with clean formatting
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`✓ Successfully updated ${path.basename(filePath)} (${data.length} total entries)`);
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
  }
}

// Helper to create URL-friendly slug
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function syncGovtJobs() {
  console.log('🔄 [Auto-Sync] Starting 24/7 automated government job sync...');
  
  const existingJobs = readJSON(JOBS_FILE);
  const existingResults = readJSON(RESULTS_FILE);
  const existingAdmitCards = readJSON(ADMIT_CARDS_FILE);

  const existingJobSlugs = new Set(existingJobs.map(j => j.slug));
  const existingResultSlugs = new Set(existingResults.map(r => r.slug));
  const existingAdmitCardSlugs = new Set(existingAdmitCards.map(a => a.slug));

  let newJobsCount = 0;
  let newResultsCount = 0;
  let newAdmitCardsCount = 0;

  // Real-time Feed Sources (RSS & Open Data endpoints)
  const RSS_FEEDS = [
    { url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1', type: 'job' },
    { url: 'https://upsc.gov.in/rss.xml', type: 'job' }
  ];

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (SarkariSahayakBot/2.0; +https://govtjob.salarypitcher.com)' }
      });
      if (!res.ok) continue;
      const xml = await res.text();
      
      // Extract <item> tags from RSS
      const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
      for (const itemXml of items) {
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || itemXml.match(/<title>(.*?)<\/title>/i);
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/i) || itemXml.match(/<guid[^>]*>(.*?)<\/guid>/i);
        const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i);

        if (!titleMatch || !titleMatch[1]) continue;
        const title = titleMatch[1].trim();
        const rawLink = linkMatch ? linkMatch[1].trim() : '';
        const pubDate = dateMatch ? new Date(dateMatch[1]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        const slug = slugify(title).slice(0, 50) + '-2026';

        // Check if recruitment / job item
        if (/recruitment|vacancy|officer|clerk|constable|teacher|engineer|apply/i.test(title)) {
          if (!existingJobSlugs.has(slug)) {
            existingJobs.unshift({
              slug,
              title: `${title} 2026`,
              shortTitle: title.slice(0, 35),
              organization: /upsc/i.test(title) ? 'UPSC' : /ssc/i.test(title) ? 'SSC' : /rrb|railway/i.test(title) ? 'Railway' : 'Govt of India',
              category: /banking|sbi|ibps/i.test(title) ? 'banking' : /rrb|railway/i.test(title) ? 'railway' : /upsc|ssc/i.test(title) ? 'central' : 'other',
              vacancies: 1000,
              startDate: pubDate,
              lastDate: 'Check Notification',
              applyUrl: rawLink || 'https://govtjob.salarypitcher.com/latest-jobs/',
              salary: 'As per 7th Pay Commission',
              qualify: 'Graduate / 10th / 12th',
              autoSynced: true
            });
            existingJobSlugs.add(slug);
            newJobsCount++;
          }
        } else if (/result|merit list|score card/i.test(title)) {
          if (!existingResultSlugs.has(slug)) {
            existingResults.unshift({
              slug,
              title: `${title} 2026`,
              shortTitle: title.slice(0, 35),
              organization: 'Govt of India',
              category: 'central',
              releaseDate: pubDate,
              resultUrl: rawLink || 'https://govtjob.salarypitcher.com/results/',
              status: 'Declared',
              autoSynced: true
            });
            existingResultSlugs.add(slug);
            newResultsCount++;
          }
        } else if (/admit card|hall ticket|call letter/i.test(title)) {
          if (!existingAdmitCardSlugs.has(slug)) {
            existingAdmitCards.unshift({
              slug,
              title: `${title} Admit Card 2026`,
              shortTitle: title.slice(0, 35),
              organization: 'Govt of India',
              category: 'central',
              releaseDate: pubDate,
              downloadUrl: rawLink || 'https://govtjob.salarypitcher.com/admit-cards/',
              status: 'Released',
              autoSynced: true
            });
            existingAdmitCardSlugs.add(slug);
            newAdmitCardsCount++;
          }
        }
      }
    } catch (err) {
      console.warn(`[Auto-Sync] Notice fetching ${feed.url}:`, err.message);
    }
  }

  // Save updated data files
  if (newJobsCount > 0) writeJSON(JOBS_FILE, existingJobs);
  if (newResultsCount > 0) writeJSON(RESULTS_FILE, existingResults);
  if (newAdmitCardsCount > 0) writeJSON(ADMIT_CARDS_FILE, existingAdmitCards);

  console.log(`✅ [Auto-Sync Complete] Synced: +${newJobsCount} Jobs, +${newResultsCount} Results, +${newAdmitCardsCount} Admit Cards.`);
}

syncGovtJobs().catch(console.error);
