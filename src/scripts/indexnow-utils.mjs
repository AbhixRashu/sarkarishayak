/**
 * indexnow-utils.mjs
 * Reusable IndexNow helper — event-driven, Bing-compliant.
 *
 * Usage:
 *   import { pingIndexNow, pingIndexNowBatch } from './indexnow-utils.mjs';
 *
 *   // Single URL (ideal: call on every new page publish)
 *   await pingIndexNow('https://govtjob.salarypitcher.com/latest-jobs/some-slug/');
 *
 *   // Small batch (max 5 URLs, 2s delay between chunks)
 *   await pingIndexNowBatch(urlArray);
 */

const INDEXNOW_KEY = '4d1dfba9aa07492a98672edb71029e25';
const SITE_HOST = 'govtjob.salarypitcher.com';
const KEY_LOCATION = `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`;
const API_ENDPOINT = 'https://api.indexnow.org/indexnow';

const CHUNK_SIZE = 5;        // Bing recommends small batches
const DELAY_BETWEEN_CHUNKS_MS = 2000;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function submitUrls(urls) {
  const payload = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls
  };

  const res = await fetch(API_ENDPOINT, {
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

/**
 * Ping IndexNow for a single URL.
 * Call this whenever a new page/job/result is published or updated.
 */
export async function pingIndexNow(url) {
  if (!url || typeof url !== 'string') {
    return { ok: false, status: 0, body: 'Invalid URL' };
  }

  try {
    const result = await submitUrls([url]);
    console.log(`[IndexNow] ${result.ok ? '✓' : '✗'} ${url} (HTTP ${result.status})`);
    return result;
  } catch (err) {
    console.error(`[IndexNow] ✗ ${url} — ${err.message}`);
    return { ok: false, status: 0, body: err.message };
  }
}

/**
 * Ping IndexNow for multiple URLs in small chunks (max 5 per request, 2s gap).
 * Use this when you have a few new/updated URLs to submit together.
 */
export async function pingIndexNowBatch(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return { total: 0, success: 0, fail: 0, results: [] };
  }

  const results = [];
  let success = 0;
  let fail = 0;

  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(urls.length / CHUNK_SIZE);

    try {
      const result = await submitUrls(chunk);
      if (result.ok) {
        success += chunk.length;
        console.log(`[IndexNow Chunk ${chunkNum}/${totalChunks}] ✓ ${chunk.length} URLs (HTTP ${result.status})`);
      } else {
        fail += chunk.length;
        console.warn(`[IndexNow Chunk ${chunkNum}/${totalChunks}] ✗ Failed (HTTP ${result.status}): ${result.body}`);
      }
      results.push({ chunk: chunkNum, ok: result.ok, status: result.status, urls: chunk });
    } catch (err) {
      fail += chunk.length;
      console.error(`[IndexNow Chunk ${chunkNum}/${totalChunks}] ✗ Error: ${err.message}`);
      results.push({ chunk: chunkNum, ok: false, status: 0, urls: chunk, error: err.message });
    }

    // Delay between chunks (skip after last chunk)
    if (i + CHUNK_SIZE < urls.length) {
      await sleep(DELAY_BETWEEN_CHUNKS_MS);
    }
  }

  console.log(`[IndexNow] Summary: ${success} success, ${fail} failed out of ${urls.length} total`);
  return { total: urls.length, success, fail, results };
}

export { INDEXNOW_KEY, SITE_HOST, KEY_LOCATION };
