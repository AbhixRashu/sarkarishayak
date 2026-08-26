/**
 * migrate-add-fields.mjs
 * One-time migration: adds examPattern, salaryDetails, faq, socialLinks, postDate
 * to all existing jobs that are missing these fields.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JOBS_FILE = path.resolve(__dirname, '../data/latest-jobs.json');

function readJSON(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  return JSON.parse(content);
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

const jobs = readJSON(JOBS_FILE);
console.log(`Total jobs found: ${jobs.length}`);

let migrated = 0;

for (const job of jobs) {
  let changed = false;

  // Add postDate if missing
  if (!job.postDate) {
    job.postDate = job.startDate || 'Check Notification';
    changed = true;
  }

  // Add howToApply if missing
  if (!job.howToApply) {
    job.howToApply = [
      'Visit the official website of the recruiting organization.',
      'Find the relevant recruitment notification.',
      'Register and fill the online application form.',
      'Upload required documents (photograph, signature, certificates).',
      'Pay the application fee online.',
      'Submit the form and save/print the confirmation.',
    ];
    changed = true;
  }

  // Add selectionProcess if missing
  if (!job.selectionProcess) {
    job.selectionProcess = ['Written Examination', 'Skill/Physical Test (if applicable)', 'Document Verification', 'Final Merit List'];
    changed = true;
  }

  // Add importantLinks if missing
  if (!job.importantLinks) {
    job.importantLinks = [
      { label: 'Apply Online', url: job.applyUrl || '#' },
      { label: 'Download Notification', url: '#' },
      { label: 'Official Website', url: '#' },
    ];
    changed = true;
  }

  // Add examPattern if missing
  if (!job.examPattern) {
    job.examPattern = [
      {
        stage: 'Prelims',
        subjects: 'Reasoning, English, Quantitative Aptitude, General Awareness',
        questions: 200,
        maxMarks: 200,
        duration: '120 minutes'
      },
      {
        stage: 'Mains',
        subjects: 'Economic & Social Issues, Agriculture & Rural Development, English, Computer Knowledge',
        questions: 200,
        maxMarks: 200,
        duration: '120 minutes'
      }
    ];
    changed = true;
  }

  // Add salaryDetails if missing
  if (!job.salaryDetails) {
    job.salaryDetails = {
      payScale: job.salary || 'As per 7th Pay Commission Matrix',
      grossSalary: '₹60,000 to ₹70,000 (including allowances)',
      allowances: 'Dearness Allowance, HRA, Special Allowance, Medical Benefits'
    };
    changed = true;
  }

  // Add faq if missing
  if (!job.faq) {
    const title = job.shortTitle || job.title;
    job.faq = [
      {
        question: `${title} ka exam kab hoga?`,
        answer: `Exam date: ${job.examDate || 'To be announced'}. Official notification aane ke baad date confirm hogi.`
      },
      {
        question: `${title} mein kitni vacancy hai?`,
        answer: `Is recruitment mein total ${job.vacancies ? job.vacancies.toLocaleString('en-IN') : 'TBA'} posts hain.`
      },
      {
        question: `${title} ke liye online apply kaise karein?`,
        answer: 'Official website par jaake registration karein, form fill karein, documents upload karein aur fee pay karein.'
      },
      {
        question: `${title} ki eligibility kya hai?`,
        answer: `Educational qualification: ${job.qualify || 'Check official notification'}. Age limit: ${job.ageMin || 18}-${job.ageMax || 40} years. Age relaxation SC/ST: 5 yrs, OBC: 3 yrs, PH: 10 yrs.`
      },
      {
        question: `${title} ki last date kya hai?`,
        answer: `Online apply ki last date ${job.lastDate} hai. Fee payment ki last date bhi ${job.feePaymentLastDate || job.lastDate} hai.`
      }
    ];
    changed = true;
  }

  // Add socialLinks if missing
  if (!job.socialLinks) {
    job.socialLinks = {
      telegram: '#',
      whatsapp: '#',
      facebook: '#'
    };
    changed = true;
  }

  if (changed) migrated++;
}

writeJSON(JOBS_FILE, jobs);
console.log(`Migration complete. Updated ${migrated} jobs.`);
console.log(`Total jobs: ${jobs.length}`);
