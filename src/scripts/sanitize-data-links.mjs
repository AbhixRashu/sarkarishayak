import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pickBestLink } from './quality-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT, 'src/data');

const filesToClean = [
  { file: 'latest-jobs.json', urlFields: ['applyUrl', 'officialUrl', 'notificationUrl'] },
  { file: 'results.json', urlFields: ['resultUrl', 'officialUrl'] },
  { file: 'admit-cards.json', urlFields: ['downloadUrl', 'officialUrl'] },
  { file: 'answer-keys.json', urlFields: ['downloadUrl', 'keyUrl', 'officialUrl'] },
  { file: 'yojana.json', urlFields: ['officialWebsite'] }
];

console.log('🧹 Sanitizing news.google.com redirect links in JSON data files...\n');

let totalReplaced = 0;

for (const { file, urlFields } of filesToClean) {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) continue;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let fileReplaced = 0;

  for (const item of data) {
    // 1. Direct fields
    for (const field of urlFields) {
      const val = item[field];
      if (val && typeof val === 'string' && /news\.google\.com/i.test(val)) {
        const best = pickBestLink(val, item.title || item.name || '', item.organization || item.ministry || '');
        if (best && best !== val) {
          item[field] = best;
          fileReplaced++;
        }
      }
    }

    // 2. importantLinks array
    if (Array.isArray(item.importantLinks)) {
      for (const link of item.importantLinks) {
        if (link && link.url && /news\.google\.com/i.test(link.url)) {
          const best = pickBestLink(link.url, item.title || item.name || '', item.organization || item.ministry || '');
          if (best && best !== link.url) {
            link.url = best;
            fileReplaced++;
          }
        }
      }
    }

    // 3. Yojana benefits field with raw HTML google news links
    if (item.benefits && typeof item.benefits === 'string' && /news\.google\.com/i.test(item.benefits)) {
      // Strip HTML tags and clean up
      const cleanText = item.benefits.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      item.benefits = cleanText || 'योजना के लाभ और विवरण के लिए आधिकारिक अधिसूचना देखें।';
      fileReplaced++;
    }
  }

  if (fileReplaced > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`✅ ${file}: Replaced/cleaned ${fileReplaced} items`);
    totalReplaced += fileReplaced;
  } else {
    console.log(`ℹ️  ${file}: All clean`);
  }
}

console.log(`\n🎉 Total items cleaned: ${totalReplaced}\n`);
