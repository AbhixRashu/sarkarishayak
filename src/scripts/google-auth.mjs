/**
 * google-auth.mjs — Google service-account authentication (shared)
 *
 * google-index-ping.mjs aur gsc-report.mjs dono isi ko use karte hain, taaki
 * auth ka code ek hi jagah rahe (indexnow-utils.mjs ke same pattern me).
 *
 * Credentials (pehla match jeetta hai):
 *   1. env GOOGLE_SERVICE_ACCOUNT_JSON — raw JSON ya base64 JSON
 *                                       (GitHub Actions / Vercel secret)
 *   2. ./service-account.json          — local dev (gitignored)
 *
 * Koi external dependency nahi — pure Node.js (crypto + fetch).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT = path.resolve(__dirname, '../../');
export const SERVICE_ACCOUNT_FILE = path.join(ROOT, 'service-account.json');

export const SITE_HOST = 'govtjob.salarypitcher.com';
export const SITE_ORIGIN = `https://${SITE_HOST}`;
export const SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`;

/** Raw JSON ya base64 JSON — dono chalte hain. */
export function parseServiceAccount(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  // base64 me '{' nahi hota, isliye seedha check kar lo
  const json = text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf-8');
  return JSON.parse(json);
}

/** Env (CI) ya local file se credentials uthao. */
export function loadServiceAccount() {
  const envRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (envRaw) {
    try {
      return { keyData: parseServiceAccount(envRaw), source: 'env GOOGLE_SERVICE_ACCOUNT_JSON' };
    } catch (err) {
      console.error('❌ GOOGLE_SERVICE_ACCOUNT_JSON is set but could not be parsed:', err.message);
      return { keyData: null, source: 'env (invalid)' };
    }
  }

  if (fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    try {
      const keyData = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf-8'));
      return { keyData, source: 'service-account.json' };
    } catch (err) {
      console.error('❌ service-account.json could not be parsed:', err.message);
      return { keyData: null, source: 'service-account.json (invalid)' };
    }
  }

  return { keyData: null, source: null };
}

// Base64URL helper
function base64url(input) {
  const base64 = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input).toString('base64');
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Service-account JWT flow se OAuth2 access token lo.
 * @param {object} keyData   service account JSON
 * @param {string} scope     e.g. 'https://www.googleapis.com/auth/indexing'
 */
export async function getGoogleAccessToken(keyData, scope) {
  const iat = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: keyData.client_email,
    scope,
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

export const GOOGLE_SCOPES = {
  indexing: 'https://www.googleapis.com/auth/indexing',
  webmasters: 'https://www.googleapis.com/auth/webmasters',
  webmastersReadonly: 'https://www.googleapis.com/auth/webmasters.readonly',
  cloudPlatform: 'https://www.googleapis.com/auth/cloud-platform'
};
