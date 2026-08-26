import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');
const DATA_DIR = resolve(__dirname, '../data');
const SITEMAP_PATH = resolve(ROOT, 'public/sitemap.xml');

function loadJson(name) {
  try {
    const raw = readFileSync(resolve(DATA_DIR, name), 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Could not load ${name}:`, e.message);
    return [];
  }
}

const jobs = loadJson('latest-jobs.json');
const results = loadJson('results.json');
const admitCards = loadJson('admit-cards.json');
const answerKeys = loadJson('answer-keys.json');
const syllabus = loadJson('syllabus.json');
const yojanas = loadJson('yojana.json');
const scholarships = loadJson('scholarships.json');
const cutoffs = loadJson('cutoffs.json');

const today = new Date().toISOString().split('T')[0];

const staticPages = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/latest-jobs/', priority: '0.9', changefreq: 'daily' },
  { loc: '/results/', priority: '0.9', changefreq: 'daily' },
  { loc: '/admit-cards/', priority: '0.9', changefreq: 'daily' },
  { loc: '/answer-keys/', priority: '0.9', changefreq: 'daily' },
  { loc: '/cutoffs/', priority: '0.9', changefreq: 'daily' },
  { loc: '/syllabus/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/pyq/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/quiz/', priority: '0.8', changefreq: 'daily' },
  { loc: '/current-affairs/', priority: '0.8', changefreq: 'daily' },
  { loc: '/yojana/', priority: '0.9', changefreq: 'daily' },
  { loc: '/scholarship/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/national-services/', priority: '0.9', changefreq: 'weekly' },
  { loc: '/rajasthan-services/', priority: '0.9', changefreq: 'weekly' },
  { loc: '/employment-news/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/exam-calendar/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/competitor-comparison/', priority: '0.7', changefreq: 'monthly' },
  { loc: '/about/', priority: '0.5', changefreq: 'monthly' },
  { loc: '/contact/', priority: '0.5', changefreq: 'monthly' },
  { loc: '/faq/', priority: '0.5', changefreq: 'monthly' },
  { loc: '/privacy/', priority: '0.3', changefreq: 'monthly' },
  { loc: '/terms/', priority: '0.3', changefreq: 'monthly' },
  { loc: '/disclaimer/', priority: '0.3', changefreq: 'monthly' },
  
  // Tools
  { loc: '/tools/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/tools/eligibility-checker/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/tools/cutoff-tracker/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/tools/age-calculator/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/tools/salary-calculator/', priority: '0.8', changefreq: 'weekly' },
  
  // Qualifications
  { loc: '/qualifications/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/qualifications/10th-pass/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/qualifications/12th-pass/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/qualifications/graduate/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/qualifications/post-graduate/', priority: '0.8', changefreq: 'weekly' },

  // States
  { loc: '/states/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/states/rajasthan/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/states/uttar-pradesh/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/states/bihar/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/states/madhya-pradesh/', priority: '0.8', changefreq: 'weekly' },

  // Quiz Categories
  { loc: '/quiz/gk-gs/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/quiz/maths/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/quiz/reasoning/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/quiz/english/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/quiz/hindi/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/quiz/computer/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/quiz/rajasthan-gk/', priority: '0.7', changefreq: 'weekly' },
];

const nationalServices = [
  'aadhaar', 'pan', 'passport', 'driving-license', 'ration-card',
  'voter-id', 'itr-filing', 'birth-certificate', 'ayushman-bharat'
];

const rajServices = [
  'sso', 'e-mitra', 'bhu-naksha', 'jan-aadhaar', 'rbse-board',
  'chiranjeevi-yojana', 'rajasthan-police', 'kisan-kalyan', 'nagarpalika', 'rajasthan-university'
];

const urls = [];

// Static and hub pages
for (const p of staticPages) {
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);
}

// National services
for (const s of nationalServices) {
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com/service/${s}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
}

// Rajasthan services
for (const s of rajServices) {
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com/raj/${s}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
}

// Jobs
const MIN_SLUG_LEN = 10;
for (const j of jobs) {
  if (!j.slug || j.slug.length < MIN_SLUG_LEN) continue;
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com/latest-jobs/${j.slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
}

// Results
for (const r of results) {
  if (!r.slug || r.slug.length < MIN_SLUG_LEN) continue;
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com/results/${r.slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
}

// Admit cards
for (const a of admitCards) {
  if (!a.slug || a.slug.length < MIN_SLUG_LEN) continue;
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com/admit-cards/${a.slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
}

// Answer keys
for (const k of answerKeys) {
  if (!k.slug || k.slug.length < MIN_SLUG_LEN) continue;
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com/answer-keys/${k.slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
}

// Cutoff pages
for (const c of cutoffs) {
  const slug = c.id || c.slug;
  if (!slug) continue;
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com/cutoffs/${slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
}

// Syllabus pages
for (const s of syllabus) {
  const slug = s.id || s.slug;
  if (!slug) continue;
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com/syllabus/${slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
}

// Yojana pages
for (const y of yojanas) {
  if (!y.slug || y.slug.length < MIN_SLUG_LEN) continue;
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com/yojana/${y.slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
}

// Scholarship pages
for (const s of scholarships) {
  if (!s.slug) continue;
  urls.push(`  <url>
    <loc>https://govtjob.salarypitcher.com/scholarship/${s.slug}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

writeFileSync(SITEMAP_PATH, sitemapXml, 'utf8');
console.log(`Generated sitemap.xml with ${urls.length} URLs!`);
