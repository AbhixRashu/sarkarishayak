/**
 * telegram-notify.mjs — Telegram Channel Auto-Poster for Sarkari Sahayak
 *
 * Sends a message to the "Sarkari Sahayak Updates" Telegram channel whenever
 * the live agent saves a new job / result / admit card / answer key / yojana.
 *
 * - Uses Telegram's official Bot API directly (https://api.telegram.org) —
 *   no third-party library or paid service involved.
 * - Credentials come from environment variables ONLY (never hardcoded):
 *     TELEGRAM_BOT_TOKEN  → from @BotFather (keep secret, like a password)
 *     TELEGRAM_CHAT_ID    → e.g. @SarkariSahayakUpdates (public channel)
 *   Locally these live in .env.local (already covered by .gitignore).
 * - Fails safe: if Telegram is unreachable, rate-limits us, or the token is
 *   wrong, the error is logged and the job pipeline continues unaffected.
 * - 1 automatic retry after a short delay, then it gives up and logs.
 *
 * FUTURE (Step 4): this module can be reused for WhatsApp later. Once a
 * WhatsApp Business API (Meta Cloud API) account is set up, add a sibling
 * function (e.g. sendWhatsAppMessage) next to sendTelegramMessage() and call
 * both from notifyNewEntries() — the message-building logic below is
 * channel-agnostic and can be shared.
 *
 * Manual test:  node src/scripts/telegram-notify.mjs --test
 * Preview only: node src/scripts/telegram-notify.mjs --test --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 10000;   // 10s per API call
const RETRY_DELAY_MS = 5000;        // wait 5s before the single retry
const BETWEEN_MESSAGES_MS = 3000;   // spacing to stay under channel rate limits (~20 msg/min)
const DEFAULT_MAX_PER_RUN = 10;     // safety cap per agent cycle

// ---------------------------------------------------------------------------
// Env loading: read .env.local / .env if the vars aren't already in process.env
// (keeps zero-dependency — no dotenv package needed)
// ---------------------------------------------------------------------------
function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.join(ROOT, fileName);
    if (!fs.existsSync(filePath)) continue;
    try {
      const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
      for (const line of lines) {
        if (line.trim().startsWith('#')) continue;
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!match) continue;
        const key = match[1];
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch (err) {
      console.warn(`⚠️ [Telegram] Could not read ${fileName}:`, err.message);
    }
  }
}

loadLocalEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const MAX_PER_RUN = parseInt(process.env.TELEGRAM_MAX_PER_RUN || String(DEFAULT_MAX_PER_RUN), 10);

export function isTelegramConfigured() {
  return Boolean(BOT_TOKEN && CHAT_ID && !BOT_TOKEN.includes('PASTE_'));
}

// ---------------------------------------------------------------------------
// Message building helpers
// ---------------------------------------------------------------------------

// Values the pipeline writes when it has no real data — treated as "missing"
const PLACEHOLDER_VALUES = new Set([
  'check official notification',
  'check notification',
  'to be announced',
  'n/a',
  '#',
  '',
]);

function hasRealValue(value) {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  return !PLACEHOLDER_VALUES.has(str.toLowerCase());
}

// Escape for Telegram HTML parse_mode (& < > must be escaped)
function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build the channel message for one newly saved entry.
 * Only lines with real data are included (no "N/A" noise).
 *
 * @param {Object} entry
 * @param {'jobs'|'results'|'admit-cards'|'answer-keys'|'yojana'} entry.type
 * @param {string} entry.title
 * @param {string} entry.url            Direct link to the page on the site
 * @param {string} [entry.organization]
 * @param {number|string} [entry.vacancies]
 * @param {string} [entry.qualify]      Qualification
 * @param {string} [entry.lastDate]
 * @param {string} [entry.salary]
 * @param {string} [entry.releaseDate]  For results / admit cards / answer keys
 */
