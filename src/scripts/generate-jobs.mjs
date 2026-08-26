import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import railway from './seeds/railway.mjs';
import banking from './seeds/banking.mjs';
import ssc from './seeds/ssc.mjs';
import psc from './seeds/psc.mjs';
import defence from './seeds/defence.mjs';
import teaching from './seeds/teaching.mjs';
import medical from './seeds/medical.mjs';
import engineering from './seeds/engineering.mjs';
import police from './seeds/police.mjs';
import court from './seeds/court.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '../data/latest-jobs.json');

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFee(str) {
  const m = str.match(/(\d[\d,]*)/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
}

function addDays(dateStr, days) {
  const [d, m, y] = dateStr.split('/').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return [
    String(dt.getDate()).padStart(2, '0'),
    String(dt.getMonth() + 1).padStart(2, '0'),
    dt.getFullYear()
  ].join('/');
}

function expandJob(seed, usedSlugs) {
  let slug = seed.shortTitle
    ? slugify(seed.shortTitle)
    : slugify(seed.title.replace(/\s*(Online Form|Online Form\s*20\d{2}|—\s*\d+\s*Posts?|Notification|Form)\s*/gi, ''));

  let baseSlug = slug;
  let counter = 1;
  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${counter++}`;
  }
  usedSlugs.add(slug);

  const steps = [
    `Visit the official website: ${seed.siteUrl}`,
    `Navigate to the "Recruitment / Careers" section`,
    `Click on "${seed.title}" and read the full notification carefully`,
    `Register with a valid Email ID and Mobile Number`,
    `Fill the online application form with personal and educational details`,
    `Upload scanned photograph, signature and required documents as per specifications`,
    `Pay the application fee online (General/OBC: ${seed.feeGeneral}, SC/ST: ${seed.feeSC_ST}, PH: ${seed.feePH})`,
    `Submit the application and take a printout of the confirmation page for future reference`
  ];

  const links = [
    { label: 'Apply Online', url: seed.applyUrl },
    { label: 'Download Notification', url: seed.siteUrl },
    { label: 'Official Website', url: seed.siteUrl }
  ];

  const posts = seed.posts.map(([name, count]) => ({ postName: name, posts: count }));

  const eligibility = typeof seed.elig === 'string'
    ? posts.map(p => ({ postName: p.postName, details: seed.elig }))
    : seed.elig.map(([name, detail]) => ({ postName: name, details: detail }));

  const sel = seed.sel || [
    'Online Written Examination (CBT)',
    'Document Verification',
    'Medical Examination'
  ];

  const examPattern = seed.examPattern || [
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

  const salaryDetails = seed.salaryDetails || {
    payScale: seed.salary || 'As per 7th Pay Commission Matrix',
    grossSalary: '₹60,000 to ₹70,000 (including allowances)',
    allowances: 'Dearness Allowance, HRA, Special Allowance, Medical Benefits'
  };

  const faq = seed.faq || [
    {
      question: `${seed.shortTitle || seed.title} ka exam kab hoga?`,
      answer: `Exam date abhi officially announce nahi hui hai. Official notification aane ke baad date confirm hogi. Hamari website par regular check karte rahein.`
    },
    {
      question: `${seed.shortTitle || seed.title} mein kitni vacancy hai?`,
      answer: `Is recruitment mein total ${seed.vacancies ? seed.vacancies.toLocaleString('en-IN') : 'TBA'} posts hain.`
    },
    {
      question: `${seed.shortTitle || seed.title} ke liye online apply kaise karein?`,
      answer: `Official website par jaake registration karein, form fill karein, documents upload karein aur fee pay karein.`
    },
    {
      question: `${seed.shortTitle || seed.title} ki eligibility kya hai?`,
      answer: `Educational qualification: ${seed.qualify || 'Check official notification'}. Age limit: ${seed.ageMin || 18}-${seed.ageMax || 40} years. Age relaxation SC/ST: 5 yrs, OBC: 3 yrs, PH: 10 yrs.`
    },
    {
      question: `${seed.shortTitle || seed.title} ki last date kya hai?`,
      answer: `Online apply ki last date ${seed.lastDate} hai. Fee payment ki last date bhi ${seed.lastDate} hai.`
    }
  ];

  return {
    title: seed.title,
    shortTitle: seed.shortTitle,
    organization: seed.organization,
    advNumber: seed.advNumber,
    category: seed.category,
    vacancies: seed.vacancies,
    postDate: seed.startDate,
    startDate: seed.startDate,
    lastDate: seed.lastDate,
    feePaymentLastDate: seed.lastDate,
    correctionDate: addDays(seed.lastDate, 5),
    examDate: seed.examDate,
    resultDate: seed.resultDate || 'To be announced',
    feeGeneral: seed.feeGeneral,
    feeSC_ST: seed.feeSC_ST,
    feePH: seed.feePH,
    ageMin: seed.ageMin,
    ageMax: seed.ageMax,
    qualify: seed.qualify,
    salary: seed.salary,
    state: seed.state || 'All India',
    isNew: true,
    isFeatured: !!seed.isFeatured,
    vacancyDetails: posts,
    eligibility,
    howToApply: steps,
    selectionProcess: sel,
    importantLinks: links,
    applyUrl: seed.applyUrl,
    examPattern,
    salaryDetails,
    faq,
    socialLinks: {
      telegram: '#',
      whatsapp: '#',
      facebook: '#'
    },
    slug
  };
}

const allSeeds = [...railway, ...banking, ...ssc, ...psc, ...defence, ...teaching, ...medical, ...engineering, ...police, ...court];

const existingRaw = readFileSync(DATA_PATH, 'utf8').replace(/^\uFEFF/, '');
const existingJobs = JSON.parse(existingRaw);
const existingSlugs = new Set(existingJobs.map(j => j.slug));

console.log(`Existing jobs: ${existingJobs.length}`);
console.log(`New seeds to add: ${allSeeds.length}`);

const newJobs = allSeeds.map(seed => expandJob(seed, existingSlugs));
const merged = [...existingJobs, ...newJobs];

writeFileSync(DATA_PATH, JSON.stringify(merged, null, 4), 'utf8');

console.log(`Total jobs after merge: ${merged.length}`);
console.log('New jobs by category:');
const cats = {};
newJobs.forEach(j => { cats[j.category] = (cats[j.category] || 0) + 1; });
Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});
console.log(`Slugs used: ${newJobs.length}, duplicates avoided: ${allSeeds.length - newJobs.length}`);
