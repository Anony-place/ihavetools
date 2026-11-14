// =============================================================================
// iHaveTools — Web & SEO tools: meta-tag-generator, robots-txt-generator,
// sitemap-generator, open-graph-preview, url-parser, keyword-density-checker,
// qr-code-generator, qr-code-scanner, youtube-thumbnail-downloader
// =============================================================================
import { h, field, input, textarea, select, switchChip, btn, actionsRow, resultPanel, statusLine, statsGrid, table, toast, copyText, downloadText, downloadBlob, privacyNote, dropzone, readFile, mountTool } from '../ui.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ═══════════════════════════ QR codes (vendored MIT engine, lazy) ═══════════════════════════
   The encoder is qrcode-generator by Kazuhiko Arase (MIT), vendored at
   /assets/vendor/qrcode-generator.js and loaded only on the QR page —
   the same pattern as pdf-lib. Round-trip verified in tests with jsQR. */
let qrLibPromise = null;
export function loadQrLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (qrLibPromise) return qrLibPromise;
  qrLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/assets/vendor/qrcode-generator.js';
    s.onload = () => { if (window.qrcode) resolve(window.qrcode); else { qrLibPromise = null; reject(new Error('The QR engine loaded but did not initialise.')); } };
    s.onerror = () => { qrLibPromise = null; reject(new Error('Could not load the QR engine. Check your connection and try again.')); };
    document.head.append(s);
  });
  return qrLibPromise;
}

let jsQrPromise = null;
export function loadJsQrLib() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (jsQrPromise) return jsQrPromise;
  jsQrPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/assets/vendor/jsqr.js';
    s.onload = () => { if (window.jsQR) resolve(window.jsQR); else { jsQrPromise = null; reject(new Error('The QR scanner loaded but did not initialise.')); } };
    s.onerror = () => { jsQrPromise = null; reject(new Error('Could not load the QR scanner. Check your connection and try again.')); };
    document.head.append(s);
  });
  return jsQrPromise;
}

export function decodeQrPixels(lib, imageData) {
  if (!lib) throw new Error('The QR scanner is not loaded yet.');
  if (!imageData?.data || !(imageData.width > 0) || !(imageData.height > 0)) throw new Error('No readable image pixels were provided.');
  const code = lib(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  return code?.data || null;
}

export function qrPayloadInfo(raw) {
  const original = String(raw ?? '');
  const text = original.trim();
  if (!text) throw new Error('The QR code did not contain readable text.');
  const base = { type: 'Plain text', text: original, href: null, actionLabel: null, summary: text, safety: 'Review the content before using it.' };

  if (/^WIFI:/i.test(text)) {
    const fieldValue = (key) => {
      const m = new RegExp(`(?:^WIFI:|;)${key}:((?:\\\\.|[^;])*)`, 'i').exec(text);
      return m ? m[1].replace(/\\([;,:\\"])/g, '$1') : '';
    };
    const ssid = fieldValue('S');
    const security = fieldValue('T') || 'not specified';
    return { ...base, type: 'Wi-Fi network', summary: ssid ? `Network “${ssid}” · security ${security}` : `Wi-Fi join payload · security ${security}`, safety: 'Only join networks you trust. The password is present in the raw QR text below.' };
  }
  if (/^BEGIN:VCARD/im.test(text)) return { ...base, type: 'Contact card (vCard)', summary: 'Contact details encoded as a vCard.' };
  if (/^upi:\/\//i.test(text) || /^upi:/i.test(text)) {
    let payee = '';
    try { payee = new URL(text).searchParams.get('pn') || new URL(text).searchParams.get('pa') || ''; } catch { /* show raw text */ }
    return { ...base, type: 'UPI payment request', summary: payee ? `Payee: ${payee}` : 'UPI payment payload', safety: 'Payment QR codes require extra care. Verify the payee name and amount inside your UPI app before approving.' };
  }
  if (/^mailto:/i.test(text)) return { ...base, type: 'Email address', href: text, actionLabel: 'Open email app', summary: text.slice(7).split('?')[0] || text };
  if (/^tel:/i.test(text)) return { ...base, type: 'Phone number', href: text, actionLabel: 'Call number', summary: text.slice(4) };
  if (/^(sms|smsto):/i.test(text)) return { ...base, type: 'SMS message', href: text.replace(/^smsto:/i, 'sms:'), actionLabel: 'Open messages', summary: text.replace(/^(sms|smsto):/i, '') };
  if (/^geo:/i.test(text)) return { ...base, type: 'Location', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text.slice(4).split(';')[0])}`, actionLabel: 'Open in Google Maps', summary: text.slice(4) };
  try {
    const u = new URL(text);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return { ...base, type: 'Website URL', href: u.href, actionLabel: 'Open website', summary: `${u.hostname}${u.pathname === '/' ? '' : u.pathname}`, safety: `Check the domain first: ${u.hostname}. A QR code can hide a look-alike or phishing address.` };
    }
  } catch { /* plain text */ }
  return base;
}

/** Build a QR module matrix. lib = the vendored qrcode() factory. */
export function makeQrModules(lib, text, ecl = 'M') {
  const s = String(text ?? '');
  if (!s.trim()) throw new Error('Enter some text or a URL first.');
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s)) throw new Error('Text contains an unpaired Unicode surrogate.');
  if (!lib) throw new Error('The QR engine is not loaded yet.');
  if (!['L', 'M', 'Q', 'H'].includes(ecl)) throw new Error('Unsupported error-correction level.');
  let qr;
  try {
    qr = lib(0, ecl); // typeNumber 0 = smallest version that fits
    qr.addData(s);
    qr.make();
  } catch {
    throw new Error('That text is too long for a single QR code at this error-correction level — shorten it or choose level L.');
  }
  const size = qr.getModuleCount();
  const modules = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push(!!qr.isDark(r, c));
    modules.push(row);
  }
  return { size, modules, version: (size - 17) / 4 };
}

/** Render a module matrix as a standalone SVG string (quiet zone included). */
export function qrSvgString(modules, { fg = '#000000', bg = '#ffffff', margin = 4 } = {}) {
  const size = modules.length;
  const total = size + margin * 2;
  let d = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (modules[r][c]) d += `M${c + margin},${r + margin}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="512" height="512"><rect width="${total}" height="${total}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>\n`;
}

/* ═══════════════════════════ YouTube thumbnails ═══════════════════════════ */
export function extractYouTubeId(raw) {
  const s = String(raw || '').trim();
  if (!s) throw new Error('Paste a YouTube video URL or ID first.');
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); }
  catch { throw new Error('That does not look like a valid URL.'); }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const isId = (v) => /^[a-zA-Z0-9_-]{11}$/.test(v || '');
  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    if (isId(id)) return id;
  } else if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')) {
    if (isId(u.searchParams.get('v'))) return u.searchParams.get('v');
    const m = /^\/(?:shorts|embed|live|v)\/([a-zA-Z0-9_-]{11})/.exec(u.pathname);
    if (m) return m[1];
  }
  throw new Error('No video ID found. Use a youtube.com/watch, youtu.be, Shorts or embed link — or paste the 11-character video ID.');
}
export const YT_THUMB_SIZES = [
  { key: 'maxresdefault', label: 'Maximum (1280 × 720)', w: 1280 },
  { key: 'sddefault', label: 'SD (640 × 480)', w: 640 },
  { key: 'hqdefault', label: 'HQ (480 × 360)', w: 480 },
  { key: 'mqdefault', label: 'MQ (320 × 180)', w: 320 },
  { key: 'default', label: 'Default (120 × 90)', w: 120 },
];
export const youtubeThumbUrl = (id, key) => `https://i.ytimg.com/vi/${id}/${key}.jpg`;

