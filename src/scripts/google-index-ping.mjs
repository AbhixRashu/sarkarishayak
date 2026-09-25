/**
 * google-index-ping.mjs
 * Automated Google Indexing API submission for instant crawling & indexing.
 * Pure Node.js (zero external dependencies).
 *
 * ── THE GOOGLE RULE (why whole-site pings do nothing) ───────────────────────
 * Google's Indexing API ONLY schedules pages that contain JobPosting or
 * BroadcastEvent structured data. For every other URL it answers HTTP 200
 * but silently ignores the notification. Default quota is 200 publish
 * calls/day per Google Cloud project.
 * => Submit *exact new/updated URLs*, right after they are added.
 *
 * Usage:
 *   node src/scripts/google-index-ping.mjs <url> [url ...]   # EXACT urls (best)
 *   node src/scripts/google-index-ping.mjs --urls-file=out.json  # url list from a file
 *   node src/scripts/google-index-ping.mjs --limit=20        # first 20 sitemap URLs
 *   node src/scripts/google-index-ping.mjs --sample=25       # 25 random URLs (rotation)
 *   node src/scripts/google-index-ping.mjs --dry-run         # print targets, no API calls
 *
 * Credentials (first match wins):
 *   1. env GOOGLE_SERVICE_ACCOUNT_JSON — raw JSON or base64 JSON
 *                                        (GitHub Actions / Vercel secret)
 *   2. ./service-account.json          — local dev (gitignored)
 *
 * Missing credentials => clean SKIP with exit code 0, so automated
 * pipelines (live-agent / GitHub Actions) never break because of it.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const SERVICE_ACCOUNT_FILE = path.join(ROOT, 'service-account.json');
const SITEMAP_FILE = path.join(ROOT, 'public/sitemap.xml');

const SITE_HOST = 'govtjob.salarypitcher.com';
const SITE_ORIGIN = `https://${SITE_HOST}`;
const PUBLISH_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Base64URL helper
function base64url(input) {
  const base64 = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input).toString('base64');
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Resolve service-account credentials from env (CI) or local file
function loadServiceAccount() {
  const envRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();

  if (envRaw) {
    try {
      const text = envRaw.startsWith('{') ? envRaw : Buffer.from(envRaw, 'base64').toString('utf-8');
      return { keyData: JSON.parse(text), source: 'env GOOGLE_SERVICE_ACCOUNT_JSON' };
    } catch (err) {
      console.error('❌ GOOGLE_SERVICE_ACCOUNT_JSON is set but could not be parsed:', err.message);
      return { keyData: null, source: 'env (invalid)' };
    }
  }

  if (fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    try {
      return { keyData: JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf-8')), source: 'service-account.json' };
    } catch (err) {
      console.error('❌ service-account.json could not be parsed:', err.message);
      return { keyData: null, source: 'service-account.json (invalid)' };
    }
  }

  return { keyData: null, source: null };
}

// Get OAuth2 access token with a signed JWT (service account flow)
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

  const signatureInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(keyData.private_key, 'base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signatureInput}.${signature}`
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OAuth Error (${res.status}): ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

// Publish a single URL to the Google Indexing API
async function publishUrl(url, accessToken, type = 'URL_UPDATED') {
  const res = await fetch(PUBLISH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ url, type })
  });

  let data = {};
  try { data = await res.json(); } catch { /* non-JSON body */ }

  const latestUpdate = data?.urlNotificationMetadata?.latestUpdate || null;
  return { status: res.status, ok: res.ok, data, latestUpdate };
}

// Extract every URL from the generated sitemap
function getSitemapUrls() {
  if (!fs.existsSync(SITEMAP_FILE)) return [];
  const xml = fs.readFileSync(SITEMAP_FILE, 'utf-8');
  const matches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
  return matches.map(m => m.replace(/<\/?loc>/g, '').trim());
}

// ── CLI handling ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const urls = [];
  const opts = { limit: 20, sample: 0, dryRun: false, type: 'URL_UPDATED', urlsFile: '' };

  for (const arg of argv) {
    if (arg.startsWith('http')) urls.push(arg.trim());
    else if (arg.startsWith('--limit=')) opts.limit = Math.max(1, parseInt(arg.split('=')[1], 10) || 20);
    else if (arg.startsWith('--sample=')) opts.sample = Math.max(1, parseInt(arg.split('=')[1], 10) || 0);
    else if (arg.startsWith('--type=')) opts.type = arg.split('=')[1] === 'URL_DELETED' ? 'URL_DELETED' : 'URL_UPDATED';
    else if (arg.startsWith('--urls-file=')) opts.urlsFile = arg.slice('--urls-file='.length).replace(/^"|"$/g, '');
    else if (arg === '--dry-run') opts.dryRun = true;
  }

  return { urls: [...new Set(urls)], opts };
}

