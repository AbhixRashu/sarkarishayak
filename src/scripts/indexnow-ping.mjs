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
 *   node src/scripts/indexnow-ping.mjs --limit=50             # stream first 50 URLs
 *   node src/scripts/indexnow-ping.mjs --delay=300            # custom delay in ms (default 500ms)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pingIndexNow, pingIndexNowStream } from './indexnow-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const SITEMAP_FILE = path.join(ROOT, 'public/sitemap.xml');

function getSitemapUrls(limit = 5000) {
  if (!fs.existsSync(SITEMAP_FILE)) return [];
  const xml = fs.readFileSync(SITEMAP_FILE, 'utf-8');
  const matches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
  const urls = matches.map(m => m.replace(/<\/?loc>/g, '').trim());
  return urls.slice(0, limit);
}

async function main() {
  console.log('🚀 [IndexNow] Streaming mode — Bing-compliant one-by-one submission...\n');

  const args = process.argv.slice(2);
  const specificUrl = args.find(a => a.startsWith('http'));
  const limitArg = args.find(a => a.startsWith('--limit='));
  const delayArg = args.find(a => a.startsWith('--delay='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5000;
  const delayMs = delayArg ? parseInt(delayArg.split('=')[1], 10) : 500;

  if (specificUrl) {
    // Single URL — direct ping
    console.log(`📡 Submitting single URL: ${specificUrl}\n`);
    const result = await pingIndexNow(specificUrl);
    console.log(result.ok ? '\n✅ Done!' : `\n❌ Failed (HTTP ${result.status})`);
    return;
  }

  const urlsToPing = getSitemapUrls(limit);

  if (urlsToPing.length === 0) {
    console.log('⚠️  No URLs found. Run `npm run sitemap` first.');
    process.exit(1);
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
