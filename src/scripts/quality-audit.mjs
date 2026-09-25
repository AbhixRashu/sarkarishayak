/**
 * quality-audit.mjs — READ-ONLY content quality report
 *
 * Batata hai ki abhi data me kitna kachra hai. Kuch bhi modify NAHI karta.
 *
 * Checks:
 *   1. Broken slugs  -> double hyphen, ya shabd ke beech kate (old slice(0,50))
 *   2. Junk titles    -> galat category / finance-filmi-cricket topics
 *   3. Unofficial links -> news.google.com redirect / private news sites
 *   4. Duplicate titles -> same title do baar
 *
 * Usage:
 *   node src/scripts/quality-audit.mjs            # human report
 *   node src/scripts/quality-audit.mjs --summary  # sirf totals
 *   node src/scripts/quality-audit.mjs --json     # machine readable
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isQualityTitle, isNewsRedirectLink, categoryMatchesTitle
} from './quality-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

const FILES = [
  { file: 'latest-jobs.json',     type: 'jobs',         linkKeys: ['applyUrl'] },
  { file: 'results.json',         type: 'results',      linkKeys: ['resultUrl'] },
  { file: 'admit-cards.json',     type: 'admit-cards',  linkKeys: ['downloadUrl'] },
  { file: 'answer-keys.json',     type: 'answer-keys',  linkKeys: ['downloadUrl'] },
  { file: 'yojana.json',          type: 'yojana',       linkKeys: ['officialWebsite'] }
];

// Purane slice(0,50) slug ko detect karo: shabd ke beech kata hona
function isBrokenSlug(slug) {
  if (!slug) return false;
  if (slug.includes('--')) return true;
  // "...-ou-2026", "...-pos-2026" jaise atakate hue chhote tukde
  if (/-[a-z]{1,3}-\d{4}$/.test(slug)) {
    return /-(ou|po|pos|sta|tea|ap|app|n|ann|rec|det|scr|int|adv|lab|cha|not)$/.test(slug);
  }
  return false;
}

function loadJson(name) {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Could not load ${name}: ${e.message}`);
    return [];
  }
}

const report = {};
const grandTotal = { entries: 0, brokenSlug: 0, junkTitle: 0, unofficialLink: 0, dupTitle: 0 };

for (const spec of FILES) {
  const rows = loadJson(spec.file);
  const titleKey = spec.type === 'yojana' ? 'name' : 'title';

  const seenTitles = new Map();
  const entry = { entries: rows.length, brokenSlug: [], junkTitle: [], unofficialLink: [], dupTitle: [] };

  for (const row of rows) {
    const title = String(row[titleKey] || row.title || '').trim();
    const slug = String(row.slug || '');

    if (isBrokenSlug(slug)) entry.brokenSlug.push(slug);

    if (title) {
      const before = seenTitles.get(title.toLowerCase()) || 0;
      if (before > 0) entry.dupTitle.push(title);
      seenTitles.set(title.toLowerCase(), before + 1);
    }

    // Category match personal-finance ko "Admit Card" banane jaisa junk pakadta hai
    if (!isQualityTitle(title, spec.type) || !categoryMatchesTitle(title, spec.type)) {
      entry.junkTitle.push(title);
    }

    for (const lk of spec.linkKeys) {
      const url = row[lk];
      if (url && isNewsRedirectLink(url)) { entry.unofficialLink.push(url); break; }
    }
  }

  report[spec.file] = entry;
  grandTotal.entries += entry.entries;
  grandTotal.brokenSlug += entry.brokenSlug.length;
  grandTotal.junkTitle += entry.junkTitle.length;
  grandTotal.unofficialLink += entry.unofficialLink.length;
  grandTotal.dupTitle += entry.dupTitle.length;
}

const args = process.argv.slice(2);

if (args.includes('--json')) {
  const out = Object.fromEntries(
    Object.entries(report).map(([k, v]) => [k, {
      entries: v.entries,
      brokenSlug: v.brokenSlug.length,
      junkTitle: v.junkTitle.length,
      unofficialLink: v.unofficialLink.length,
      dupTitle: v.dupTitle.length
    }])
  );
  out._grandTotal = grandTotal;
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

console.log('='.repeat(74));
console.log('📊 CONTENT QUALITY AUDIT (read-only — kuch modify nahi hua)');
console.log('='.repeat(74));
console.log('File'.padEnd(24), 'Total'.padEnd(8), 'Broken'.padEnd(8),
  'Junk'.padEnd(7), 'Unoffl'.padEnd(8), 'Dup');

for (const [file, e] of Object.entries(report)) {
  console.log(
    file.padEnd(24),
    String(e.entries).padEnd(8),
    String(e.brokenSlug.length).padEnd(8),
    String(e.junkTitle.length).padEnd(7),
    String(e.unofficialLink.length).padEnd(8),
    String(e.dupTitle.length)
  );
}

console.log('-'.repeat(74));
console.log(
  'TOTAL'.padEnd(24),
  String(grandTotal.entries).padEnd(8),
  String(grandTotal.brokenSlug).padEnd(8),
  String(grandTotal.junkTitle).padEnd(7),
  String(grandTotal.unofficialLink).padEnd(8),
  String(grandTotal.dupTitle)
);

if (!args.includes('--summary')) {
  const show = (label, list, n = 4) => {
    if (!list.length) return;
    console.log(`\n🔸 ${label} (${list.length}):`);
    list.slice(0, n).forEach(x => console.log('    -', String(x).slice(0, 95)));
    if (list.length > n) console.log(`    ... aur ${list.length - n}`);
  };
  for (const [file, e] of Object.entries(report)) {
    show(`${file} → broken slugs`, e.brokenSlug, 3);
    show(`${file} → junk titles`, e.junkTitle, 3);
    show(`${file} → unofficial links`, e.unofficialLink, 2);
    show(`${file} → duplicate titles`, e.dupTitle, 2);
  }
}

console.log('\nLegend:');
console.log('  Broken  = slug double-hyphen ya shabd ke beech kata (dekhne me ganda)');
console.log('  Junk    = title apni category se match nahi karta / topic hamara hi nahi');
console.log('  Unoffl  = download/apply link news.google.com redirect (private site par jata hai)');
console.log('  Dup     = ek hi title do baar data me');
console.log('\n⚠️  Ye report SIRF batata hai. Filter `quality-utils.mjs` NAYE entries par lagta');
console.log('   hai, purane entries ko touch nahi karta — isliye koi purana URL nahi tootta.');

