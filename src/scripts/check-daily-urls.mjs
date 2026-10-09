/**
 * check-daily-urls.mjs
 * Inspects all new URLs added today or yesterday using Google Search Console API.
 * Identifies which URLs are ALREADY INDEXED vs NOT INDEXED.
 * Outputs a Notepad-ready list of URLs that need manual submission in GSC!
 *
 * Usage:
 *   node src/scripts/check-daily-urls.mjs             # Checks today's new URLs
 *   node src/scripts/check-daily-urls.mjs --yesterday # Checks yesterday's URLs
 *   node src/scripts/check-daily-urls.mjs --date=2026-10-09 # Specific date
 *   node src/scripts/check-daily-urls.mjs --all       # Checks all recent URLs in daily-new-urls.txt
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadServiceAccount, getGoogleAccessToken, GOOGLE_SCOPES, SITE_ORIGIN } from './google-auth.mjs';
import { getTodayIST, getUrlsByDate } from './url-tracker.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const DAILY_URLS_TXT = path.join(ROOT, 'daily-new-urls.txt');
const UNINDEXED_REPORT_TXT = path.join(ROOT, 'unindexed-urls-to-submit.txt');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Compute yesterday in IST
function getYesterdayIST() {
  const d = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const yesterday = new Date(d.getTime() + istOffset - (24 * 60 * 60 * 1000));
  return yesterday.toISOString().split('T')[0];
}

async function inspectUrl(url, token) {
  try {
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inspectionUrl: url,
        siteUrl: SITE_ORIGIN + '/'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return { url, indexed: false, verdict: 'ERROR', error: data.error?.message || 'API error' };
    }

    const idx = data.inspectionResult?.indexStatusResult;
    const verdict = idx?.verdict || 'UNKNOWN';
    const coverage = idx?.coverageState || 'Unknown';
    // Google ke status: "Crawled - currently not indexed" ya "Discovered - currently not indexed" ka matlab ye abhi search me index NAHI hua hai!
    // Asli indexed tabhi hota hai jab verdict PASS ho aur coverageState me 'Submitted and indexed' ya 'Indexed' ho bina 'not indexed' ke.
    const isActuallyIndexed = verdict === 'PASS' && !coverage.toLowerCase().includes('not indexed');

    return {
      url,
      indexed: isActuallyIndexed,
      verdict,
      coverage,
      lastCrawl: idx?.lastCrawlTime || 'Never'
    };
  } catch (err) {
    return { url, indexed: false, verdict: 'FAIL', error: err.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  let targetDate = getTodayIST();

  if (args.includes('--yesterday')) {
    targetDate = getYesterdayIST();
  } else {
    const dateArg = args.find(a => a.startsWith('--date='));
    if (dateArg) {
      targetDate = dateArg.split('=')[1];
    }
  }

  console.log(`\n======================================================`);
  console.log(`🔍 DAILY URL INDEX INSPECTOR (Target Date: ${targetDate})`);
  console.log(`======================================================\n`);

  // 1. Gather URLs
  let urls = [];
  const entries = getUrlsByDate(targetDate);
  if (entries.length > 0) {
    urls = entries.map(e => e.url);
  } else if (fs.existsSync(DAILY_URLS_TXT)) {
    // Fallback: parse lines from daily-new-urls.txt
    const lines = fs.readFileSync(DAILY_URLS_TXT, 'utf-8').split(/\r?\n/);
    urls = lines
      .map(l => l.trim())
      .filter(l => l.startsWith('http'));
  }

  if (urls.length === 0) {
    console.log(`ℹ️ No new URLs recorded for ${targetDate}.`);
    console.log(`Tip: URLs are logged automatically when 'live-agent.mjs' discovers new jobs/results.`);
    return;
  }

  // Deduplicate
  urls = [...new Set(urls)];
  console.log(`Found ${urls.length} unique URL(s) to verify.\n`);

  // 2. Auth with GSC
  const { keyData, source } = loadServiceAccount();
  if (!keyData) {
    console.warn(`⚠️ Google service account credentials not found (${source}).`);
    console.log(`Exporting all ${urls.length} URL(s) to ${path.basename(UNINDEXED_REPORT_TXT)} for manual inspection:`);
    writeUnindexedReport(urls, []);
    return;
  }

  let token;
  try {
    token = await getGoogleAccessToken(keyData, GOOGLE_SCOPES.webmasters);
  } catch (e) {
    console.error(`❌ Failed to get Google OAuth token:`, e.message);
    writeUnindexedReport(urls, []);
    return;
  }

  console.log(`🚀 Inspecting URL indexing status via Search Console API...\n`);

  const indexedUrls = [];
  const unindexedUrls = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    process.stdout.write(`[${i + 1}/${urls.length}] Inspecting: ${url.replace('https://govtjob.salarypitcher.com', '')}... `);

    const result = await inspectUrl(url, token);

    if (result.indexed) {
      console.log(`✅ INDEXED (${result.coverage})`);
      indexedUrls.push(result);
    } else {
      console.log(`❌ NOT INDEXED (${result.verdict} | ${result.coverage || result.error})`);
      unindexedUrls.push(result);
    }

    // GSC API rate limit safe delay (500ms)
    await sleep(600);
  }

  console.log(`\n================ SUMMARY ================`);
  console.log(`Total URLs Checked: ${urls.length}`);
  console.log(`✅ Already Indexed: ${indexedUrls.length}`);
  console.log(`❌ Not Indexed (Needs Action): ${unindexedUrls.length}`);
  console.log(`=========================================\n`);

  writeUnindexedReport(unindexedUrls.map(u => u.url), indexedUrls.map(u => u.url));
}

function writeUnindexedReport(unindexed, indexed) {
  const content = [
    `# ====================================================================`,
    `# SARKARI SAHAYAK - UNINDEXED URLS LIST (NOTEPAD READY)`,
    `# Date Generated: ${getTodayIST()} (Total To Submit: ${unindexed.length})`,
    `# `,
    `# KAISE SUBMIT KAREIN:`,
    `# 1. Google Search Console kholo (https://search.google.com/search-console)`,
    `# 2. Upar search box (Inspect any URL) mein ek-ek URL paste karo`,
    `# 3. Enter dbao aur fir 'REQUEST INDEXING' button dabao!`,
    `# ====================================================================`,
    '',
    '### UNINDEXED URLS (MANUAL SUBMISSION LIST):',
    ...unindexed,
    '',
    ...(indexed && indexed.length > 0 ? [
      '### ALREADY INDEXED URLS (No Action Needed):',
      ...indexed,
      ''
    ] : [])
  ].join('\n');

  fs.writeFileSync(UNINDEXED_REPORT_TXT, content, 'utf-8');
  console.log(`📄 Notepad file created: ${path.basename(UNINDEXED_REPORT_TXT)}`);
  console.log(`👉 Is file ko Notepad mein khol kar seedhe copy-paste karke Search Console mein submit kar sakte ho!`);
}

main().catch(err => {
  console.error('Fatal error:', err);
});
