import fs from 'fs';
import { loadServiceAccount, getGoogleAccessToken, GOOGLE_SCOPES, SITE_ORIGIN } from './google-auth.mjs';

async function main() {
  const { keyData } = loadServiceAccount();
  if (!keyData) {
    console.log('No service account found');
    return;
  }
  const token = await getGoogleAccessToken(keyData, GOOGLE_SCOPES.webmasters);

  const urlsToCheck = [
    // 1. Homepage
    'https://govtjob.salarypitcher.com/',
    // 2. Previously high traffic pages (old URLs)
    'https://govtjob.salarypitcher.com/answer-keys/utet-answer-key-2026-download-paper-1-and-answer-key-2026/',
    'https://govtjob.salarypitcher.com/latest-jobs/up-police-constable-2027/',
    'https://govtjob.salarypitcher.com/latest-jobs/bank-of-baroda-so-recruitment-2026-1100-vacancies--2026/',
    'https://govtjob.salarypitcher.com/latest-jobs/government-jobs-2026-ibps-railway-vacancies-open-2026/',
    // 3. New URLs from recent list
    'https://govtjob.salarypitcher.com/latest-jobs/1338-delhi-teacher-vacancy-2026-sanctioned-check-2026/',
    'https://govtjob.salarypitcher.com/latest-jobs/rajasthan-safai-karmachari-recruitment-2026-last-date-2026/',
    'https://govtjob.salarypitcher.com/latest-jobs/mp-police-asi-recruitment-2026-notification-out-for-2026/'
  ];

  console.log('=== CHECKING LIVE WEB STATUS & GOOGLE GSC INDEX STATUS ===\n');

  for (const url of urlsToCheck) {
    console.log(`🔍 Checking: ${url}`);
    
    // Step A: Live HTTP Fetch
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      const html = await resp.text();
      const hasNoindex = /name=["']robots["'][^>]*noindex/i.test(html);
      const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
      console.log(`   [HTTP] Status: ${resp.status} | Size: ${html.length}b | noindex: ${hasNoindex} | Canonical: ${canonicalMatch ? canonicalMatch[1] : 'NONE'}`);
    } catch (e) {
      console.log(`   [HTTP] Failed: ${e.message}`);
    }

    // Step B: Google Search Console URL Inspection API
    try {
      const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE_ORIGIN + '/' })
      });
      const data = await res.json();
      const idx = data.inspectionResult?.indexStatusResult;
      if (idx) {
        console.log(`   [GSC] Coverage: ${idx.coverageState}`);
        console.log(`   [GSC] Verdict: ${idx.verdict}`);
        console.log(`   [GSC] RobotsTxt: ${idx.robotsTxtState}`);
        console.log(`   [GSC] Indexing: ${idx.indexingState}`);
        console.log(`   [GSC] Last Crawled: ${idx.lastCrawlTime || 'Never'}`);
        console.log(`   [GSC] Google Canonical: ${idx.googleCanonical || 'None'}`);
      } else {
        console.log(`   [GSC] Inspection error:`, JSON.stringify(data.error || data));
      }
    } catch (e) {
      console.log(`   [GSC] Failed: ${e.message}`);
    }
    console.log('------------------------------------------------------------');
  }
}

main().catch(console.error);
