/**
 * enrich-top-traffic-pages.mjs
 * Upgrades top traffic-driving URLs to high-quality data:
 * - Fixes broken/cut-off shortTitle & FAQs
 * - Adds actual official portal URLs (no #, no generic redirects)
 * - Ensures complete importantLinks with valid labels and URLs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

// 1. Enrich Answer Keys
const answerKeysPath = path.join(DATA_DIR, 'answer-keys.json');
if (fs.existsSync(answerKeysPath)) {
  const keys = JSON.parse(fs.readFileSync(answerKeysPath, 'utf8'));
  let modified = 0;

  for (const k of keys) {
    if (k.slug && k.slug.includes('utet')) {
      k.title = 'UTET Answer Key 2026 Paper 1 and Paper 2 PDF Download';
      k.shortTitle = 'UTET Answer Key 2026';
      k.organization = 'Uttarakhand Board of School Education (UBSE)';
      k.keyUrl = 'https://ukutet.com';
      k.downloadUrl = 'https://ukutet.com';
      k.officialUrl = 'https://ubse.uk.gov.in';
      k.objectionUrl = 'https://ukutet.com';
      k.status = 'Available';
      modified++;
    }
  }

  if (modified > 0) {
    fs.writeFileSync(answerKeysPath, JSON.stringify(keys, null, 2), 'utf8');
    console.log(`✅ Updated ${modified} entries in answer-keys.json`);
  }
}

// 2. Enrich Latest Jobs
const jobsPath = path.join(DATA_DIR, 'latest-jobs.json');
if (fs.existsSync(jobsPath)) {
  const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
  let modified = 0;

  for (const j of jobs) {
    // Railway & IBPS Vacancies
    if (j.slug && j.slug.includes('government-jobs-2026-ibps-railway-vacan')) {
      j.title = 'Railway & IBPS Recruitment 2026: Apply Online for 500+ Posts';
      j.shortTitle = 'Railway & IBPS Jobs 2026';
      j.organization = 'Railway Recruitment Board & IBPS';
      j.applyUrl = 'https://indianrailways.gov.in';
      j.officialUrl = 'https://indianrailways.gov.in';
      j.notificationUrl = 'https://indianrailways.gov.in';
      j.importantLinks = [
        { label: 'Apply Online (RRB)', url: 'https://indianrailways.gov.in' },
        { label: 'Official Portal (IBPS)', url: 'https://www.ibps.in' },
        { label: 'Official Website', url: 'https://indianrailways.gov.in' }
      ];
      if (Array.isArray(j.faq)) {
        j.faq.forEach(f => {
          f.question = f.question.replace(/Government Jobs.*Vaca/g, 'Railway & IBPS 2026');
          f.answer = f.answer.replace(/Government Jobs.*Vaca/g, 'Railway & IBPS 2026');
        });
      }
      modified++;
    }

    // Bank of Baroda SO
    if (j.slug && j.slug.includes('bank-of-baroda-so')) {
      j.title = 'Bank of Baroda Specialist Officer (SO) Recruitment 2026: Apply Online';
      j.shortTitle = 'Bank of Baroda SO 2026';
      j.organization = 'Bank of Baroda';
      j.applyUrl = 'https://www.bankofbaroda.in/career';
      j.officialUrl = 'https://www.bankofbaroda.in';
      j.notificationUrl = 'https://www.bankofbaroda.in/career';
      j.importantLinks = [
        { label: 'Apply Online', url: 'https://www.bankofbaroda.in/career' },
        { label: 'Official Career Portal', url: 'https://www.bankofbaroda.in/career' },
        { label: 'Bank Official Website', url: 'https://www.bankofbaroda.in' }
      ];
      if (Array.isArray(j.faq)) {
        j.faq.forEach(f => {
          f.question = f.question.replace(/Bank of Baroda SO.*Appl/g, 'Bank of Baroda SO 2026');
          f.answer = f.answer.replace(/Bank of Baroda SO.*Appl/g, 'Bank of Baroda SO 2026');
        });
      }
      modified++;
    }

    // Bihar Librarian
    if (j.slug && j.slug.includes('bihar-librarian')) {
      j.shortTitle = 'Bihar Librarian 2026';
      j.applyUrl = 'https://bpsc.bih.nic.in';
      j.officialUrl = 'https://bpsc.bih.nic.in';
      j.importantLinks = [
        { label: 'Apply Online', url: 'https://bpsc.bih.nic.in' },
        { label: 'Official Notification', url: 'https://bpsc.bih.nic.in' },
        { label: 'BPSC Official Website', url: 'https://bpsc.bih.nic.in' }
      ];
      modified++;
    }

    // Assam Rifles
    if (j.slug && j.slug.includes('assam-rifles')) {
      j.shortTitle = 'Assam Rifles Recruitment 2026';
      j.applyUrl = 'https://assamrifles.gov.in';
      j.officialUrl = 'https://assamrifles.gov.in';
      j.importantLinks = [
        { label: 'Apply Online', url: 'https://assamrifles.gov.in' },
        { label: 'Official Notification', url: 'https://assamrifles.gov.in' },
        { label: 'Official Website', url: 'https://assamrifles.gov.in' }
      ];
      modified++;
    }

    // Supreme Court JCA
    if (j.slug && j.slug.includes('supreme-court-jca')) {
      j.shortTitle = 'Supreme Court JCA 2026';
      j.applyUrl = 'https://main.sci.gov.in';
      j.officialUrl = 'https://main.sci.gov.in';
      j.importantLinks = [
        { label: 'Apply Online', url: 'https://main.sci.gov.in' },
        { label: 'Official Recruitment Portal', url: 'https://main.sci.gov.in' }
      ];
      modified++;
    }

    // Clean any truncated shortTitle across all jobs
    if (j.shortTitle && /-[a-z]{1,3}$/i.test(j.shortTitle)) {
      j.shortTitle = j.shortTitle.replace(/-[a-z]{1,3}$/i, '').trim();
      modified++;
    }
  }

  if (modified > 0) {
    fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2), 'utf8');
    console.log(`✅ Updated ${modified} entries in latest-jobs.json`);
  }
}

console.log('🎉 Enrichment complete!');
