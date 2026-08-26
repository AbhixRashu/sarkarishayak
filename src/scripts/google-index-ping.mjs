/**
 * google-index-ping.mjs
 * Automated Google Indexing API integration for instant URL crawling & indexing.
 * Pure Node.js (zero external dependencies).
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

// Base64URL helper
function base64url(input) {
  const base64 = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input).toString('base64');
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Get OAuth2 Access Token using Google Service Account
async function getGoogleAccessToken(keyData) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: keyData.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: exp,
    iat: iat
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(keyData.private_key, 'base64url');

  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OAuth Error (${res.status}): ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

// Publish URL to Google Indexing API
async function publishUrl(url, accessToken, type = 'URL_UPDATED') {
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      url: url,
      type: type
    })
  });

  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

// Extract URLs from sitemap.xml
function getSitemapUrls(limit = 100) {
  if (!fs.existsSync(SITEMAP_FILE)) return [];
  const xml = fs.readFileSync(SITEMAP_FILE, 'utf-8');
  const matches = xml.match(/<loc>(.*?)<\/loc>/g) || [];
  const urls = matches.map(m => m.replace(/<\/?loc>/g, '').trim());
  return urls.slice(0, limit);
}

async function main() {
  console.log('🚀 [Google Indexing API] Initializing instant indexing pipeline...\n');

  if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    console.error('❌ Service account key file not found at:', SERVICE_ACCOUNT_FILE);
    process.exit(1);
  }

  const keyData = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf-8'));
  console.log(`🔑 Service Account: ${keyData.client_email}`);
  console.log(`🌐 Project ID:      ${keyData.project_id}`);

  let accessToken;
  try {
    accessToken = await getGoogleAccessToken(keyData);
    console.log('✓ Successfully authenticated with Google OAuth2!\n');
  } catch (err) {
    console.error('❌ Authentication failed:', err.message);
    process.exit(1);
  }

  // Parse CLI args
  const args = process.argv.slice(2);
  const specificUrl = args.find(a => a.startsWith('http'));
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

  let urlsToPing = [];

  if (specificUrl) {
    urlsToPing = [specificUrl];
  } else {
    urlsToPing = getSitemapUrls(limit);
  }

  console.log(`📡 Preparing to submit ${urlsToPing.length} URLs to Google Indexing API...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urlsToPing.length; i++) {
    const url = urlsToPing[i];
    try {
      const result = await publishUrl(url, accessToken);
      if (result.ok) {
        successCount++;
        console.log(`[${i + 1}/${urlsToPing.length}] ✓ Submitted: ${url}`);
      } else {
        failCount++;
        console.warn(`[${i + 1}/${urlsToPing.length}] ⚠️ Failed (${result.status}): ${url}`);
        if (result.data?.error?.message) {
          console.warn(`   Reason: ${result.data.error.message}`);
        }
      }
    } catch (e) {
      failCount++;
      console.error(`[${i + 1}/${urlsToPing.length}] ❌ Error: ${url} (${e.message})`);
    }

    // Gentle 50ms delay between requests to avoid rate limit spikes
    if (i < urlsToPing.length - 1) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 [Google Indexing Summary]`);
  console.log(`   🟢 Successfully Submitted: ${successCount}`);
  console.log(`   🔴 Failed / Permission Needed: ${failCount}`);
  console.log(`======================================================\n`);

  if (failCount > 0) {
    console.log(`💡 IMPORTANT: If you see 403 "Permission denied", please ensure you added:`);
    console.log(`   👉 ${keyData.client_email}`);
    console.log(`   as an "Owner" in Google Search Console under Settings -> Users & Permissions.`);
  }
}

main().catch(console.error);
