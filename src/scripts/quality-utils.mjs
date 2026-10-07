/**
 * quality-utils.mjs — Sarkari Sahayak ke liye shared "content quality" rules
 *
 * Kyu bana:
 *   Google hamari 2377+ auto-generated pages ko index nahi kar raha tha. Wajah
 *   content quality thi, API nahi:
 *     1. Slug 50 chars par BEECH KE SHABD me kat jata tha  -> "...notification-ou-2026"
 *     2. Kabhi-kabhi double hyphen aa jata tha              -> "...starts--2026"
 *     3. Title me "Recruitment 2026" DO BAAR aa jata tha
 *     4. Apply/Download link jagranjosh / careerpower jaise private news sites
 *        par jata tha (news.google.com redirect ke through) — official govt
 *        portal par nahi
 *     5. Galat category: personal-finance news ko "Admit Card" bana diya jata tha
 *        ("I fear losing stability: 30-year-old man with Rs50 lakh net worth...")
 *        aur news article ko "Yojana" bana diya jata tha
 *
 * Ye module SIRF NAYE entries par lagta hai — purane URL kabhi nahi badalte,
 * isliye koi link tootta nahi.
 *
 * Zero external dependencies (repo ka existing style).
 */

// ---------------------------------------------------------------------------
// SLUG — shabd ki seema par kato, kabhi beech me nahi
// ---------------------------------------------------------------------------

/** Text ko URL-friendly slug banao (double hyphen kabhi nahi). */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u0900-\u097F]/g, ' ')   // Devanagari -> space (slug English me rakho)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Shabd ki seema par kato — "posts" ka "pos" kabhi nahi.
 * @param {string} str
 * @param {number} max
 */
export function truncateAtWord(str, max) {
  const s = String(str || '');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastDash = cut.lastIndexOf('-');
  // Agar dash mila aur thoda sa meaningful bacha hai to wahan kato
  if (lastDash > max * 0.4) return cut.slice(0, lastDash).replace(/-+$/, '');
  return cut.replace(/-+$/, '');
}

/**
 * Safe slug banao: word-boundary truncation + suffix + koi double hyphen nahi.
 * Slug hamesha {body}-{suffix} format me rehta hai.
 *
 * @param {string} title
 * @param {string} suffix  e.g. '2026' | 'admit-card-2026' | 'result-2026'
 * @param {number} maxTotal  total slug length ki safe limit (default 60)
 */
export function makeSlug(title, suffix = '', maxTotal = 60) {
  const cleanSuffix = slugify(suffix);
  // suffix ke liye jagah chhod do taaki total limit cross na ho
  const budget = Math.max(20, maxTotal - (cleanSuffix ? cleanSuffix.length + 1 : 0));
  let body = truncateAtWord(slugify(title), budget);
  if (!body) body = 'update';
  return cleanSuffix ? `${body}-${cleanSuffix}` : body;
}

/**
 * Slug ka "family key" — pehle 4 hyphen segments.
 *
 * Dedupe: ek hi khabar title ke 1-2 shabd badalne par alag slug ban leti thi
 * (IFFCO jaise cases → do duplicate pages, dono sitemap me → spam/scaled-content
 * signal). Agar do slugs ke pehle 4 segments same hain to wo wahi exam/job hai —
 * distinction aksar 5th segment se aata hai, isliye 4 safe hai:
 *   "iffco-agt-recruitment-2026-notification-out-at-2026"
 *   "iffco-agt-recruitment-2026-notification-out-apply-2026"  → same family
 *   "ssc-cgl-tier-1-result-2026" vs "ssc-cgl-mains-result-2026" → alag family
 *
 * Number-words normalize hote hain ("tier-one" === "tier-1") — warna ek hi
 * admit card do families me baant jaata tha (ssc-cgl-tier-1 vs ssc-cgl-tier-one),
 * dono sitemap me aur dono self-canonical → duplicate signal wapas.
 *
 * Slug Set ke saath use karo — ye "same story, slightly different title" wale
 * duplicates pakadta hai jo plain slug match kabhi nahi pakadta.
 */
const NUMBER_WORDS = {
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  first: '1', second: '2', third: '3', fourth: '4', fifth: '5',
};

export function slugFamilyKey(slug) {
  const parts = String(slug || '').toLowerCase().split('-').filter(Boolean)
    .map(seg => NUMBER_WORDS[seg] || seg);
  if (parts.length === 0) return '';
  return parts.slice(0, 4).join('|');
}

