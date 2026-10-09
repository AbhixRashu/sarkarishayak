import { loadServiceAccount, getGoogleAccessToken, GOOGLE_SCOPES, SITE_ORIGIN } from './google-auth.mjs';

const r = await fetch(`${SITE_ORIGIN}/latest-jobs/up-police-constable-2027/`);
const html = await r.text();

// Extract JobPosting schema
const jsonldBlocks = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || [];
let jobPosting = null;
for (const block of jsonldBlocks) {
  try {
    const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim();
    const parsed = JSON.parse(inner);
    if (parsed['@type'] === 'JobPosting') { jobPosting = parsed; break; }
  } catch {}
}

if (jobPosting) {
  console.log('✅ JobPosting schema found on LIVE site:');
  console.log('  directApply    :', jobPosting.directApply);
  console.log('  validThrough   :', jobPosting.validThrough);
  console.log('  datePosted     :', jobPosting.datePosted);
  console.log('  url            :', jobPosting.url);
  console.log('  hiringOrg.name :', jobPosting.hiringOrganization?.name);
  console.log('  hiringOrg.sameAs:', jobPosting.hiringOrganization?.sameAs);
} else {
  console.log('❌ No JobPosting schema found on LIVE site — Vercel build not deployed yet');
  console.log('Schemas found:', jsonldBlocks.length);
  jsonldBlocks.forEach((b, i) => {
    try {
      const j = JSON.parse(b.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim());
      console.log('  Schema', i+1, ':', j['@type']);
    } catch {}
  });
}

// Also check noindex
const hasNoindex = /name="robots"[^>]*noindex/i.test(html);
console.log('\nnoindex on live page:', hasNoindex);
