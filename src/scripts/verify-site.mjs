async function test() {
  const homeRes = await fetch('http://localhost:4321/');
  const homeHtml = await homeRes.text();
  console.log('Homepage Status:', homeRes.status);
  console.log('Has Secs Countdown Unit:', homeHtml.includes('data-unit="secs"'));
  console.log('Has 1s Interval Script:', homeHtml.includes('setInterval(updateCountdowns, 1000)'));
  console.log('Has Global Search Overlay:', homeHtml.includes('search-overlay'));

  const jobRes = await fetch('http://localhost:4321/latest-jobs/sbi-clerk-2026/');
  const jobHtml = await jobRes.text();
  console.log('Job Detail Status:', jobRes.status);
  console.log('Has Light Mode Hero Overrides:', jobHtml.includes('html[data-theme="light"] .jd-hero'));
  console.log('Has Light Mode High-Contrast Title:', jobHtml.includes('html[data-theme="light"] .jd-hero-title'));
}

test().catch(console.error);