/**
 * Title ka "word-set family key" — sare words sort+dedupe karke join.
 *
 * Slug family se alag: ye WORD ORDER badalne wale duplicates pakadta hai jo
 * slug-based key chhod deta hai:
 *   "IDBI Bank Executive Online Form 2026"  vs "IDBI Bank Executive 2026 Online Form"
 *   "RBI Assistant Online Form 2026"        vs "RBI Assistant 2026 Online Form"
 * Dono ek hi news hai — alag-alag pages + dono sitemap me = scaled-content signal.
 *
 * Rules:
 *   - Sare tokens rakhe jaate hain (chhote jaise "up"/"mp"/"po"/"a"/"b" bhi) —
 *     UP vs MP Police, Grade-A vs Grade-B, IBPS PO vs SO ALAG rehne chahiye.
 *   - Number-words normalize (title me "Tier One" = "Tier 1").
 *   - Years rakhe jaate hain — CHSL-2025 aur CHSL-2024 alag results hain.
 *   - <2 tokens ya empty/non-Latin (Hindi) title → '' (no match, safe).
 *   - Equality-based hai: sirf EXACT same word-set wale merge hote hain.
 */
const _titleKeyCache = new Map();

export function titleFamilyKey(title) {
  const raw = String(title || '');
  if (_titleKeyCache.has(raw)) return _titleKeyCache.get(raw);

  const tokens = raw.toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => NUMBER_WORDS[w] || w);
  let key = '';
  if (tokens.length >= 2) {
    key = [...new Set(tokens)].sort().join('|');
  }
  _titleKeyCache.set(raw, key);
  return key;
}

/**
 * Dataset me isi story ka PRIMARY page — pehla (file me sabse upar = newest)
 * entry jo uske connected component me ho.
 *
 * Component = union of slug-family aur title word-set family (transitive):
 *   A~B (slug family), B~C (title family)  ⇒  A, B, C sabka primary = C-jaisa
 *   pehla wala entry. Union-find se chains stable rehti hain — warna
 *   A→B→C wali canonical chain ban sakti thi (Google ko 2 hops follow karne
 *   padte, aur sitemap/canonical set alag-alag ho jaate).
 *
 * Duplicate variants ka canonical primary ko point karta hai. Result cached
 * hai (WeakMap) — build me har page pe O(n) rebuild nahi hota.
 *
 * NOTE: koi page delete/disappear nahi hota — wo live rehta hai, bas <head>
 * me canonical batata hai ki Google signals us primary page pe consolidate
 * kare. Isse duplicate-footprint kam hota hai bina kuch udaye.
 */
const _primaryCache = new WeakMap();

function buildPrimaryMap(list) {
  const n = list.length;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = i => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  // chhota index (= file me pehla = newest) hamesha root banao
  const union = (a, b) => {
    a = find(a); b = find(b);
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
  };

  const keyFirst = new Map(); // family key -> pehla index
  list.forEach((e, i) => {
    if (!e) return;
    const keys = [];
    const s = slugFamilyKey(e.slug);
    if (s) keys.push('s:' + s);
    const t = titleFamilyKey(e.title || e.name);
    if (t) keys.push('t:' + t);
    for (const k of keys) {
      if (keyFirst.has(k)) union(i, keyFirst.get(k));
      else keyFirst.set(k, i);
    }
  });

  const map = new Map();
  list.forEach((e, i) => {
    if (e && e.slug) {
      const root = list[find(i)];
      map.set(e.slug, (root && root.slug) || e.slug);
    }
  });
  return map;
}

export function primarySlugOf(entries, slug) {
  const list = entries || [];
  if (list.length === 0) return slug;
  let map = _primaryCache.get(list);
  if (!map) {
    map = buildPrimaryMap(list);
    _primaryCache.set(list, map);
  }
  return map.get(slug) || slug;
}

// ---------------------------------------------------------------------------
// TITLE — duplicate phrase aur mid-word katne se bachao
// ---------------------------------------------------------------------------

/**
 * Title ke aakhir me phrase jodo, PAR agar wo pehle se hai to nahi.
 * ("... Recruitment 2026 ... Recruitment 2026" wala bug fix.)
 */
export function appendIfMissing(title, phrase) {
  const t = String(title || '').trim();
  const p = String(phrase || '').trim();
  if (!p) return t;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (norm(t).includes(norm(p))) return t;
  return `${t} ${p}`.trim();
}