export function buildEntryMessage(entry) {
  const lines = [];

  switch (entry.type) {
    case 'jobs':
      lines.push(`🔴 <b>NEW JOB: ${esc(entry.title)}</b>`);
      break;
    case 'results':
      lines.push(`🟢 <b>RESULT OUT: ${esc(entry.title)}</b>`);
      break;
    case 'admit-cards':
      lines.push(`🎫 <b>ADMIT CARD: ${esc(entry.title)}</b>`);
      break;
    case 'answer-keys':
      lines.push(`🔑 <b>ANSWER KEY: ${esc(entry.title)}</b>`);
      break;
    case 'yojana':
      lines.push(`🏛️ <b>NEW YOJANA: ${esc(entry.title)}</b>`);
      break;
    default:
      lines.push(`📢 <b>UPDATE: ${esc(entry.title)}</b>`);
  }

  if (hasRealValue(entry.organization)) lines.push(`🏢 ${esc(entry.organization)}`);
  if (hasRealValue(entry.vacancies))    lines.push(`📋 Vacancies: ${esc(entry.vacancies)}`);
  if (hasRealValue(entry.qualify))      lines.push(`🎓 Qualification: ${esc(entry.qualify)}`);
  if (hasRealValue(entry.lastDate))     lines.push(`📅 Last Date: ${esc(entry.lastDate)}`);
  if (hasRealValue(entry.releaseDate))  lines.push(`📅 Released: ${esc(entry.releaseDate)}`);
  if (hasRealValue(entry.salary))       lines.push(`💰 Salary: ${esc(entry.salary)}`);

  lines.push('');
  lines.push(`👉 <b>Full details &amp; apply:</b> ${esc(entry.url)}`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Telegram Bot API call (direct HTTPS, no library)
// ---------------------------------------------------------------------------
async function callSendMessage(text, chatId = CHAT_ID) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const desc = data.description || `HTTP ${res.status}`;
      const err = new Error(`Telegram API error: ${desc}`);
      err.retryAfter = data?.parameters?.retry_after; // honor rate-limit hint
      throw err;
    }
    return true;
  } finally {
    clearTimeout(timeoutId);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send one message to the channel with 1 retry. NEVER throws — failures are
 * logged and reported via the return value so the job pipeline is unaffected.
 *
 * @param {string} text        Message (HTML parse_mode)
 * @param {string} [chatId]    Override target chat. Traffic report jaisi
 *                             internal cheezein public channel par nahi bhejni
 *                             chahiye, isliye TELEGRAM_REPORT_CHAT_ID se
 *                             alag chat par bheji ja sakti hain.
 */
export async function sendTelegramMessage(text, chatId = CHAT_ID) {
  if (!isTelegramConfigured()) {
    console.warn('⚠️ [Telegram] Skipped — TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set.');
    return false;
  }
  if (!chatId) {
    console.warn('⚠️ [Telegram] Skipped — target chat id missing.');
    return false;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await callSendMessage(text, chatId);
      if (attempt > 1) console.log('✓ [Telegram] Retry succeeded.');
      return true;
    } catch (err) {
      if (attempt === 1) {
        const waitMs = err.retryAfter ? err.retryAfter * 1000 : RETRY_DELAY_MS;
        console.warn(`⚠️ [Telegram] Send failed (${err.message}). Retrying in ${Math.round(waitMs / 1000)}s...`);
        await sleep(waitMs);
      } else {
        console.error(`❌ [Telegram] Retry also failed — giving up. Reason: ${err.message}`);
      }
    }
  }
  return false;
}

/**
 * Notify the channel about every newly saved entry (sequential, rate-limit
 * friendly, capped per run). NEVER throws.
 *
 * @returns {Promise<{sent: number, failed: number, skipped: number}>}
 */
export async function notifyNewEntries(entries) {
  const result = { sent: 0, failed: 0, skipped: 0 };
  if (!Array.isArray(entries) || entries.length === 0) return result;

  if (!isTelegramConfigured()) {
    console.warn(`⚠️ [Telegram] ${entries.length} new entr(ies) saved, but Telegram is not configured — skipping notifications.`);
    result.skipped = entries.length;
    return result;
  }

  const batch = entries.slice(0, MAX_PER_RUN);
  if (entries.length > MAX_PER_RUN) {
    console.warn(`⚠️ [Telegram] ${entries.length} new entries — posting first ${MAX_PER_RUN} only (TELEGRAM_MAX_PER_RUN cap).`);
    result.skipped = entries.length - MAX_PER_RUN;
  }

  for (let i = 0; i < batch.length; i++) {
    const message = buildEntryMessage(batch[i]);
    const ok = await sendTelegramMessage(message);
    if (ok) {
      result.sent++;
      console.log(`📣 [Telegram] Posted: ${batch[i].title.slice(0, 60)}`);
    } else {
      result.failed++;
    }
    // Spacing between messages to respect channel rate limits
    if (i < batch.length - 1) await sleep(BETWEEN_MESSAGES_MS);
  }

  console.log(`📣 [Telegram] Done — sent: ${result.sent}, failed: ${result.failed}, skipped: ${result.skipped}`);
  return result;
}

// ---------------------------------------------------------------------------
// CLI: safe testing with a dummy posting (Step 3)
//   node src/scripts/telegram-notify.mjs --test           → actually sends
//   node src/scripts/telegram-notify.mjs --test --dry-run → prints only
// ---------------------------------------------------------------------------
const cliArgs = process.argv.slice(2);
if (cliArgs.includes('--test')) {
  const dummyEntry = {
    type: 'jobs',
    title: 'TEST — SSC MTS Recruitment 2026 (Dummy Posting, Please Ignore)',
    organization: 'Staff Selection Commission (TEST)',
    vacancies: 1234,
    qualify: '10th Pass',
    lastDate: '15 October 2026',
    salary: '₹18,000 – ₹56,900 (Pay Level-1)',
    url: 'https://govtjob.salarypitcher.com/latest-jobs/',
  };

  const message = buildEntryMessage(dummyEntry);

  if (cliArgs.includes('--dry-run')) {
    console.log('--- DRY RUN: message that would be posted ---\n');
    console.log(message.replace(/<[^>]+>/g, '')); // strip HTML tags for console readability
    console.log('\n----------------------------------------------');
  } else {
    console.log('📣 [Telegram] Sending TEST message to channel...');
    const ok = await sendTelegramMessage(message);
    console.log(ok ? '✅ TEST message posted! Check your Telegram channel.' : '❌ TEST message NOT posted — see warnings above.');
  }
}

