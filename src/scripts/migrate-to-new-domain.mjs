/**
 * migrate-to-new-domain.mjs
 *
 * Replaces all instances of 'sarkarishayak.online' and 'salarypitcher.com'
 * with 'sarkarishayak.online' across configuration, templates, schemas, and scripts.
 */

import fs from 'fs';
import path from 'path';

const ROOT = 'c:/Users/HII/sarkari-sahayak';
const IGNORE_DIRS = new Set(['.git', '.vercel', 'node_modules', 'dist', '.astro', 'logs']);
const IGNORE_FILES = new Set(['build.log', 'package-lock.json']);

const replacements = [
  { from: /https:\/\/govtjob\.salarypitcher\.com/g, to: 'https://sarkarishayak.online' },
  { from: /http:\/\/govtjob\.salarypitcher\.com/g, to: 'https://sarkarishayak.online' },
  { from: /govtjob\.salarypitcher\.com/g, to: 'sarkarishayak.online' },
  { from: /hello@govtjob\.salarypitcher\.com/g, to: 'contact@sarkarishayak.online' },
  { from: /Sarkari Sahayak/g, to: 'Sarkari Sahayak' },
  { from: /An Initiative of <a href="https:\/\/salarypitcher\.com"[^>]*>Salary Pitcher<\/a> · /g, to: '' },
  { from: / \| A Salary Pitcher Initiative/g, to: '' },
  { from: /https:\/\/salarypitcher\.com/g, to: 'https://sarkarishayak.online' }
];

let modifiedCount = 0;

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (!IGNORE_DIRS.has(ent.name)) {
        processDir(path.join(dir, ent.name));
      }
    } else {
      if (IGNORE_FILES.has(ent.name)) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!['.astro', '.js', '.mjs', '.ts', '.json', '.txt', '.md', '.html', '.css'].includes(ext)) {
        continue;
      }

      const filePath = path.join(dir, ent.name);
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        let changed = false;

        for (const { from, to } of replacements) {
          if (from.test(content)) {
            content = content.replace(from, to);
            changed = true;
          }
        }

        if (changed) {
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`✅ Updated: ${filePath.replace(ROOT, '')}`);
          modifiedCount++;
        }
      } catch (err) {
        console.error(`Error reading ${filePath}: ${err.message}`);
      }
    }
  }
}

console.log('🔄 Migrating codebase to sarkarishayak.online...\n');
processDir(ROOT);
console.log(`\n🎉 Total files updated: ${modifiedCount}`);