/** Title ko shabd ki seema par kato (shortTitle ke liye). */
export function truncateTitleAtWord(title, max) {
  const t = String(title || '').trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  let out = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  out = out.replace(/[\s:,\-–—|]+$/, '').trim();

  // Agar cut ke turant baad ek CHHOTA token bacha ho (jaise "2026" ya "2026:"),
  // to use bhi le lo — warna saal jaise "Admit Card" se gayab ho jata hai.
  const rest = t.slice(out.length);
  const small = rest.match(/^\s*(\S{1,6})(?=[\s:,;.\-–—|]|$)/);
  if (small) {
    const token = small[1].replace(/[\s:,\-–—|]+$/, '');
    if (token && out.length + 1 + token.length <= max + 6) {
      return `${out} ${token}`.trim();
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// JUNK DETECTION — galat category ka content roko
// ---------------------------------------------------------------------------

// Aise topics jo sarkari naukri / result / yojana se bilkul related nahi hain.
// Inhe publish karna Google ke liye "auto-generated spam" signal hai.
const JUNK_TOPIC_PATTERNS = [
  /net worth/i,
  /\bstock\b|share market|sensex|nifty|mutual fund|\bsip\b|\bipo\b|crypto|bitcoin/i,
  /\brashifal\b|horoscope|astrology|zodiac|jyotish/i,
  /bollywood|celebrity|actress|\bactor\b|movie review|box office|ott release|web series/i,
  /\bcricket\b|\bipl\b|match score|world cup|football|olympic medal/i,
  /murder|arrested|kidnap|rape|accident|crash|fire broke out|theft/i,
  /relationship|marriage tips|girlfriend|boyfriend|breakup/i,
  /weight loss|diet plan|skin care|home remedy|beauty tips/i,
  /recipe|mehndi design|rangoli/i,
  /weather forecast|mausam|temperature today/i,
  /gold rate|silver rate|petrol diesel price|sensex today/i,
  /movie ticket|gaming app|lottery|\bsatta\b|betting/i,
  /puzzle answer|brain teaser|optical illusion|viral video/i,
];

// Jaroori keywords — inme se koi bhi na ho to entry sarkari-naukri domain ki hi nahi hai
const GOVT_CONTEXT_PATTERNS = [
  /recruitment|vacancy|vacancies|bharti|naukri|hiring|apply online|notification/i,
  /admit card|hall ticket|call letter|exam city|intimation slip|exam date|exam schedule/i,
  /answer key|response sheet|objection window|question paper|exam analysis/i,
  /result|merit list|selection list|cut ?off|scorecard|rank card|final list/i,
  /yojana|scheme|subsidy|awas|kisan|ration|ayushman|pension|scholarship|mudra|ujjwala/i,
  /counselling|counseling|seat allotment|admission|round \d/i,
  /ssc|upsc|rrb|ibps|sbi|rbi|nta|neet|jee|cuet|gate|\bcat\b|bpsc|rpsc|mppsc|uppsc/i,
  /police|constable|teacher|clerk|officer|engineer|nurse|pharmacist|stenographer/i,
];

/** Title me koi bhi sarkari-naukri context hai? */
export function hasGovtContext(title) {
  const t = String(title || '');
  return GOVT_CONTEXT_PATTERNS.some(re => re.test(t));
}

/** Ye topic hamare site ka hi nahi hai (finance / filmi / crime / cricket)? */
export function isJunkTopic(title) {
  const t = String(title || '');
  return JUNK_TOPIC_PATTERNS.some(re => re.test(t));
}

/**
 * Category-wise keyword. Entry ka title apni category se match karna CHAHIYE.
 * (personal-finance news ko "Admit Card" banane se rokta hai.)
 */
const CATEGORY_PATTERNS = {
  'jobs': /recruitment|vacancy|vacancies|bharti|naukri|hiring|apply online|notification|posts|opening|\bjobs?\b/i,
  'results': /result|merit list|selection list|final list|scorecard|rank card|cut ?off|topper|marks/i,
  'admit-cards': /admit card|hall ticket|call letter|exam city|city slip|intimation slip|exam date|exam schedule|exam analysis|question paper|response sheet/i,
  'answer-keys': /answer key|response sheet|objection|challenge window|master question|question paper/i,
  'yojana': /yojana|scheme|awas|kisan|subsidy|ration|ayushman|pension|mudra|ujjwala|scholarship|jan dhan|solar|bijli|pradhan mantri|pm[- ]/i,
};

/** Entry ka title uski category se match karta hai? */
export function categoryMatchesTitle(title, type) {
  const re = CATEGORY_PATTERNS[type];
  if (!re) return true; // 'pib' jaise feeds ke liye koi restriction nahi
  return re.test(String(title || ''));
}

/**
 * Purana quality gate + junk topic + govt context + category match — sab ek jagah.
 * @param {string} title
 * @param {string} [type] optional category; diya to category match bhi check hoga
 */
export function isQualityTitle(title, type) {
  const t = String(title || '').trim();

  // 1. Purane basic rules (pehle se the, waise hi rakhe)
  const words = t.split(/\s+/).filter(w => w.length > 1);
  if (words.length < 3) return false;
  if (t.length < 15) return false;
  const alphaChars = (t.match(/[a-zA-Z\u0900-\u097F]/g) || []).length;
  if (alphaChars / t.length < 0.3) return false;

  // 2. NAYA: bilkul galat topic? (finance / filmi / cricket / crime)
  if (isJunkTopic(t)) return false;

  // 3. NAYA: sarkari context hai hi? (nahi to ye hamara content nahi hai)
  if (!hasGovtContext(t)) return false;

  // 4. NAYA: category se match karta hai? (galat bucket rokta hai)
  if (type && !categoryMatchesTitle(t, type)) return false;

  return true;
}


// ---------------------------------------------------------------------------
// OFFICIAL LINKS — jagranjosh/careerpower ki jagah asli govt portal
// ---------------------------------------------------------------------------

// Organization -> uska OFFICIAL portal. Google ka JobPosting rule kehta hai
// apply link official hona chahiye; private coaching blog nahi.
// Organization -> uska OFFICIAL portal. Google ka JobPosting rule kehta hai
// apply link official hona chahiye; private coaching blog nahi.
const OFFICIAL_PORTALS = [
  [/\bssc\b|staff selection/i, 'https://ssc.gov.in'],
  [/\bupsc\b/i, 'https://upsc.gov.in'],
  [/\brrb\b|railway|railtel|\brpf\b|cris/i, 'https://indianrailways.gov.in'],
  [/\bibps\b/i, 'https://www.ibps.in'],
  [/\bsbi\b|state bank of india/i, 'https://sbi.co.in'],
  [/\brbi\b|reserve bank of india/i, 'https://www.rbi.org.in'],
  [/\bnta\b|\bneet\b|\bjee\b|\bcuet\b|\bgate\b/i, 'https://nta.ac.in'],
  [/\bdsssb\b|delhi subordinate/i, 'https://dsssb.delhi.gov.in'],
  [/\bwbpsc\b|west bengal psc/i, 'https://psc.wb.gov.in'],
  [/\bpsssb\b|punjab sssb/i, 'https://sssb.punjab.gov.in'],
  [/\bhssc\b|\bhpsc\b|haryana/i, 'https://hssc.gov.in'],
  [/\bukpsc\b|\buksssc\b|uttarakhand/i, 'https://psc.uk.gov.in'],
  [/\bbpsc\b|\bbssc\b|bihar/i, 'https://www.bpsc.bihar.gov.in'],
  [/\brpsc\b|\brsmssb\b|rajasthan/i, 'https://rpsc.rajasthan.gov.in'],
  [/\bmppsc\b|\bmppeb\b|\besb\b|madhya pradesh/i, 'https://mppsc.mp.gov.in'],
  [/\buppsc\b|\bupsssc\b|uttar pradesh/i, 'https://uppsc.up.nic.in'],
  [/\bjpsc\b|\bjssc\b|jharkhand/i, 'https://jssc.nic.in'],
  [/\bopsc\b|\bosssc\b|odisha/i, 'https://opsc.gov.in'],
  [/\bappsc\b|\btspsc\b/i, 'https://psc.ap.gov.in'],
  [/\bkpsc\b|karnataka/i, 'https://kpsc.kar.nic.in'],
  [/\btnpsc\b|tamil nadu/i, 'https://www.tnpsc.gov.in'],
  [/\bmpsc\b|maharashtra/i, 'https://mpsc.gov.in'],
  [/\b(army|navy|air force|nda|cds|drdo|defence|agniveer)\b/i, 'https://www.joinindianarmy.nic.in'],
  [/\b(cisf|crpf|bsf|itbp|ssb|capf|assam rifles)\b/i, 'https://www.crpf.gov.in'],
  [/\b(epfo|esic|lic|gail|ongc|bhel|nhpc|sail|ntpc|iocl)\b/i, 'https://www.india.gov.in'],
  [/post office|india post|\bgds\b/i, 'https://www.indiapost.gov.in'],
];

/**
 * Ye link kisi private news/coaching site par jata hai?
 * (news.google.com/rss/articles/... = Google News redirect -> jagranjosh etc.)
 */
export function isNewsRedirectLink(url) {
  return /news\.google\.com\/rss\/articles/i.test(String(url || ''));
}

/** Ye asli sarkari domain hai? (.gov.in / .nic.in / .gov / .mil) */
export function isOfficialGovtLink(url) {
  const u = String(url || '').trim();
  if (!u || isNewsRedirectLink(u)) return false;
  try {
    const host = new URL(u).hostname.toLowerCase();
    return /\.(gov\.in|nic\.in|gov|mil|gov\.uk|edu\.in)$/.test(host);
  } catch {
    return false;
  }
}

/**
 * Title/organization se uska OFFICIAL portal nikaalo.
 * Mil na jaye to India ka national portal.
 */
export function officialPortalFor(title = '', org = '') {
  const hay = `${title} ${org}`;
  for (const [re, url] of OFFICIAL_PORTALS) {
    if (re.test(hay)) return url;
  }
  return 'https://www.india.gov.in';
}

/**
 * Entry ke liye behtar download/apply link chuno.
 *
 * Rule:
 *   - Official govt link  -> wahi use karo (best)
 *   - Google News redirect-> uski jagah OFFICIAL portal do (jagranjosh se behtar)
 *   - Kuch aur            -> jaisa hai waisa rakho
 */
export function pickBestLink(rawLink, title, org = '') {
  const link = String(rawLink || '').trim();
  if (isOfficialGovtLink(link)) return link;
  if (isNewsRedirectLink(link) || !link) return officialPortalFor(title, org);
  return link;
}

/**
 * Yojana entries ke liye HONEST text. Pehle har scheme me ek hi jaisa nakli
 * eligibility/documents paste ho jata tha, jo fabricated content tha.
 * Ab sirf neutral, sach text jaata hai jab tak asli data na mile.
 */
export const HONEST_YOJANA_TEXT = {
  eligibility: 'पात्रता की जानकारी आधिकारिक अधिसूचना में देखें (नीचे आधिकारिक पोर्टल लिंक)।',
  benefits: 'योजना के लाभ और राशि की पुष्टि आधिकारिक अधिसूचना से करें।',
  documents: ['आधिकारिक अधिसूचना में दी गई दस्तावेज़ सूची देखें'],
  applicationProcess: [
    'नीचे दिए आधिकारिक पोर्टल पर जाएँ',
    'आधिकारिक अधिसूचना पढ़ें और पात्रता जाँचें',
    'निर्देशानुसार आवेदन करें',
  ],
};

// ---------------------------------------------------------------------------
// THIN PAGE DETECTION (Shared between Astro templates & sitemap generator)
// Pages flagged as thin:
// 1. Get `noindex` in meta robots tag (Google ignores them for site-quality score)
// 2. Are excluded from sitemap.xml (prevents "Submitted URL marked noindex" errors)
// ---------------------------------------------------------------------------

const VAGUE_DATE = /check official|check notification|tba|to be announced|announce nahi/i;

export function isThinJob(job) {
  if (!job) return false;
  return Boolean(job.autoSynced) &&
    (VAGUE_DATE.test(job.lastDate || '') || !job.lastDate) &&
    (
      !job.applyUrl ||
      job.applyUrl === '#' ||
      /news\.google\.com|india\.gov\.in\/?(\?|$)/i.test(job.applyUrl)
    );
}

export function isThinResult(result) {
  if (!result) return false;
  return Boolean(result.autoSynced) &&
    (
      !result.resultUrl ||
      result.resultUrl === '#' ||
      /news\.google\.com|india\.gov\.in\/?(\?|$)/i.test(result.resultUrl || '')
    );
}

export function isThinAdmitCard(card) {
  if (!card) return false;
  return Boolean(card.autoSynced) &&
    (
      !card.downloadUrl ||
      card.downloadUrl === '#' ||
      /news\.google\.com|india\.gov\.in\/?(\?|$)/i.test(card.downloadUrl || '')
    );
}

export function isThinAnswerKey(key) {
  if (!key) return false;
  return Boolean(key.autoSynced) &&
    (
      !key.keyUrl ||
      key.keyUrl === '#' ||
      /news\.google\.com|india\.gov\.in\/?(\?|$)/i.test(key.keyUrl || '')
    );
}

export function isThinYojana(yojana) {
  if (!yojana) return false;
  return Boolean(yojana.autoSynced) &&
    (
      !yojana.officialWebsite ||
      /news\.google\.com|india\.gov\.in\/?(\?|$)/i.test(yojana.officialWebsite || '') ||
      /news\.google\.com/i.test(yojana.benefits || '')
    );
}

