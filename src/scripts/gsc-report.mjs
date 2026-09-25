/**
 * gsc-report.mjs — Google Search Console: sitemap auto-submit + TRAFFIC REPORT
 *
 * Do kaam karta hai (dono automatic):
 *
 *   1. SITEMAP AUTO-SUBMIT
 *      GSC API (PUT /webmasters/v3/sites/{site}/sitemaps/{sitemap}) se Google ko
 *      sitemap submit karta hai. Google ka purana "ping" endpoint 2023 me band ho
 *      gaya tha (HTTP 404), aur Bing ka bhi (HTTP 410). IndexNow chal raha hai
 *      (Bing/Yandex), par GOOGLE ke liye yehi ek official auto-submit raasta hai.
 *
 *   2. TRAFFIC REPORT (Telegram par)
 *      Google ke asli aankde: clicks, impressions, CTR, average position, top
 *      queries, top pages — aur pichle hafte se TULNA (badha ya ghata).
 *      Isse "clicks kam ho gaye kya?" ka jawab andaaze se nahi, data se milta hai.
 *
 * Usage:
 *   node src/scripts/gsc-report.mjs                  # submit + 7-din report
 *   node src/scripts/gsc-report.mjs --days=28        # 28-din report
 *   node src/scripts/gsc-report.mjs --submit         # sirf sitemap submit
 *   node src/scripts/gsc-report.mjs --report         # sirf report
 *   node src/scripts/gsc-report.mjs --dry-run        # Telegram par mat bhejo
 *   node src/scripts/gsc-report.mjs --enable-api     # API band ho to enable karo
 *
 * Env: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (.env.local ya GitHub secret)
 * Missing credentials => clean SKIP, exit 0. Kabhi pipeline nahi todta.
 */

import fs from 'fs';
import path from 'path';
import {
  loadServiceAccount, getGoogleAccessToken, GOOGLE_SCOPES,
  SITE_ORIGIN, SITEMAP_URL, ROOT
} from './google-auth.mjs';
import { sendTelegramMessage, isTelegramConfigured } from './telegram-notify.mjs';

const GSC_API = 'https://www.googleapis.com/webmasters/v3';

