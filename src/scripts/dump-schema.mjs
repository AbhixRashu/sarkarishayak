async function dumpJsonLd() {
  const res = await fetch('https://govtjob.salarypitcher.com/latest-jobs/up-police-constable-2027/');
  const html = await res.text();
  const matches = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const m of matches) {
    const raw = m.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    try {
      const obj = JSON.parse(raw);
      console.log('TYPE:', obj['@type'], JSON.stringify(obj, null, 2));
    } catch (e) {
      console.log('UNPARSED:', raw);
    }
  }
}
dumpJsonLd();
