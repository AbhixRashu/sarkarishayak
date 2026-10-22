/**
 * purge-low-value-content.mjs
 *
 * Removes all low-value, junk, off-topic, broken-slug, and duplicate entries
 * from all JSON data files to comply strictly with Google Search Essentials
 * and prevent Scaled Content Abuse / AI Spam flags.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isQualityTitle,
  categoryMatchesTitle,
  titleFamilyKey,
  pickBestLink
} from './quality-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

function isBrokenSlug(slug) {
  if (!slug) return true;
  if (slug.includes('--')) return true;
  if (/-[a-z]{1,3}-\d{4}$/.test(slug)) {
    return /-(ou|po|pos|sta|tea|ap|app|n|ann|rec|det|scr|int|adv|lab|cha|not)$/.test(slug);
  }
  return false;
}

const FILES = [
  { file: 'latest-jobs.json',     type: 'jobs',         urlFields: ['applyUrl', 'officialUrl', 'notificationUrl'] },
  { file: 'results.json',         type: 'results',      urlFields: ['resultUrl', 'officialUrl'] },
  { file: 'admit-cards.json',     type: 'admit-cards',  urlFields: ['downloadUrl', 'officialUrl'] },
  { file: 'answer-keys.json',     type: 'answer-keys',  urlFields: ['downloadUrl', 'keyUrl', 'officialUrl'] },
  { file: 'yojana.json',          type: 'yojana',       urlFields: ['officialWebsite'] }
];

console.log('🧹 Starting Low-Value Content Purge & Data Quality Cleanup...\n');

let grandInitial = 0;
let grandCleaned = 0;
let grandDropped = 0;

for (const spec of FILES) {
  const p = path.join(DATA_DIR, spec.file);
  if (!fs.existsSync(p)) continue;

  const rows = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  const titleKey = spec.type === 'yojana' ? 'name' : 'title';

  const seenSlugs = new Set();
  const seenTitleFamilies = new Set();
  const cleanRows = [];

  let droppedBroken = 0;
  let droppedJunk = 0;
  let droppedDup = 0;

  for (const row of rows) {
    const title = String(row[titleKey] || row.title || '').trim();
    const slug = String(row.slug || '').trim();

    // 1. Check broken slug
    if (isBrokenSlug(slug)) {
      droppedBroken++;
      continue;
    }

    // 2. Check junk or mismatched category
    if (!isQualityTitle(title, spec.type) || !categoryMatchesTitle(title, spec.type)) {
      droppedJunk++;
      continue;
    }

    // 3. Deduplication check
    const tfKey = titleFamilyKey(title);
    if (seenSlugs.has(slug) || (tfKey && seenTitleFamilies.has(tfKey))) {
      droppedDup++;
      continue;
    }

    // 4. Sanitize news redirect links to official links
    const org = row.organization || row.ministry || '';
    for (const field of spec.urlFields) {
      if (row[field] && typeof row[field] === 'string' && /news\.google\.com/i.test(row[field])) {
        const best = pickBestLink(row[field], title, org);
        if (best) row[field] = best;
      }
    }

    if (Array.isArray(row.importantLinks)) {
      for (const link of row.importantLinks) {
        if (link && link.url && /news\.google\.com/i.test(link.url)) {
          const best = pickBestLink(link.url, title, org);
          if (best) link.url = best;
        }
      }
    }

    // Clean up shortTitle if broken at trailing hyphens
    if (row.shortTitle) {
      row.shortTitle = String(row.shortTitle).trim().replace(/-+$/, '');
    }

    seenSlugs.add(slug);
    if (tfKey) seenTitleFamilies.add(tfKey);

    cleanRows.push(row);
  }

  fs.writeFileSync(p, JSON.stringify(cleanRows, null, 2) + '\n', 'utf8');

  const dropped = rows.length - cleanRows.length;
  grandInitial += rows.length;
  grandCleaned += cleanRows.length;
  grandDropped += dropped;

  console.log(`✅ ${spec.file.padEnd(18)}: ${rows.length} -> ${cleanRows.length} (Dropped: ${dropped} [Junk: ${droppedJunk}, Broken: ${droppedBroken}, Dup: ${droppedDup}])`);
}

console.log('\n============================================================');
console.log(`🎉 Total Initial Items: ${grandInitial}`);
console.log(`✨ Total High Quality Items Kept: ${grandCleaned}`);
console.log(`🗑️ Total Low-Value / Spam Items Removed: ${grandDropped}`);
console.log('============================================================\n');
