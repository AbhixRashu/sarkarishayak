/**
 * GET /api/cron-index
 * Vercel Cron endpoint — auto-pings Google Indexing API + IndexNow
 * with newly added URLs from the sitemap.
 *
 * Secured via VERCEL_CRON_SECRET (auto-injected by Vercel cron jobs).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SITEMAP_FILE = path.join(process.cwd(), 'public/sitemap.xml');
const SITE_URL = 'https://govtjob.salarypitcher.com';

// IndexNow config
const INDEXNOW_KEY = '4d1dfba9aa07492a98672edb71029e25';
const INDEXNOW_API = 'https://api.indexnow.org/indexnow';

function base64url(input) {
  const b = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input).toString('base64');
  return b.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getGoogleAccessToken(keyData) {
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: keyData.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: iat + 3600,
    iat
  };
  const sigInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sig = crypto.createSign('RSA-SHA256').update(sigInput).sign(keyData.private_key, 'base64url');
  const jwt = `${sigInput}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth failed (${res.status}): ${JSON.stringify(data)}`);
  return data.access_token;
}

async function googlePing(url, token) {
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ url, type: 'URL_UPDATED' })
  });
  return { ok: res.ok, status: res.status };
}

async function indexnowPing(urls) {
  const res = await fetch(INDEXNOW_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'govtjob.salarypitcher.com',
      key: INDEXNOW_KEY,
      keyLocation: `https://govtjob.salarypitcher.com/${INDEXNOW_KEY}.txt`,
      urlList: urls
    })
  });
  return { ok: res.ok, status: res.status };
}

function getRecentUrls(limit = 20) {
  if (!fs.existsSync(SITEMAP_FILE)) return [];
  const xml = fs.readFileSync(SITEMAP_FILE, 'utf-8');
  const matches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
  const urls = matches.map(m => m.replace(/<\/?loc>/g, '').trim());
  // Return the last N URLs (most recently added)
  return urls.slice(-limit);
}

export async function GET({ request }) {
  // Verify cron secret (Vercel injects this for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.VERCEL_CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const results = { google: { submitted: 0, failed: 0 }, indexnow: { submitted: 0, failed: 0 }, urls: [] };
  const urls = getRecentUrls(20);
  results.urls = urls;

  if (urls.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: 'No URLs found', results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Google Indexing API
  try {
    const saPath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(saPath)) {
      const keyData = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
      const token = await getGoogleAccessToken(keyData);
      for (const url of urls) {
        try {
          const r = await googlePing(url, token);
          r.ok ? results.google.submitted++ : results.google.failed++;
        } catch { results.google.failed++; }
        await new Promise(r => setTimeout(r, 50));
      }
    }
  } catch (e) {
    results.google.error = e.message;
  }

  // IndexNow (Bing)
  try {
    // Send in chunks of 5
    for (let i = 0; i < urls.length; i += 5) {
      const chunk = urls.slice(i, i + 5);
      const r = await indexnowPing(chunk);
      r.ok ? results.indexnow.submitted += chunk.length : results.indexnow.failed += chunk.length;
      if (i + 5 < urls.length) await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    results.indexnow.error = e.message;
  }

  return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString(), results }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
