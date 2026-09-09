/**
 * indexnow-ping.mjs
 * Automated IndexNow API integration for Bing/Yandex instant URL indexing.
 * Pure Node.js (zero external dependencies).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const SITEMAP_FILE = path.join(ROOT, 'public/sitemap.xml');

const INDEXNOW_KEY = '4d1dfba9aa07492a98672edb71029e25';
const SITE_HOST = 'govtjob.salarypitcher.com';

// Extract URLs from sitemap.xml
function getSitemapUrls(limit = 10000) {
  if (!fs.existsSync(SITEMAP_FILE)) return [];
  const xml = fs.readFileSync(SITEMAP_FILE, 'utf-8');
  const matches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
  const urls = matches.map(m => m.replace(/<\/?loc>/g, '').trim());
  return urls.slice(0, limit);
}

// Submit URLs to IndexNow API (max 10,000 per request)
async function submitToIndexNow(urls) {
  const payload = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
    urlList: urls
  };

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  });

  return {
    status: res.status,
    ok: res.ok,
    body: res.ok ? null : await res.text().catch(() => 'No body')
  };
}

async function main() {
  console.log('🚀 [IndexNow] Initializing Bing/Yandex instant indexing pipeline...\n');
  console.log(`🔑 Key:  ${INDEXNOW_KEY}`);
  console.log(`🌐 Host: ${SITE_HOST}\n`);

  // Parse CLI args
  const args = process.argv.slice(2);
  const specificUrl = args.find(a => a.startsWith('http'));
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10000;

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

  console.log(`📡 Preparing to submit ${urlsToPing.length} URLs to IndexNow...\n`);

  // IndexNow supports up to 10,000 URLs per request
  const BATCH_SIZE = 10000;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urlsToPing.length; i += BATCH_SIZE) {
    const batch = urlsToPing.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(urlsToPing.length / BATCH_SIZE);

    try {
      const result = await submitToIndexNow(batch);
      if (result.ok) {
        successCount += batch.length;
        console.log(`[Batch ${batchNum}/${totalBatches}] ✓ Submitted ${batch.length} URLs (HTTP ${result.status})`);
      } else {
        failCount += batch.length;
        console.warn(`[Batch ${batchNum}/${totalBatches}] ⚠️  Failed (HTTP ${result.status})`);
        if (result.body) console.warn(`   Reason: ${result.body}`);
      }
    } catch (e) {
      failCount += batch.length;
      console.error(`[Batch ${batchNum}/${totalBatches}] ❌ Error: ${e.message}`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 [IndexNow Summary]`);
  console.log(`   🟢 Successfully Submitted: ${successCount}`);
  console.log(`   🔴 Failed: ${failCount}`);
  console.log(`======================================================\n`);

  if (failCount > 0) {
    console.log(`💡 NOTES:`);
    console.log(`   - IndexNow key must be verified: https://${SITE_HOST}/${INDEXNOW_KEY}.txt`);
    console.log(`   - Key file exists at: public/${INDEXNOW_KEY}.txt`);
    console.log(`   - Duplicate URLs are automatically ignored by IndexNow`);
  }
}

main().catch(console.error);