/* ═══════════════════════════ URL parsing (shared with url-parser) ═══════════════════════════ */
export function parseUrlParts(raw) {
  const s = String(raw).trim();
  if (!s) throw new Error('Paste a URL first.');
  const looksLikeHostPort = /^[^/?#]+:\d+(?:[/?#]|$)/.test(s);
  const hasScheme = s.includes('://') || (!looksLikeHostPort && /^[a-z][a-z0-9+.-]*:/i.test(s));
  let u;
  if (hasScheme) {
    try { u = new URL(s); }
    catch { throw new Error(`“${s}” is not a valid URL. Check the address, like https://example.com/page?q=1`); }
  } else {
    try { u = new URL(`https://${s}`); }
    catch { throw new Error(`“${s}” is not a valid URL. Include the full address, like https://example.com/page?q=1`); }
  }
  const params = [];
  for (const [k, v] of u.searchParams) params.push([k, v]);
  return {
    href: u.href, protocol: u.protocol.replace(':', ''), scheme: u.protocol.replace(':', ''),
    host: u.hostname, hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? '443 (default)' : u.protocol === 'http:' ? '80 (default)' : ''),
    origin: u.origin, path: u.pathname, pathname: u.pathname, query: u.search, search: u.search,
    params, hash: u.hash, fragment: u.hash.replace('#', ''), username: u.username, password: u.password ? '••••' : '',
    tld: (() => { const parts = u.hostname.split('.'); return parts.length > 1 ? parts[parts.length - 1] : ''; })(),
    domain: (() => { const parts = u.hostname.split('.'); return parts.slice(-2).join('.'); })(),
  };
}

