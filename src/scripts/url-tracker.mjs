/**
 * url-tracker.mjs
 * Utilities to record newly discovered URLs daily into text & markdown files.
 * Provides clean, Notepad-ready URL lists for easy manual verification or GSC indexing submission.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const LOGS_DIR = path.join(ROOT, 'logs');
const DAILY_URLS_TXT = path.join(ROOT, 'daily-new-urls.txt');
const NEW_URLS_HISTORY_JSON = path.join(LOGS_DIR, 'new-urls-history.json');

// Ensure directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Get IST Date string (YYYY-MM-DD)
export function getTodayIST() {
  const d = new Date();
  // IST offset: UTC+5:30 (330 minutes)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffset);
  return istDate.toISOString().split('T')[0];
}

/**
 * Log new URLs created today.
 * @param {Array<{url: string, title?: string, type?: string, date?: string}>} entries
 */
export function recordNewUrls(entries) {
  if (!entries || entries.length === 0) return;

  ensureDir(LOGS_DIR);
  const today = getTodayIST();
  const dateFileTxt = path.join(LOGS_DIR, `urls-${today}.txt`);

  // 1. Read existing history
  let history = {};
  if (fs.existsSync(NEW_URLS_HISTORY_JSON)) {
    try {
      history = JSON.parse(fs.readFileSync(NEW_URLS_HISTORY_JSON, 'utf-8'));
    } catch {
      history = {};
    }
  }

  if (!history[today]) {
    history[today] = [];
  }

  const existingUrlsToday = new Set(history[today].map(item => item.url));

  const toAdd = [];
  for (const item of entries) {
    const url = typeof item === 'string' ? item : item.url;
    if (!url) continue;
    if (!existingUrlsToday.has(url)) {
      existingUrlsToday.add(url);
      toAdd.push({
        url,
        title: item.title || '',
        type: item.type || 'job',
        discoveredAt: new Date().toISOString()
      });
    }
  }

  if (toAdd.length === 0) {
    return;
  }

  history[today].push(...toAdd);
  fs.writeFileSync(NEW_URLS_HISTORY_JSON, JSON.stringify(history, null, 2), 'utf-8');

  // 2. Append directly to today's date file (Notepad-friendly plain list)
  const plainUrlsToAdd = toAdd.map(i => i.url).join('\n') + '\n';
  fs.appendFileSync(dateFileTxt, plainUrlsToAdd, 'utf-8');

  // 3. Update the root "daily-new-urls.txt" for immediate access
  // Format: clean Notepad list of today's new URLs with header
  const todayAllUrls = history[today].map(i => i.url);
  const rootText = [
    `# =========================================================`,
    `# SARKARI SAHAYAK - NEW URLS LOG (Date: ${today})`,
    `# Total New URLs: ${todayAllUrls.length}`,
    `# Ye list Google Search Console mein manual submit/inspect karne ke liye hai`,
    `# =========================================================`,
    '',
    ...todayAllUrls,
    ''
  ].join('\n');

  fs.writeFileSync(DAILY_URLS_TXT, rootText, 'utf-8');

  console.log(`📝 [URL Tracker] Logged ${toAdd.length} new URL(s) to ${path.basename(DAILY_URLS_TXT)} & logs/urls-${today}.txt`);
}

/**
 * Get URLs discovered on a specific date (or today/yesterday)
 * @param {string} dateStr 'YYYY-MM-DD'
 */
export function getUrlsByDate(dateStr) {
  if (!fs.existsSync(NEW_URLS_HISTORY_JSON)) return [];
  try {
    const history = JSON.parse(fs.readFileSync(NEW_URLS_HISTORY_JSON, 'utf-8'));
    return history[dateStr] || [];
  } catch {
    return [];
  }
}