// Google Search Console date format: YYYY-MM-DD
function isoDate(d) {
  return d.toISOString().split('T')[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function num(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function prettyDate(iso) {
  const [y, m, dd] = String(iso).split('-');
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dd} ${M[Number(m) - 1]}`;
}

// Telegram HTML escape
function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { days: 7, submit: false, report: false, dryRun: false, send: false };
  for (const a of argv) {
    if (a.startsWith('--days=')) opts.days = Math.max(1, parseInt(a.split('=')[1], 10) || 7);
    else if (a === '--submit') opts.submit = true;
    else if (a === '--report') opts.report = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--send') opts.send = true;
  }
  // Kuch bhi specify na karo to dono karo
  if (!opts.submit && !opts.report) { opts.submit = true; opts.report = true; }
  return opts;
}

// ---------------------------------------------------------------------------
// GSC API calls
// ---------------------------------------------------------------------------
async function gscFetch(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text };
}

/** Best-effort: GSC API band ho to enable kar do (service account ke paas aksar
 *  Service Usage permission hoti hai). Pehle yeh manually karna padta tha.
 *  NOTE: is project me API already enabled hai — ye fallback ke liye rakha hai. */
async function tryEnableGscApi(keyData) {
  try {
    const token = await getGoogleAccessToken(keyData, GOOGLE_SCOPES.cloudPlatform);
    // Project number '- ' (auto) ke saath enable call — service account ke
    // paas Service Usage Admin ho to ye khud chalu ho jaata hai.
    const res = await fetch(
      'https://serviceusage.googleapis.com/v1/projects/-/services/searchconsole.googleapis.com:enable',
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export { tryEnableGscApi };

/** Sitemap submit karo. @returns {{ok:boolean,status:number,message:string}} */
export async function submitSitemap(token) {
  const url = `${GSC_API}/sites/${encodeURIComponent(SITE_ORIGIN + '/')}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`;
  const res = await gscFetch(token, url, { method: 'PUT' });
  // Google 204 (No Content) deta hai success par
  if (res.status === 204 || res.ok) {
    return { ok: true, status: res.status, message: 'submitted' };
  }
  return { ok: false, status: res.status, message: res.text.slice(0, 200) };
}

/** Ek date range ka aggregate data. */
async function queryRange(token, startDate, endDate, dimensions, rowLimit = 10) {
  const body = { startDate, endDate, rowLimit };
  if (dimensions && dimensions.length) body.dimensions = dimensions;
  const res = await gscFetch(
    token,
    `${GSC_API}/sites/${encodeURIComponent(SITE_ORIGIN + '/')}/searchAnalytics/query`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  if (!res.ok) return { rows: [], error: res.text.slice(0, 200) };
  return res.json || { rows: [] };
}

function totalsOf(result) {
  const row = result.rows && result.rows[0];
  if (!row) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0
  };
}

// ---------------------------------------------------------------------------
// Report banana
// ---------------------------------------------------------------------------
function deltaLine(label, current, previous, isGoodWhenUp = true) {
  const diff = current - previous;
  if (previous === 0 && current === 0) return `${label}: 0 (koi change nahi)`;
  let arrow = '➖';
  if (diff > 0) arrow = isGoodWhenUp ? '🟢 +' : '🔴 +';
  else if (diff < 0) arrow = isGoodWhenUp ? '🔴 ' : '🟢 ';
  const pct = previous > 0 ? ` (${diff >= 0 ? '+' : ''}${((diff / previous) * 100).toFixed(1)}%)` : '';
  return `${label}: <b>${num(current)}</b> ${arrow}${num(Math.abs(diff))}${pct} pichhle hafte se`;
}

/**
 * Poora Telegram report message banao.
 * @returns {Promise<{text: string, snapshot: object}>}
 */
export async function buildTrafficReport(token, days = 7) {
  // Aaj ka data usually adhoora hota hai, isliye 2 din peeche se shuru karo
  const end = daysAgo(2);
  const start = daysAgo(2 + days - 1);
  const prevEnd = daysAgo(2 + days);
  const prevStart = daysAgo(2 + days * 2 - 1);

  const range = { start: isoDate(start), end: isoDate(end) };
  const prevRange = { start: isoDate(prevStart), end: isoDate(prevEnd) };

  const [now, before, queries, pages, allPages] = await Promise.all([
    queryRange(token, range.start, range.end, null),
    queryRange(token, prevRange.start, prevRange.end, null),
    queryRange(token, range.start, range.end, ['query'], 5),
    queryRange(token, range.start, range.end, ['page'], 5),
    queryRange(token, range.start, range.end, ['page'], 25000)
  ]);

  const cur = totalsOf(now);
  const prev = totalsOf(before);

  const allRows = allPages.rows || [];
  const withClicks = allRows.filter(r => r.clicks > 0).length;
  const zeroClicks = allRows.length - withClicks;

  const L = [];
  L.push(`📊 <b>GOOGLE TRAFFIC REPORT</b>`);
  L.push(`🌐 govtjob.salarypitcher.com`);
  L.push(`📅 ${prettyDate(range.start)} – ${prettyDate(range.end)} (${days} din)`);
  L.push('');
  L.push(`👆 Clicks       : <b>${num(cur.clicks)}</b>`);
  L.push(`👁️ Impressions  : <b>${num(cur.impressions)}</b>`);
  L.push(`🎯 CTR          : <b>${(cur.ctr * 100).toFixed(2)}%</b>`);
  L.push(`📈 Avg position : <b>${cur.position.toFixed(1)}</b>`);
  L.push('');
  L.push(`📊 <b>Pichhle hafte se tulna:</b>`);
  L.push(deltaLine('   Clicks', cur.clicks, prev.clicks, true));
  L.push(deltaLine('   Impressions', cur.impressions, prev.impressions, true));
  L.push(deltaLine('   Avg position', Number(cur.position.toFixed(1)), Number(prev.position.toFixed(1)), false));

  if (queries.rows && queries.rows.length) {
    L.push('');
    L.push(`🔍 <b>Top queries:</b>`);
    queries.rows.forEach((r, i) => {
      L.push(`   ${i + 1}. ${esc(String(r.keys[0]).slice(0, 48))} — ${r.clicks} clicks`);
    });
  }

  if (pages.rows && pages.rows.length) {
    L.push('');
    L.push(`📄 <b>Top pages:</b>`);
    pages.rows.forEach((r, i) => {
      const p = String(r.keys[0]).replace(/^https?:\/\/[^/]+/, '') || '/';
      L.push(`   ${i + 1}. ${esc(p.slice(0, 52))} — ${r.clicks} clicks`);
    });
  }

  L.push('');
  L.push(`📋 <b>Pages ki sthiti:</b>`);
  L.push(`   Google me dikhe      : <b>${num(allRows.length)}</b>`);
  L.push(`   Clicks mile          : <b>${num(withClicks)}</b>`);
  L.push(`   ZERO clicks          : <b>${num(zeroClicks)}</b>`);

  return {
    text: L.join('\n'),
    snapshot: { range, cur, prev, pagesSeen: allRows.length, withClicks, zeroClicks }
  };
}


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export async function runGscReport(opts = {}) {
  const options = { days: 7, submit: true, report: true, dryRun: false, ...opts };

  const { keyData, source: credSource } = loadServiceAccount();
  if (!keyData) {
    console.log('ℹ️  [GSC] SKIPPED — no service account credentials found.');
    console.log('   Local : keep service-account.json in the project root (gitignored).');
    console.log('   Cloud : set env GOOGLE_SERVICE_ACCOUNT_JSON as a secret.');
    return { skipped: true };
  }

  console.log(`🔑 [GSC] Service Account: ${keyData.client_email}`);
  console.log(`📦 [GSC] Credentials:     ${credSource}`);

  let token;
  try {
    token = await getGoogleAccessToken(keyData, GOOGLE_SCOPES.webmasters);
  } catch (err) {
    console.error('❌ [GSC] Authentication failed:', err.message);
    return { error: err.message };
  }

  let submitted = null;

  // Report public channel par nahi jaani chahiye (subscribers ko spam lagega).
  // Isliye alag chat chahiye, ya explicit --send flag.
  const reportChat = (process.env.TELEGRAM_REPORT_CHAT_ID || '').trim();
  const canSend = Boolean(reportChat) || options.send;

  // ---- 1. Sitemap submit ----
  if (options.submit) {
    submitted = await submitSitemap(token);
    if (submitted.ok) {
      console.log(`✅ [GSC] Sitemap submitted to Google (HTTP ${submitted.status}) — ${SITEMAP_URL}`);
    } else if (submitted.status === 403 && /has not been used in project|disabled/i.test(submitted.message)) {
      console.warn('⚠️  [GSC] Search Console API is DISABLED on this project.');
      console.warn('   Enable it once (1 click):');
      console.warn('   https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project=305925188546');
      console.warn('   ...ya: node src/scripts/gsc-report.mjs --enable-api');
    } else {
      console.warn(`⚠️  [GSC] Sitemap submit failed (HTTP ${submitted.status}): ${submitted.message}`);
    }
  }

  // ---- 2. Traffic report ----
  if (!options.report) return { submitted };

  const { text, snapshot } = await buildTrafficReport(token, options.days);

  console.log('\n' + text.replace(/<[^>]+>/g, '') + '\n');

  if (options.dryRun) {
    console.log('ℹ️  --dry-run: Telegram par kuch nahi bheja gaya.');
  } else if (!isTelegramConfigured()) {
    console.log('ℹ️  [Telegram] Skipped — TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID set nahi hain.');
  } else if (!canSend) {
    console.log('ℹ️  Report Telegram par nahi bheji gayi (default behaviour).');
    console.log('   Public channel par spam se bachne ke liye report ek ALAG chat me jaati hai.');
    console.log('   Chalu karne ke liye .env.local / GitHub secret me set karo:');
    console.log('      TELEGRAM_REPORT_CHAT_ID=<tumhara private chat id>');
    console.log('   ...ya ek baar turant bhejne ke liye: node src/scripts/gsc-report.mjs --send');
  } else {
    const lines = [];
    if (submitted && submitted.ok) lines.push('📤 Sitemap: ✅ Google ko submit kar diya gaya');
    else if (submitted) lines.push(`📤 Sitemap: ⚠️ submit nahi hua (HTTP ${submitted.status})`);
    lines.push('');
    lines.push(text);
    const ok = await sendTelegramMessage(lines.join('\n'), reportChat || undefined);
    console.log(ok ? '📣 [Telegram] Traffic report bhej diya.' : '⚠️  [Telegram] Report nahi bhej paye (upar reason dekho).');
  }

  return { submitted, snapshot };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('gsc-report.mjs');
if (isDirectRun) {
  const opts = parseArgs(process.argv.slice(2));
  await runGscReport(opts);
}

