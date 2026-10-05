/**
 * indexnow-ping.mjs
 * CLI script to submit URLs to IndexNow API in STREAMING MODE (Bing recommended).
 *
 * STREAMING MODE: URLs submitted one-by-one with a small delay.
 * This eliminates the Bing "IndexNow is in batch mode" warning.
 *
 * Usage:
 *   node src/scripts/indexnow-ping.mjs                        # stream all sitemap URLs
 *   node src/scripts/indexnow-ping.mjs https://example.com/page  # ping single URL
 *   node src/scripts/indexnow-ping.mjs --today                # sirf AAJ update hue URLs (recommended)
 *   node src/scripts/indexnow-ping.mjs --since=7              # pichle 7 din me change hue URLs
 *   node src/scripts/indexnow-ping.mjs --limit=50             # stream first 50 URLs
 *   node src/scripts/indexnow-ping.mjs --delay=300            # custom delay in ms (default 500ms)
 *   node src/scripts/indexnow-ping.mjs --today --dry-run      # sirf list dikhao, ping mat karo
 *
 * Why --today: purana `--limit=500` har 30 min SAME 500 purane URLs dobara
 * ping karta tha (~24k ping/day) — Bing ko spam signals aur koi fayda nahi.
 * Naye pages khud live-agent se event-driven ping hote hain; ye flag bas
 * "aaj jo badla" usko cover karta hai.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pingIndexNow, pingIndexNowStream } from './indexnow-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const SITEMAP_FILE = path.join(ROOT, 'public/sitemap.xml');

/** Sitemap ke <url> blocks se {loc, lastmod} nikaalo. */
function getSitemapEntries() {
  if (!fs.existsSync(SITEMAP_FILE)) return [];
  const xml = fs.readFileSync(SITEMAP_FILE, 'utf-8');
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
  return blocks.map(b => ({
    loc: (b.match(/<loc>(.*?)<\/loc>/) || [])[1] || '',
    lastmod: (b.match(/<lastmod>(.*?)<\/lastmod>/) || [])[1] || '',
  })).filter(e => e.loc);
}

/** Aaj ki date (IST) — YYYY-MM-DD */
function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getSitemapUrls(limit = 5000) {
  return getSitemapEntries().map(e => e.loc).slice(0, limit);
}

async function main() {
  console.log('🚀 [IndexNow] Streaming mode — Bing-compliant one-by-one submission...\n');

  const args = process.argv.slice(2);
  const specificUrl = args.find(a => a.startsWith('http'));
  const limitArg = args.find(a => a.startsWith('--limit='));
  const delayArg = args.find(a => a.startsWith('--delay='));
  const sinceArg = args.find(a => a.startsWith('--since='));
  const todayMode = args.includes('--today');
  const dryRun = args.includes('--dry-run');

  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5000;
  const delayMs = delayArg ? parseInt(delayArg.split('=')[1], 10) : 500;

  if (specificUrl) {
    // Single URL — direct ping
    console.log(`📡 Submitting single URL: ${specificUrl}\n`);
    const result = await pingIndexNow(specificUrl);
    console.log(result.ok ? '\n✅ Done!' : `\n❌ Failed (HTTP ${result.status})`);
    return;
  }

  let urlsToPing;
  if (todayMode || sinceArg) {
    const now = todayIST();
    const days = sinceArg ? Math.max(1, parseInt(sinceArg.split('=')[1], 10) || 1) : 0;
    const cutoff = new Date(Date.now() - days * 86400000)
      .toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const fromDate = todayMode ? now : cutoff;

    // lastmod >= aaj (ya --since ka cutoff) wale URLs — lekin bina lastmod wale
    // (static pages) ko aaj ka naya samajh kar ping MAT karo.
    urlsToPing = getSitemapEntries()
      .filter(e => e.lastmod && e.lastmod >= fromDate)
      .map(e => e.loc)
      .slice(0, limit);

    console.log(`📅 Filter: lastmod >= ${fromDate} (${urlsToPing.length} URL(s))\n`);
    if (urlsToPing.length === 0) {
      // Ye failure nahi hai — aaj kuch update hua hi nahi. Workflow ko rokna nahi chahiye.
      console.log('✅ No changed URLs to submit — nothing to ping.');
      return;
    }
  } else {
    urlsToPing = getSitemapUrls(limit);
  }

  if (urlsToPing.length === 0) {
    console.log('⚠️  No URLs found. Run `npm run sitemap` first.');
    process.exit(1);
  }

  if (dryRun) {
    console.log(`🔎 DRY RUN — would submit ${urlsToPing.length} URL(s):`);
    urlsToPing.forEach(u => console.log(`   ${u}`));
    return;
  }

  console.log(`📡 Streaming ${urlsToPing.length} URLs — one per request, ${delayMs}ms apart...`);
  console.log(`⏱️  Estimated time: ~${Math.round(urlsToPing.length * delayMs / 1000)}s\n`);

  const result = await pingIndexNowStream(urlsToPing, delayMs);

  console.log(`\n======================================================`);
  console.log(`📊 [IndexNow Streaming Summary]`);
  console.log(`   🟢 Successfully Submitted: ${result.success}`);
  console.log(`   🔴 Failed: ${result.fail}`);
  console.log(`   📦 Total: ${result.total}`);
  console.log(`   🔄 Mode: Streaming (${delayMs}ms per URL)`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
