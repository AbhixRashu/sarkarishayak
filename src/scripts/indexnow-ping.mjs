/**
 * indexnow-ping.mjs
 * CLI script to submit URLs to IndexNow API (Bing-compliant, chunked).
 *
 * Usage:
 *   node src/scripts/indexnow-ping.mjs                     # ping all sitemap URLs in chunks of 5
 *   node src/scripts/indexnow-ping.mjs https://example.com/page  # ping single URL
 *   node src/scripts/indexnow-ping.mjs --limit=50           # ping first 50 URLs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pingIndexNow, pingIndexNowBatch } from './indexnow-utils.mjs';

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
  console.log('🚀 [IndexNow] Bing-compliant chunked submission pipeline...\n');

  const args = process.argv.slice(2);
  const specificUrl = args.find(a => a.startsWith('http'));
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 5000;

  let urlsToPing = [];

  if (specificUrl) {
    urlsToPing = [specificUrl];
  } else {
    urlsToPing = getSitemapUrls(limit);
  }

  if (urlsToPing.length === 0) {
    console.log('⚠️  No URLs found. Run `npm run sitemap` first.');
    process.exit(1);
  }

  console.log(`📡 Submitting ${urlsToPing.length} URLs in chunks of 5 (2s delay between chunks)...\n`);

  const result = await pingIndexNowBatch(urlsToPing);

  console.log(`\n======================================================`);
  console.log(`📊 [IndexNow Summary]`);
  console.log(`   🟢 Successfully Submitted: ${result.success}`);
  console.log(`   🔴 Failed: ${result.fail}`);
  console.log(`   📦 Total: ${result.total}`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