function randomSample(list, count) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function pickTargets({ urls, opts }) {
  if (urls.length > 0) return { list: urls, source: 'explicit URLs' };

  if (opts.urlsFile) {
    try {
      const raw = fs.readFileSync(opts.urlsFile, 'utf-8').trim();
      const parsed = raw.startsWith('[') ? JSON.parse(raw) : raw.split(/\r?\n/);
      const clean = [...new Set(
        (Array.isArray(parsed) ? parsed : [])
          .map(u => String(u).trim())
          .filter(u => u.startsWith('http'))
      )];
      return { list: clean, source: `file ${path.basename(opts.urlsFile)}` };
    } catch (err) {
      console.error('❌ Could not read --urls-file:', err.message);
      return { list: [], source: 'urls-file (unreadable)' };
    }
  }

  const sitemapUrls = getSitemapUrls();
  if (sitemapUrls.length === 0) return { list: [], source: 'sitemap (missing or empty)' };

  if (opts.sample > 0) {
    return { list: randomSample(sitemapUrls, opts.sample), source: `random sample of ${opts.sample} sitemap URLs` };
  }
  return { list: sitemapUrls.slice(0, opts.limit), source: `first ${opts.limit} sitemap URLs` };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const { list, source } = pickTargets(parsed);
  const type = parsed.opts.type;

  // Google only accepts URLs belonging to a Search Console verified property
  const targets = list.filter(u => u.startsWith(`${SITE_ORIGIN}/`) || u === SITE_ORIGIN);
  const offsite = list.length - targets.length;

  console.log('🚀 [Google Indexing API] Initializing instant indexing pipeline...\n');
  console.log(`📡 Targets: ${targets.length} (${source})`);
  if (offsite > 0) {
    console.warn(`⚠️  Skipped ${offsite} URL(s) outside ${SITE_ORIGIN} — not part of the verified property.`);
  }

  if (targets.length === 0) {
    console.log('ℹ️  Nothing to submit. Run `npm run sitemap` first, or pass explicit URLs.');
    return 0;
  }

  if (parsed.opts.dryRun) {
    targets.forEach((u, i) => console.log(`   [${i + 1}] ${u}`));
    console.log('\nℹ️  --dry-run: no request was sent to Google.');
    return 0;
  }

  const { keyData, source: credSource } = loadServiceAccount();
  if (!keyData) {
    console.log('\nℹ️  [Google Indexing] SKIPPED — no service account credentials found.');
    console.log('   Local : keep service-account.json in the project root (it is gitignored).');
    console.log('   Cloud : set env GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON or base64) as a secret.');
    return 0;
  }

  console.log(`🔑 Service Account: ${keyData.client_email}`);
  console.log(`🌐 Project ID:      ${keyData.project_id}`);
  console.log(`📦 Credentials:     ${credSource}\n`);

  let accessToken;
  try {
    accessToken = await getGoogleAccessToken(keyData);
    console.log('✓ Successfully authenticated with Google OAuth2!\n');
  } catch (err) {
    console.error('❌ Authentication failed:', err.message);
    return 1;
  }

  let submitted = 0;
  let queued = 0;
  let ignored = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const url = targets[i];
    try {
      const result = await publishUrl(url, accessToken, type);

      if (result.ok) {
        submitted++;
        if (result.latestUpdate) {
          queued++;
          console.log(`[${i + 1}/${targets.length}] ✓ Queued by Google (${result.latestUpdate.notifyTime}): ${url}`);
        } else {
          // HTTP 200 par latestUpdate MISSING hona = Google ne request "samajh" li
          // par koi notification RECORD nahi banaya. Live test me ye 404 wala
          // metadata deta tha — matlab queue me kuch gaya hi nahi.
          ignored++;
          console.warn(`[${i + 1}/${targets.length}] ⚠️  HTTP 200 but Google IGNORED it (no latestUpdate): ${url}`);
        }
      } else {
        failed++;
        console.warn(`[${i + 1}/${targets.length}] ⚠️ Failed (HTTP ${result.status}): ${url}`);
        const reason = result.data?.error?.message;
        if (reason) console.warn(`   Reason: ${reason}`);

        if (result.status === 403) {
          console.warn(`   👉 Add ${keyData.client_email} as OWNER in Search Console → Settings → Users and permissions.`);
        } else if (result.status === 429) {
          console.warn('   👉 Daily quota (default 200/day) exhausted. Retry tomorrow or request more quota in Google Cloud.');
          break;
        }
      }
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${targets.length}] ❌ Error: ${url} (${err.message})`);
    }

    // Gentle delay between requests to avoid rate-limit spikes
    if (i < targets.length - 1) await sleep(120);
  }

  console.log('\n======================================================');
  console.log('📊 [Google Indexing Summary]');
  console.log(`   ✅ ACTUALLY QUEUED (verified):  ${queued}`);
  console.log(`   ⚠️  HTTP 200 but IGNORED:       ${ignored}`);
  console.log(`   🔴 Failed:                      ${failed}`);
  console.log(`   📦 Total attempted:             ${targets.length}`);
  console.log('======================================================\n');

  if (queued === 0 && submitted > 0) {
    console.log('🔴 Google ne EK BHI URL queue nahi kiya (sab 200 par ignore hue).');
    console.log('   Google Indexing API SIRF JobPosting/BroadcastEvent pages accept karta hai,');
    console.log('   aur usse spam/quality filter bhi drop kar sakta hai.');
    console.log('   Iska matlab nahi ki request fail hui — HTTP 200 fine hai, par');
    console.log('   instant crawl trigger KAHI NAHI hua.');
    console.log('   Faithful sitemap crawl + IndexNow (Bing) hi abhi reliable auto-push hai.');
  }
  if (failed > 0) {
    console.log(`💡 For 403 "Permission denied", add ${keyData.client_email} as OWNER of the`);
    console.log('   https://govtjob.salarypitcher.com property in Google Search Console.');
  }

  return failed > 0 && submitted === 0 ? 1 : 0;
}

main()
  .then(code => { process.exitCode = code; })
  .catch(err => { console.error('❌ Unexpected error:', err); process.exitCode = 1; });