/* ═══════════════════════════ Keyword density ═══════════════════════════ */
const STOPWORDS = new Set('a,an,and,are,as,at,be,been,but,by,can,could,did,do,does,for,from,had,has,have,he,her,his,how,i,if,in,into,is,it,its,just,like,may,might,must,not,of,on,or,our,shall,she,should,since,so,some,than,that,the,their,them,then,there,these,they,this,those,to,too,us,was,we,were,what,when,where,which,while,who,whom,why,will,with,would,you,your,yours'.split(','));
const tokenizeWords = (text, normalize = false) => {
  const lowered = String(text || '').toLowerCase();
  return (normalize ? lowered.normalize('NFC') : lowered).match(/\p{L}[\p{L}\p{M}'’-]*/gu) || [];
};

/**
 * Keyword frequency + density.
 * `total` is always the word count. Density is the share of all words that
 * belong to occurrences of the term: count × phrase length ÷ total words,
 * capped at 100% for pathological overlapping phrases. A target phrase is
 * counted independently of the stop-word filter and phrase-length setting.
 */
export function keywordDensity(text, { phraseLength = 1, filterStop = true, minCount = 1, limit = 100, target = '', excluded = '', normalize = false } = {}) {
  if (String(text).length > 200000 || String(target).length > 1000) throw new Error('Input limit: 200,000 characters of content and 1,000 characters in the target phrase.');
  if (String(excluded).length > 2000) throw new Error('Excluded words are limited to 2,000 characters.');
  const exclusions = new Set(tokenizeWords(excluded, normalize));
  const words = tokenizeWords(text, normalize);
  const targetWords = tokenizeWords(target, normalize);
  if (String(target).trim() && !targetWords.length) throw new Error('The target must contain at least one word made of letters.');
  const n = [1, 2, 3].includes(Number(phraseLength)) ? Number(phraseLength) : 1;
  const minimum = Math.max(1, Number(minCount) || 1);
  const cap = Math.min(500, Math.max(1, Math.floor(Number(limit) || 100)));
  if (!words.length) return { total: 0, totalWords: 0, totalPhrases: 0, distinct: 0, terms: [], top: [], target: null };

  const counts = new Map();
  for (let i = 0; i + n <= words.length; i++) {
    const gram = words.slice(i, i + n);
    if (gram.some(g => exclusions.has(g) || (filterStop && STOPWORDS.has(g)))) continue;
    const key = gram.join(' ');
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const totalPhrases = Math.max(0, words.length - n + 1);
  const matchedTerms = [...counts.entries()]
    .filter(([, c]) => c >= minimum)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([phrase, count]) => ({ phrase, count, density: Math.min(100, (count * n / words.length) * 100) }));
  const terms = matchedTerms.slice(0, cap);

  let targetResult = null;
  if (targetWords.length) {
    if (targetWords.length * words.length > 2000000) throw new Error('Target phrase is too long for this content. Shorten it or the input.');
    let count = 0;
    for (let i = 0; i + targetWords.length <= words.length; i++) {
      if (targetWords.every((word, j) => words[i + j] === word)) count++;
    }
    targetResult = {
      phrase: targetWords.join(' '),
      count,
      density: Math.min(100, (count * targetWords.length / words.length) * 100),
    };
  }

  return { total: words.length, totalWords: words.length, totalPhrases, distinct: counts.size, matched: matchedTerms.length, terms, top: terms, target: targetResult };
}

/** Count a small, normalized list of phrases independently of table filters. */
export function keywordTargetList(text, targets, { normalize = false } = {}) {
  if (String(text).length > 200000) throw new Error('Content exceeds the 200,000-character limit.');
  if (String(targets).length > 2000) throw new Error('Target list exceeds 2,000 characters.');
  const lines = String(targets).split(/\r\n|\r|\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 20) throw new Error('Enter at most 20 target phrases.');
  const unique = new Map();
  for (const line of lines) {
    const tokens = tokenizeWords(line, normalize);
    if (!tokens.length) throw new Error('Each target must contain at least one word made of letters.');
    const key = tokens.join(' ');
    if (!unique.has(key)) unique.set(key, tokens);
  }
  const words = tokenizeWords(text, normalize);
  const work = [...unique.values()].reduce((sum,tokens) => sum + tokens.length * words.length, 0);
  if (work > 2000000) throw new Error('Target list is too long for this content. Reduce the targets or content.');
  return [...unique].map(([phrase,tokens]) => {
    let count = 0;
    for (let i=0; i+tokens.length<=words.length; i++) if (tokens.every((word,j)=>words[i+j]===word)) count++;
    return {phrase,count,density:words.length ? Math.min(100,count*tokens.length/words.length*100) : 0};
  });
}

export function keywordFrequencyCsv(terms = []) {
  const cell = (value) => `"${String(value).replace(/"/g, '""')}"`;
  return [
    'term,count,density_percent',
    ...terms.map((t) => [cell(t.phrase), t.count, Number(t.density || 0).toFixed(4)].join(',')),
  ].join('\n') + '\n';
}

/* ═══════════════════════════ Robots.txt builder ═══════════════════════════ */
export function buildRobots(rules, { sitemap = '', crawlDelay = null } = {}) {
  const lines = [];
  if (rules.length > 500 || rules.reduce((n, rule) => n + (rule.disallow || []).length + (rule.allow || []).length, 0) > 10000) throw new Error('At most 500 crawler groups and 10,000 paths are supported.');
  if (crawlDelay != null && crawlDelay !== '' && (!/^\d+(?:\.\d+)?$/.test(String(crawlDelay)) || Number(crawlDelay) > 86400)) throw new Error('Crawl-delay must be a non-negative number of seconds, up to 86400.');
  if (sitemap) validateWebUrl(sitemap, 'Sitemap URL');
  for (const rule of rules) {
    if (!/^(?:\*|[A-Za-z][A-Za-z0-9_-]*)$/.test(rule.agent || '*')) throw new Error('User-agent must be * or a crawler token (letters, digits, hyphens and underscores).');
    for (const path of [...(rule.disallow || []), ...(rule.allow || [])]) {
      if (typeof path !== 'string' || !path.startsWith('/') || /[\s#\x00-\x1f\x7f]/.test(path)) throw new Error('Robots paths must start with / and contain no spaces, # or control characters. Percent-encode them.');
      if (path.length > 2048) throw new Error('Robots paths must be at most 2,048 characters.');
    }
    const disallow = rule.disallow || [];
    const allow = rule.allow || [];
    lines.push(`User-agent: ${rule.agent || '*'}`);
    // An empty group is easy for both people and parsers to misread. Spell
    // out the conventional empty Disallow when the intent is "allow all".
    if (!disallow.length && !allow.length) lines.push('Disallow:');
    for (const d of disallow) lines.push(`Disallow: ${d}`);
    for (const a of allow) lines.push(`Allow: ${a}`);
    if (crawlDelay != null && crawlDelay !== '' && rule.agent !== 'Googlebot') lines.push(`Crawl-delay: ${crawlDelay}`);
    lines.push('');
  }
  if (!rules.length) lines.push('User-agent: *', 'Disallow:', '');
  if (sitemap) lines.push(`Sitemap: ${sitemap}`);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const robotsPatternMatches = (pattern, path) => {
  const anchored = pattern.endsWith('$');
  const parts = (anchored ? pattern.slice(0, -1) : pattern).split('*');
  if (!path.startsWith(parts[0])) return false;
  let pos = parts[0].length;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (anchored && i === parts.length - 1) return path.endsWith(part) && path.length - part.length >= pos;
    const index = path.indexOf(part, pos);
    if (index < 0) return false;
    pos = index + part.length;
  }
  return !anchored || pos === path.length;
};

const robotsPath = (raw) => {
  const value = String(raw || '').trim();
  if (value.length > 8192) throw new Error('Test path must be no longer than 8,192 characters.');
  if (!value) throw new Error('Enter a URL or path to test.');
  try {
    const url = new URL(value);
    return `${url.pathname || '/'}${url.search || ''}`;
  } catch {
    return value.startsWith('/') ? value : `/${value}`;
  }
};

/**
 * Test one path against the current in-memory robots rules.
 * The most specific matching user-agent token wins over `*`; then the
 * longest matching Allow/Disallow pattern wins. On an exact length tie,
 * Allow is the least restrictive result. `*` and a trailing `$` follow the
 * pattern syntax supported by major search crawlers.
 */
export function testRobotsAccess(rules, userAgent, rawPath) {
  const path = robotsPath(rawPath);
  const ua = String(userAgent || '*').trim().toLowerCase() || '*';
  const specific = (rules || []).filter((rule) => {
    const token = String(rule.agent || '*').trim().toLowerCase();
    return token && token !== '*' && (ua === token || ua.includes(token));
  });
  const bestSpecificLength = specific.reduce((max, rule) => Math.max(max, String(rule.agent || '').trim().length), 0);
  const groups = bestSpecificLength
    ? specific.filter((rule) => String(rule.agent || '').trim().length === bestSpecificLength)
    : (rules || []).filter((rule) => String(rule.agent || '*').trim() === '*');
  const agentGroup = groups.length ? String(groups[0].agent || '*') : '*';

  let winner = null;
  for (const group of groups) {
    const candidates = [
      ...(group.disallow || []).map((pattern) => ({ type: 'Disallow', pattern })),
      ...(group.allow || []).map((pattern) => ({ type: 'Allow', pattern })),
    ];
    for (const candidate of candidates) {
      const pattern = String(candidate.pattern || '');
      if (!pattern || !robotsPatternMatches(pattern, path)) continue;
      if (!winner || pattern.length > winner.pattern.length || (pattern.length === winner.pattern.length && candidate.type === 'Allow')) {
        winner = { ...candidate, pattern };
      }
    }
  }

  return {
    allowed: !winner || winner.type === 'Allow',
    agentGroup,
    path,
    ruleType: winner?.type || null,
    pattern: winner?.pattern || null,
  };
}

/* ═══════════════════════════ Sitemap XML builder ═══════════════════════════ */
function validateWebUrl(raw, label = 'URL') {
  if (typeof raw !== 'string' || raw.length >= 2048 || /[\x00-\x20\x7f]/.test(raw) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(raw)) throw new Error(`${label} must be a valid absolute URL under 2,048 characters, without whitespace or control characters.`);
  let u; try { u = new URL(raw); } catch { throw new Error(`${label} must be a valid absolute URL with http:// or https://.`); }
  if (u.href.length >= 2048) throw new Error(`${label} must be under 2,048 characters after URL encoding.`);
  if (!/^https?:$/.test(u.protocol) || !u.hostname || u.username || u.password || u.hash) throw new Error(`${label} must be an absolute HTTP(S) URL without credentials or a fragment.`);
  return u;
}
export function buildSitemapXml(urls, { changefreq = '', priority = '', lastmod = '' } = {}) {
  if (!urls.length || !urls.some(raw => String(raw).trim())) throw new Error('Add at least one URL.');
  if (urls.length > 10000 || urls.reduce((n, u) => n + String(u).length, 0) > 2000000) throw new Error('This generator supports at most 10,000 URLs and 2 million input characters per sitemap.');
  if (changefreq && !['always','hourly','daily','weekly','monthly','yearly','never'].includes(changefreq)) throw new Error('Invalid change frequency.');
  if (priority !== '' && (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(String(priority)))) throw new Error('Priority must be from 0.0 to 1.0.');
  if (lastmod) {
    const date = new Date(`${lastmod}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== lastmod) throw new Error('lastmod must be a valid date (YYYY-MM-DD).');
  }
  let origin = null;
  const seen = new Set();
  const entries = urls.map(raw => {
    const value = String(raw).trim(); if (!value) return null;
    const u = validateWebUrl(value);
    if (origin && origin !== u.origin) throw new Error('All sitemap URLs must have the same scheme, host and port.');
    origin = u.origin;
    if (seen.has(u.href)) throw new Error(`Duplicate URL after normalization: ${u.href}. Remove the duplicate and generate again.`);
    seen.add(u.href);
    // URL serialization percent-encodes non-ASCII/control-sensitive characters.
    return `  <url>\n    <loc>${esc(u.href)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}${changefreq ? `\n    <changefreq>${changefreq}</changefreq>` : ''}${priority !== '' ? `\n    <priority>${priority}</priority>` : ''}\n  </url>`;
  }).filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'meta-tag-generator'(root) {
    const title = input({ type: 'text', placeholder: 'Descriptive page title', maxlength: '120' });
    const desc = textarea({ rows: 3, mono: false, placeholder: 'Summarize this page for searchers…' });
    const url = input({ type: 'url', placeholder: 'https://example.com/page' });
    const image = input({ type: 'url', placeholder: 'https://example.com/og-image.png (1200×630 recommended)' });
    const siteName = input({ type: 'text', placeholder: 'Site name, e.g. Example Inc.' });
    const twitter = select({ options: [{ v: 'summary_large_image', t: 'Summary with large image' }, { v: 'summary', t: 'Summary (small image)' }] });
    const robots = select({ options: [{ v: 'index, follow', t: 'index, follow (default)' }, { v: 'noindex, follow', t: 'noindex, follow' }, { v: 'index, nofollow', t: 'index, nofollow' }, { v: 'noindex, nofollow', t: 'noindex, nofollow' }] });
    const status = statusLine('');
    const out = resultPanel({ label: 'Meta tags', download: true, downloadName: 'meta-tags.html', downloadMime: 'text/html;charset=utf-8' });
    const build = () => {
      const t = title.value.trim(), d = desc.value.trim(), u = url.value.trim(), img = image.value.trim(), sn = siteName.value.trim();
      if (!t) { out.placeholder('Enter a page title to generate tags.'); status.set('Enter a page title first.', 'warning'); return; }
      try { if (u) validateWebUrl(u, 'Canonical URL'); if (img) validateWebUrl(img, 'Image URL'); }
      catch (e) { out.placeholder(); status.set(e.message, 'error'); return; }
      const L = [];
      L.push(`<title>${esc(t)}</title>`);
      L.push(`<meta name="description" content="${esc(d)}">`);
      L.push(`<meta name="robots" content="${robots.value}">`);
      if (u) L.push(`<link rel="canonical" href="${esc(u)}">`);
      L.push('');
      L.push(`<!-- Open Graph (Facebook, LinkedIn, WhatsApp…) -->`);
      L.push(`<meta property="og:type" content="website">`);
      L.push(`<meta property="og:title" content="${esc(t)}">`);
      L.push(`<meta property="og:description" content="${esc(d)}">`);
      if (u) L.push(`<meta property="og:url" content="${esc(u)}">`);
      if (sn) L.push(`<meta property="og:site_name" content="${esc(sn)}">`);
      if (img) L.push(`<meta property="og:image" content="${esc(img)}">`);
      L.push('');
      L.push(`<!-- Twitter / X -->`);
      L.push(`<meta name="twitter:card" content="${twitter.value}">`);
      L.push(`<meta name="twitter:title" content="${esc(t)}">`);
      L.push(`<meta name="twitter:description" content="${esc(d)}">`);
      if (img) L.push(`<meta name="twitter:image" content="${esc(img)}">`);
      out.set(L.join('\n'));
      status.set('Generated. Search engines may choose different titles or snippets; display width varies.', 'success');
    };
    [title, desc, url, image, siteName, twitter, robots].forEach((el) => { el.addEventListener('input', build); el.addEventListener('change', build); });
    root.append(
      field({ label: 'Page title', control: title }),
      field({ label: 'Meta description', control: desc }),
      h('div', { class: 'field-row' }, field({ label: 'Canonical URL', control: url }), field({ label: 'Site name', control: siteName })),
      field({ label: 'Social image URL', control: image }),
      h('div', { class: 'field-row' }, field({ label: 'Twitter card', control: twitter }), field({ label: 'Robots', control: robots })),
      actionsRow(btn({ label: 'Generate tags', icon: 'code', onClick: build })),
      status, h('br'), out.panel);
    build();
  },

  'robots-txt-generator'(root) {
    const rows = h('div', { class: 'file-list' });
    const sitemap = input({ type: 'url', placeholder: 'https://example.com/sitemap.xml' });
    const delay = input({ type: 'number', min: 0, placeholder: 'seconds (optional)' });
    const out = resultPanel({ label: 'robots.txt', download: true, downloadName: 'robots.txt' });
    const testAgent = input({ type: 'text', value: 'Googlebot', placeholder: 'Googlebot, Bingbot, GPTBot…' });
    const testUrl = input({ type: 'text', value: '/private/', placeholder: '/private/ or https://example.com/private/' });
    const testOut = resultPanel({ label: 'Crawl test result', copy: false, placeholder: 'Run a test to see which rule wins.' });
    const status = statusLine('');
    let rules = [{ agent: '*', disallow: [], allow: [] }];
    const runTest = () => {
      try {
        const r = testRobotsAccess(rules, testAgent.value, testUrl.value);
        testOut.set([
          r.allowed ? 'Allowed ✓' : 'Blocked ✕',
          `Crawler group used: ${r.agentGroup}`,
          `Path tested: ${r.path}`,
          r.pattern ? `Winning rule: ${r.ruleType}: ${r.pattern}` : 'Winning rule: none — crawling is allowed by default.',
        ].join('\n'));
      } catch (e) { testOut.set(e.message); }
    };
    const render = () => {
      rows.replaceChildren(...rules.map((r, i) => h('div', { class: 'file-row', style: 'flex-wrap:wrap' },
        h('code', { class: 'mono', text: `UA: ${r.agent}` }),
        h('span', { class: 'hint', text: `Disallow: ${r.disallow.length || 'none'} · Allow: ${r.allow.length || 'none'}` }),
        h('span', { class: 'fr-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `Edit ${r.agent} rule ${i + 1}`, onclick: () => addRule(i) }, 'Edit'),
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `Remove ${r.agent} rule ${i + 1}`, onclick: () => { rules.splice(i, 1); if (!rules.length) rules = [{ agent: '*', disallow: [], allow: [] }]; formWrap.replaceChildren(); render(); build(); } }, 'Remove')))));
    };
    const build = () => {
      try {
        const text = buildRobots(rules, { sitemap: sitemap.value.trim(), crawlDelay: delay.value });
        out.set(text);
        status.set('Generated ✓ — place this file at the root of your domain.', 'success');
        runTest();
      } catch (e) { out.placeholder(); testOut.placeholder(); status.set(e.message, 'error'); }
    };
    [sitemap, delay].forEach(el => el.addEventListener('input', build));
    [testAgent, testUrl].forEach(el => el.addEventListener('input', () => testOut.placeholder('Inputs changed. Run the test again.')));
    const addRule = (index = null) => {
      const agent = input({ type: 'text', placeholder: 'User-agent, e.g. * or Googlebot' });
      const dis = input({ type: 'text', placeholder: '/private/  (comma-separate multiple)' });
      const allow = input({ type: 'text', placeholder: '/public/  (optional)' });
      if (index !== null) { agent.value = rules[index].agent; dis.value = rules[index].disallow.join(', '); allow.value = rules[index].allow.join(', '); }
      const form = h('div', {},
        h('div', { class: 'field-row' }, field({ label: 'User-agent', control: agent }), field({ label: 'Disallow paths', control: dis }), field({ label: 'Allow paths', control: allow })),
        actionsRow(
          btn({ label: index === null ? 'Add rule' : 'Save rule', icon: 'check', onClick: () => {
            const d = dis.value.split(',').map((s) => s.trim()).filter(Boolean);
            const a = allow.value.split(',').map((s) => s.trim()).filter(Boolean);
            const candidate = [...rules];
            const updated = { agent: agent.value.trim() || '*', disallow: d, allow: a };
            if (index === null) candidate.push(updated); else candidate[index] = updated;
            try { buildRobots(candidate, { sitemap: sitemap.value.trim(), crawlDelay: delay.value }); }
            catch (e) { status.set(e.message, 'error'); return; }
            rules = candidate; render(); build(); formWrap.replaceChildren();
          } }),
          btn({ label: 'Cancel', variant: 'ghost', onClick: () => formWrap.replaceChildren() })));
      formWrap.replaceChildren(form);
    };
    const formWrap = h('div', {});
    const setRules = (next) => { rules = next; formWrap.replaceChildren(); render(); build(); };
    const aiTrainingAgents = ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'Applebot-Extended', 'Meta-ExternalAgent'];
    root.append(
      actionsRow(
        btn({ label: 'Add rule', icon: 'robot', onClick: () => addRule() }),
        btn({ label: 'Allow everything', variant: 'secondary', onClick: () => setRules([{ agent: '*', disallow: [], allow: [] }]) }),
        btn({ label: 'Block everything', variant: 'secondary', onClick: () => setRules([{ agent: '*', disallow: ['/'], allow: [] }]) })),
      h('h3', { text: 'Starting presets', style: 'margin:18px 0 10px' }),
      actionsRow(
        btn({ label: 'WordPress defaults', variant: 'secondary', icon: 'settings', onClick: () => setRules([{ agent: '*', disallow: ['/wp-admin/'], allow: ['/wp-admin/admin-ajax.php'] }]) }),
        btn({ label: 'Block AI training crawlers', variant: 'secondary', icon: 'robot', onClick: () => setRules([
          { agent: '*', disallow: [], allow: [] },
          ...aiTrainingAgents.map((agent) => ({ agent, disallow: ['/'], allow: [] })),
        ]) })),
      h('p', { class: 'hint', text: 'The AI preset requests common crawlers not to crawl; compliance and future crawler names vary. Robots.txt is not access control and cannot guarantee blocking AI training or indexing. Review presets before publishing.' }),
      rows, formWrap,
      h('div', { class: 'field-row', style: 'margin-top:14px' }, field({ label: 'Sitemap URL', control: sitemap }), field({ label: 'Crawl-delay', control: delay, hint: 'Not supported by Google' })),
      actionsRow(btn({ label: 'Generate', icon: 'settings', onClick: build })),
      status, h('br'), out.panel,
      h('h3', { text: 'Test a URL against these rules', style: 'margin:22px 0 10px' }),
      h('p', { class: 'hint', text: 'Approximate local simulation, not a crawler guarantee. Encoding and crawler-specific rule handling may differ; verify with the crawler’s official tools.' }),
      h('div', { class: 'field-row' },
        field({ label: 'Crawler user-agent', control: testAgent }),
        field({ label: 'URL or path', control: testUrl })),
      actionsRow(btn({ label: 'Test crawler access', variant: 'secondary', icon: 'check', onClick: runTest })),
      h('br'), testOut.panel);
    render(); build();
  },

  'sitemap-generator'(root) {
    const inp = textarea({ rows: 10, placeholder: 'https://example.com/\nhttps://example.com/about\nhttps://example.com/blog/post-1' });
    const lastmod = input({ type: 'date' });
    const freq = select({ options: [{ v: '', t: '— none —' }, ...['always','hourly','daily','weekly','monthly','yearly','never'].map((f) => ({ v: f, t: f }))] });
    const prio = select({ options: [{ v: '', t: '— none —' }, ...['0.0','0.1','0.2','0.3','0.4','0.5','0.6','0.7','0.8','0.9','1.0'].map((p) => ({ v: p, t: p }))] });
    const status = statusLine('');
    const out = resultPanel({ label: 'sitemap.xml', download: true, downloadName: 'sitemap.xml', downloadMime: 'application/xml;charset=utf-8' });
    const run = () => {
      const urls = inp.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      try {
        const xml = buildSitemapXml(urls, { changefreq: freq.value, priority: prio.value, lastmod: lastmod.value });
        out.set(xml);
        status.set(`${urls.length} URL${urls.length === 1 ? '' : 's'} in the sitemap ✓`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    [inp, lastmod, freq, prio].forEach(el => { el.addEventListener('input', () => { out.placeholder(); status.set('Inputs changed. Generate again.', 'info'); }); el.addEventListener('change', () => { out.placeholder(); status.set('Inputs changed. Generate again.', 'info'); }); });
    root.append(field({ label: 'URLs (one per line)', control: inp }),
      h('p', { class: 'hint', text: 'One HTTP(S) origin per sitemap; max 10,000 URLs / 2 million characters here. The optional lastmod applies to every URL: use it only if accurate for each page. Google ignores changefreq and priority.' }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'lastmod (all URLs)', control: lastmod }),
        field({ label: 'changefreq', control: freq }),
        field({ label: 'priority', control: prio })),
      actionsRow(btn({ label: 'Generate sitemap', icon: 'sitemap', onClick: run }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'open-graph-preview'(root) {
    const title = input({ type: 'text', value: 'How We Built a Faster Checkout', placeholder: 'Page title' });
    const desc = input({ type: 'text', value: 'Cutting checkout time from 40 seconds to 12 — here is everything we learned.', placeholder: 'Description' });
    const site = input({ type: 'text', value: 'example.com', placeholder: 'example.com' });
    const url = input({ type: 'url', value: 'https://example.com/blog/faster-checkout', placeholder: 'https://…' });
    const status = statusLine('The preview shows the layout platforms use. Actual rendering varies slightly by platform.');
    const card = h('div', { class: 'preview-frame', style: 'margin-bottom:8px' });
    const out = resultPanel({ label: 'Open Graph tags' });
    const render = () => {
      const t = title.value || 'Your page title';
      const d = desc.value || 'Your page description will appear here.';
      const s = site.value || 'example.com';
      card.replaceChildren(
        h('div', { style: 'padding:14px' },
          h('div', { style: 'height:150px;border-radius:8px;background:linear-gradient(135deg,var(--primary-soft),var(--surface-2));display:grid;place-items:center;color:var(--text-3);font-size:.85rem;margin-bottom:10px', text: 'og:image (1200×630) renders here' }),
          h('div', { style: 'font-size:.78rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em', text: s }),
          h('div', { style: 'font-weight:700;font-size:1.02rem;margin:2px 0', text: t }),
          h('div', { style: 'font-size:.85rem;color:var(--text-2)', text: d })));
      out.set(`<meta property="og:type" content="article">\n<meta property="og:title" content="${esc(title.value)}">\n<meta property="og:description" content="${esc(desc.value)}">\n<meta property="og:site_name" content="${esc(site.value)}">\n<meta property="og:url" content="${esc(url.value)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${esc(title.value)}">\n<meta name="twitter:description" content="${esc(desc.value)}">`);
    };
    [title, desc, site, url].forEach((el) => el.addEventListener('input', render));
    root.append(
      field({ label: 'Title', control: title }),
      field({ label: 'Description', control: desc }),
      h('div', { class: 'field-row' }, field({ label: 'Site name', control: site }), field({ label: 'URL', control: url })),
      actionsRow(btn({ label: 'Copy tags', variant: 'secondary', icon: 'copy', onClick: async () => { (await copyText(out.text)) ? toast('OG tags copied', 'success') : toast('Copy failed', 'error'); } })),
      h('h3', { text: 'Share card preview', style: 'margin:8px 0 10px' }), card, status, h('br'), out.panel);
    render();
  },

  'url-parser'(root) {
    const inp = input({ type: 'text', class: 'input mono', value: 'https://user@example.com:8080/products/list?category=shoes&sort=price%20asc&page=2#results', placeholder: 'https://example.com/path?query=1#hash' });
    const status = statusLine('');
    const out = h('div', { class: 'tool-docs' });
    const run = () => {
      out.replaceChildren();
      try {
        const p = parseUrlParts(inp.value);
        const kv = (pairs) => h('dl', { class: 'kv-grid' }, pairs.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { class: 'mono', text: String(v) || '—' })]));
        out.append(
          h('section', { class: 'result-panel' }, h('div', { class: 'result-head' }, h('span', { class: 'result-label', text: 'Components' })), h('div', { class: 'result-body', tabindex: '0', role: 'region', 'aria-label': 'Result details' },
            kv([['Protocol', p.protocol], ['Host', p.host], ['Port', p.port], ['Path', p.path], ['Query', p.query || '—'], ['Fragment', p.fragment ? `#${p.fragment}` : '—'], ['Origin', p.origin], ['Last two hostname labels (not registrable domain)', p.domain], ['Last hostname label', p.tld], ['Username', p.username || '—']]))),
          h('section', {},
            h('h3', { text: `Query parameters (${p.params.length})`, style: 'margin:20px 0 10px' }),
            p.params.length
              ? table({ headers: ['#', 'Name', 'Value (decoded)'], rows: p.params.map(([k, v], i) => [String(i + 1), k, v]) })
              : h('p', { class: 'hint', text: 'This URL has no query parameters.' })));
        status.set('Parsed ✓', 'success');
      } catch (e) { status.set(e.message, 'error'); }
    };
    inp.addEventListener('input', () => { out.replaceChildren(); status.set('Input changed. Parse again.', 'info'); });
    root.append(field({ label: 'URL to parse', control: inp }),
      actionsRow(btn({ label: 'Parse URL', icon: 'link', onClick: run })), status, h('br'), out);
    run();
  },

  'keyword-density-checker'(root) {
    const inp = textarea({ rows: 10, mono: false, placeholder: 'Paste your content here…' });
    const target = input({ type: 'text', placeholder: 'Optional — e.g. online tools' });
    const targets = textarea({rows:3, placeholder:'One phrase per line, e.g.\nonline tools\nkeyword research'});
    const len = select({ options: [{ v: '1', t: 'Single words' }, { v: '2', t: '2-word phrases' }, { v: '3', t: '3-word phrases' }], value: '1' });
    const excluded = input({ type: 'text', placeholder: 'e.g. brand, example, product', maxlength: 2000 });
    const limit = select({ options: [{v:'25',t:'25 terms'}, {v:'100',t:'100 terms'}, {v:'500',t:'500 terms'}], value: '100' });
    const minimum = select({ options: [{ v: '1', t: 'All terms' }, { v: '2', t: '2+ times' }, { v: '3', t: '3+ times' }, { v: '5', t: '5+ times' }], value: '1' });
    const stop = switchChip({ label: 'Filter stop words', checked: true });
    const normalize = switchChip({ label: 'Match Unicode equivalents (NFC)' });
    const grid = statsGrid();
    const status = statusLine('');
    const out = h('div', {});
    let lastCsv = '', targetCsv = '', importRevision = 0;
    window.addEventListener('pagehide', () => { importRevision++; }, {once:true});
    const clearResults = () => { lastCsv = ''; targetCsv = ''; grid.replaceChildren(); out.replaceChildren(); };
    const file = input({ type: 'file', accept: '.txt,.md,text/plain,text/markdown' });
    file.addEventListener('change', async () => {
      const selected = file.files?.[0]; file.value = '';
      const token = ++importRevision;
      if (!selected) return;
      clearResults();
      if (!/\.(txt|md)$/i.test(selected.name) || selected.size > 800000) {
        status.set('Choose a .txt or .md file of at most 800,000 bytes. Existing content was kept.', 'error'); return;
      }
      status.set('Reading file locally…', 'info');
      try {
        const bytes = await readFile(selected, 'buffer');
        if (token !== importRevision) return;
        let text; try { text = new TextDecoder('utf-8', {fatal:true}).decode(bytes); } catch { status.set('File is not valid UTF-8. Existing content was kept.', 'error'); return; }
        if (typeof text !== 'string' || text.length > 200000) { status.set('File exceeds the 200,000-character content limit. Existing content was kept.', 'error'); return; }
        inp.value = text; lastCsv = ''; targetCsv = ''; grid.replaceChildren(); out.replaceChildren();
        status.set('Text loaded locally as UTF-8. Press Count keywords to analyse.', 'info');
      } catch { if (token === importRevision) status.set('Could not read that file. Existing content was kept.', 'error'); }
    });
    inp.addEventListener('input', () => { importRevision++; });
    const run = () => {
      importRevision++;
      const text = inp.value;
      if (!text.trim()) { lastCsv = ''; targetCsv = ''; grid.replaceChildren(); out.replaceChildren(); status.set('Paste some content first.', 'warning'); return; }
      let r, list; try { const nfc = normalize.querySelector('input').checked; list = keywordTargetList(text, targets.value, { normalize: nfc }); r = keywordDensity(text, {
        normalize: nfc,
        phraseLength: Number(len.value),
        filterStop: stop.querySelector('input').checked,
        minCount: Number(minimum.value),
        limit: Number(limit.value),
        excluded: excluded.value,
        target: target.value,
      }); } catch (e) { lastCsv = ''; targetCsv = ''; grid.replaceChildren(); out.replaceChildren(); status.set(e.message, 'error'); return; }
      lastCsv = keywordFrequencyCsv(r.terms);
      targetCsv = list.length ? keywordFrequencyCsv(list) : '';
      const stats = [
        { label: 'Total words', value: r.totalWords.toLocaleString(), kind: 'good' },
        { label: 'Distinct terms', value: r.distinct.toLocaleString() },
        { label: 'Top density', value: r.terms.length ? `${r.terms[0].density.toFixed(1)}%` : '—' },
      ];
      if (r.target) {
        stats.push(
          { label: `“${r.target.phrase}” count`, value: r.target.count.toLocaleString(), kind: r.target.count ? 'good' : 'warn' },
          { label: 'Target density', value: `${r.target.density.toFixed(2)}%` });
      }
      grid.set(stats);
      out.replaceChildren(
        h('h3', { text: 'Keyword frequency', style: 'margin:18px 0 10px' }),
        r.terms.length
          ? table({ headers: ['Term', 'Frequency', 'Density'], rows: r.terms.map((t) => [t.phrase, String(t.count), `${t.density.toFixed(2)}%`]) })
          : h('p', { class: 'hint', text: 'No terms match the current minimum-frequency filter.' }),
        r.matched > r.terms.length
          ? h('p', { class: 'hint', text: `Showing the top ${r.terms.length} of ${r.matched.toLocaleString()} matching terms. Download the CSV for the displayed rows.` })
          : h('span'),
        ...(list.length ? [h('h3',{text:'Target phrase comparison'}), h('p',{class:'hint',text:'One row per unique token sequence; counts include overlapping matches and ignore phrase-table filters. Density is capped at 100%.'}), table({headers:['Target','Frequency','Density'],rows:list.map(t=>[t.phrase,String(t.count),`${t.density.toFixed(2)}%`])})] : []));
      status.set(`Analysed ${r.totalWords.toLocaleString()} words ✓`, 'success');
    };
    [inp, target, targets, excluded, len, minimum, limit, stop, normalize].forEach(el => { const clear = () => { lastCsv = ''; targetCsv = ''; grid.replaceChildren(); out.replaceChildren(); status.set('Inputs changed. Analyse again.', 'info'); }; el.addEventListener('input', clear); el.addEventListener('change', clear); });
    root.append(field({ label: 'Content', control: inp }),
      field({ label: 'Load text file (optional)', control: file, hint: 'Local .txt or .md, UTF-8, up to 800,000 bytes and 200,000 characters; replaces the content above.' }),
      field({ label: 'Target keyword or phrase', control: target, hint: 'Counted even if it contains excluded or stop words' }),
      field({label:'Compare target phrases (optional)', control:targets, hint:'Up to 20 lines and 2,000 characters. Duplicate normalized phrases are counted once; numbers and symbols are ignored.'}),
      field({ label: 'Exclude words (optional)', control: excluded, hint: 'Separate words with commas or spaces. A phrase containing any excluded word is skipped; target counts are unaffected.' }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Phrase length', control: len }),
        field({ label: 'Show terms occurring', control: minimum }),
        field({ label: 'Maximum results', control: limit }),
        field({ label: 'Options', control: stop })),
      normalize,
      h('p', {class:'hint', text:'NFC matching combines canonically equivalent spellings in content, targets and exclusions; output terms are normalized. Overlapping phrases can count shared words more than once; displayed density is capped at 100%. No keyword percentage guarantees rankings.'}),
      actionsRow(
        btn({ label: 'Count keywords', icon: 'chart', onClick: run }),
        btn({ label: 'Download target CSV', variant:'secondary', onClick: () => {
          if (!targetCsv) { status.set('Analyse a target list before downloading its CSV.', 'warning'); return; }
          const ok = downloadText(targetCsv, 'keyword-targets.csv', 'text/csv;charset=utf-8');
          status.set(ok ? 'Target CSV download requested.' : 'Could not request the target CSV download.', ok ? 'info' : 'error');
        }}),
        btn({ label: 'Download CSV', variant: 'secondary', icon: 'download', onClick: () => {
          if (!lastCsv) { status.set('Analyse some content before downloading the CSV.', 'warning'); return; }
          if (!downloadText(lastCsv, 'keyword-frequency.csv', 'text/csv;charset=utf-8')) { status.set('Could not request the CSV download in this browser.', 'error'); return; }
          status.set('CSV download requested. Check that your browser saved it.', 'info');
        } })),
      grid, out, status);
  },

  'youtube-thumbnail-downloader'(root) {
    const inp = input({ type: 'text', class: 'input mono', placeholder: 'https://www.youtube.com/watch?v=… or a video ID' });
    const status = statusLine('Paste any YouTube link — watch, youtu.be, Shorts or embed.');
    const out = h('div', {});
    let revision = 0;
    const download = async (url, filename, token) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        if (token !== revision) return;
        if (!downloadBlob(blob, filename)) throw new Error('download failed');
        status.set('Download requested. Check that your browser saved it.', 'info');
      } catch { if (token === revision) status.set('Could not download automatically. Use Open image and save it from the new tab.', 'warning'); }
    };
    const run = () => {
      const token = ++revision; out.replaceChildren();
      let id;
      try { id = extractYouTubeId(inp.value); }
      catch (e) { status.set(e.message, 'error'); return; }
      let shown = 0, pending = YT_THUMB_SIZES.length;
      const done = () => { if (token !== revision) return; pending--; if (!pending && !shown) status.set('No thumbnails could be loaded. Check the video ID, availability and network.', 'warning'); };
      for (const s of YT_THUMB_SIZES) {
        const url = youtubeThumbUrl(id, s.key);
        const card = h('div', { style: 'margin-top:18px' },
          h('h3', { text: s.label, style: 'margin:0 0 8px' }),
          h('img', {
            class: 'img-preview', src: url, alt: `YouTube thumbnail ${s.label}`, loading: 'lazy',
            onload: (e) => {
              // YouTube serves a 120×90 placeholder when a size doesn't exist.
              if (token !== revision) return;
              if (s.w > 120 && e.target.naturalWidth <= 120) { card.remove(); done(); return; }
              shown += 1; done();
              status.set(`Video ID ${id} — ${shown} thumbnail size${shown === 1 ? '' : 's'} available ✓`, 'success');
            },
            onerror: () => { if (token !== revision) return; card.remove(); done(); },
          }),
          h('div', { style: 'margin-top:8px;display:flex;gap:8px;flex-wrap:wrap' },
            h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => download(url, `youtube-${id}-${s.key}.jpg`, token) }, 'Download JPG'),
            h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: async () => { const ok = await copyText(url); if (token === revision) toast(ok ? 'Thumbnail URL copied' : 'Copy failed', ok ? 'success' : 'error'); } }, 'Copy URL'),
            h('a', { class: 'btn btn-secondary btn-sm', href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Open image')));
        out.append(card);
      }
      status.set(`Loading thumbnails for video ${id}…`, 'info');
    };
    inp.addEventListener('input', () => { revision++; out.replaceChildren(); status.set('Input changed. Get thumbnails again.', 'info'); });
    window.addEventListener('pagehide', () => { revision++; });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    root.append(field({ label: 'YouTube video URL or ID', control: inp }),
      actionsRow(btn({ label: 'Get thumbnails', icon: 'film', onClick: run })), status, out,
      privacyNote('Thumbnails load from YouTube’s image CDN (i.ytimg.com), which receives the video ID and your IP address. Respect the creator’s copyright when re-using a thumbnail.'));
  },

  'qr-code-generator'(root) {
    const inp = textarea({ rows: 3, mono: false, placeholder: 'Text, a URL, or Wi-Fi like: WIFI:S:MyNetwork;T:WPA;P:mypassword;;' });
    const ecl = select({ options: [{ v: 'L', t: 'L — smallest code (~7% recovery)' }, { v: 'M', t: 'M — balanced (~15%)' }, { v: 'Q', t: 'Q — sturdy (~25%)' }, { v: 'H', t: 'H — toughest (~30%)' }], value: 'M' });
    const sizeSel = select({ options: [{ v: '512', t: 'Up to 512 px' }, { v: '1024', t: 'Up to 1024 px' }, { v: '2048', t: 'Up to 2048 px' }], value: '1024' });
    const fg = input({ type: 'color', value: '#000000' });
    const bg = input({ type: 'color', value: '#ffffff' });
    const grid = statsGrid();
    const status = statusLine('Type something, then generate. Test-scan the result before printing it anywhere important.');
    const out = h('div', {});
    let last = null, revision = 0; // {modules, size, version}
    const invalidate = () => { revision++; last = null; out.replaceChildren(); grid.replaceChildren(); status.set('Settings changed. Generate a new QR code.', 'info'); };
    [inp, ecl, sizeSel, fg, bg].forEach(el => { el.addEventListener('input', invalidate); el.addEventListener('change', invalidate); });
    window.addEventListener('pagehide', invalidate);
    const draw = (px) => {
      const { modules, size } = last;
      const cell = Math.max(1, Math.floor(px / (size + 8)));
      const dim = cell * (size + 8);
      const canvas = document.createElement('canvas');
      canvas.width = dim; canvas.height = dim;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bg.value; ctx.fillRect(0, 0, dim, dim);
      ctx.fillStyle = fg.value;
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
        if (modules[r][c]) ctx.fillRect((c + 4) * cell, (r + 4) * cell, cell, cell);
      }
      return canvas;
    };
    const run = async () => {
      const token = ++revision; last = null; out.replaceChildren(); grid.replaceChildren();
      const text = inp.value, correction = ecl.value;
      if (!text.trim()) { status.set('Enter some text or a URL first.', 'warning'); return; }
      status.set('Loading the QR engine…', 'info');
      try {
        const lib = await loadQrLib();
        if (token !== revision) return;
        last = makeQrModules(lib, text, correction);
        const preview = draw(512);
        preview.setAttribute('class', 'img-preview');
        preview.setAttribute('role', 'img'); preview.setAttribute('aria-label', 'Generated QR code preview');
        preview.setAttribute('style', 'margin-top:14px;max-width:320px;width:100%');
        out.replaceChildren(preview,
          h('div', { style: 'margin-top:10px;display:flex;gap:8px;flex-wrap:wrap' },
            h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => {
              try {
                draw(Number(sizeSel.value)).toBlob((blob) => {
                  if (token !== revision) return;
                  if (!blob || blob.type !== 'image/png' || !downloadBlob(blob, 'qr-code.png')) { status.set('Could not start the PNG download in this browser.', 'error'); return; }
                  status.set('PNG download requested. Check that your browser saved it.', 'info');
                }, 'image/png');
              } catch { if (token === revision) status.set('Could not create the PNG in this browser.', 'error'); }
            } }, 'Download PNG'),
            h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: () => {
              try {
                if (token !== revision || !last) return;
                if (!downloadText(qrSvgString(last.modules, { fg: fg.value, bg: bg.value }), 'qr-code.svg', 'image/svg+xml;charset=utf-8')) throw new Error('Download blocked');
                status.set('SVG download requested. Check that your browser saved it.', 'info');
              } catch { if (token === revision) status.set('Could not start the SVG download in this browser.', 'error'); }
            } }, 'Download SVG')));
        grid.set([
          { label: 'QR version', value: `v${last.version}` },
          { label: 'Modules', value: `${last.size} × ${last.size}` },
          { label: 'Error correction', value: correction },
          { label: 'Characters', value: `${[...text].length}` },
          { label: 'PNG dimensions', value: `${Math.max(1, Math.floor(Number(sizeSel.value) / (last.size + 8))) * (last.size + 8)} × ${Math.max(1, Math.floor(Number(sizeSel.value) / (last.size + 8))) * (last.size + 8)} px` },
        ]);
        status.set(fg.value === bg.value ? 'Foreground and background are the same colour; this code will not be readable. Change colours and generate again.' : 'QR code ready ✓ — scan it with your phone camera to verify before using it.', fg.value === bg.value ? 'warning' : 'success');
      } catch (e) { if (token === revision) { last = null; out.replaceChildren(); grid.replaceChildren(); status.set(e.message, 'error'); } }
    };
    root.append(field({ label: 'Text or URL to encode', control: inp, hint: 'Payload whitespace is preserved. Wi-Fi format: WIFI:S:NetworkName;T:WPA;P:password;;' }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Error correction', control: ecl }),
        field({ label: 'PNG size', control: sizeSel }),
        field({ label: 'Code colour', control: fg }),
        field({ label: 'Background', control: bg })),
      actionsRow(btn({ label: 'Generate QR code', icon: 'qr', onClick: run })), grid, status, out,
      privacyNote('The QR code is generated locally in your browser (MIT-licensed qrcode-generator library, loaded from this site). Your text is never uploaded.'));
  },

  'qr-code-scanner'(root) {
    const status = statusLine('Upload a screenshot/photo or use your camera. Decoding happens locally — the image and camera frames never leave this device.');
    const grid = statsGrid();
    const out = resultPanel({ label: 'Decoded QR content', placeholder: 'Scan a QR code to see exactly what it contains before opening anything.' });
    const actions = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px' });
    const preview = h('div', { style: 'margin-top:14px' });
    const video = h('video', { playsinline: true, muted: true, style: 'display:none;width:min(560px,100%);border-radius:14px;margin-top:14px;background:#000' });
    const canvas = document.createElement('canvas');
    let stream = null, timer = null, previewUrl = '', revision = 0;
    const releasePreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; preview.replaceChildren(); };
    const stopCamera = () => {
      if (timer) clearTimeout(timer); timer = null;
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null; video.srcObject = null; video.style.display = 'none';
      startBtn.disabled = false; stopBtn.disabled = true;
    };
    const invalidate = () => { revision++; stopCamera(); return revision; };
    const resetResult = placeholder => { actions.replaceChildren(); grid.replaceChildren(); out.placeholder(placeholder); };
    const showResult = (text, source) => {
      const info = qrPayloadInfo(text);
      stopCamera();
      out.set(info.text);
      grid.set([
        { label: 'Payload type', value: info.type, kind: 'good' },
        { label: 'Source', value: source },
        { label: 'Characters', value: String([...info.text].length) },
        { label: 'Detected destination', value: info.summary.length > 80 ? `${info.summary.slice(0, 77)}…` : info.summary },
      ]);
      actions.replaceChildren(...(info.href ? [
        h('a', { class: 'btn btn-primary btn-sm', href: info.href,
          ...(info.type === 'Website URL' || info.type === 'Location' ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        }, info.actionLabel || 'Open'),
      ] : []));
      status.set(`QR decoded ✓ ${info.safety}`, 'success');
    };
    const decodeCurrentCanvas = async (source, token) => {
      const lib = await loadJsQrLib();
      if (token !== revision) return false;
      const pixels = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
      const text = decodeQrPixels(lib, pixels);
      if (text) { showResult(text, source); return true; }
      return false;
    };
    const drawScaled = (source, width, height, maxSide = 1800) => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > 40000000) throw new Error('Image dimensions must be valid and at most 40 million pixels.');
      const scale = Math.min(1, maxSide / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0, canvas.width, canvas.height);
    };
    const scanFile = async file => {
      const token = invalidate(); releasePreview(); resetResult('Looking for a QR code…');
      if (file.size > 25 * 1024 * 1024) { status.set('Choose an image no larger than 25 MiB.', 'error'); return; }
      status.set('Loading the local QR decoder…', 'info');
      try {
        previewUrl = URL.createObjectURL(file); const currentUrl = previewUrl;
        preview.replaceChildren(h('img', { class: 'img-preview', src: currentUrl, alt: 'Uploaded image being scanned for a QR code', style: 'max-width:360px;width:100%' }));
        let bitmap = null;
        try {
          try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
          catch { if (token !== revision) return; bitmap = await createImageBitmap(file); }
        } catch {
          if (token !== revision) return;
          const img = new Image(); img.src = currentUrl;
          if (img.decode) await img.decode();
          else await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
          if (token !== revision) return;
          drawScaled(img, img.naturalWidth, img.naturalHeight);
        }
        if (bitmap) { try { if (token !== revision) return; drawScaled(bitmap, bitmap.width, bitmap.height); } finally { bitmap.close?.(); } }
        if (token !== revision) return;
        const found = await decodeCurrentCanvas('Uploaded image', token);
        if (token === revision && !found) status.set('No QR code found in that image. Try a closer crop with the full code, quiet white border and less glare or blur.', 'warning');
      } catch (e) { if (token === revision) status.set(`Could not scan that image: ${e.message}`, 'error'); }
    };
    const zone = dropzone({
      accept: 'image/*', title: 'Choose a QR image or drop it here',
      sub: 'Screenshot, JPG, PNG or WebP — up to 25 MiB and 40 million pixels, decoded locally',
      onFiles: files => { zone.clear(); if (files[0]) scanFile(files[0]); },
      onReject: () => { invalidate(); releasePreview(); resetResult('Selection rejected.'); zone.clear(); status.set('Selection rejected. Choose an image no larger than 25 MiB.', 'error'); },
    });
    const scanFrame = async token => {
      if (token !== revision || !stream) return;
      try {
        if (video.readyState >= 2 && video.videoWidth) {
          drawScaled(video, video.videoWidth, video.videoHeight, 1280);
          if (await decodeCurrentCanvas('Camera', token)) return;
        }
      } catch (e) { if (token === revision) { status.set(`Camera scan stopped: ${e.message}`, 'error'); stopCamera(); } return; }
      if (token === revision && stream) timer = setTimeout(() => scanFrame(token), 220);
    };
    const startBtn = btn({ label: 'Start camera', icon: 'eye', onClick: async () => {
      const token = invalidate(); releasePreview(); resetResult('Point the camera at a QR code…');
      if (!navigator.mediaDevices?.getUserMedia) { status.set('This browser cannot open a camera here. Camera scanning needs a secure HTTPS page and camera permission — image upload still works.', 'error'); return; }
      startBtn.disabled = true; stopBtn.disabled = false;
      try {
        status.set('Requesting camera permission…', 'info');
        const requested = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (token !== revision) { requested.getTracks().forEach(t => t.stop()); return; }
        stream = requested; video.srcObject = stream; video.style.display = 'block';
        await video.play();
        if (token !== revision) return;
        status.set('Camera is scanning locally. Keep the whole QR code in frame; the result will appear here before anything opens.', 'warning');
        scanFrame(token);
      } catch { if (token === revision) { stopCamera(); status.set('Camera permission was denied or no camera is available. You can still upload a QR image above.', 'error'); } }
    } });
    const stopBtn = btn({ label: 'Stop camera', variant: 'secondary', icon: 'x', onClick: () => { invalidate(); resetResult('Camera stopped.'); status.set('Camera stopped.', 'info'); } });
    stopBtn.disabled = true;
    window.addEventListener('pagehide', () => { invalidate(); releasePreview(); });

    root.append(
      zone,
      actionsRow(startBtn, stopBtn),
      video, preview, grid, status, out.panel, actions,
      privacyNote('Scanner uses the Apache-2.0 jsQR decoder, loaded from this site only on this page. Unknown QR links are shown first — never opened automatically.'));
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { parseUrlParts, keywordDensity, keywordFrequencyCsv, buildRobots, testRobotsAccess, buildSitemapXml, extractYouTubeId, youtubeThumbUrl, YT_THUMB_SIZES, makeQrModules, qrSvgString, decodeQrPixels, qrPayloadInfo };
