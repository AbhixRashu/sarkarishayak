/**
 * indexnow-utils.mjs
 * Reusable IndexNow helper — streaming mode (Bing recommended).
 *
 * STREAMING MODE: Each URL is submitted individually with a delay between them.
 * This avoids the "batch mode" warning in Bing Webmaster Tools.
 *
 * Usage:
 *   import { pingIndexNow, pingIndexNowStream } from './indexnow-utils.mjs';
 *
 *   // Single URL (ideal: call on every new page publish)
 *   await pingIndexNow('https://govtjob.salarypitcher.com/latest-jobs/some-slug/');
 *
 *   // Stream multiple URLs one-by-one (streaming mode, Bing compliant)
 *   await pingIndexNowStream(urlArray);
 */

const INDEXNOW_KEY = '4d1dfba9aa07492a98672edb71029e25';
const SITE_HOST = 'govtjob.salarypitcher.com';
const KEY_LOCATION = `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`;
const API_ENDPOINT = 'https://api.indexnow.org/indexnow';

// Streaming mode: 500ms delay between individual URL submissions
// Keeps load even & prevents "batch mode" Bing warning
const STREAM_DELAY_MS = 500;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Submit a single URL to IndexNow API.
 * @param {string} url - The URL to submit
 */
async function submitSingleUrl(url) {
  const payload = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: [url]
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
    const result = await submitSingleUrl(url);
    console.log(`[IndexNow] ${result.ok ? '✓' : '✗'} ${url} (HTTP ${result.status})`);
    return result;
  } catch (err) {
    console.error(`[IndexNow] ✗ ${url} — ${err.message}`);
    return { ok: false, status: 0, body: err.message };
  }
}

/**
 * Stream multiple URLs to IndexNow — ONE BY ONE with delay (Bing streaming mode).
 * Replaces the old batch/chunk approach to avoid Bing "batch mode" warning.
 * 
 * @param {string[]} urls - Array of URLs to submit
 * @param {number} delayMs - Delay between each URL submission (default: 500ms)
 */
export async function pingIndexNowStream(urls, delayMs = STREAM_DELAY_MS) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return { total: 0, success: 0, fail: 0 };
  }

  let success = 0;
  let fail = 0;

  console.log(`[IndexNow] Streaming ${urls.length} URLs (${delayMs}ms delay each)...\n`);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const result = await submitSingleUrl(url);
      if (result.ok) {
        success++;
        console.log(`[${i + 1}/${urls.length}] ✓ ${url}`);
      } else {
        fail++;
        console.warn(`[${i + 1}/${urls.length}] ✗ (HTTP ${result.status}): ${url}`);
        if (result.body) console.warn(`   Reason: ${result.body}`);
      }
    } catch (err) {
      fail++;
      console.error(`[${i + 1}/${urls.length}] ✗ Error: ${url} — ${err.message}`);
    }

    // Streaming delay between each URL (skip after last)
    if (i < urls.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log(`\n[IndexNow] Summary: ${success} success, ${fail} failed out of ${urls.length} total`);
  return { total: urls.length, success, fail };
}

/**
 * @deprecated Use pingIndexNowStream() instead.
 * Kept for backwards compatibility — now internally uses streaming mode.
 */
export async function pingIndexNowBatch(urls) {
  console.warn('[IndexNow] ⚠️  pingIndexNowBatch() is deprecated. Using streaming mode instead.');
  return pingIndexNowStream(urls);
}

export { INDEXNOW_KEY, SITE_HOST, KEY_LOCATION };
