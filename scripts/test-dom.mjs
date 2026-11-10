#!/usr/bin/env node
// =============================================================================
// iHaveTools — DOM tests. Loads the BUILT pages into jsdom, imports the real
// tool modules, drives the real UI (inputs, clicks) and verifies on-screen
// results — the same interactions a user performs.
// =============================================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Worker as ThreadWorker } from 'node:worker_threads';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const consoleErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('error', (...a) => consoleErrors.push(a.join(' ')));
virtualConsole.on('jsdomError', (e) => { if (!/Could not load|not implemented/i.test(String(e))) consoleErrors.push(String(e)); });

let passed = 0, failed = 0;
const failures = [];
async function domTest(name, fn) {
  try { await fn(); passed++; process.stdout.write(`  ✓ ${name}\n`); }
  catch (e) { failed++; failures.push([name, e]); process.stdout.write(`  ✗ ${name}\n    ${e.message}\n`); }
}

/* Browser-like globals for the tool modules (they use plain `document`). */
function makeBrowserGlobals() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://i-have-tools.vercel.app/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  global.Worker = class {
    constructor(url) {
      const boot = `import { parentPort } from 'node:worker_threads';
globalThis.self = { postMessage: m => parentPort.postMessage(m) };
await import(${JSON.stringify(url.href)});
parentPort.on('message', data => self.onmessage({data}));`;
      this.thread = new ThreadWorker(new URL(`data:text/javascript,${encodeURIComponent(boot)}`));
      this.thread.on('message', data => this.onmessage?.({data}));
      this.thread.on('error', error => this.onerror?.(error));
    }
    postMessage(value) { this.thread.postMessage(value); }
    terminate() { this.thread.terminate(); }
  };
  global.window = window;
  global.document = window.document;
  Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true, writable: true });
  global.Node = window.Node;
  global.Element = window.Element;
  global.HTMLElement = window.HTMLElement;
  global.DOMParser = window.DOMParser;
  global.FileReader = window.FileReader;
  global.File = window.File;
  global.localStorage = window.localStorage;
  global.location = window.location;
  global.history = window.history; // calculators sync shareable state via history.replaceState
  window.URL.createObjectURL = window.URL.createObjectURL || (() => 'blob:fake');
  return dom;
}

function fire(el, type) {
  el.dispatchEvent(new window.Event(type, { bubbles: true }));
}
function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); }
function statusText(doc) { return doc.querySelector('.status-line')?.textContent || ''; }
function resultText(doc) { return doc.querySelector('.result-panel .result-body')?.textContent || ''; }
function btnByLabel(root, label) {
  return [...root.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase().includes(label.toLowerCase()));
}

/* Load one tool page into the shared jsdom and mount its module.
   `search` simulates opening a shared link (e.g. '?monthly=5000&rate=12'):
   every load resets the URL first so calculator shareState() sees exactly
   the query a test intends — and nothing synced by a previous test. */
async function loadToolPage(toolId, moduleName, search = '') {
  const html = readFileSync(join(ROOT, 'tools', toolId, 'index.html'), 'utf8');
  document.open(); document.write(html); document.close();
  try {
    const w = document.defaultView;
    w.history.replaceState(null, '', `${w.location.pathname}${search}`);
  } catch { /* jsdom history quirks: shareState guards itself anyway */ }
  const mod = await import(`../assets/js/tools/${moduleName}.js?tool=${toolId}&t=${Math.random().toString(36).slice(2)}`);
  mod.mount(toolId);
  await new Promise((r) => setTimeout(r, 10));
  const app = document.getElementById('tool-app');
  assert.ok(app && app.children.length > 0, 'tool UI did not mount');
  return app;
}

await makeBrowserGlobals();

/* ═════════════════ Developer tools ═════════════════ */
console.log('\n── Developer tool UIs ──');
await domTest('json-formatter: format and minify via buttons', async () => {
  const app = await loadToolPage('json-formatter', 'developer');
  const ta = app.querySelector('textarea');
  ta.value = '{"b":2,"a":[1,2]}';
  click(btnByLabel(app, 'Format'));
  assert.match(resultText(document), /"a": \[/);
  click(btnByLabel(app, 'Minify'));
  assert.equal(resultText(document).trim(), '{"b":2,"a":[1,2]}');
  ta.value = '{broken}';
  click(btnByLabel(app, 'Format'));
  assert.match(statusText(document), /Line \d+, column \d+/);
});
await domTest('json-validator: live flagging', async () => {
  const app = await loadToolPage('json-validator', 'developer');
  const ta = app.querySelector('textarea');
  ta.value = '{"ok":true}';
  fire(ta, 'input');
  await new Promise((r) => setTimeout(r, 500));
  assert.match(statusText(document), /Valid JSON/);
  ta.value = '{"ok":}';
  fire(ta, 'input');
  await new Promise((r) => setTimeout(r, 500));
  assert.match(statusText(document), /Invalid JSON/);
});
await domTest('base64-encoder: unicode round trip via UI', async () => {
  const app = await loadToolPage('base64-encoder', 'developer');
  const ta = app.querySelector('textarea');
  ta.value = 'héllo 🎉';
  click(btnByLabel(app, 'Encode'));
  const encoded = resultText(document).trim();
  ta.value = encoded;
  click(btnByLabel(app, 'Decode'));
  assert.equal(resultText(document).trim(), 'héllo 🎉');
});
await domTest('UUID controls have real icons, accessible names, and reject invalid counts', async () => {
 const app=await loadToolPage('uuid-generator','developer'); const count=app.querySelector('input[type=number]');
 const copy=app.querySelector('.file-row button');assert.equal(copy.getAttribute('aria-label'),'Copy');assert.ok(copy.querySelector('svg'));assert.doesNotMatch(copy.textContent,/<svg/);
 count.value='1.5';fire(count,'input');assert.equal(app.querySelectorAll('.file-row').length,0);click(btnByLabel(app,'Generate'));assert.match(statusText(document),/whole number/);
 count.value='2';fire(count,'input');click(btnByLabel(app,'Generate'));assert.equal(app.querySelectorAll('.file-row').length,2);
});
await domTest('shared output buttons use real icons and report failed download requests', async () => {
 const app=await loadToolPage('json-formatter','developer');click(btnByLabel(app,'Format'));
 const copy=app.querySelector('.result-head button[aria-label=Copy]');const download=app.querySelector('.result-head button[aria-label=Download]');assert.ok(copy.querySelector('svg'));assert.ok(download.querySelector('svg'));
 const original=URL.createObjectURL;try{URL.createObjectURL=()=>{throw new Error('blocked');};click(download);await new Promise(r=>setTimeout(r,0));assert.match(document.querySelector('.toast-container')?.textContent||'',/Download failed/);}finally{URL.createObjectURL=original;}
});

await domTest('uuid-generator: generates on load with copy buttons', async () => {
  const app = await loadToolPage('uuid-generator', 'developer');
  const rows = app.querySelectorAll('.file-row');
  assert.ok(rows.length >= 1);
  assert.match(rows[0].querySelector('code').textContent, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
await domTest('timestamp-converter: converts and detects ms', async () => {
  const app = await loadToolPage('timestamp-converter', 'developer');
  const input = app.querySelector('input');
  input.value = '1735689600';
  click(btnByLabel(app, 'Convert to date'));
  assert.match(resultText(document), /2025-01-01/);
});
await domTest('regex-tester: live matches table', async () => {
  const app = await loadToolPage('regex-tester', 'developer');
  await new Promise((r) => setTimeout(r, 300));
  assert.match(statusText(document), /match(es)? found/);
  // without the g flag only the first match is reported (standard regex semantics)
  assert.match(statusText(document), /1 match found/);
  const inputs = app.querySelectorAll('input');
  const gChip = app.querySelector('.switch input'); // first flag chip is "g"
  gChip.checked = true;
  fire(gChip, 'change');
  inputs[0].value = '\\d{3}';
  fire(inputs[0], 'input');
  const ta = app.querySelector('textarea');
  ta.value = 'rooms 101, 202 and 303 are open';
  fire(ta, 'input');
  await new Promise((r) => setTimeout(r, 300));
  assert.match(statusText(document), /3 matches found/);
  assert.equal(app.querySelectorAll('mark').length, 3);
});
await domTest('jwt-decoder: decodes a real token', async () => {
  const app = await loadToolPage('jwt-decoder', 'developer');
  const ta = app.querySelector('textarea');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'abc', exp: Math.floor(Date.now() / 1000) + 9999 })).toString('base64url');
  ta.value = `${header}.${payload}.sig`;
  click(btnByLabel(app, 'Decode'));
  assert.match(document.getElementById('tool-app').textContent, /HS256/);
  assert.match(document.getElementById('tool-app').textContent, /expires/i);
});

/* ═════════════════ Text tools ═════════════════ */
console.log('\n── Text tool UIs ──');
await domTest('word-counter: live stats update', async () => {
  const app = await loadToolPage('word-counter', 'text');
  const ta = app.querySelector('textarea');
  ta.value = 'One two three four five.';
  fire(ta, 'input');
  const grid = app.textContent;
  assert.match(grid, /5Words/);
  assert.match(grid, /Reading time/);
});
await domTest('case-converter: all mode buttons work', async () => {
  const app = await loadToolPage('case-converter', 'text');
  const ta = app.querySelector('textarea');
  ta.value = 'hello world';
  for (const label of ['UPPER CASE', 'camelCase', 'snake_case']) {
    click([...app.querySelectorAll('button')].find((b) => b.textContent.trim() === label));
    assert.ok(resultText(document).trim().length > 0, `${label} produced nothing`);
  }
  click([...app.querySelectorAll('button')].find((b) => b.textContent.trim() === 'UPPER CASE'));
  assert.equal(resultText(document).trim(), 'HELLO WORLD');
});
await domTest('remove-duplicate-lines: reports removed count', async () => {
  const app = await loadToolPage('remove-duplicate-lines', 'text');
  const ta = app.querySelector('textarea');
  ta.value = 'a\nb\na\nc';
  click(btnByLabel(app, 'Remove duplicates'));
  assert.match(statusText(document), /Removed 1 duplicate line/);
  assert.match(resultText(document), /^a\nb\nc$/);
});
await domTest('text-diff: shows adds and removes', async () => {
  const app = await loadToolPage('text-diff', 'text');
  const [a, b] = app.querySelectorAll('textarea');
  a.value = 'line one\nline two';
  b.value = 'line one\nline two changed\nline three';
  click(btnByLabel(app, 'Compare'));
  assert.match(statusText(document), /2 lines? added/);
  assert.ok(document.querySelector('.d-add'));
  assert.ok(document.querySelector('.d-del'));
});
await domTest('lorem-ipsum-generator: generates on load', async () => {
  const app = await loadToolPage('lorem-ipsum-generator', 'text');
  assert.match(resultText(document), /Lorem ipsum/i);
});

/* ═════════════════ Calculators ═════════════════ */
console.log('\n── Calculator UIs ──');
await domTest('percentage-calculator: X% of Y with formula', async () => {
  const app = await loadToolPage('percentage-calculator', 'calculators');
  const nums = app.querySelectorAll('input[type=number]');
  nums[0].value = '15'; nums[1].value = '200';
  click(btnByLabel(app, 'Calculate'));
  assert.match(app.textContent, /30/);
  assert.match(app.querySelector('.hint').textContent, /Formula/);
});
await domTest('emi-calculator: shows EMI and schedule', async () => {
  const app = await loadToolPage('emi-calculator', 'calculators');
  const nums = app.querySelectorAll('input[type=number]');
  nums[0].value = '100000'; nums[1].value = '12'; nums[2].value = '1';
  click(btnByLabel(app, 'Calculate EMI'));
  assert.match(app.textContent, /Monthly EMI/);
  assert.match(app.textContent, /Year-by-year balance/);
});
await domTest('sip-calculator: shows maturity and growth table', async () => {
  const app = await loadToolPage('sip-calculator', 'calculators');
  const nums = app.querySelectorAll('input[type=number]');
  nums[0].value = '10000'; nums[1].value = '12'; nums[2].value = '15';
  click(btnByLabel(app, 'Calculate SIP'));
  assert.match(app.textContent, /Maturity value/);
  assert.match(app.textContent, /Year-by-year growth/);
  assert.match(app.textContent, /not guaranteed/);
});
await domTest('SIP step-up updates contribution and clears stale output', async () => {
 const app=await loadToolPage('sip-calculator','calculators'), values=app.querySelectorAll('input[type=number]');
 values[0].value='1000'; values[1].value='0'; values[2].value='2'; values[3].value='10';
 click(btnByLabel(app,'Calculate SIP')); assert.match(app.textContent,/25,200\.00/);
 values[3].value='20'; fire(values[3],'input'); assert.equal(app.querySelectorAll('.stat-card').length,0); assert.doesNotMatch(app.textContent,/Year-by-year growth/);
});
await domTest('qr-code-generator: mounts and validates empty input', async () => {
  const app = await loadToolPage('qr-code-generator', 'webseo');
  assert.match(app.textContent, /Text or URL to encode/);
  assert.match(app.textContent, /Error correction/);
  click(btnByLabel(app, 'Generate QR code'));
  assert.match(statusText(document), /Enter some text or a URL first/);
});
await domTest('tool page: records recently used and the favourite star persists', async () => {
  localStorage.removeItem('iht-favourites');
  localStorage.removeItem('iht-recent');
  await loadToolPage('word-counter', 'text');
  const site = await import(`../assets/js/site.js?t=${Math.random().toString(36).slice(2)}`);
  site.initRecents();
  site.initFavourites();
  assert.deepEqual(JSON.parse(localStorage.getItem('iht-recent')), ['word-counter'], 'visiting a tool must record it as recently used');
  const star = document.querySelector('.page-head [data-fav-toggle="word-counter"]');
  assert.ok(star, 'tool page must have a favourite button in the page head');
  click(star);
  assert.deepEqual(JSON.parse(localStorage.getItem('iht-favourites')), ['word-counter'], 'star click must save the tool to favourites');
  assert.equal(star.getAttribute('aria-pressed'), 'true');
  assert.match(star.textContent, /Remove from favourites/);
  click(star);
  assert.deepEqual(JSON.parse(localStorage.getItem('iht-favourites')), [], 'second click must remove the favourite');
  assert.equal(star.getAttribute('aria-pressed'), 'false');
});
await domTest('sip-calculator: legacy link pre-fills and clears recognised query values', async () => {
  const app = await loadToolPage('sip-calculator', 'calculators', '?monthly=5000&rate=12&years=10');
  const [monthly, rate, years] = app.querySelectorAll('input');
  assert.equal(monthly.value, '5000', 'shared link must pre-fill the monthly amount');
  assert.equal(rate.value, '12');
  assert.equal(years.value, '10');
  await new Promise((r) => setTimeout(r, 20)); // shareState auto-run for shared links
  assert.match(app.textContent, /1,161,695/, 'maturity of ₹5,000/mo @12% for 10y must be computed without a click');
  monthly.value = '7000';
  click(btnByLabel(app, 'Calculate SIP'));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(document.defaultView.location.search, '', 'recalculating must not put values in the URL');
});
await domTest('batch-3 GSC upgrades compute in the real UIs', async () => {
  let app = await loadToolPage('percentage-change', 'calculators');
  let inputs = app.querySelectorAll('input');
  inputs[0].value = '80'; inputs[1].value = '100';
  click(btnByLabel(app, 'Calculate change'));
  assert.match(app.textContent, /\+25%/, '80 → 100 is a +25% change');
  assert.match(app.textContent, /Reverse change/, 'the upgraded result must show the reverse direction');
  assert.match(app.textContent, /-20%|−20%/, '100 → 80 is a −20% reverse change');
  assert.match(app.textContent, /Formula:/, 'the worked formula must be visible');

  app = await loadToolPage('keyword-density-checker', 'webseo');
  app.querySelector('textarea').value = 'Keyword research helps content. Keyword research guides tools. Tools help research.';
  app.querySelector('input[type="text"]').value = 'keyword research';
  click(btnByLabel(app, 'Count keywords'));
  assert.match(app.textContent, /“keyword research” count/, 'target phrase stats must be shown');
  assert.match(app.textContent, /Keyword frequency/, 'the frequency table must render');
  assert.ok(btnByLabel(app, 'Download CSV'), 'frequency results must be exportable');

  app = await loadToolPage('robots-txt-generator', 'webseo');
  click(btnByLabel(app, 'Block everything'));
  assert.match(app.textContent, /Blocked ✕/, 'blocking / must make the crawl tester report Blocked');
  assert.match(app.textContent, /User-agent: \*/, 'the generated robots.txt must remain visible');
  assert.ok(btnByLabel(app, 'Block AI training crawlers'), 'AI-crawler preset must be present');

  app = await loadToolPage('data-storage-converter', 'converters');
  assert.match(app.textContent, /1,000 megabyte \(MB\)/, '1 GB must convert to 1,000 MB by default');
  assert.match(app.textContent, /gibibyte \(GiB\)/, 'the all-units table must include binary GiB');

  app = await loadToolPage('palette-generator', 'color');
  assert.ok(btnByLabel(app, 'Copy CSS variables'), 'each palette must offer CSS-variable export');
  click(btnByLabel(app, 'Random color'));
  assert.match(app.textContent, /Random base color: #[0-9A-F]{6}/, 'random base colour must regenerate the palettes');
});
await domTest('batch-2 tools (base, roman, morse, lumpsum) mount and compute', async () => {
  let app = await loadToolPage('number-base-converter', 'developer');
  app.querySelector('input').value = 'FF';
  app.querySelector('select').value = '16';
  click(btnByLabel(app, 'Convert'));
  assert.match(app.textContent, /1111 1111/, 'FF hex should render as grouped binary 1111 1111');
  assert.match(app.textContent, /255/, 'FF hex = 255 decimal');
  app = await loadToolPage('roman-numeral-converter', 'converters');
  app.querySelector('input').value = '1994';
  click(btnByLabel(app, 'Convert'));
  assert.match(app.textContent, /MCMXCIV/, '1994 should convert to MCMXCIV');
  app = await loadToolPage('morse-code-translator', 'text');
  app.querySelector('textarea').value = 'SOS';
  click(btnByLabel(app, 'Translate'));
  assert.match(app.textContent, /\.\.\. --- \.\.\./, 'SOS should encode to ... --- ...');
  app = await loadToolPage('lumpsum-calculator', 'calculators');
  const inputs = app.querySelectorAll('input');
  inputs[0].value = '100000'; inputs[1].value = '12'; inputs[2].value = '10';
  click(btnByLabel(app, 'Calculate lumpsum'));
  assert.match(app.textContent, /310,584/, '₹1L lumpsum @12% for 10y = ₹3,10,585');
});
await domTest('batch-4 NPS, EPF and HRA shared links auto-compute', async () => {
  let app = await loadToolPage('nps-calculator', 'calculators', '?age=30&retire=31&monthly=1000&corpus=0&rate=0&step=0&annuity=40&annuityRate=12');
  assert.match(app.textContent, /12,000\.00/, 'zero-return NPS corpus should equal 12 monthly contributions');
  assert.match(app.textContent, /₹48\.00/, '40% annuity at 12% should show ₹48/month pension on a ₹12,000 corpus');
  app = await loadToolPage('epf-calculator', 'calculators', '?basic=50000&age=30&retire=31&balance=0&growth=0&rate=0');
  assert.match(app.textContent, /129,000\.00/, 'EPF should add ₹10,750/month after the EPS diversion');
  assert.match(app.textContent, /15,000\.00/, 'one year of capped EPS diversion should be explicit');
  app = await loadToolPage('hra-calculator', 'calculators', '?basic=50000&hra=20000&rent=20000&city=metro');
  assert.match(app.textContent, /180,000\.00/, 'rent minus 10% salary should be the exempt amount');
  assert.match(app.textContent, /60,000\.00/, 'the remaining HRA should be taxable');
  assert.match(app.textContent, /Lowest ✓/, 'the deciding HRA limit should be marked');
});
await domTest('batch-4 CGPA and attendance tools compute in the UI', async () => {
  let app = await loadToolPage('cgpa-calculator', 'student', '?mode=to-pct&value=8.5&scale=10&multiplier=9.5');
  assert.match(app.textContent, /80\.75%/, '8.5 CGPA × 9.5 = 80.75%');
  click(btnByLabel(app, 'Calculate SGPA'));
  assert.match(app.textContent, /8\.89/, 'default credit-weighted SGPA example = 8.89');
  assert.match(app.textContent, /9\s*Total credits/);
  app = await loadToolPage('attendance-calculator', 'student', '?held=40&attended=28&target=75');
  assert.match(app.textContent, /70\.00%/, '28/40 = 70% current attendance');
  assert.match(app.textContent, /8\s*Attend next classes/, 'eight straight classes recover to 36/48 = 75%');
});
await domTest('batch-4 scanner, wheel and typing interactions work', async () => {
  let app = await loadToolPage('qr-code-scanner', 'webseo');
  assert.ok(app.querySelector('input[type=file][accept="image/*"]'), 'scanner must offer image upload');
  click(btnByLabel(app, 'Start camera'));
  assert.match(statusText(document), /image upload still works/i, 'jsdom has no camera, so the fallback explanation should show');

  app = await loadToolPage('spin-wheel', 'misc');
  assert.match(app.querySelector('[data-wheel-group]')?.textContent || '', /Aarav/, 'wheel labels should render in the SVG');
  click(btnByLabel(app, 'Spin the wheel'));
  assert.match(statusText(document), /spinning/i);
  await new Promise((r) => setTimeout(r, 4450));
  assert.match(app.textContent, /Winner\s*(Aarav|Priya|Rohan|Sneha|Kabir|Anaya)/, 'the wheel should announce one of the entries');
  assert.match(app.textContent, /Winner history/);

  app = await loadToolPage('typing-speed-test', 'misc');
  const target = app.querySelector('[aria-label="Text to type"]').textContent;
  const box = app.querySelector('textarea');
  box.value = target;
  fire(box, 'input');
  assert.match(statusText(document), /Text complete\./, 'typing the full passage should finish and stop the timer');
  assert.match(app.textContent, /100\.0%/, 'an exact passage should score 100% accuracy');
});
await domTest('rd, cagr and gratuity calculators mount and compute correct values', async () => {
  let app = await loadToolPage('rd-calculator', 'calculators');
  let inputs = app.querySelectorAll('input');
  inputs[0].value = '1000'; inputs[1].value = '7'; inputs[2].value = '1';
  click(btnByLabel(app, 'Calculate RD'));
  assert.match(app.textContent, /12,462/, 'RD ₹1,000/mo @7% for 1 year matures at ₹12,462');
  app = await loadToolPage('cagr-calculator', 'calculators');
  inputs = app.querySelectorAll('input');
  inputs[0].value = '10000'; inputs[1].value = '20000'; inputs[2].value = '5';
  click(btnByLabel(app, 'Calculate CAGR'));
  assert.match(app.textContent, /14\.87%/, 'doubling in 5 years is a 14.87% CAGR');
  app = await loadToolPage('gratuity-calculator', 'calculators');
  inputs = app.querySelectorAll('input');
  inputs[0].value = '50000'; inputs[1].value = '20'; inputs[2].value = '0';
  click(btnByLabel(app, 'Calculate gratuity'));
  assert.match(app.textContent, /576,923/, 'gratuity for ₹50,000 × 20 years is ₹5,76,923');
  assert.match(app.textContent, /Eligible/);
});
await domTest('shared download cleans up anchor and object URL when click throws', async () => {
 const ui=await import('../assets/js/ui.js'), create=URL.createObjectURL, revoke=URL.revokeObjectURL, clickAnchor=window.HTMLAnchorElement.prototype.click; let revoked='';
 URL.createObjectURL=()=> 'blob:blocked'; URL.revokeObjectURL=url=>{revoked=url;}; window.HTMLAnchorElement.prototype.click=()=>{throw new Error('blocked');};
 try {assert.equal(ui.downloadBlob(new Blob(['x']),'x.txt'),false);assert.equal(revoked,'blob:blocked');assert.equal(document.querySelector('a[download="x.txt"]'),null);}
 finally {URL.createObjectURL=create;URL.revokeObjectURL=revoke;window.HTMLAnchorElement.prototype.click=clickAnchor;}
});
await domTest('YouTube thumbnails ignore stale loads/downloads and show failures', async () => {
 const app=await loadToolPage('youtube-thumbnail-downloader','webseo'), inp=app.querySelector('input[type=text]');
 const oldFetch=global.fetch, oldCreate=URL.createObjectURL, oldClipboard=document.execCommand;let release,downloads=0;
 global.fetch=()=>new Promise(resolve=>{release=resolve;});URL.createObjectURL=()=>{downloads++;return 'blob:test';};document.execCommand=()=>false;
 try {inp.value='abcdefghijk'; fire(inp,'input');click(btnByLabel(app,'Get thumbnails'));
  const imgs=[...app.querySelectorAll('img')];assert.ok(imgs.length>1);Object.defineProperty(imgs[0],'naturalWidth',{value:1280});fire(imgs[0],'load');assert.match(statusText(document),/1 thumbnail size/);
  click(btnByLabel(app,'Download JPG'));assert.ok(release);inp.value='12345678901';fire(inp,'input');assert.equal(app.querySelectorAll('img').length,0);release({ok:true,blob:async()=>new Blob(['x'])});await new Promise(r=>setTimeout(r,10));assert.equal(downloads,0);fire(imgs[0],'load');assert.match(statusText(document),/Input changed/);
  click(btnByLabel(app,'Get thumbnails')); for(const img of app.querySelectorAll('img')) fire(img,'error'); assert.match(statusText(document),/No thumbnails could be loaded/);
  click(btnByLabel(app,'Get thumbnails'));const img=app.querySelector('img');Object.defineProperty(img,'naturalWidth',{value:1280});fire(img,'load'); global.fetch=async()=>{throw new Error('network');};click(btnByLabel(app,'Download JPG'));await new Promise(r=>setTimeout(r,10));assert.match(statusText(document),/Open image/);assert.ok(app.querySelector('a[target="_blank"][rel="noopener noreferrer"]'));
 } finally {global.fetch=oldFetch;URL.createObjectURL=oldCreate;document.execCommand=oldClipboard;}
});
await domTest('keyword CSV reports blocked downloads', async () => {
 const app=await loadToolPage('keyword-density-checker','webseo'), old=URL.createObjectURL; const input=app.querySelector('textarea'); input.value='alpha alpha beta'; fire(input,'input');click(btnByLabel(app,'Count keywords'));
 try {URL.createObjectURL=()=>{throw new Error('blocked');};click(btnByLabel(app,'Download CSV'));assert.match(statusText(document),/Could not request the CSV/);} finally {URL.createObjectURL=old;}
});
await domTest('income tax labels historical year and equal regimes correctly', async () => {
 const app=await loadToolPage('income-tax-calculator','calculators'); assert.match(app.textContent,/does not model Tax Year 2026/);
 const nums=app.querySelectorAll('input[type=number]'); nums[0].value='400000';nums[1].value='0';nums[2].value='0';click(btnByLabel(app,'Calculate tax'));assert.match(app.textContent,/Neither \(tie\)/);
});

await domTest('income tax: edits clear stale estimates and show limitations', async () => {
  const app = await loadToolPage('income-tax-calculator', 'calculators');
  assert.match(app.textContent, /eligib(le|ility)/i);
  click(btnByLabel(app, 'Calculate tax (FY 2025-26)'));
  assert.match(app.textContent, /New regime tax/);
  const salary = app.querySelector('input[type=number]'); salary.value = '2000000'; fire(salary, 'input');
  assert.doesNotMatch(app.textContent, /New regime tax|New regime — FY 2025-26 slabs/);
});
await domTest('income-tax-calculator: compares both regimes', async () => {
  const app = await loadToolPage('income-tax-calculator', 'calculators');
  const nums = app.querySelectorAll('input[type=number]');
  nums[0].value = '1275000'; nums[1].value = '0'; nums[2].value = '150000';
  click(btnByLabel(app, 'Calculate tax'));
  assert.match(app.textContent, /New regime tax/);
  assert.match(app.textContent, /rebate u\/s 87A/);
  assert.match(app.textContent, /regime/);
});
await domTest('bmi-calculator: metric healthy category', async () => {
  const app = await loadToolPage('bmi-calculator', 'calculators');
  const nums = app.querySelectorAll('input[type=number]');
  nums[0].value = '170'; nums[1].value = '70';
  click(btnByLabel(app, 'Calculate BMI'));
  assert.match(app.textContent, /Healthy weight/);
});
await domTest('age-calculator: exact age grid', async () => {
  const app = await loadToolPage('age-calculator', 'calculators');
  const dob = app.querySelector('input[type=date]');
  dob.value = '2000-01-01';
  fire(dob, 'input');
  click(btnByLabel(app, 'Calculate age'));
  assert.match(app.textContent, /26y/);
});

/* ═════════════════ Converters ═════════════════ */
console.log('\n── Converter UIs ──');
await domTest('length-converter: cm→inch with all-units table', async () => {
  const app = await loadToolPage('length-converter', 'converters');
  assert.match(app.textContent, /39\.37007874 inch/); // 100 cm default
  const value = app.querySelector('input[type=number]');
  value.value = '254';
  fire(value, 'input');
  assert.match(app.textContent, /100 inch/);
});
await domTest('temperature-converter: 37°C → 98.6°F', async () => {
  const app = await loadToolPage('temperature-converter', 'converters');
  assert.match(app.textContent, /98\.6 Fahrenheit/);
});

await domTest('fuel economy reciprocal, zero error, and unit swap',async()=>{
 const app=await loadToolPage('fuel-economy-converter','converters'); assert.match(app.textContent,/7\.84048611 litres\/100 km/);
 const value=app.querySelector('input[type=number]');value.value='0';fire(value,'input');assert.match(app.textContent,/greater than zero/);assert.doesNotMatch(app.textContent,/7\.84048611 litres/);
 value.value='10';fire(value,'input'); const selects=app.querySelectorAll('select');click(btnByLabel(app,'⇄'));assert.equal(selects[0].value,'litres/100 km (L/100 km)');assert.match(app.textContent,/23\.52145833 miles\/US gallon/);
});
await domTest('pressure, energy and power converter default examples',async()=>{
 for(const [id,re] of [['pressure-converter',/14\.50377377 psi/],['energy-converter',/3\.6 megajoule/],['power-converter',/0\.74569987 kilowatt/]]) {const app=await loadToolPage(id,'converters');assert.match(app.textContent,re);}
});
await domTest('small values stay nonzero in table and stale output clears',async()=>{
 const app=await loadToolPage('length-converter','converters'),v=app.querySelector('input[type=number]');v.value='0.000001';fire(v,'input');assert.match(app.textContent,/e-\d+/);v.value='';fire(v,'input');assert.match(app.textContent,/valid number/);assert.doesNotMatch(app.textContent,/Equal to…/);
});

/* ═════════════════ Security ═════════════════ */
console.log('\n── Security tool UIs ──');
await domTest('password-generator: generates 20-char password with entropy', async () => {
  const app = await loadToolPage('password-generator', 'security');
  await new Promise((r) => setTimeout(r, 50));
  const pw = resultText(document).trim();
  assert.ok(pw.length === 20, `expected 20 chars, got ${pw.length}`);
  assert.match(app.textContent, /Entropy: \d+ bits/);
  const before = pw;
  click(btnByLabel(app, 'Generate'));
  assert.notEqual(resultText(document).trim(), before, 'regenerate should change password');
});
await domTest('password-strength-checker: weak flagged live', async () => {
  const app = await loadToolPage('password-strength-checker', 'security');
  const input = app.querySelector('input');
  input.value = 'password123';
  fire(input, 'input');
  assert.match(app.textContent, /Very weak|Weak/);
  assert.match(app.textContent, /common password/);
  input.value = 't7#Kq2!vLz9@Wp3$Xq';
  fire(input, 'input');
  assert.match(app.textContent, /Very strong|Strong/);
});
await domTest('random-string-generator: bulk output with preset', async () => {
  const app = await loadToolPage('random-string-generator', 'security');
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(app.querySelectorAll('.file-row').length, 10);
});

/* ═════════════════ Color ═════════════════ */
console.log('\n── Color tool UIs ──');
await domTest('unit converters reject numeric underflow instead of showing zero', async () => {
 const app=await loadToolPage('length-converter','converters'); const v=app.querySelector('input[type=number]');
 v.value='1e-999';fire(v,'input');assert.match(app.textContent,/too small to represent/);assert.doesNotMatch(app.textContent,/Equal to…/);
 v.value='0e-999';fire(v,'input');assert.match(app.textContent,/Equal to…/);
});
await domTest('roman converter requires decimal whole number input', async () => {
 const app=await loadToolPage('roman-numeral-converter','converters');const v=app.querySelector('input[type=text]');
 for(const text of ['0x10','1e2','1.0']){v.value=text;fire(v,'input');assert.match(app.textContent,/whole decimal number/);assert.doesNotMatch(resultText(document),/^(XVI|C|I)$/);}
 v.value='100';fire(v,'input');assert.equal(resultText(document).trim(),'C');
});

await domTest('hex-rgb-converter: bidirectional sync', async () => {
  const app = await loadToolPage('hex-rgb-converter', 'color');
  const inputs = app.querySelectorAll('input.mono');
  inputs[0].value = '#ff0000';
  fire(inputs[0], 'input');
  assert.match(inputs[1].value, /255,\s*0,\s*0/);
  assert.match(inputs[2].value, /hsl\(0/);
});
await domTest('color-contrast-checker: black on white = 21:1', async () => {
  const app = await loadToolPage('color-contrast-checker', 'color');
  const texts = app.querySelectorAll('input.mono');
  texts[0].value = '#000000'; fire(texts[0], 'input');
  texts[1].value = '#ffffff'; fire(texts[1], 'input');
  assert.match(app.textContent, /21\.0+:1/);
});

await domTest('color converter preserves transparency and clears stale results', async () => {
  const app=await loadToolPage('hex-rgb-converter','color'); const [hex,rgb,hsl]=app.querySelectorAll('input.mono'); const copy=btnByLabel(app,'Copy all formats');
  hex.value='#ff000080';fire(hex,'input'); assert.match(app.querySelector('[aria-label="Color preview"]').style.background, /0\.50/); assert.match(rgb.value,/\/ 0\.5019607843137255/); assert.match(hsl.value,/\/ 0\.5019607843137255/);
  rgb.value='rgb(255 0 0 / 0.5)';fire(rgb,'input');assert.equal(hex.value,'#ff000080');assert.match(hsl.value,/\/ 0\.5/);
  const old=Object.getOwnPropertyDescriptor(navigator,'clipboard');const secure=Object.getOwnPropertyDescriptor(window,'isSecureContext');let copied='';
  try {Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText: async s=>{copied=s;}}});Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});click(copy);await new Promise(r=>setTimeout(r,0));assert.match(copied,/rgb\(255 0 0 \/ 0\.5\)/);}
  finally {if(old)Object.defineProperty(navigator,'clipboard',old);else delete navigator.clipboard;if(secure)Object.defineProperty(window,'isSecureContext',secure);else delete window.isSecureContext;}
  rgb.value='bad!';fire(rgb,'input');assert.equal(hex.value,'');assert.equal(hsl.value,'');assert.ok(copy.disabled);
  rgb.value='79, 70, 229';fire(rgb,'input');assert.equal(hex.value,'#4f46e5');assert.equal(copy.disabled,false);
});
await domTest('picker preserves typed text, rejects alpha and ignores late eyedropper', async () => {
  let resolve; window.EyeDropper=class {open(){return new Promise(r=>{resolve=r;});}};
  try {
    const app=await loadToolPage('color-picker','color');const field=app.querySelector('input[type=text]');
    field.value='#abc';fire(field,'input');assert.equal(field.value,'#abc');assert.match(app.textContent,/#AABBCC/);
    field.value='#abc8';fire(field,'input');assert.match(app.textContent,/opaque colors only/);assert.equal(app.querySelectorAll('.stat-card').length,0);
    click(btnByLabel(app,'Pick from screen'));field.value='#123456';fire(field,'input');resolve({sRGBHex:'#ffffff'});await new Promise(r=>setTimeout(r,0));assert.equal(field.value,'#123456');assert.match(app.textContent,/#123456/);
    click(btnByLabel(app,'Pick from screen'));window.dispatchEvent(new window.Event('pagehide'));resolve({sRGBHex:'#ffffff'});await new Promise(r=>setTimeout(r,0));assert.equal(field.value,'#123456');
  } finally {delete window.EyeDropper;}
});
await domTest('contrast boundary displays rounded ratio but does not round pass/fail', async () => {
 const app=await loadToolPage('color-contrast-checker','color');const fields=app.querySelectorAll('input.mono');fields[0].value='#070707';fire(fields[0],'input');fields[1].value='#777777';fire(fields[1],'input');
 assert.match(app.textContent,/4\.50:1/);assert.match(app.textContent,/Large text only/);assert.match(app.textContent,/unrounded ratio/);
});

/* ═════════════════ Web & SEO ═════════════════ */
console.log('\n── Web & SEO tool UIs ──');
await domTest('meta-tag-generator: emits full tag set', async () => {
  const app = await loadToolPage('meta-tag-generator', 'webseo');
  const title = app.querySelector('input[type=text]');
  title.value = 'My Page';
  fire(title, 'input');
  const text = resultText(document);
  assert.match(text, /<title>My Page<\/title>/);
  assert.match(text, /property="og:title" content="My Page"/);
  assert.match(text, /name="twitter:card"/);
});
await domTest('url-parser: components + decoded params', async () => {
  const app = await loadToolPage('url-parser', 'webseo');
  await new Promise((r) => setTimeout(r, 30));
  assert.match(app.textContent, /price asc/);
  assert.match(app.textContent, /Query parameters \(3\)/);
});
await domTest('sitemap-generator: validates URLs', async () => {
  const app = await loadToolPage('sitemap-generator', 'webseo');
  const ta = app.querySelector('textarea');
  ta.value = 'https://a.b/\nnot a url';
  click(btnByLabel(app, 'Generate sitemap'));
  assert.match(statusText(document), /valid absolute URL/);
  ta.value = 'https://a.b/\nhttps://a.b/d';
  click(btnByLabel(app, 'Generate sitemap'));
  assert.match(resultText(document), /<urlset/);
  assert.match(statusText(document), /2 URLs in the sitemap/);
});

/* ═════════════════ Student / Math ═════════════════ */
console.log('\n── Student & Math UIs ──');
await domTest('scientific-calculator: keypad + evaluate + history', async () => {
  const app = await loadToolPage('scientific-calculator', 'student');
  const input = app.querySelector('input');
  input.value = '2^10';
  fire(input, 'keydown', );
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.match(app.textContent, /1024/);
  const padButtons = app.querySelectorAll('.calc-pad button');
  assert.ok(padButtons.length >= 24);
  click([...app.querySelectorAll('button')].find((b) => b.textContent.trim() === 'sin('));
  assert.ok(input.value.includes('sin('), 'keypad inserts into expression');
});
await domTest('fraction-calculator: simplified result with steps', async () => {
  const app = await loadToolPage('fraction-calculator', 'student');
  click(btnByLabel(app, 'Calculate'));
  assert.match(app.textContent, /5\/6/);
  assert.match(app.querySelector('.hint').textContent, /Working:/);
});
await domTest('gcd-lcm-calculator: GCD/LCM with prime factors', async () => {
  const app = await loadToolPage('gcd-lcm-calculator', 'math');
  const input = app.querySelector('input');
  input.value = '12, 18, 30';
  click(btnByLabel(app, 'Calculate GCD'));
  assert.match(app.textContent, /6/);
  assert.match(app.textContent, /Prime factorisation/);
});

console.log('\n── Batch-12 math UIs ──');
await domTest('average shows ties, sample spread, and clears errors',async()=>{
 const app=await loadToolPage('average-calculator','math'),inp=app.querySelector('textarea'); inp.value='1 2 2 3 3'; click(btnByLabel(app,'Calculate'));
 assert.match(app.textContent,/2, 3 ×2Mode/); assert.match(app.textContent,/0\.56Population variance/); assert.match(app.textContent,/0\.7Sample variance/);
 inp.value='7';click(btnByLabel(app,'Calculate'));assert.match(app.textContent,/Undefined \(need 2 values\)Sample variance/);
 inp.value='1 abc';click(btnByLabel(app,'Calculate')); assert.match(app.textContent,/not valid numbers/); assert.doesNotMatch(app.textContent,/Sample variance/);
});
await domTest('ratio UI shows proportion and exact decimal simplification, then clears errors',async()=>{
 const app=await loadToolPage('ratio-calculator','math'),[a,b,c]=app.querySelectorAll('input'); a.value='0.3';b.value='0.1';c.value='12';click(btnByLabel(app,'Simplify'));
 assert.match(app.textContent,/3 : 1Simplified/); assert.match(app.textContent,/x = 4/);
 c.value='-3';click(btnByLabel(app,'Simplify'));assert.match(app.textContent,/Third value/);assert.doesNotMatch(app.textContent,/x = 4/);
});
await domTest('GCD LCM reports unsafe overflow and clears factor table',async()=>{
 const app=await loadToolPage('gcd-lcm-calculator','math'),inp=app.querySelector('input');inp.value='12,18,30';click(btnByLabel(app,'Calculate'));assert.match(app.textContent,/180LCM/);
 inp.value='999999937,999999929';click(btnByLabel(app,'Calculate'));assert.match(app.textContent,/safe integer/);assert.doesNotMatch(app.textContent,/Prime factorisation/);
});
await domTest('weighted average worked example and invalid weights',async()=>{
 const app=await loadToolPage('weighted-average-calculator','math');click(btnByLabel(app,'Calculate weighted'));assert.match(app.textContent,/84Weighted average.*5Total weight.*420Sum of value/s);
 app.querySelector('textarea').value='80, 0\n90, 0';click(btnByLabel(app,'Calculate weighted'));assert.match(app.textContent,/greater than zero/);assert.doesNotMatch(app.textContent,/84Weighted average/);
});

/* ═════════════════ Date & Time ═════════════════ */
console.log('\n── Date & Time UIs ──');
await domTest('date-difference: business days + weeks', async () => {
  const app = await loadToolPage('date-difference', 'datetime');
  click(btnByLabel(app, 'Calculate difference'));
  assert.match(app.textContent, /Total days/);
  assert.match(app.textContent, /Business days/);
});
await domTest('time-zone-converter: NY → London winter offset', async () => {
  const app = await loadToolPage('time-zone-converter', 'datetime');
  const [date, time] = app.querySelectorAll('input');
  date.value = '2024-01-15'; fire(date, 'input');
  time.value = '12:00'; fire(time, 'input');
  const selects = app.querySelectorAll('select');
  selects[0].value = 'America/New_York';
  selects[1].value = 'Europe/London';
  click(btnByLabel(app, 'Convert'));
  assert.match(app.textContent, /5:00 PM/);
  assert.match(app.textContent, /-05:00/);
});

/* ═════════════════ Data ═════════════════ */
console.log('\n── Data tool UIs ──');
await domTest('date tools clear results when their inputs or options change', async () => {
 for (const [id,button] of [['iso-week-calculator','Calculate ISO week'],['business-day-calculator','Count working days'],['date-difference','Calculate difference'],['date-add-calculator','Calculate'],['time-zone-converter','Convert']]) {
  const app=await loadToolPage(id,'datetime');click(btnByLabel(app,button));assert.ok(app.querySelectorAll('.stat-card').length,id+' should display results');
  const date=app.querySelector('input[type=date]');date.value='2024-01-01';fire(date,'input');assert.equal(app.querySelectorAll('.stat-card').length,0,id+' should clear stale output');
 }
});
await domTest('timezone Now uses selected source zone, not browser timezone', async () => {
 const app=await loadToolPage('time-zone-converter','datetime');const [from,to]=app.querySelectorAll('select');from.value='Asia/Kolkata';fire(from,'change');to.value='UTC';fire(to,'change');
 const wall=() => {const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;};
 const before=wall();click(btnByLabel(app,'Now'));const after=wall();const got=app.querySelector('input[type=date]').value+'T'+app.querySelector('input[type=time]').value;
 assert.ok([before,after].includes(got));assert.match(app.textContent,/Now uses the selected source/);
});

await domTest('csv-to-json: quoted values convert correctly', async () => {
  const app = await loadToolPage('csv-to-json', 'data');
  click(btnByLabel(app, 'Convert to JSON'));
  const out = resultText(document);
  assert.match(out, /"role": "Admiral, USN"/);
  assert.match(statusText(document), /2 records converted/);
});
await domTest('CSV refuses pasted inputs beyond documented bounds', async () => {
 const app=await loadToolPage('csv-to-json','data');const v=app.querySelector('textarea');v.value='x'.repeat(1_000_001);fire(v,'input');click(btnByLabel(app,'Convert to JSON'));assert.match(statusText(document),/1,000,000 characters/);assert.doesNotMatch(resultText(document),/"x"/);
});

await domTest('json-to-csv: round trips', async () => {
  const app = await loadToolPage('json-to-csv', 'data');
  click(btnByLabel(app, 'Convert to CSV'));
  assert.match(resultText(document), /"Admiral, USN"/);
});
await domTest('json-lines-converter: both directions', async () => {
  const app = await loadToolPage('json-lines-converter', 'data');
  click(btnByLabel(app, 'JSONL → Array'));
  assert.match(resultText(document), /"name": "Ada"/);
  const ta = app.querySelector('textarea');
  ta.value = '[{"a":1},{"a":2}]';
  click(btnByLabel(app, 'Array → JSONL'));
  assert.match(resultText(document), /\{"a":1\}/);
});

await domTest('time-duration-calculator: survives middle-row removal', async () => {
  const app = await loadToolPage('time-duration-calculator', 'student');
  const addRow = () => click([...app.querySelectorAll('button')].find((b) => b.textContent.includes('Add row')));
  addRow(); addRow();
  const rows = app.querySelectorAll('.file-row');
  const setRow = (row, h, m, s) => { const nums = row.querySelectorAll('input'); nums[0].value = String(h); nums[1].value = String(m); nums[2].value = String(s); };
  setRow(rows[0], 1, 0, 0);
  setRow(rows[1], 0, 30, 0);
  setRow(rows[2], 0, 10, 0);
  // set second row's operator to minus
  const sel2 = rows[2].querySelector('select');
  sel2.value = '-'; fire(sel2, 'change');
  click(btnByLabel(app, 'Calculate total'));
  assert.match(app.querySelector('.stats-grid').textContent, /1:20:00/, '1h - 30m + 10m should be 1:20:00');
  // remove the middle row: now 1h minus 10m = 0:50:00
  rows[1].querySelector('button[aria-label="Remove row"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  click(btnByLabel(app, 'Calculate total'));
  assert.match(app.querySelector('.stats-grid').textContent, /0:50:00/, 'after removing row, operator must be re-read from DOM');
});

/* ═════════════════ Audio & Video ═════════════════ */
console.log('\n── Audio & Video UIs ──');
await domTest('tone-generator: renders stats and honest WAV size', async () => {
  const app = await loadToolPage('tone-generator', 'audio');
  assert.match(app.textContent, /440 Hz/);
  assert.match(app.querySelector('.stats-grid').textContent, /WAV size/);
  const freq = app.querySelector('input[type=number]');
  freq.value = '261.6'; fire(freq, 'input');
  const slider = app.querySelector('input[type=range]');
  assert.ok(slider, 'no fine-tune slider');
});
await domTest('tone generator rejects blank and zero inputs and cancels late playback', async () => {
 const previous=window.AudioContext;const pending=[];let started=0,stopped=0,closed=0;
 window.AudioContext=class {constructor(){this.destination={};}decodeAudioData(wav,ok,fail){pending.push({ok,fail});}createBufferSource(){return {connect(){},start(){started++;},stop(){stopped++;}};}close(){closed++;return Promise.resolve();}};
 try {
  const app=await loadToolPage('tone-generator','audio');const [freq,duration]=app.querySelectorAll('input[type=number]');const play=btnByLabel(app,'Play tone');
  freq.value='0';fire(freq,'input');click(play);assert.match(statusText(document),/Frequency must be/);assert.equal(pending.length,0);
  freq.value='440';duration.value='';fire(duration,'input');click(play);assert.match(statusText(document),/Enter a frequency and duration/);assert.equal(pending.length,0);
  duration.value='0';fire(duration,'input');click(play);assert.match(statusText(document),/Duration must be/);
  duration.value='1';fire(duration,'input');click(play);freq.value='500';fire(freq,'input');pending[0].ok({});assert.equal(started,0);assert.match(statusText(document),/Settings changed/);
  click(play);pending[1].ok({});assert.equal(started,1);assert.match(statusText(document),/500 Hz/);freq.value='600';fire(freq,'input');assert.equal(stopped,1);
  click(play);window.dispatchEvent(new window.Event('pagehide'));pending[2].ok({});assert.equal(started,1);assert.equal(closed,1);
 } finally {window.AudioContext=previous;}
});

await domTest('audio-trimmer: export before load shows error state', async () => {
  const app = await loadToolPage('audio-trimmer', 'audio');
  click(btnByLabel(app, 'Export WAV'));
  assert.match(statusText(document), /Load an audio file first/);
  const zone = app.querySelector('.dropzone input[type=file]');
  assert.ok(zone, 'no file input in dropzone');
});
await domTest('mp4-inspector: parses a synthetic MP4 via dropzone', async () => {
  const app = await loadToolPage('mp4-inspector', 'audio');
  const box = (type, payload) => {
    const b = new Uint8Array(8 + payload.length);
    const dv = new DataView(b.buffer);
    dv.setUint32(0, b.length);
    for (let i = 0; i < 4; i++) dv.setUint8(4 + i, type.charCodeAt(i));
    b.set(payload, 8);
    return b;
  };
  const u32 = (n) => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n); return a; };
  const enc = (s) => [...new TextEncoder().encode(s)];
  const ftyp = box('ftyp', [...enc('isom'), ...u32(512)]);
  const mvhd = box('mvhd', [...u32(0), ...u32(0), ...u32(0), ...u32(1000), ...u32(12500)]);
  const tkhdBody = new Uint8Array(84);
  const tdv = new DataView(tkhdBody.buffer);
  tdv.setUint32(12, 1); tdv.setUint32(76, 1920 * 65536); tdv.setUint32(80, 1080 * 65536);
  const tkhd = box('tkhd', [...tkhdBody]);
  const mdhd = box('mdhd', [...u32(0), ...u32(0), ...u32(0), ...u32(48000), ...u32(960000)]);
  const stsd = box('stsd', [...u32(0), ...u32(1), ...u32(8), ...enc('avc1')]);
  const stbl = box('stbl', [...stsd]);
  const minf = box('minf', [...stbl]);
  const hdlr = box('hdlr', [...u32(0), ...u32(0), ...enc('vide')]);
  const mdia = box('mdia', [...mdhd, ...hdlr, ...minf]);
  const trak = box('trak', [...tkhd, ...mdia]);
  const moov = box('moov', [...mvhd, ...trak]);
  const bytes = new Uint8Array([...ftyp, ...moov]);
  const file = new window.File([bytes], 'test.mp4', { type: 'video/mp4' });
  const input = app.querySelector('.dropzone input[type=file]');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fire(input, 'change');
  await new Promise((r) => setTimeout(r, 120));
  assert.match(app.querySelector('.stats-grid').textContent, /1920×1080/);
  assert.match(app.querySelector('.stats-grid').textContent, /avc1/);
  assert.match(app.querySelector('.stats-grid').textContent, /12:13|12s|isom/);
  assert.match(app.querySelector('.data-table').textContent, /moov/);
});
await domTest('extract-audio: export before load shows error state', async () => {
  const app = await loadToolPage('extract-audio', 'audio');
  click(btnByLabel(app, 'Export audio'));
  assert.match(statusText(document), /Load a video file first/);
});
await domTest('audio-speed-changer: shows live output length hint', async () => {
  const app = await loadToolPage('audio-speed-changer', 'audio');
  const hints = app.querySelectorAll('.hint');
  assert.ok([...hints].some((el) => /1\.00×/.test(el.textContent)), 'no speed hint');
});

/* ═════════════════ Misc ═════════════════ */
console.log('\n── Misc UIs ──');
await domTest('random-number-generator: draws within range', async () => {
  const app = await loadToolPage('random-number-generator', 'misc');
  await new Promise((r) => setTimeout(r, 50));
  const nums = [...app.querySelectorAll('.swatch .sw-color')].map((el) => Number(el.textContent));
  assert.ok(nums.length >= 1);
  for (const n of nums) assert.ok(n >= 1 && n <= 100, `${n} outside 1–100`);
});
await domTest('dice-roller: rolls show per-die and total', async () => {
  const app = await loadToolPage('dice-roller', 'misc');
  await new Promise((r) => setTimeout(r, 50));
  assert.match(app.textContent, /Rolled 2d6/);
  assert.match(app.textContent, /Total/);
});

/* ═════════════════ Error-handling states (every page still mounts) ═════════════════ */
console.log('\n── Error states ──');
await domTest('css-formatter: clear button resets panel', async () => {
  const app = await loadToolPage('css-formatter', 'developer');
  click(btnByLabel(app, 'Clear'));
  assert.match(statusText(document), /Cleared/);
  const ta = app.querySelector('textarea');
  ta.value = 'body{color:red}';
  click(btnByLabel(app, 'Format'));
  await new Promise(r=>setTimeout(r,100));
  assert.match(resultText(document), /color: red;/);
});
await domTest('html-formatter: parser output and safe minification disclosure', async () => {
  const app = await loadToolPage('html-formatter', 'developer');
  assert.equal(btnByLabel(app, 'Minify'),undefined); assert.match(app.textContent,/minification is unavailable/);
  app.querySelector('textarea').value='<pre>  keep\n   me</pre>';click(btnByLabel(app, 'Format'));await new Promise(r=>setTimeout(r,100)); assert.match(resultText(document),/  keep\n   me/);
});

console.log('\n── Batch-6 planning UIs ──');
for (const [id, query, expected] of [
  ['final-grade-calculator', '?current=86&target=88&weight=25&exam=80', /94\.00%.*84\.50%/s],
  ['savings-goal-calculator', '?goal=100000&initial=10000&rate=0&months=12', /7,500\.00.*100,000\.00/s],
  ['swp-calculator', '?initial=100000&withdrawal=30000&rate=0&months=12', /100,000\.00.*month 4/s],
  ['electricity-cost-calculator', '?watts=1000&hours=2&days=30&rate=8&fixed=50', /60\.00.*480\.00.*530\.00/s],
  ['fuel-cost-calculator', '?distance=100&mileage=20&price=100&trips=2&people=4', /200\.00.*10\.00.*1,000\.00.*250\.00/s],
]) {
  await domTest(`${id}: shared inputs calculate the worked example`, async () => {
    const app = await loadToolPage(id, 'calculators', query);
    assert.match(app.textContent, expected);
    const first = app.querySelector('input'); first.value = '';
    click(btnByLabel(app, 'Calculate'));
    assert.match(app.textContent, /must be|whole number/i);
  });
}

await domTest('audio trimmer ignores stale decodes and rejects empty end time', async () => {
  const app = await loadToolPage('audio-trimmer', 'audio');
  const pending = []; const previous = window.AudioContext;
  window.AudioContext = class { decodeAudioData(bytes, ok, fail) { pending.push({ok, fail}); } close() { return Promise.resolve(); } };
  const drop = (file) => { const e = new window.Event('drop', {bubbles:true, cancelable:true}); Object.defineProperty(e, 'dataTransfer', {value:{files:[file]}}); app.querySelector('.dropzone').dispatchEvent(e); };
  try {
    drop(new File(['a'], 'first.wav')); await new Promise(r => setTimeout(r, 30));
    drop(new File(['b'], 'second.wav')); await new Promise(r => setTimeout(r, 30));
    assert.equal(pending.length, 2);
    const fake = {duration:1, length:100, sampleRate:100, numberOfChannels:1, getChannelData:() => new Float32Array(100)};
    pending[1].ok(fake); await new Promise(r => setTimeout(r, 10));
    pending[0].ok(fake); await new Promise(r => setTimeout(r, 10));
    assert.match(statusText(document), /second.wav/);
    const fields = app.querySelectorAll('input[type=number]'); fields[1].value = '';
    click(btnByLabel(app, 'Export WAV of selection')); assert.match(statusText(document), /valid range/);
    drop(new File(['bad'], 'bad.wav')); await new Promise(r => setTimeout(r, 30)); pending[2].fail(); await new Promise(r => setTimeout(r, 10));
    click(btnByLabel(app, 'Export WAV of selection')); assert.match(statusText(document), /Load an audio file first/);
  } finally { window.AudioContext = previous; }
});

for (const id of ['audio-trimmer','audio-speed-changer','extract-audio']) {
  await domTest(`${id}: rejected media cancels pending decoding and stale export`, async () => {
    const app=await loadToolPage(id,'audio'); const previous=window.AudioContext, pending=[];
    window.AudioContext=class {decodeAudioData(bytes,ok,fail){pending.push({ok,fail});} close(){return Promise.resolve();}};
    const drop=file=>{const e=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[file]}}); app.querySelector('.dropzone').dispatchEvent(e);};
    try {
      drop(new File(['x'],'first.wav',{type:'audio/wav'})); await new Promise(r=>setTimeout(r,30)); assert.equal(pending.length,1);
      drop({name:'huge.wav',size:201*1024*1024});
      pending[0].ok({duration:1,length:100,sampleRate:100,numberOfChannels:1,getChannelData:()=>new Float32Array(100)}); await new Promise(r=>setTimeout(r,20));
      assert.match(statusText(document),/Selection rejected/);
      click(btnByLabel(app,id==='audio-trimmer'?'Export WAV of selection':id==='extract-audio'?'Export audio as WAV':'Export WAV'));
      assert.match(statusText(document),/Load an? (audio|video) file first/);
    } finally {window.AudioContext=previous;}
  });
}
await domTest('audio trimmer stops playback on selection changes and closes context', async () => {
  const app=await loadToolPage('audio-trimmer','audio'); const previous=window.AudioContext; let stopped=0,closed=0;
  const fake={duration:1,length:100,sampleRate:100,numberOfChannels:1,getChannelData:()=>new Float32Array(100)};
  window.AudioContext=class {constructor(){this.destination={};} decodeAudioData(bytes,ok){ok(fake);} createBuffer(){return {copyToChannel(){}};} createBufferSource(){return {connect(){},start(){},stop(){stopped++;}};} close(){closed++;return Promise.resolve();}};
  const drop=file=>{const e=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[file]}});app.querySelector('.dropzone').dispatchEvent(e);};
  try {drop(new File(['x'],'ok.wav')); await new Promise(r=>setTimeout(r,40)); click(btnByLabel(app,'Play selection')); click(btnByLabel(app,'Play selection')); assert.equal(stopped,1);
    const start=app.querySelector('input[type=number]'); start.value='0.5'; fire(start,'input'); assert.equal(stopped,2); assert.ok(closed>=3);
  } finally {window.AudioContext=previous;}
});
await domTest('tone WAV download failure is not reported as success', async () => {
  const app=await loadToolPage('tone-generator','audio'); const original=URL.createObjectURL; URL.createObjectURL=()=>{throw new Error('blocked');};
  try {click(btnByLabel(app,'Download WAV')); assert.match(statusText(document),/Could not start the WAV download/);} finally {URL.createObjectURL=original;}
});

for (const id of ['audio-trimmer','audio-speed-changer','extract-audio']) {
  await domTest(`${id}: blocked WAV download is reported`, async () => {
    const app=await loadToolPage(id,'audio'); const previous=window.AudioContext, original=URL.createObjectURL;
    const fake={duration:1,length:100,sampleRate:100,numberOfChannels:1,getChannelData:()=>new Float32Array(100)};
    window.AudioContext=class {decodeAudioData(bytes,ok){ok(fake);} close(){return Promise.resolve();}};
    const e=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[new File(['x'],'ok.wav')]}});
    try {app.querySelector('.dropzone').dispatchEvent(e); await new Promise(r=>setTimeout(r,40)); URL.createObjectURL=()=>{throw new Error('blocked');};
      click(btnByLabel(app,id==='audio-trimmer'?'Export WAV of selection':id==='extract-audio'?'Export audio as WAV':'Export WAV')); assert.match(statusText(document),/Could not start the WAV download/);
    } finally {window.AudioContext=previous;URL.createObjectURL=original;}
  });
}
await domTest('MP4 inspector clears metadata after rejected file', async () => {
  const app=await loadToolPage('mp4-inspector','audio'); const fixture=readFileSync(join(ROOT,'scripts/fixtures/ffmpeg-test.mp4'));
  const drop=file=>{const e=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[file]}});app.querySelector('.dropzone').dispatchEvent(e);};
  drop(new File([fixture],'test.mp4')); await new Promise(r=>setTimeout(r,50)); assert.match(app.textContent,/128×96/);
  drop({name:'large.mp4',size:201*1024*1024}); assert.doesNotMatch(app.textContent,/128×96/); assert.match(statusText(document),/Selection rejected/);
});

console.log('\n── Batch-7 private document UIs ──');
await domTest('JSON compare reports structural paths safely and rejects invalid JSON', async () => {
  const app = await loadToolPage('json-compare', 'developer');
  const [a,b] = app.querySelectorAll('textarea');
  a.value = '{"b":2,"a":1}'; b.value = '{"a":1,"b":2}'; click(btnByLabel(app, 'Compare JSON'));
  assert.match(app.textContent, /No structural differences/);
  b.value = '{"a":1,"b":"<img src=x onerror=alert(1)>"}'; click(btnByLabel(app, 'Compare JSON'));
  assert.match(app.textContent, /CHANGED \/b/); assert.equal(app.querySelector('.result-body img'), null);
  b.value = '{'; click(btnByLabel(app, 'Compare JSON')); assert.match(app.textContent, /Right JSON is invalid/);
});
await domTest('PDF organizer accepts a drop, reorders, rotates, removes and exports actual PDF', async () => {
  const lib = await import('pdf-lib'); window.PDFLib = { ...lib, PDFDocument: { create: (...args) => lib.PDFDocument.create(...args), load: (bytes, ...args) => lib.PDFDocument.load(new Uint8Array(bytes), ...args) } };
  const src = await lib.PDFDocument.create(); src.addPage([100,200]); src.addPage([200,300]); src.addPage([300,400]);
  const file = new File([await src.save()], 'source.pdf', { type: 'application/pdf' });
  const app = await loadToolPage('pdf-organizer', 'pdf');
  const event = new window.Event('drop', { bubbles: true, cancelable: true }); Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
  app.querySelector('.dropzone').dispatchEvent(event); await new Promise(r => setTimeout(r, 100));
  assert.equal(app.querySelectorAll('.file-row').length, 3, app.textContent);
  const ranges = app.querySelector('input[type=text]');
  ranges.value = '1, 4'; click(btnByLabel(app, 'Apply page filter'));
  assert.equal(app.querySelectorAll('.file-row').length, 3, 'invalid range leaves pages intact');
  ranges.value = '1, 3'; click(btnByLabel(app, 'Apply page filter'));
  assert.equal(app.querySelectorAll('.file-row').length, 2);
  click(btnByLabel(app, 'Keep even pages'));
  assert.equal(app.querySelectorAll('.file-row').length, 2, 'empty parity leaves pages intact');
  click(btnByLabel(app, 'Reverse page order'));
  assert.match(app.querySelector('.file-row').textContent, /Original page 3/);
  click(btnByLabel(app, 'Reverse page order'));
  click(app.querySelector('[aria-label="Move page 3 up"]'));
  click(app.querySelector('[aria-label="Rotate page 3 clockwise"]'));
  let output; const original = URL.createObjectURL; URL.createObjectURL = (blob) => { output = blob; return 'blob:test'; };
  try { click(btnByLabel(app, 'Export organized PDF')); await new Promise(r => setTimeout(r, 100));
    assert.ok(output, 'download was not created'); const result = await lib.PDFDocument.load(await output.arrayBuffer());
    assert.equal(result.getPageCount(), 2); assert.equal(result.getPage(0).getWidth(), 300); assert.equal(result.getPage(0).getRotation().angle, 90);
    click(btnByLabel(app, 'Restore original')); assert.equal(app.querySelectorAll('.file-row').length, 3);
  } finally { URL.createObjectURL = original; }
});
await domTest('PDF organizer ignores an export superseded by page filtering', async () => {
  const lib = await import('pdf-lib'); let release;
  const wait = new Promise(resolve => { release = resolve; });
  window.PDFLib = { ...lib, PDFDocument: { create: async () => { await wait; return lib.PDFDocument.create(); }, load: (bytes, ...args) => lib.PDFDocument.load(new Uint8Array(bytes), ...args) } };
  const src = await lib.PDFDocument.create(); src.addPage([100,200]); src.addPage([200,300]);
  const app = await loadToolPage('pdf-organizer','pdf');
  const e = new window.Event('drop',{bubbles:true,cancelable:true});
  Object.defineProperty(e,'dataTransfer',{value:{files:[new File([await src.save()],'two.pdf',{type:'application/pdf'})]}});
  app.querySelector('.dropzone').dispatchEvent(e); await new Promise(r => setTimeout(r,100));
  let output; const original = URL.createObjectURL; URL.createObjectURL = blob => { output = blob; return 'blob:test'; };
  try {
    click(btnByLabel(app,'Export organized PDF'));
    click(btnByLabel(app,'Keep even pages'));
    release(); await new Promise(r => setTimeout(r,100));
    assert.equal(output,undefined,'stale export must not download');
    assert.equal(app.querySelectorAll('.file-row').length,1);
  } finally { URL.createObjectURL = original; }
});
await domTest('PDF numbering changes invalidate a pending export', async () => {
  const lib = await import('pdf-lib'); let release;
  const wait = new Promise(resolve => { release = resolve; });
  window.PDFLib = { ...lib, PDFDocument: { create: async () => { await wait; return lib.PDFDocument.create(); }, load: (bytes, ...args) => lib.PDFDocument.load(new Uint8Array(bytes), ...args) } };
  const src = await lib.PDFDocument.create(); src.addPage([100,200]);
  const app = await loadToolPage('pdf-organizer','pdf');
  const e = new window.Event('drop',{bubbles:true,cancelable:true});
  Object.defineProperty(e,'dataTransfer',{value:{files:[new File([await src.save()],'one.pdf',{type:'application/pdf'})]}});
  app.querySelector('.dropzone').dispatchEvent(e); await new Promise(r => setTimeout(r,100));
  let output; const original = URL.createObjectURL; URL.createObjectURL = blob => { output = blob; return 'blob:test'; };
  try {
    click(btnByLabel(app,'Export organized PDF'));
    const setting = [...app.querySelectorAll('input[type=number]')].find(el => el.value === '1');
    setting.value='7'; setting.dispatchEvent(new window.Event('input',{bubbles:true}));
    release(); await new Promise(r => setTimeout(r,100));
    assert.equal(output,undefined,'old numbering settings must not download');
  } finally { URL.createObjectURL = original; }
});
await domTest('Numbering settings do not cancel a pending PDF load', async () => {
  const lib = await import('pdf-lib'); let release;
  const wait = new Promise(resolve => { release = resolve; });
  window.PDFLib = { ...lib, PDFDocument: { create: (...args) => lib.PDFDocument.create(...args), load: async (bytes, ...args) => { await wait; return lib.PDFDocument.load(new Uint8Array(bytes), ...args); } } };
  const src = await lib.PDFDocument.create(); src.addPage([100,200]);
  const app = await loadToolPage('pdf-organizer','pdf');
  const e = new window.Event('drop',{bubbles:true,cancelable:true});
  Object.defineProperty(e,'dataTransfer',{value:{files:[new File([await src.save()],'one.pdf',{type:'application/pdf'})]}});
  app.querySelector('.dropzone').dispatchEvent(e);
  const position=app.querySelector('select'); position.value='top-left'; position.dispatchEvent(new window.Event('change',{bubbles:true}));
  release(); await new Promise(r => setTimeout(r,100));
  assert.equal(app.querySelectorAll('.file-row').length,1,app.textContent);
  assert.equal(position.value,'top-left');
});
await domTest('PDF merge handles dropped duplicate filenames by identity and removal', async () => {
  const lib = await import('pdf-lib'); window.PDFLib = { ...lib, PDFDocument: { create: (...args) => lib.PDFDocument.create(...args), load: (bytes, ...args) => lib.PDFDocument.load(new Uint8Array(bytes), ...args) } };
  const one = await lib.PDFDocument.create(); one.addPage([100,200]);
  const two = await lib.PDFDocument.create(); two.addPage([200,300]);
  const app = await loadToolPage('pdf-merge', 'pdf');
  const files = [new File([await one.save()], 'same.pdf', { type:'application/pdf' }), new File([await two.save()], 'same.pdf', { type:'application/pdf' })];
  const event = new window.Event('drop', { bubbles:true, cancelable:true }); Object.defineProperty(event,'dataTransfer',{value:{files}});
  app.querySelector('.dropzone').dispatchEvent(event);
  assert.equal(app.querySelectorAll('.file-row').length, 2);
  let output; const original = URL.createObjectURL; URL.createObjectURL = (blob) => { output = blob; return 'blob:test'; };
  try { click(btnByLabel(app,'Merge PDFs')); await new Promise(r => setTimeout(r, 100));
    assert.ok(output, app.textContent); const result = await lib.PDFDocument.load(await output.arrayBuffer());
    assert.equal(result.getPage(0).getWidth(),100); assert.equal(result.getPage(1).getWidth(),200);
    click(app.querySelector('[aria-label="Remove"]')); assert.equal(app.querySelectorAll('.file-row').length, 1);
    assert.match(app.textContent, /1Files/);
  } finally { URL.createObjectURL = original; }
});

await domTest('PDF rotate and split produce parseable pages with expected dimensions and rotation', async () => {
  const lib = await import('pdf-lib'); window.PDFLib = {...lib, PDFDocument: {create: (...a) => lib.PDFDocument.create(...a), load: (b,...a) => lib.PDFDocument.load(new Uint8Array(b),...a)}};
  const src = await lib.PDFDocument.create(); src.addPage([100,200]); src.addPage([200,300]);
  src.getPage(0).setRotation(lib.degrees(90)); const bytes = await src.save();
  const drop = app => {const e = new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[new File([bytes],'source.pdf',{type:'application/pdf'})]}}); app.querySelector('.dropzone').dispatchEvent(e);};
  let output; const original = URL.createObjectURL; URL.createObjectURL = b => { output = b; return 'blob:test'; };
  try {
    let app = await loadToolPage('pdf-rotate','pdf'); drop(app); click(btnByLabel(app,'Rotate PDF')); await new Promise(r => setTimeout(r,120));
    assert.ok(output, app.textContent); let result = await lib.PDFDocument.load(await output.arrayBuffer());
    assert.equal(result.getPageCount(),2); assert.equal(result.getPage(0).getRotation().angle,180); assert.equal(result.getPage(1).getRotation().angle,90);
    output = null; app = await loadToolPage('pdf-split','pdf'); drop(app); app.querySelector('input[type=text]').value = '2'; click(btnByLabel(app,'Split PDF')); await new Promise(r => setTimeout(r,120));
    assert.ok(output,app.textContent); result = await lib.PDFDocument.load(await output.arrayBuffer()); assert.equal(result.getPageCount(),1); assert.equal(result.getPage(0).getWidth(),200);
  } finally { URL.createObjectURL = original; }
});

for (const id of ['pdf-rotate', 'pdf-split']) {
  await domTest(`${id}: stale inspect and export cannot use a newer selection`, async () => {
    const lib = await import('pdf-lib');
    const first = await lib.PDFDocument.create(); first.addPage([100,200]); first.addPage([100,200]);
    const second = await lib.PDFDocument.create(); second.addPage([300,400]);
    const files = [new File([await first.save()], 'first.pdf', {type:'application/pdf'}), new File([await second.save()], 'second.pdf', {type:'application/pdf'})];
    let resolveLoad, calls = 0;
    window.PDFLib = {...lib, PDFDocument: {create: (...a) => lib.PDFDocument.create(...a), load: (b,...a) => {
      calls++; const load = () => lib.PDFDocument.load(new Uint8Array(b),...a);
      if (calls === 1) return new Promise(resolve => { resolveLoad = () => resolve(load()); });
      return load();
    }}};
    const app = await loadToolPage(id, 'pdf');
    const drop = f => {const e = new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[f]}}); app.querySelector('.dropzone').dispatchEvent(e);};
    let output; const original = URL.createObjectURL; URL.createObjectURL = b => {output=b;return 'blob:test';};
    try {
      drop(files[0]); click(btnByLabel(app,'Inspect PDF')); await new Promise(r => setTimeout(r,40)); assert.ok(resolveLoad);
      drop(files[1]); click(btnByLabel(app,'Inspect PDF')); await new Promise(r => setTimeout(r,70)); resolveLoad(); await new Promise(r => setTimeout(r,60));
      assert.match(app.textContent, /second.pdf” has 1 pages/); assert.doesNotMatch(app.textContent, /first.pdf” has/);
      if (id === 'pdf-split') app.querySelector('input[type=text]').value='1';
      click(btnByLabel(app,id === 'pdf-rotate' ? 'Rotate PDF' : 'Split PDF')); await new Promise(r => setTimeout(r,100));
      assert.ok(output, app.textContent); const result = await lib.PDFDocument.load(await output.arrayBuffer());
      assert.equal(result.getPageCount(),1); assert.equal(result.getPage(0).getWidth(),300);
    } finally { URL.createObjectURL = original; }
  });
}
for (const id of ['pdf-rotate', 'pdf-split']) {
  await domTest(`${id}: selecting another document cancels an in-flight export`, async () => {
    const lib = await import('pdf-lib'); const doc = await lib.PDFDocument.create(); doc.addPage([100,200]);
    const bytes = await doc.save(); let calls = 0, release;
    window.PDFLib = {...lib, PDFDocument: {create: (...a) => lib.PDFDocument.create(...a), load: (b,...a) => {
      const load = () => lib.PDFDocument.load(new Uint8Array(b),...a);
      if (++calls === 2) return new Promise(resolve => {release = () => resolve(load());}); return load();
    }}};
    const app = await loadToolPage(id,'pdf'); const drop = name => {const e = new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[new File([bytes],name,{type:'application/pdf'})]}}); app.querySelector('.dropzone').dispatchEvent(e);};
    let output = false; const original = URL.createObjectURL; URL.createObjectURL = () => {output=true; return 'blob:test';};
    try { drop('first.pdf'); if (id === 'pdf-split') app.querySelector('input[type=text]').value='1';
      click(btnByLabel(app,id === 'pdf-rotate' ? 'Rotate PDF' : 'Split PDF')); await new Promise(r => setTimeout(r,80)); assert.ok(release);
      drop('second.pdf'); release(); await new Promise(r => setTimeout(r,80)); assert.equal(output,false); assert.match(statusText(document), /second.pdf/);
    } finally { URL.createObjectURL = original; }
  });
}
await domTest('PDF merge cancels an export when the file list changes', async () => {
  const lib = await import('pdf-lib'); const doc = await lib.PDFDocument.create(); doc.addPage(); const bytes = await doc.save(); let release;
  window.PDFLib = {...lib, PDFDocument: {create: (...a) => new Promise(resolve => {release=() => resolve(lib.PDFDocument.create(...a));}), load: (b,...a) => lib.PDFDocument.load(new Uint8Array(b),...a)}};
  const app = await loadToolPage('pdf-merge','pdf'); const e = new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[new File([bytes],'a.pdf',{type:'application/pdf'}),new File([bytes],'b.pdf',{type:'application/pdf'})]}}); app.querySelector('.dropzone').dispatchEvent(e);
  let output = false; const original = URL.createObjectURL; URL.createObjectURL = () => {output=true; return 'blob:test';};
  try { click(btnByLabel(app,'Merge PDFs')); await new Promise(r => setTimeout(r,30)); assert.ok(release); click(btnByLabel(app,'Clear list')); release(); await new Promise(r => setTimeout(r,100)); assert.equal(output,false); assert.match(statusText(document), /Cleared/); }
  finally { URL.createObjectURL = original; }
});

await domTest('PDF download failures are not reported as success', async () => {
  const lib = await import('pdf-lib'); window.PDFLib = {...lib, PDFDocument: {create: (...a) => lib.PDFDocument.create(...a), load: (b,...a) => lib.PDFDocument.load(new Uint8Array(b),...a)}};
  const doc = await lib.PDFDocument.create(); doc.addPage(); const file = new File([await doc.save()],'test.pdf',{type:'application/pdf'});
  const app = await loadToolPage('pdf-rotate','pdf'); const e = new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[file]}}); app.querySelector('.dropzone').dispatchEvent(e);
  const original = URL.createObjectURL; URL.createObjectURL = () => { throw new Error('blocked'); };
  try { click(btnByLabel(app,'Rotate PDF')); await new Promise(r => setTimeout(r,100)); assert.match(statusText(document), /Could not start the download/); }
  finally { URL.createObjectURL = original; }
});

await domTest('Image to PDF keeps duplicate filenames distinct and updates removed-file totals', async () => {
  const app = await loadToolPage('image-to-pdf', 'pdf');
  const files = [new File(['a'], 'same.png', { type: 'image/png' }), new File(['bc'], 'same.png', { type: 'image/png' })];
  const event = new window.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  app.querySelector('.dropzone').dispatchEvent(event);
  const rows = app.querySelectorAll('.file-row');
  assert.equal(rows.length, 2); assert.equal(rows[0].file, files[0]); assert.equal(rows[1].file, files[1]);
  click(rows[0].querySelector('[aria-label="Remove"]'));
  assert.equal(app.querySelector('.file-row').file, files[1]);
  assert.match(app.textContent, /2 BTotal size/);
});

for (const id of ['pdf-rotate', 'pdf-split']) {
  await domTest(`${id}: edits and rejected selections cancel pending exports`, async () => {
    const lib = await import('pdf-lib'); const doc = await lib.PDFDocument.create(); doc.addPage(); const bytes = await doc.save();
    let calls=0, release;
    window.PDFLib = {...lib, PDFDocument: {create: (...a) => lib.PDFDocument.create(...a), load: (b,...a) => {
      const load=()=>lib.PDFDocument.load(new Uint8Array(b),...a);
      if (++calls === 2) return new Promise(resolve => {release=()=>resolve(load());}); return load();
    }}};
    const app=await loadToolPage(id,'pdf');
    const drop = file => { const e=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[file]}}); app.querySelector('.dropzone').dispatchEvent(e); };
    const file=new File([bytes],'ok.pdf',{type:'application/pdf'}); const huge={name:'huge.pdf',size:201*1024*1024};
    let output=0; const original=URL.createObjectURL; URL.createObjectURL=()=>{output++;return 'blob:test';};
    try {
      drop(file); if(id==='pdf-split') app.querySelector('input[type=text]').value='1';
      click(btnByLabel(app,id==='pdf-rotate'?'Rotate PDF':'Split PDF')); await new Promise(r=>setTimeout(r,80)); assert.ok(release);
      if(id==='pdf-rotate') click(btnByLabel(app,'180°')); else {const ranges=app.querySelector('input[type=text]'); ranges.value='2'; fire(ranges,'input');}
      release(); await new Promise(r=>setTimeout(r,80)); assert.equal(output,0); assert.match(statusText(document),/Settings changed/);
      drop(huge); assert.match(statusText(document),/Selection rejected/);
      click(btnByLabel(app,id==='pdf-rotate'?'Rotate PDF':'Split PDF')); assert.match(statusText(document),/Choose a PDF first/);
      drop(file); assert.match(statusText(document),/Loaded ok.pdf/);
    } finally { URL.createObjectURL=original; }
  });
}
await domTest('PDF organizer clears old document after a rejected selection', async () => {
  const lib=await import('pdf-lib'); window.PDFLib={...lib,PDFDocument:{create:(...a)=>lib.PDFDocument.create(...a),load:(b,...a)=>lib.PDFDocument.load(new Uint8Array(b),...a)}};
  const doc=await lib.PDFDocument.create(); doc.addPage(); const file=new File([await doc.save()],'ok.pdf',{type:'application/pdf'});
  const app=await loadToolPage('pdf-organizer','pdf');
  const drop = file => {const e=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[file]}}); app.querySelector('.dropzone').dispatchEvent(e);};
  drop(file); await new Promise(r=>setTimeout(r,80)); assert.equal(app.querySelectorAll('.file-row').length,1);
  drop({name:'large.pdf',size:201*1024*1024}); assert.equal(app.querySelectorAll('.file-row').length,0); click(btnByLabel(app,'Export organized PDF')); assert.match(statusText(document),/Choose a PDF first/);
});
await domTest('Image to PDF page-size changes cancel pending conversion', async () => {
  const lib=await import('pdf-lib'); let release;
  window.PDFLib={...lib, PDFDocument:{create:(...a)=>new Promise(resolve=>{release=()=>resolve(lib.PDFDocument.create(...a));})}};
  const app=await loadToolPage('image-to-pdf','pdf'); const e=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[new File(['x'],'x.png',{type:'image/png'})]}}); app.querySelector('.dropzone').dispatchEvent(e);
  let output=false; const original=URL.createObjectURL; URL.createObjectURL=()=>{output=true;return 'blob:test';};
  try { click(btnByLabel(app,'Convert to PDF')); await new Promise(r=>setTimeout(r,30)); assert.ok(release); click(btnByLabel(app,'Letter (fit)')); release(); await new Promise(r=>setTimeout(r,80)); assert.equal(output,false); assert.match(statusText(document),/Page size changed/); }
  finally { URL.createObjectURL=original; }
});

for (const id of ['pdf-merge', 'image-to-pdf']) {
  await domTest(`${id}: oversized input keeps list but cancels pending output`, async () => {
    const lib=await import('pdf-lib'); let release;
    window.PDFLib={...lib,PDFDocument:{create:(...a)=>new Promise(resolve=>{release=()=>resolve(lib.PDFDocument.create(...a));})}};
    const app=await loadToolPage(id,'pdf');
    const drop=files=>{const e=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files}}); app.querySelector('.dropzone').dispatchEvent(e);};
    const type=id==='pdf-merge'?'application/pdf':'image/png'; const ext=id==='pdf-merge'?'pdf':'png';
    drop([new File(['a'],`a.${ext}`,{type}),new File(['b'],`b.${ext}`,{type})]);
    let output=false; const original=URL.createObjectURL; URL.createObjectURL=()=>{output=true;return 'blob:test';};
    try {click(btnByLabel(app,id==='pdf-merge'?'Merge PDFs':'Convert to PDF')); await new Promise(r=>setTimeout(r,30)); assert.ok(release);
      drop([{name:`large.${ext}`,size:201*1024*1024}]); assert.equal(app.querySelectorAll('.file-row').length,2); assert.match(statusText(document),/Existing list was kept/);
      release(); await new Promise(r=>setTimeout(r,80)); assert.equal(output,false);
    } finally {URL.createObjectURL=original;}
  });
}

console.log('\n── Batch-8 UIs ──');
for (const [id, query, expected] of [
  ['loan-prepayment-calculator', '?principal=120000&rate=0&payment=10000&extra=1000&lump=20000&month=3', /2Time saved.*12Baseline months.*10With prepayment months/s],
  ['inflation-calculator', '?amount=100000&rate=6&years=10', /179,084\.77.*55,839\.48/s],
  ['work-hours-calculator', '?start=22%3A00&end=06%3A00&break=30&hourly=20', /7h 30m.*7\.50.*150\.00/s],
  ['profit-margin-calculator', '?cost=60&revenue=100', /40\.00.*40\.00%.*66\.67%/s],
]) {
  await domTest(`${id}: shared example and invalid input`, async () => {
    const app = await loadToolPage(id, 'calculators', query); assert.match(app.textContent, expected);
    app.querySelector('input').value = ''; click(btnByLabel(app, 'Calculate')); assert.match(app.textContent, /must be|valid/i);
  });
}

console.log('\n── Batch-13 calendar UIs ──');
await domTest('age shared link respects leap policy and clears stale results',async()=>{
 const app=await loadToolPage('age-calculator','calculators','?dob=2000-02-29&at=2023-02-28&leap=mar1'); assert.match(app.textContent,/22y 11m 27dAge/); assert.match(app.textContent,/2023-03-01Next birthday/);
 const sel=app.querySelector('select'); sel.value='feb28'; click(btnByLabel(app,'Calculate age')); assert.match(app.textContent,/23y 0m 0dAge/); assert.match(app.textContent,/TodayBirthday today/);
 app.querySelector('input[type=date]').value=''; click(btnByLabel(app,'Calculate age')); assert.doesNotMatch(app.textContent,/23y 0m 0dAge/); assert.match(app.textContent,/Pick a date of birth/);
});
await domTest('date difference month end and include end show consistent counts',async()=>{
 const app=await loadToolPage('date-difference','datetime'); const dates=app.querySelectorAll('input[type=date]'); dates[0].value='2024-01-31'; dates[1].value='2024-03-01'; click(btnByLabel(app,'Calculate difference')); assert.match(app.textContent,/30Total days.*0y 1m 1dCalendar/s);
 app.querySelector('.switch input').checked=true;click(btnByLabel(app,'Calculate difference'));assert.match(app.textContent,/31Total days.*0y 1m 1dCalendar/s);assert.match(app.textContent,/calendar breakdown excludes the end date/);
});
await domTest('date add rejects fractional amount and clears output',async()=>{
 const app=await loadToolPage('date-add-calculator','datetime');app.querySelector('input[type=date]').value='2024-01-31'; app.querySelector('input[type=number]').value='1'; app.querySelector('select').value='months';click(btnByLabel(app,'Calculate'));assert.match(app.textContent,/2024-02-29ISO/);
 app.querySelector('input[type=number]').value='1.5';click(btnByLabel(app,'Calculate'));assert.match(app.textContent,/whole number/);assert.doesNotMatch(app.textContent,/2024-02-29ISO/);
});
await domTest('time zone UI reports missing and ambiguous local times',async()=>{
 const app=await loadToolPage('time-zone-converter','datetime'); const date=app.querySelector('input[type=date]'),time=app.querySelector('input[type=time]'),[from,to]=app.querySelectorAll('select'); from.value='America/New_York';to.value='UTC';date.value='2024-03-10';time.value='02:30';click(btnByLabel(app,'Convert'));assert.match(app.textContent,/does not exist/);
 date.value='2024-11-03';time.value='01:30';click(btnByLabel(app,'Convert'));assert.match(app.textContent,/occurs twice/);
});
await domTest('ISO week UI returns the right week-year around New Year',async()=>{
 const app=await loadToolPage('iso-week-calculator','datetime');app.querySelector('input[type=date]').value='2021-01-01';click(btnByLabel(app,'Calculate ISO'));assert.match(app.textContent,/2020-W53ISO week.*2020-12-28Week starts Monday.*2021-01-03Week ends Sunday/s);
 app.querySelector('input[type=date]').value='';click(btnByLabel(app,'Calculate ISO'));assert.match(app.textContent,/valid date/);assert.doesNotMatch(app.textContent,/2020-W53ISO week/);
});

console.log('\n── Batch-11 privacy and sharing ──');
await domTest('opt-in share copies fragment only, round trips inputs and clears stale generated links', async () => {
  const originalClipboard=Object.getOwnPropertyDescriptor(navigator,'clipboard'); const oldSecure=Object.getOwnPropertyDescriptor(window,'isSecureContext'); let copied;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text;}}}); Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
  try {
    let app=await loadToolPage('budget-calculator','calculators'); const income=app.querySelector('input'); income.value='43000'; fire(income,'input'); click(btnByLabel(app,'Calculate budget'));
    assert.equal(location.search,''); assert.equal(location.hash,'');
    click(btnByLabel(app,'Copy link with inputs')); await new Promise(r=>setTimeout(r,10));
    const u=new URL(copied); assert.equal(u.search,''); assert.ok(u.hash.startsWith('#iht=')); assert.match(decodeURIComponent(u.hash),/income=43000/);
    assert.equal(app.querySelector('[aria-label="Generated link with inputs"]').value,copied);
    income.value='44000'; fire(income,'input'); assert.equal(app.querySelector('[aria-label="Generated link with inputs"]').value,'');
    app=await loadToolPage('budget-calculator','calculators',u.hash); assert.equal(app.querySelector('input').value,'43000'); assert.match(app.textContent,/21,500\.00Needs target/);
  } finally { if(originalClipboard)Object.defineProperty(navigator,'clipboard',originalClipboard);else delete navigator.clipboard; if(oldSecure)Object.defineProperty(window,'isSecureContext',oldSecure);else delete window.isSecureContext; }
});
await domTest('legacy query is scrubbed without losing unrelated parameters and anchors', async()=>{
 const app=await loadToolPage('budget-calculator','calculators','?income=50000&needs=24000&campaign=example#main');
 assert.equal(app.querySelector('input').value,'50000'); assert.equal(location.search,'?campaign=example'); assert.equal(location.hash,'#main');
 assert.match(app.textContent,/25,000\.00Needs target/);
});
await domTest('share link clipboard failure provides a selectable fallback',async()=>{
 const old=Object.getOwnPropertyDescriptor(window,'isSecureContext'); Object.defineProperty(window,'isSecureContext',{configurable:true,value:false});
 try {const app=await loadToolPage('debt-to-income-calculator','calculators'); click(btnByLabel(app,'Copy link with inputs')); await new Promise(r=>setTimeout(r,10));
 assert.match(app.textContent,/Clipboard unavailable/); const out=app.querySelector('[aria-label="Generated link with inputs"]'); assert.ok(out.value.includes('#iht=')); assert.equal(out.readOnly,true); assert.equal(out.closest('[hidden]'),null);
 } finally {if(old)Object.defineProperty(window,'isSecureContext',old);else delete window.isSecureContext;}
});
await domTest('header copy page link excludes query and fragment',async()=>{
 await loadToolPage('word-counter','text','?private=value#fragment'); let copied=''; const old=Object.getOwnPropertyDescriptor(navigator,'clipboard');
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>copied=text}});
 try { const site=await import(`../assets/js/site.js?sharetest=${Math.random()}`); site.initShare(); click(document.querySelector('[data-copy-link]')); await new Promise(r=>setTimeout(r,10)); const u=new URL(copied); assert.equal(u.search,''); assert.equal(u.hash,''); }
 finally {if(old)Object.defineProperty(navigator,'clipboard',old);else delete navigator.clipboard;}
});
await domTest('all calculator share clients expose explicit disclosure and no auto URL updates',async()=>{
 const {tools}=await import('../assets/js/registry.js');
 const clients=['budget-calculator','emergency-fund-calculator','debt-to-income-calculator','break-even-calculator','percentage-calculator','percentage-change','discount-calculator','age-calculator','bmi-calculator','gst-calculator','emi-calculator','tip-calculator','compound-interest-calculator','simple-interest-calculator','sip-calculator','ppf-calculator','fd-calculator','income-tax-calculator','rd-calculator','cagr-calculator','gratuity-calculator','lumpsum-calculator','nps-calculator','epf-calculator','loan-prepayment-calculator','inflation-calculator','work-hours-calculator','profit-margin-calculator','final-grade-calculator','savings-goal-calculator','swp-calculator','electricity-cost-calculator','fuel-cost-calculator','hra-calculator','cgpa-calculator','attendance-calculator'];
 for(const id of clients) { const t=tools.find(x=>x.id===id); const app=await loadToolPage(id,t.engine); assert.ok(btnByLabel(app,'Copy link with inputs'),id); assert.match(app.textContent,/Anyone with it can see them/,id); assert.equal(location.search,'',id); }
});

console.log('\n── Batch-10 UIs ──');
for (const [id, query, expected] of [
 ['budget-calculator','?income=50000&needs=24000&wants=16000&savings=8000',/25,000\.00Needs target.*15,000\.00Wants target.*10,000\.00Savings target.*2,000\.00Unallocated/s],
 ['emergency-fund-calculator','?monthly=25000&months=6&saved=50000&contribution=10000',/150,000\.00Fund target.*100,000\.00Still needed.*10Months to reach goal/s],
 ['debt-to-income-calculator','?income=100000&debts=35000',/35\.00%Debt-to-income ratio.*65,000\.00Income less debt/s],
 ['break-even-calculator','?fixed=10000&price=100&variable=60',/40\.00Contribution per unit.*250Break-even whole units.*25,000\.00Sales/s],
]) { await domTest(`${id}: shared result, edit and invalid input`,async()=>{
 const app=await loadToolPage(id,'calculators',query); assert.match(app.textContent,expected);
 const first=app.querySelector('input'); first.value=''; click(btnByLabel(app,'Calculate')); assert.match(app.textContent,/must be|valid/i); assert.doesNotMatch(app.textContent,expected);
 first.value=id==='debt-to-income-calculator'?'100000':'100'; fire(first,'input'); click(btnByLabel(app,'Calculate')); await new Promise(r=>setTimeout(r,10)); assert.equal(new URL(window.location.href).search, '', 'inputs should not be auto-synced');
}); }
await domTest('break even communicates non-positive contribution edge cases',async()=>{
 const app=await loadToolPage('break-even-calculator','calculators','?fixed=0&price=10&variable=10'); assert.match(app.textContent,/Every sales volume breaks even/);
 const ins=app.querySelectorAll('input'); ins[0].value='100'; click(btnByLabel(app,'Calculate')); assert.match(app.textContent,/Not attainable/);
});

console.log('\n── Batch-9 UIs ──');
await domTest('business day UI counts holiday and computes next working day', async () => {
  const app = await loadToolPage('business-day-calculator', 'datetime');
  const dates = app.querySelectorAll('input[type=date]'); dates[0].value='2026-11-06'; dates[1].value='2026-11-13';
  app.querySelector('textarea').value='2026-11-11';
  click(btnByLabel(app, 'Count working days')); assert.match(app.textContent,/5Working days \(inclusive\)/);
  click(btnByLabel(app, 'Add / subtract working days')); assert.match(app.textContent,/2026-11-16Resulting date/);
  app.querySelector('textarea').value='2026-02-30'; click(btnByLabel(app, 'Count working days')); assert.match(app.textContent,/Invalid date/);
});
await domTest('date difference displays 24 hours for one day', async () => {
  const app = await loadToolPage('date-difference', 'datetime'); const dates=app.querySelectorAll('input[type=date]');
  dates[0].value='2024-01-01'; dates[1].value='2024-01-02'; click(btnByLabel(app,'Calculate difference'));
  assert.match(app.textContent,/24Hours/); assert.doesNotMatch(app.textContent,/576Hours/);
});
await domTest('image tools accept picker and drop, clear stale results, and refuse unsupported encoders', async () => {
  const originalImage=global.Image, originalCreate=URL.createObjectURL, originalRevoke=URL.revokeObjectURL;
  const canvas=window.HTMLCanvasElement.prototype, getContext=canvas.getContext, toBlob=canvas.toBlob;
  class FakeImage { constructor(){this.naturalWidth=800; this.naturalHeight=600;} set src(_v){queueMicrotask(()=>this.onload());} }
  global.Image=FakeImage; URL.createObjectURL=()=> 'blob:test'; URL.revokeObjectURL=()=>{};
  canvas.getContext=()=>({ drawImage(){}, fillRect(){}, clearRect(){}, strokeRect(){} });
  canvas.toBlob=function(cb,mime){ cb(new Blob(['output'],{type:mime})); };
  try {
    const good = new File([new Uint8Array([255,216,255,217])], 'first.jpg', {type:'image/jpeg'});
    const bad = new File(['bad'], 'bad.jpg', {type:'image/jpeg'});
    const app = await loadToolPage('image-compressor','image'); let zone=app.querySelector('.dropzone');
    const drop=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(drop,'dataTransfer',{value:{files:[good]}}); zone.dispatchEvent(drop);
    assert.match(app.textContent,/Loaded first.jpg/); click(btnByLabel(app,'Compress')); await new Promise(r=>setTimeout(r,30));
    assert.ok(app.querySelector('.img-preview'), app.textContent);
    const picker=zone.querySelector('input[type=file]'); Object.defineProperty(picker,'files',{configurable:true,value:[bad]}); fire(picker,'change');
    assert.equal(app.querySelector('.img-preview'),null,'new file clears stale preview'); click(btnByLabel(app,'Compress')); await new Promise(r=>setTimeout(r,30)); assert.match(app.textContent,/does not look like/);
    Object.defineProperty(picker,'files',{configurable:true,value:[good]}); fire(picker,'change');
    canvas.toBlob=(cb)=>cb(new Blob(['x'],{type:'image/png'})); click(btnByLabel(app,'Compress')); await new Promise(r=>setTimeout(r,30)); assert.match(app.textContent,/does not support encoding/);
    canvas.toBlob=function(cb,mime){ cb(new Blob(['output'],{type:mime})); };
    for (const id of ['image-resizer','image-converter','image-cropper','image-metadata-viewer']) {
      const target=await loadToolPage(id,'image'); zone=target.querySelector('.dropzone'); const e=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[good]}}); zone.dispatchEvent(e); await new Promise(r=>setTimeout(r,30));
      assert.match(target.textContent,/Loaded|Analysed/,`${id}: ${target.textContent}`);
    }
  } finally { global.Image=originalImage; URL.createObjectURL=originalCreate; URL.revokeObjectURL=originalRevoke; canvas.getContext=getContext; canvas.toBlob=toBlob; }
});

await domTest('single image tools invalidate pending work and previews on oversized rejection', async () => {
  const oldImage=global.Image, create=URL.createObjectURL, revoke=URL.revokeObjectURL, pending=[];
  global.Image=class {constructor(){this.naturalWidth=80;this.naturalHeight=40;} set src(v){pending.push(this);}};
  URL.createObjectURL=()=> 'blob:test'; URL.revokeObjectURL=()=>{};
  const good=new File([new Uint8Array([255,216,255,217])],'first.jpg',{type:'image/jpeg'});
  const drop=(zone,file)=>{const e=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[file]}});zone.dispatchEvent(e);};
  try {for(const id of ['image-compressor','image-resizer','image-converter','image-cropper','image-metadata-viewer','jpg-to-png']) {
    const app=await loadToolPage(id,'image'), zone=app.querySelector('.dropzone'); drop(zone,good); await new Promise(r=>setTimeout(r,30));
    if(id==='image-compressor' || id==='jpg-to-png' || id==='image-converter') {const button=btnByLabel(app,id==='image-compressor'?'Compress':id==='jpg-to-png'?'Convert to PNG':'Convert'); click(button); await new Promise(r=>setTimeout(r,30));}
    const outstanding=pending.splice(0); drop(zone,{name:'large.png',size:201*1024*1024});
    for(const img of outstanding) img.onload(); await new Promise(r=>setTimeout(r,20));
    assert.match(statusText(document),/Selection rejected/,id); assert.equal(app.querySelector('.img-preview'),null,id);
    if(id==='image-compressor' || id==='image-resizer' || id==='image-converter' || id==='image-cropper') { click(btnByLabel(app,{'image-compressor':'Compress','image-resizer':'Resize','image-converter':'Convert','image-cropper':'Crop'}[id])); assert.match(statusText(document),/Choose an image first/,id); }
  }} finally {global.Image=oldImage;URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});
await domTest('image rotator cancels stale loads and stale encoding', async () => {
  const oldImage=global.Image, create=URL.createObjectURL, revoke=URL.revokeObjectURL, pending=[];
  const canvas=window.HTMLCanvasElement.prototype, oldContext=canvas.getContext, oldBlob=canvas.toBlob; let encode;
  global.Image=class {constructor(){this.naturalWidth=80;this.naturalHeight=40;} set src(v){pending.push(this);}};
  URL.createObjectURL=()=> 'blob:test'; URL.revokeObjectURL=()=>{};
  canvas.getContext=()=>({fillRect(){},translate(){},scale(){},rotate(){},drawImage(){}});
  canvas.toBlob=(cb)=>{encode=cb;};
  const drop=(zone,file)=>{const e=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[file]}});zone.dispatchEvent(e);};
  const good=new File([new Uint8Array([255,216,255,217])],'one.jpg',{type:'image/jpeg'});
  try {
    const app=await loadToolPage('image-rotator','image'), zone=app.querySelector('.dropzone');
    drop(zone,good); await new Promise(r=>setTimeout(r,30)); assert.equal(pending.length,1);
    click(btnByLabel(app,'Clear image')); pending[0].onload(); await new Promise(r=>setTimeout(r,20));
    assert.match(statusText(document),/Image cleared/); assert.equal(app.querySelector('.img-preview'),null);
    drop(zone,good); await new Promise(r=>setTimeout(r,30)); pending[1].onload(); await new Promise(r=>setTimeout(r,20));
    click(btnByLabel(app,'Create preview')); assert.ok(encode);
    const angle=app.querySelector('select'); angle.value='180'; fire(angle,'change');
    encode(new Blob(['png'],{type:'image/png'})); await new Promise(r=>setTimeout(r,20));
    assert.equal(app.querySelector('.img-preview'),null); assert.match(statusText(document),/Settings changed/);
    drop(zone,{name:'huge.png',size:201*1024*1024}); assert.match(statusText(document),/Selection rejected/);
    click(btnByLabel(app,'Create preview')); assert.match(statusText(document),/Choose a supported image/);
  } finally {global.Image=oldImage;URL.createObjectURL=create;URL.revokeObjectURL=revoke;canvas.getContext=oldContext;canvas.toBlob=oldBlob;}
});
await domTest('batch image rotation changes cancel an in-flight load', async () => {
  const oldImage=global.Image, create=URL.createObjectURL, revoke=URL.revokeObjectURL, pending=[];
  global.Image=class {constructor(){this.naturalWidth=80;this.naturalHeight=40;} set src(v){pending.push(this);}};
  URL.createObjectURL=()=> 'blob:test'; URL.revokeObjectURL=()=>{};
  try {
    const app=await loadToolPage('bulk-image-resizer','image');
    const event=new window.Event('drop',{bubbles:true,cancelable:true});
    Object.defineProperty(event,'dataTransfer',{value:{files:[new File([new Uint8Array([255,216,255,217])],'a.jpg')]}});
    app.querySelector('.dropzone').dispatchEvent(event); click(btnByLabel(app,'Process images'));
    for(let i=0;i<30 && !pending.length;i++) await new Promise(r=>setTimeout(r,10));
    assert.equal(pending.length,1);
    const rotation=[...app.querySelectorAll('select')].find(el=>[...el.options].some(o=>o.value==='270'));
    rotation.value='90'; fire(rotation,'change'); pending[0].onload(); await new Promise(r=>setTimeout(r,20));
    assert.match(statusText(document),/Settings changed/); assert.equal(btnByLabel(app,'Download ZIP').disabled,true);
  } finally {global.Image=oldImage;URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});
await domTest('crop coordinates validate boundaries and aspect changes are synchronous', async () => {
  const oldImage=global.Image, create=URL.createObjectURL, revoke=URL.revokeObjectURL;
  const canvas=window.HTMLCanvasElement.prototype, getContext=canvas.getContext, toBlob=canvas.toBlob;
  global.Image=class {constructor(){this.naturalWidth=80;this.naturalHeight=40;} set src(v){queueMicrotask(()=>this.onload());}};
  URL.createObjectURL=()=> 'blob:test';URL.revokeObjectURL=()=>{};canvas.getContext=()=>({drawImage(){},fillRect(){},clearRect(){},strokeRect(){}});canvas.toBlob=(cb,mime)=>cb(new Blob(['png'],{type:mime}));
  try {const app=await loadToolPage('image-cropper','image');const e=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[new File([new Uint8Array([255,216,255,217])],'x.jpg')]}});app.querySelector('.dropzone').dispatchEvent(e); await new Promise(r=>setTimeout(r,40));
    const inputs=app.querySelectorAll('input[type=number]');assert.deepEqual([...inputs].map(v=>v.value),['0','0','80','40']);
    click(btnByLabel(app,'1:1'));assert.equal(inputs[2].value,'40');assert.equal(inputs[3].value,'40'); click(btnByLabel(app,'Crop')); await new Promise(r=>setTimeout(r,20));assert.ok(app.querySelector('.img-preview'));
    inputs[0].value='70';fire(inputs[0],'input');assert.equal(app.querySelector('.img-preview'),null);click(btnByLabel(app,'Crop'));assert.match(statusText(document),/within the image/);
    inputs[0].value='0'; inputs[2].value='1'; inputs[3].value='1'; fire(inputs[2],'input'); click(btnByLabel(app,'Crop'));await new Promise(r=>setTimeout(r,20));assert.match(statusText(document),/Cropped to 1 × 1/);
  } finally {global.Image=oldImage;URL.createObjectURL=create;URL.revokeObjectURL=revoke;canvas.getContext=getContext;canvas.toBlob=toBlob;}
});

await domTest('bulk image resizer rejects invalid batches and cancels stale image loads', async () => {
  const oldImage=global.Image, create=URL.createObjectURL, revoke=URL.revokeObjectURL; const pending=[];
  global.Image=class {constructor(){this.naturalWidth=80;this.naturalHeight=40;} set src(v){pending.push(this);}};
  URL.createObjectURL=()=> 'blob:test'; URL.revokeObjectURL=()=>{};
  try {
    const app=await loadToolPage('bulk-image-resizer','image');
    const file=new File([new Uint8Array([255,216,255,217])],'photo.jpg',{type:'image/jpeg'});
    const send=files=>{const e=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files}});app.querySelector('.dropzone').dispatchEvent(e);};
    send(Array(21).fill(file)); assert.match(app.textContent,/at most 20 images/);
    const other=new File([new Uint8Array([255,216,255,217])],'other.jpg',{type:'image/jpeg'});
    send([file,other,file]);
    assert.match(app.textContent,/001-photo.jpg/); assert.match(app.textContent,/003-photo.jpg/);
    const up=app.querySelector('button[aria-label="Move up 3: photo.jpg"]'); click(up);
    assert.match(app.textContent,/002-photo.jpg/);
    click(app.querySelector('button[aria-label="Remove 2: photo.jpg"]'));
    assert.doesNotMatch(app.textContent,/003-photo.jpg/);
    click(btnByLabel(app,'Clear selected images')); assert.match(app.textContent,/Selection cleared/);
    send([file]); const prefix=app.querySelector('input[placeholder^="optional, e.g."]'); prefix.value='../bad'; fire(prefix,'input'); click(btnByLabel(app,'Process images')); assert.match(app.textContent,/Prefix must use/); prefix.value=''; fire(prefix,'input');
    send([file]); const nums=app.querySelectorAll('input[type=number]');
    const selects=app.querySelectorAll('select'); selects[0].value='white'; nums[0].value=''; click(btnByLabel(app,'Process images')); assert.match(app.textContent,/requires both width and height/);
    nums[0].value='1200'; selects[0].value='transparent'; click(btnByLabel(app,'Process images')); assert.match(app.textContent,/requires PNG or WebP/); selects[0].value='fit';
    const huge = { name: 'huge.jpg', size: 201 * 1024 * 1024 }; send([huge]); assert.match(app.textContent,/Selection rejected/); click(btnByLabel(app,'Process images')); assert.match(app.textContent,/Choose images first/); send([file]);
    nums[3].value='0'; click(btnByLabel(app,'Process images')); assert.match(app.textContent,/Target must be a whole number/);
    nums[3].value='10'; app.querySelectorAll('select')[1].value='png'; click(btnByLabel(app,'Process images')); assert.match(app.textContent,/JPEG and WebP only/);
    nums[3].value=''; app.querySelectorAll('select')[1].value='jpeg'; nums[0].value='0'; click(btnByLabel(app,'Process images')); assert.match(app.textContent,/whole numbers from 1 to 4096/);
    nums[0].value='100'; click(btnByLabel(app,'Process images'));
    for (let i=0;i<30 && !pending.length;i++) await new Promise(r=>setTimeout(r,10));
    assert.equal(pending.length,1,'image load should be in progress');
    click(btnByLabel(app,'Cancel')); pending[0].onload(); await new Promise(r=>setTimeout(r,20));
    assert.match(app.textContent,/Cancelled/); assert.equal(btnByLabel(app,'Download ZIP').disabled,true);
    nums[0].value=''; nums[1].value=''; click(btnByLabel(app,'Process images'));
    for (let i=0;i<30 && pending.length < 2;i++) await new Promise(r=>setTimeout(r,10));
    assert.equal(pending.length,2,'blank bounds allow a new run');
    nums[1].value='60'; fire(nums[1],'input'); pending[1].onload(); await new Promise(r=>setTimeout(r,20));
    assert.match(app.textContent,/Settings changed/); assert.equal(btnByLabel(app,'Download ZIP').disabled,true);
  } finally {global.Image=oldImage; URL.createObjectURL=create; URL.revokeObjectURL=revoke;}
});

await domTest('metadata viewer warns about incomplete inspection and does not claim absence', async () => {
  const oldImage=global.Image, create=URL.createObjectURL, revoke=URL.revokeObjectURL;
  global.Image=class {constructor(){this.naturalWidth=1;this.naturalHeight=1;} set src(v){queueMicrotask(()=>this.onload());}};
  URL.createObjectURL=()=> 'blob:test'; URL.revokeObjectURL=()=>{};
  try {
    const app=await loadToolPage('image-metadata-viewer','image');
    assert.match(app.textContent,/does not mean metadata or location is absent/);
    const file=new File([new Uint8Array([255,216,255,217])],'plain.jpg',{type:'image/jpeg'});
    const e=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[file]}}); app.querySelector('.dropzone').dispatchEvent(e);
    await new Promise(r=>setTimeout(r,30));
    assert.match(app.textContent,/Not found/); assert.match(app.textContent,/does not establish/);
    assert.doesNotMatch(app.textContent,/may have been stripped/);
  } finally {global.Image=oldImage; URL.createObjectURL=create; URL.revokeObjectURL=revoke;}
});

await domTest('image resizer invalidates stale encodes, revokes previews and bounds dimensions', async () => {
  const originalImage=global.Image, originalCreate=URL.createObjectURL, originalRevoke=URL.revokeObjectURL;
  const canvas=window.HTMLCanvasElement.prototype, getContext=canvas.getContext, toBlob=canvas.toBlob; let callbacks=[], created=0, revoked=[];
  global.Image=class {constructor(){this.naturalWidth=800;this.naturalHeight=600;} set src(v){queueMicrotask(()=>this.onload());}};
  URL.createObjectURL=()=>`blob:test-${++created}`; URL.revokeObjectURL=url=>revoked.push(url);
  canvas.getContext=()=>({drawImage(){},fillRect(){}}); canvas.toBlob=(cb,mime)=>callbacks.push(()=>cb(new Blob(['output'],{type:mime})));
  try {
    const app=await loadToolPage('image-resizer','image'); const good=new File([new Uint8Array([255,216,255,217])],'first.jpg',{type:'image/jpeg'});
    const drop=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(drop,'dataTransfer',{value:{files:[good]}}); app.querySelector('.dropzone').dispatchEvent(drop); await new Promise(r=>setTimeout(r,30));
    const width=app.querySelector('input[type=number]'); width.value='400'; fire(width,'input'); click(btnByLabel(app,'Resize')); assert.equal(callbacks.length,1);
    width.value='200'; fire(width,'input'); callbacks.shift()(); await new Promise(r=>setTimeout(r,10)); assert.equal(app.querySelector('.img-preview'),null);
    click(btnByLabel(app,'Resize')); callbacks.shift()(); await new Promise(r=>setTimeout(r,10)); assert.ok(app.querySelector('.img-preview')); const previewUrl=app.querySelector('.img-preview').getAttribute('src');
    width.value='300'; fire(width,'input'); assert.equal(app.querySelector('.img-preview'),null); assert.ok(revoked.includes(previewUrl));
    width.value='20000'; fire(width,'input'); click(btnByLabel(app,'Resize')); assert.match(app.textContent,/16,384 pixels/); assert.equal(callbacks.length,0);
  } finally {global.Image=originalImage; URL.createObjectURL=originalCreate; URL.revokeObjectURL=originalRevoke; canvas.getContext=getContext; canvas.toBlob=toBlob;}
});

console.log('\n── All registered tool UI mount smoke test ──');
await domTest('all registered tools mount in jsdom',async()=>{
 const {tools}=await import('../assets/js/registry.js'); const issues=[];
 for (const tool of tools) {try {const app=await loadToolPage(tool.id,tool.engine); assert.doesNotMatch(app.textContent,/Something went wrong while starting this tool\.|This tool could not load\./);} catch(e){issues.push(`${tool.id}: ${e.message}`);}}
 assert.deepEqual(issues,[]);
});
await domTest('compound interest always contributes monthly for yearly compounding',async()=>{
 const app=await loadToolPage('compound-interest-calculator','calculators');const inputs=app.querySelectorAll('input[type=number]'); inputs[0].value='0';inputs[1].value='0';inputs[2].value='1';inputs[3].value='100';app.querySelector('select').value='1';click(btnByLabel(app,'Calculate growth'));assert.match(app.textContent,/1,200\.00Total contributed/);
});
await domTest('CSV text preservation and duplicate headers in UI',async()=>{
 const app=await loadToolPage('csv-to-json','data');const input=app.querySelector('textarea');input.value='id,flag\n001,true';click(btnByLabel(app,'Convert to JSON'));assert.match(app.textContent,/"001"/);assert.match(app.textContent,/"true"/);input.value='x,x\n1,2';click(btnByLabel(app,'Convert to JSON'));assert.match(app.textContent,/Duplicate column/);assert.doesNotMatch(resultText(document),/001/);
});
await domTest('contrast checker rejects alpha and clears stale result',async()=>{
 const app=await loadToolPage('color-contrast-checker','color');const fields=app.querySelectorAll('input[type=text]');fields[0].value='#0000';fire(fields[0],'input');assert.match(app.textContent,/requires opaque colors/);assert.doesNotMatch(app.textContent,/Contrast ratio/);
});

await domTest('CSV file reads cannot overwrite newer input and stale conversions clear', async () => {
  const app = await loadToolPage('csv-to-json','data'); await new Promise(r => setTimeout(r,30));
  const input=app.querySelector('textarea'); click(btnByLabel(app,'Convert to JSON')); assert.match(resultText(document),/Ada/);
  input.value='id\nnew'; fire(input,'input'); assert.doesNotMatch(resultText(document),/Ada/);
  const saved=global.FileReader, pending=[];
  global.FileReader=class {readAsText(f){pending.push({reader:this,file:f});}};
  try {
    const drop=name=>{const e=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(e,'dataTransfer',{value:{files:[new File(['x'],name,{type:'text/csv'})]}}); app.querySelector('.dropzone').dispatchEvent(e);};
    drop('old.csv'); drop('new.csv'); assert.equal(pending.length,2);
    pending[1].reader.result='id\nsecond'; pending[1].reader.onload(); await new Promise(r=>setTimeout(r,10));
    pending[0].reader.result='id\nfirst'; pending[0].reader.onload(); await new Promise(r=>setTimeout(r,10));
    assert.equal(input.value,'id\nsecond'); assert.match(resultText(document),/second/); assert.doesNotMatch(resultText(document),/first/);
    drop('third.csv'); input.value='id\ntyped'; fire(input,'input'); pending[2].reader.result='id\nstale'; pending[2].reader.onload(); await new Promise(r=>setTimeout(r,10));
    assert.equal(input.value,'id\ntyped'); assert.doesNotMatch(resultText(document),/second|stale/);
  } finally { global.FileReader=saved; }
});
await domTest('JSON converters clear stale output after editing and reject duplicate keys', async () => {
  for (const id of ['json-to-csv','json-lines-converter']) {
    const app=await loadToolPage(id,'data'); const input=app.querySelector('textarea'); const button=btnByLabel(app,id==='json-to-csv'?'Convert to CSV':'JSONL → Array');
    click(button); assert.ok(app.querySelector('.result-panel').dataset.has);
    input.value=id==='json-to-csv'?'[{"a":1,"a":2}]':'{"a":1,"a":2}'; fire(input,'input'); assert.ok(!app.querySelector('.result-panel').dataset.has);
    click(button); assert.match(statusText(document),/Duplicate JSON object keys/); assert.ok(!app.querySelector('.result-panel').dataset.has);
  }
});

await domTest('JSON format and minify preserve exact source tokens and clear stale output', async () => {
  for (const id of ['json-formatter','json-minifier']) {
    const app=await loadToolPage(id,'developer'); const input=app.querySelector('textarea'); input.value='{"n":9007199254740993,"a":1,"a":2}';
    click(btnByLabel(app,'Minify')); assert.equal(resultText(document),input.value); assert.match(statusText(document),/duplicate keys preserved/);
    input.value='{"n":2}'; fire(input,'input'); assert.ok(!app.querySelector('.result-panel').dataset.has);
  }
  const app=await loadToolPage('json-compare','developer'); const fields=app.querySelectorAll('textarea');
  fields[0].value='{"n":9007199254740993}'; fields[1].value='{"n":9007199254740992}'; click(btnByLabel(app,'Compare JSON')); assert.match(statusText(document),/safe numeric range/);
  fields[0].value='{}'; fields[1].value='{}'; click(btnByLabel(app,'Compare JSON')); assert.match(resultText(document),/No structural differences/);
  fields[1].value='{"a":1}'; fire(fields[1],'input'); assert.ok(!app.querySelector('.result-panel').dataset.has);
});

await domTest('finance UI avoids misleading GST labels, stale outputs and rounded people/years', async () => {
  let app=await loadToolPage('gst-calculator','calculators'); let fields=app.querySelectorAll('input[type=number]'); fields[0].value='1180';
  click(btnByLabel(app,'Remove GST')); click(btnByLabel(app,'Calculate GST'));
  const cards=[...app.querySelectorAll('.stat-card')].map(x=>x.textContent); assert.ok(cards.some(x=>/1,000.00.*Base \(net\)/.test(x)), cards.join('|')); assert.ok(cards.some(x=>/1,180.00.*Total \(gross\)/.test(x)),cards.join('|')); assert.match(statusText(document),/IGST/);
  fields[0].value='1000'; fire(fields[0],'input'); assert.equal(app.querySelectorAll('.stat-card').length,0);
  app=await loadToolPage('rd-calculator','calculators'); fields=app.querySelectorAll('input[type=number]'); fields[2].value='1.5'; click(btnByLabel(app,'Calculate RD')); assert.match(statusText(document),/whole number/); assert.equal(app.querySelectorAll('.stat-card').length,0);
  app=await loadToolPage('tip-calculator','calculators'); fields=app.querySelectorAll('input[type=number]'); fields[0].value='100'; fields[2].value='2.5'; click(btnByLabel(app,'Calculate tip')); assert.match(statusText(document),/whole number/);
  app=await loadToolPage('simple-interest-calculator','calculators'); fields=app.querySelectorAll('input[type=number]'); fields[1].value=''; click(btnByLabel(app,'Calculate interest')); assert.match(statusText(document),/rate/); assert.doesNotMatch(app.textContent,/NaN/);
});

await domTest('hash results ignore stale asynchronous digests', async () => {
  const previous=Object.getOwnPropertyDescriptor(global,'crypto'); const pending=[];
  Object.defineProperty(global,'crypto',{configurable:true,value:{subtle:{digest:(algo,buffer)=>new Promise(resolve=>pending.push({algo,buffer,resolve}))}}});
  try { const app=await loadToolPage('hash-generator','developer'), text=app.querySelector('textarea');
    text.value='first'; click(btnByLabel(app,'Hash text')); text.value='second'; fire(text,'input'); click(btnByLabel(app,'Hash text'));
    assert.equal(pending.length,2); pending[1].resolve(new Uint8Array([2]).buffer); await new Promise(r=>setTimeout(r,10));
    pending[0].resolve(new Uint8Array([1]).buffer); await new Promise(r=>setTimeout(r,10)); assert.equal(resultText(document),'02');
    text.value='third'; fire(text,'input'); assert.ok(!app.querySelector('.result-panel').dataset.has);
  } finally { if(previous) Object.defineProperty(global,'crypto',previous); else delete global.crypto; }
});
await domTest('timestamp explicit milliseconds and JWT payload copy are correct', async () => {
  let app=await loadToolPage('timestamp-converter','developer'); app.querySelector('input[type=text]').value='1000'; app.querySelector('select').value='milliseconds'; click(btnByLabel(app,'Convert to date')); assert.match(resultText(document),/1970-01-01T00:00:01.000Z/);
  app=await loadToolPage('jwt-decoder','developer'); const header=Buffer.from('{"alg":"none"}').toString('base64url'), payload=Buffer.from('{"sub":"abc"}').toString('base64url'); app.querySelector('textarea').value=`${header}.${payload}.`; click(btnByLabel(app,'Decode'));
  let copied=''; const oldClip=Object.getOwnPropertyDescriptor(navigator,'clipboard'), oldSecure=window.isSecureContext;
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text;}}}); window.isSecureContext=true;
  try { const panels=app.querySelectorAll('.result-panel'); click(btnByLabel(panels[1],'Copy')); await new Promise(r=>setTimeout(r,10)); assert.deepEqual(JSON.parse(copied),{sub:'abc'}); }
  finally { if(oldClip) Object.defineProperty(navigator,'clipboard',oldClip); else delete navigator.clipboard; window.isSecureContext=oldSecure; }
});
await domTest('random strings deduplicate custom alphabets and clear outputs on invalid input', async () => {
  const app=await loadToolPage('random-string-generator','security'); const inputs=app.querySelectorAll('input[type=number]'), sel=app.querySelector('select'); inputs[0].value='2'; inputs[1].value='8'; sel.value='custom'; fire(sel,'change');
  const custom=app.querySelector('input[type=text]'); custom.value='😀😀'; fire(custom,'input'); click(btnByLabel(app,'Generate'));
  assert.equal(app.querySelectorAll('.file-row').length,2); for(const code of app.querySelectorAll('.file-row code')) assert.equal(code.textContent,'😀'.repeat(8)); assert.match(statusText(document),/0 bits/);
  inputs[0].value='1.5'; fire(inputs[0],'input'); click(btnByLabel(app,'Generate')); assert.match(statusText(document),/whole numbers/); assert.equal(app.querySelectorAll('.file-row').length,0);
});

await domTest('regex worker times out, cancels stale work and preserves zero-width text', async () => {
  const app=await loadToolPage('regex-tester','developer'); const pattern=app.querySelector('input[type=text]'), text=app.querySelector('textarea');
  pattern.value='(?=a)'; text.value='aba'; fire(pattern,'input'); fire(text,'input');
  app.querySelector('.switch input').checked=true; fire(app.querySelector('.switch input'),'change');
  await new Promise(r=>setTimeout(r,450)); assert.equal(app.querySelector('.result-body pre').textContent,'aba'); assert.equal(app.querySelectorAll('mark').length,2);
  pattern.value='(a+)+$'; text.value='a'.repeat(35)+'!'; fire(pattern,'input'); fire(text,'input'); assert.equal(app.querySelectorAll('mark').length,0);
  await new Promise(r=>setTimeout(r,1450)); assert.match(statusText(document),/timed out/i);
  pattern.value='(?<letter>b)'; text.value='abc'; fire(pattern,'input'); fire(text,'input'); await new Promise(r=>setTimeout(r,450)); assert.match(app.textContent,/letter="b"/);
});
await domTest('regex ignores late worker responses after edits', async () => {
 const previous=global.Worker, jobs=[];
 global.Worker=class { constructor(){jobs.push(this);} postMessage(v){this.data=v;} terminate(){this.terminated=true;} };
 try { const app=await loadToolPage('regex-tester','developer'); assert.equal(jobs.length,1); const text=app.querySelector('textarea');
   text.value='new'; fire(text,'input'); assert.equal(jobs[0].terminated,true);
   jobs[0].onmessage({data:{matches:[{index:0,text:'old',length:3,groups:[],named:null}]}}); assert.equal(app.querySelectorAll('mark').length,0);
   await new Promise(r=>setTimeout(r,250)); assert.equal(jobs.length,2);
   jobs[1].onmessage({data:{matches:[{index:0,text:'new',length:3,groups:[],named:null}]}}); assert.equal(app.querySelector('mark').textContent,'new');
 } finally {global.Worker=previous;}
});
await domTest('regex fails closed without worker support', async () => {
  const old=global.Worker; delete global.Worker;
  try { const app=await loadToolPage('regex-tester','developer'); assert.match(statusText(document),/unavailable/); assert.equal(app.querySelectorAll('mark').length,0); }
  finally { global.Worker=old; }
});

await domTest('text tools clear stale results and diff detects final newline', async () => {
  let app=await loadToolPage('text-diff','text'); const [a,b]=app.querySelectorAll('textarea'); a.value='same'; b.value='same\n'; click(btnByLabel(app,'Compare')); assert.match(statusText(document),/1 line added/); assert.ok(app.querySelector('.d-add'));
  b.value='different'; fire(b,'input'); assert.equal(app.querySelector('.d-add'),null); assert.match(statusText(document),/changed/i);
  click(btnByLabel(app,'Compare')); click(btnByLabel(app,'Swap sides')); assert.equal(app.querySelector('.d-add'),null); assert.match(statusText(document),/swapped/i);
  app=await loadToolPage('text-sorter','text'); const input=app.querySelector('textarea'); input.value='a\nb'; click(btnByLabel(app,'Sort')); assert.match(resultText(document),/a/); input.value='z'; fire(input,'input'); assert.doesNotMatch(resultText(document),/^a\nb$/);
  app=await loadToolPage('slug-generator','text'); click(btnByLabel(app,'Generate slugs')); const title=app.querySelector('textarea'); title.value='हिन्दी भाषा'; fire(title,'input'); assert.doesNotMatch(resultText(document),/coffee/); click(btnByLabel(app,'Generate slugs')); assert.equal(resultText(document),'हिन्दी-भाषा');
});
await domTest('line counter reports zero blank lines on empty input', async () => {
 const app=await loadToolPage('line-counter','text'); assert.match(app.textContent,/0Empty/); assert.match(app.textContent,/0Total lines/);
});

await domTest('SEO generators reject unsafe input and invalidate old downloads', async () => {
 let app=await loadToolPage('sitemap-generator','webseo'), ta=app.querySelector('textarea'); ta.value='https://a.test/'; fire(ta,'input'); click(btnByLabel(app,'Generate sitemap')); assert.match(resultText(document),/a.test/);
 ta.value='https://b.test/'; fire(ta,'input'); assert.doesNotMatch(resultText(document),/a.test/); ta.value='https://a.test/\nhttps://b.test/'; click(btnByLabel(app,'Generate sitemap')); assert.match(statusText(document),/same scheme/);
 app=await loadToolPage('meta-tag-generator','webseo'); const title=app.querySelector('input[type=text]'), url=app.querySelector('input[type=url]'); title.value='Title'; fire(title,'input'); assert.match(resultText(document),/<title>Title/); url.value='javascript:alert(1)'; fire(url,'input'); assert.match(statusText(document),/HTTP/); assert.doesNotMatch(resultText(document),/<title>/);
 app=await loadToolPage('robots-txt-generator','webseo'); const sitemap=app.querySelector('input[type=url]'); sitemap.value='https://example.com/sitemap.xml'; fire(sitemap,'input'); assert.match(resultText(document),/Sitemap:/); sitemap.value='https://example.com/s.xml#frag'; fire(sitemap,'input'); assert.match(statusText(document),/fragment/); assert.doesNotMatch(resultText(document),/Sitemap:/);
 app=await loadToolPage('keyword-density-checker','webseo'); const content=app.querySelector('textarea'); content.value='alpha alpha beta'; fire(content,'input'); click(btnByLabel(app,'Count keywords')); assert.match(app.textContent,/alpha/); content.value='new'; fire(content,'input'); assert.doesNotMatch(app.textContent,/alpha/); click(btnByLabel(app,'Download CSV')); assert.match(statusText(document),/before downloading/);
});

await domTest('QR generator invalidates old content and delayed PNG downloads', async () => {
 const canvas=window.HTMLCanvasElement.prototype, oldCtx=canvas.getContext, oldBlob=canvas.toBlob, oldQr=window.qrcode, oldCreate=URL.createObjectURL; let saved, downloads=0;
 window.qrcode=()=>({addData(){},make(){},getModuleCount(){return 21;},isDark(){return false;}});
 canvas.getContext=()=>({fillRect(){},set fillStyle(v){}}); canvas.toBlob=cb=>{saved=cb;}; URL.createObjectURL=()=>{downloads++;return 'blob:download';};
 try { const app=await loadToolPage('qr-code-generator','webseo'), input=app.querySelector('textarea'); input.value=' first '; fire(input,'input'); click(btnByLabel(app,'Generate QR code')); await new Promise(r=>setTimeout(r,20)); assert.ok(btnByLabel(app,'Download PNG'));
   click(btnByLabel(app,'Download PNG')); input.value='second'; fire(input,'input'); assert.equal(btnByLabel(app,'Download PNG'),undefined); saved(new Blob(['x'])); assert.equal(downloads,0);
   click(btnByLabel(app,'Generate QR code')); await new Promise(r=>setTimeout(r,20)); assert.ok(btnByLabel(app,'Download SVG')); app.querySelector('input[type=color]').value='#123456'; fire(app.querySelector('input[type=color]'),'input'); assert.equal(btnByLabel(app,'Download SVG'),undefined);
 } finally {canvas.getContext=oldCtx;canvas.toBlob=oldBlob;window.qrcode=oldQr;URL.createObjectURL=oldCreate;}
});
await domTest('QR generator ignores delayed library load after edits', async () => {
 const previous=window.qrcode; delete window.qrcode;
 try { const app=await loadToolPage('qr-code-generator','webseo'), input=app.querySelector('textarea'); input.value='old'; fire(input,'input'); click(btnByLabel(app,'Generate QR code')); const script=[...document.querySelectorAll('script')].find(el=>el.src.endsWith('/assets/vendor/qrcode-generator.js')); assert.ok(script);
 input.value='new'; fire(input,'input'); window.qrcode=()=>({addData(){},make(){},getModuleCount(){return 21;},isDark(){return false;}}); script.onload(); await new Promise(r=>setTimeout(r,20)); assert.equal(btnByLabel(app,'Download PNG'),undefined); assert.match(statusText(document),/changed/);
 } finally {window.qrcode=previous;}
});
await domTest('QR scanner cancels pending camera permission and stops late stream', async () => {
 const old=Object.getOwnPropertyDescriptor(navigator,'mediaDevices'); let grant, stopped=0;
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(resolve=>{grant=resolve;})}});
 try { const app=await loadToolPage('qr-code-scanner','webseo'); click(btnByLabel(app,'Start camera')); assert.equal(btnByLabel(app,'Stop camera').disabled,false); click(btnByLabel(app,'Stop camera')); grant({getTracks:()=>[{stop(){stopped++;}}]}); await new Promise(r=>setTimeout(r,20)); assert.equal(stopped,1); assert.match(statusText(document),/Camera stopped/); assert.equal(app.querySelector('video').srcObject,null); }
 finally {if(old) Object.defineProperty(navigator,'mediaDevices',old); else delete navigator.mediaDevices;}
});
await domTest('QR scanner ignores out-of-order files and cleans bitmap and previews', async () => {
 const oldBitmap=global.createImageBitmap, oldQr=window.jsQR, canvas=window.HTMLCanvasElement.prototype, oldCtx=canvas.getContext, oldCreate=URL.createObjectURL, oldRevoke=URL.revokeObjectURL; const pending=[],revoked=[],closed=[]; let drawn='';
 global.createImageBitmap=file=>new Promise(resolve=>pending.push({name:file.name,resolve})); URL.createObjectURL=f=>`blob:${f.name}`; URL.revokeObjectURL=u=>revoked.push(u); window.jsQR=()=>({data:drawn});
 canvas.getContext=()=>({drawImage(image){drawn=image.name;},getImageData(){return {data:new Uint8ClampedArray(4),width:1,height:1};}});
 try {const app=await loadToolPage('qr-code-scanner','webseo'); const drop=name=>{const ev=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(ev,'dataTransfer',{value:{files:[new File(['x'],name,{type:'image/png'})]}}); app.querySelector('.dropzone').dispatchEvent(ev);};
  drop('old'); drop('new'); assert.deepEqual(revoked,['blob:old']); pending[1].resolve({name:'new payload',width:1,height:1,close(){closed.push('new');}}); await new Promise(r=>setTimeout(r,20)); assert.equal(resultText(document),'new payload');
  pending[0].resolve({name:'old payload',width:1,height:1,close(){closed.push('old');}}); await new Promise(r=>setTimeout(r,20)); assert.equal(resultText(document),'new payload'); assert.deepEqual(closed.sort(),['new','old']);
  window.dispatchEvent(new window.Event('pagehide')); assert.ok(revoked.includes('blob:new'));
 } finally {global.createImageBitmap=oldBitmap;window.jsQR=oldQr;canvas.getContext=oldCtx;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;}
});

await domTest('QR scanner rejects oversized input and cleans up on repeated pagehide', async () => {
 const old=Object.getOwnPropertyDescriptor(navigator,'mediaDevices'); let grants=[]; let stopped=0;
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(resolve=>grants.push(resolve))}});
 try { const app=await loadToolPage('qr-code-scanner','webseo'); const drop=new window.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(drop,'dataTransfer',{value:{files:[{name:'large.png',size:26*1024*1024,type:'image/png'}]}}); app.querySelector('.dropzone').dispatchEvent(drop); assert.match(statusText(document),/25 MiB/);
 for(let i=0;i<2;i++){click(btnByLabel(app,'Start camera')); window.dispatchEvent(new window.Event('pagehide')); grants[i]({getTracks:()=>[{stop(){stopped++;}}]}); await new Promise(r=>setTimeout(r,10));} assert.equal(stopped,2);
 } finally {if(old) Object.defineProperty(navigator,'mediaDevices',old); else delete navigator.mediaDevices;}
});

await domTest('QR download failures and pagehide cannot report or deliver stale output', async () => {
 const canvas=window.HTMLCanvasElement.prototype, oldCtx=canvas.getContext, oldBlob=canvas.toBlob, oldQr=window.qrcode, oldCreate=URL.createObjectURL; let callback, downloads=0;
 window.qrcode=()=>({addData(){},make(){},getModuleCount(){return 21;},isDark(){return false;}});
 canvas.getContext=()=>({fillRect(){},set fillStyle(v){}}); canvas.toBlob=cb=>{callback=cb;};
 try {const app=await loadToolPage('qr-code-generator','webseo'), input=app.querySelector('textarea'); input.value='hello'; fire(input,'input'); click(btnByLabel(app,'Generate QR code'));await new Promise(r=>setTimeout(r,20));
  click(btnByLabel(app,'Download PNG')); callback(null); assert.match(statusText(document),/Could not start the PNG/);
  URL.createObjectURL=()=>{throw new Error('blocked');}; click(btnByLabel(app,'Download SVG')); assert.match(statusText(document),/Could not start the SVG/);
  click(btnByLabel(app,'Download PNG')); window.dispatchEvent(new window.Event('pagehide')); URL.createObjectURL=()=>{downloads++; return 'blob:test';}; callback(new Blob(['x'],{type:'image/png'})); assert.equal(downloads,0); assert.equal(btnByLabel(app,'Download PNG'),undefined);
 } finally {canvas.getContext=oldCtx;canvas.toBlob=oldBlob;window.qrcode=oldQr;URL.createObjectURL=oldCreate;}
});
await domTest('QR scanner rejects huge file and stops pending camera or scan', async () => {
 const old=Object.getOwnPropertyDescriptor(navigator,'mediaDevices'), oldBitmap=global.createImageBitmap, oldCreate=URL.createObjectURL, oldRevoke=URL.revokeObjectURL; let grant,resolveBitmap,stopped=0,closed=0;
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(resolve=>{grant=resolve;})}});
 global.createImageBitmap=()=>new Promise(resolve=>{resolveBitmap=resolve;});URL.createObjectURL=()=> 'blob:test'; URL.revokeObjectURL=()=>{};
 const drop=(app,file)=>{const e=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[file]}});app.querySelector('.dropzone').dispatchEvent(e);};
 try {const app=await loadToolPage('qr-code-scanner','webseo'); click(btnByLabel(app,'Start camera')); drop(app,{name:'huge.png',size:201*1024*1024}); grant({getTracks:()=>[{stop(){stopped++;}}]}); await new Promise(r=>setTimeout(r,15)); assert.equal(stopped,1); assert.match(statusText(document),/Selection rejected/);
  drop(app,new File(['x'],'small.png',{type:'image/png'})); assert.ok(resolveBitmap); drop(app,{name:'huge.png',size:201*1024*1024}); resolveBitmap({width:1,height:1,close(){closed++;}}); await new Promise(r=>setTimeout(r,15)); assert.equal(closed,1); assert.match(statusText(document),/Selection rejected/);assert.equal(app.querySelector('.img-preview'),null);
 } finally {if(old) Object.defineProperty(navigator,'mediaDevices',old); else delete navigator.mediaDevices;global.createImageBitmap=oldBitmap;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;}
});
await domTest('CSV rejected selection cancels pending read and keeps input explicitly', async () => {
 const app=await loadToolPage('csv-to-json','data'); await new Promise(r=>setTimeout(r,30)); const text=app.querySelector('textarea'); const before=text.value; const saved=global.FileReader; let reader;
 global.FileReader=class {readAsText(){reader=this;}};
 const drop=file=>{const e=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[file]}});app.querySelector('.dropzone').dispatchEvent(e);};
 try {drop(new File(['x'],'pending.csv'));assert.ok(reader);drop({name:'huge.csv',size:201*1024*1024});reader.result='name\nwrong';reader.onload();await new Promise(r=>setTimeout(r,10));assert.equal(text.value,before);assert.match(statusText(document),/Existing CSV input was kept/);}
 finally {global.FileReader=saved;}
});

for (const toolId of ['json-to-csv','json-lines-converter']) {
 await domTest(`${toolId}: local imports keep edited input and reject oversized files`, async () => {
  const app=await loadToolPage(toolId,'data'); const text=app.querySelector('textarea'), saved=global.FileReader; let reader;
  global.FileReader=class { readAsArrayBuffer(){reader=this;} };
  const drop=file=>{const e=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[file]}});app.querySelector('.dropzone').dispatchEvent(e);};
  try {
    drop(new File(['x'],'test.json')); assert.ok(reader);
    text.value='user typed'; fire(text,'input'); reader.result=new TextEncoder().encode('[1,2]').buffer; reader.onload(); await new Promise(r=>setTimeout(r,10));
    assert.equal(text.value,'user typed');
    drop({name:'large.json',size:4*1024*1024+1}); await new Promise(r=>setTimeout(r,10));
    assert.equal(text.value,'user typed'); assert.match(statusText(document),/Existing input was kept/);
    drop({name:'other.exe',size:2}); await new Promise(r=>setTimeout(r,10)); assert.match(statusText(document),/supported text file/);
  } finally {global.FileReader=saved;}
 });
}
await domTest('JSON Lines direction and errors invalidate downloadable result', async () => {
 const app=await loadToolPage('json-lines-converter','data'); const text=app.querySelector('textarea'), download=btnByLabel(app,'Download result');
 click(btnByLabel(app,'JSONL → Array')); assert.equal(download.disabled,false);
 text.value='not json'; fire(text,'input'); assert.equal(download.disabled,true);
 click(btnByLabel(app,'JSONL → Array')); assert.equal(download.disabled,true); assert.match(statusText(document),/could not be parsed/);
});
await domTest('text diff file races, swap and report invalidation', async () => {
 const app=await loadToolPage('text-diff','text'); const [a,b]=app.querySelectorAll('textarea'), zones=app.querySelectorAll('.dropzone');
 const saved=global.FileReader, readers=[]; global.FileReader=class {readAsArrayBuffer(){readers.push(this);}};
 const drop=(i,file)=>{const e=new window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{files:[file]}});zones[i].dispatchEvent(e);};
 const complete=(i,text)=>{readers[i].result=new TextEncoder().encode(text).buffer; readers[i].onload();};
 try {
  drop(0,new File(['a'],'a.txt')); drop(1,new File(['b'],'b.txt')); assert.equal(readers.length,2);
  complete(1,'second'); complete(0,'first'); await new Promise(r=>setTimeout(r,10)); assert.equal(a.value,'first'); assert.equal(b.value,'second');
  click(btnByLabel(app,'Compare')); assert.match(app.textContent,/A:1 B:– - first/); assert.match(app.textContent,/A:– B:1 \+ second/);
  assert.equal(btnByLabel(app,'Download report').disabled,false); a.value='new'; fire(a,'input'); assert.equal(btnByLabel(app,'Download report').disabled,true);
  drop(0,new File(['a'],'a.txt')); click(btnByLabel(app,'Swap sides')); complete(2,'old read'); await new Promise(r=>setTimeout(r,10)); assert.equal(a.value,'second'); assert.equal(b.value,'new');
  drop(1,{name:'huge.txt',size:3*1024*1024}); await new Promise(r=>setTimeout(r,10)); assert.equal(b.value,'new'); assert.match(statusText(document),/Existing text was kept/);
  drop(1,new File(['a'],'bad.txt')); readers[3].result=new Uint8Array([255]).buffer; readers[3].onload(); await new Promise(r=>setTimeout(r,10)); assert.equal(b.value,'new'); assert.match(statusText(document),/not valid UTF-8/);
 } finally {global.FileReader=saved;}
});
await domTest('typing duration resets test and rejects characters after deadline', async () => {
 const previous=Object.getOwnPropertyDescriptor(performance,'now'); let now=5000; Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
 try {const app=await loadToolPage('typing-speed-test','misc'), box=app.querySelector('textarea'); click(btnByLabel(app,'30 seconds')); assert.match(app.textContent,/30sTime left/);
 box.value='T'; fire(box,'input'); now+=31000; box.value='Th'; fire(box,'input'); assert.equal(box.value,'T'); assert.equal(box.disabled,true); assert.match(statusText(document),/Time is up/);
 click(btnByLabel(app,'2 minutes')); assert.equal(box.disabled,false); assert.equal(box.value,''); assert.match(app.textContent,/120sTime left/);
 } finally {if(previous) Object.defineProperty(performance,'now',previous); else delete performance.now;}
});
await domTest('random and dice reject fractional values and invalidate stale results', async () => {
 let app=await loadToolPage('random-number-generator','misc'); const fields=app.querySelectorAll('input[type=number]'); assert.ok(app.querySelectorAll('.swatch').length); fields[2].value='1.5'; fire(fields[2],'input'); assert.equal(app.querySelectorAll('.swatch').length,0); click(btnByLabel(app,'Generate')); assert.match(statusText(document),/between 1 and 1000/);
 fields[0].value=''; fields[2].value='1'; click(btnByLabel(app,'Generate')); assert.match(statusText(document),/safe whole/);
 app=await loadToolPage('dice-roller','misc'); const dice=app.querySelector('input[type=number]'); dice.value='2.5'; fire(dice,'input'); assert.equal(app.querySelectorAll('.swatch').length,0); click(btnByLabel(app,'Roll')); assert.match(statusText(document),/1 and 12/);
});
await domTest('spin wheel locks list during draw and invalidates winner after edits', async () => {
 const app=await loadToolPage('spin-wheel','misc'), entries=app.querySelector('textarea'), spin=btnByLabel(app,'Spin the wheel'), shuffle=btnByLabel(app,'Shuffle entries');
 click(spin); assert.equal(entries.disabled,true); assert.equal(shuffle.disabled,true); const old=entries.value; click(shuffle); assert.equal(entries.value,old);
 await new Promise(r=>setTimeout(r,4450)); assert.equal(entries.disabled,false); const remove=btnByLabel(app,'Remove winner'); assert.equal(remove.disabled,false);
 entries.value='Another\nName'; fire(entries,'input'); assert.equal(remove.disabled,true); assert.match(statusText(document),/Entries changed/);
 entries.value=Array(101).fill('Entry').join('\n'); fire(entries,'input'); click(spin); assert.match(statusText(document),/100 entries/);
});

await domTest('scientific angle default, exponent notation and stale results', async () => {
 const app=await loadToolPage('scientific-calculator','student'), inp=app.querySelector('input[type=text]'); inp.value='sin(30)'; click(btnByLabel(app,'Calculate')); assert.match(app.textContent,/0\.5Result/);
 click(btnByLabel(app,'RAD')); assert.doesNotMatch(app.textContent,/0\.5Result/); inp.value='1e+21/1e20'; fire(inp,'input'); click(btnByLabel(app,'Calculate')); assert.match(app.textContent,/10Result/);
});
await domTest('student calculators reject fractional or missing inputs and clear results', async () => {
 let app=await loadToolPage('attendance-calculator','student'); const fields=app.querySelectorAll('input[type=number]'); fields[0].value='1'; fields[1].value='0'; fields[2].value='50.000001'; click(btnByLabel(app,'Calculate attendance')); assert.match(app.textContent,/2Attend next classes/); fields[0].value='2.5'; fire(fields[0],'input'); assert.doesNotMatch(app.textContent,/Attend next classes/); click(btnByLabel(app,'Calculate attendance')); assert.match(statusText(document),/whole number/);
 app=await loadToolPage('cgpa-calculator','student'); click(btnByLabel(app,'Calculate SGPA')); assert.match(app.textContent,/SGPA \/ weighted GPA/); const rows=app.querySelectorAll('.file-list .file-row'); rows[0].querySelector('input').value=''; fire(rows[0].querySelector('input'),'input'); assert.doesNotMatch(app.textContent,/SGPA \/ weighted GPA/); click(btnByLabel(app,'Calculate SGPA')); assert.match(app.textContent,/Subject 1: enter a valid/);
 app=await loadToolPage('time-duration-calculator','student'); const numbers=app.querySelectorAll('input[type=number]'); numbers[1].value='60'; click(btnByLabel(app,'Calculate total')); assert.match(statusText(document),/0–59/); numbers[1].value='59'; fire(numbers[1],'input'); click(btnByLabel(app,'Calculate total')); assert.match(app.textContent,/00:59:00/); numbers[1].value='1'; fire(numbers[1],'input'); assert.doesNotMatch(app.textContent,/00:59:00/);
});
await domTest('math results are invalidated after changing input', async () => {
 for (const [id,initial,label] of [['average-calculator','1,2,3','Calculate'],['gcd-lcm-calculator','12,18','Calculate GCD'],['weighted-average-calculator','80,3\n90,2','Calculate weighted']]) {const app=await loadToolPage(id,'math'), inp=app.querySelector('textarea,input[type=text]'); inp.value=initial; click(btnByLabel(app,label)); assert.ok(app.querySelector('.stat-card')); inp.value='4'; fire(inp,'input'); assert.equal(app.querySelector('.stat-card'),null);}
});

await domTest('HTML preview runs, pauses, clears oversized code and handles unsupported sync', async () => {
 const app=await loadToolPage('html-live-preview','developer'), code=app.querySelector('textarea'), frame=app.querySelector('iframe'), live=app.querySelector('input[type=checkbox]');
 assert.equal(frame.getAttribute('sandbox'),'allow-scripts'); assert.equal(frame.getAttribute('referrerpolicy'),'no-referrer');
 assert.match(frame.srcdoc,/Hello, world/); assert.equal(app.querySelector('.html-preview-open').hidden,true);
 live.checked=false; fire(live,'change'); code.value='<h1>Manual</h1>'; fire(code,'input'); assert.match(frame.srcdoc,/Hello, world/);
 click(btnByLabel(app,'Run preview')); assert.equal(frame.srcdoc,'<h1>Manual</h1>');
 code.value='x'.repeat(200001); click(btnByLabel(app,'Run preview')); assert.equal(frame.srcdoc,''); assert.match(statusText(document),/200,000/);
 code.value='<p>new</p>'; click(btnByLabel(app,'Run preview')); click(btnByLabel(app,'Stop preview')); assert.equal(frame.srcdoc,''); assert.equal(live.checked,false);
});

await domTest('JSON tree preserves raw values, is safe and clears on edits', async () => {
 const app = await loadToolPage('json-formatter','developer'), inp = app.querySelector('textarea');
 inp.value = '{"big":9007199254740993,"x":2.370,"x":1e400,"html":"<img src=x>"}'; fire(inp,'input');
 click(btnByLabel(app,'View tree')); const tree = app.querySelector('.json-tree');
 assert.match(tree.textContent,/9007199254740993/); assert.match(tree.textContent,/2\.370/); assert.match(tree.textContent,/1e400/); assert.equal(tree.querySelector('img'),null); assert.equal(tree.querySelectorAll('.json-tree-value').length,4);
 inp.value='{}'; fire(inp,'input'); assert.equal(tree.textContent,'');
});
await domTest('percentage results clear on edit and GST presets are explicitly user-selected', async () => {
 let app = await loadToolPage('percentage-change','calculators'), fields=app.querySelectorAll('input[type=number]');
 fields[0].value='80'; fields[1].value='100'; click(btnByLabel(app,'Calculate change')); assert.match(app.textContent,/25%/); fields[1].value='90'; fire(fields[1],'input'); assert.equal(app.querySelectorAll('.stat-card').length,0); assert.doesNotMatch(app.textContent,/Formula:/);
 app=await loadToolPage('gst-calculator','calculators'); assert.ok([...app.querySelectorAll('option')].some(o=>o.value==='40')); assert.ok([...app.querySelectorAll('option')].some(o=>o.value==='0')); assert.match(app.textContent,/applicable rate yourself/);
});
await domTest('combined date workflow and invalid robots rules remain editable', async () => {
 let app=await loadToolPage('date-add-calculator','datetime'); app.querySelector('input[type=date]').value='2024-01-31';
 const duration=app.querySelector('.date-combined'), values=duration.querySelectorAll('input'); values[1].value='1'; values[3].value='1'; click(btnByLabel(app,'Calculate combined duration')); assert.match(app.textContent,/2024-03-01ISO/);
 app=await loadToolPage('robots-txt-generator','webseo'); click(btnByLabel(app,'Add rule')); let agent=app.querySelector('input[placeholder^="User-agent"]'), path=app.querySelector('input[placeholder^="/private/"]'); agent.value='Bad agent'; path.value='/foo'; click([...app.querySelectorAll('button')].filter(b=>b.textContent.includes('Add rule')).at(-1)); assert.match(statusText(document),/User-agent must/); assert.ok(app.contains(agent)); assert.equal(agent.value,'Bad agent'); agent.value='TestBot'; click([...app.querySelectorAll('button')].filter(b=>b.textContent.includes('Add rule')).at(-1)); assert.match(app.textContent,/UA: TestBot/);
});

await domTest('keyword text import preserves content on rejection and ignores stale reads', async () => {
 const app=await loadToolPage('keyword-density-checker','webseo'), box=app.querySelector('textarea'), picker=app.querySelector('input[type=file]');
 const saved=global.FileReader; let reader;
 global.FileReader=class { readAsText(){ reader=this; } };
 const choose=file=>{Object.defineProperty(picker,'files',{configurable:true,value:[file]});fire(picker,'change');};
 try {
   box.value='existing'; choose(new File(['x'],'draft.txt')); assert.ok(reader); box.value='new edit'; fire(box,'input'); reader.result='late overwrite'; reader.onload(); await new Promise(r=>setTimeout(r,0)); assert.equal(box.value,'new edit');
   choose(new File(['x'],'bad.pdf')); assert.match(statusText(document),/Existing content was kept/); assert.equal(box.value,'new edit');
   choose(new File(['hello'],'draft.txt')); reader.result='hello hello'; reader.onload(); await new Promise(r=>setTimeout(r,0)); assert.equal(box.value,'hello hello'); click(btnByLabel(app,'Count keywords')); assert.match(app.textContent,/hello/);
   choose({name:'huge.txt',size:800001}); assert.match(statusText(document),/Existing content was kept/); assert.equal(box.value,'hello hello');
 } finally {global.FileReader=saved;}
});
await domTest('JSON compare imports ignore stale reads after edits and clear', async () => {
 const app=await loadToolPage('json-compare','developer'), editors=app.querySelectorAll('textarea'), pickers=app.querySelectorAll('input[type=file]');
 const saved=global.FileReader, pending=[];
 global.FileReader=class { readAsArrayBuffer(){ pending.push(this); } };
 const choose=(picker,file)=>{Object.defineProperty(picker,'files',{configurable:true,value:[file]});fire(picker,'change');};
 try {
   choose(pickers[0],new File(['x'],'left.json')); editors[0].value='manual'; fire(editors[0],'input');
   pending[0].result=new TextEncoder().encode('stale').buffer; pending[0].onload(); await new Promise(r=>setTimeout(r,0)); assert.equal(editors[0].value,'manual');
   choose(pickers[1],new File(['x'],'right.json')); click(btnByLabel(app,'Clear'));
   pending[1].result=new TextEncoder().encode('late').buffer; pending[1].onload(); await new Promise(r=>setTimeout(r,0)); assert.equal(editors[1].value,'');
   choose(pickers[0],new File(['x'],'first.json')); choose(pickers[0],new File(['x'],'second.json'));
   pending[3].result=new TextEncoder().encode('new').buffer; pending[3].onload(); await new Promise(r=>setTimeout(r,0)); pending[2].result=new TextEncoder().encode('old').buffer; pending[2].onload(); await new Promise(r=>setTimeout(r,0)); assert.equal(editors[0].value,'new');
   editors[0].value='{"a":1}'; editors[1].value='{"a":2}';
   choose(pickers[0],new File(['x'],'pending.json')); click(btnByLabel(app,'Compare JSON'));
   pending[4].result=new TextEncoder().encode('{"late":true}').buffer; pending[4].onload(); await new Promise(r=>setTimeout(r,0)); assert.equal(editors[0].value,'{"a":1}');
   choose(pickers[0],new File(['x'],'invalid.json')); pending[5].result=new Uint8Array([255]).buffer; pending[5].onload(); await new Promise(r=>setTimeout(r,0)); assert.equal(editors[0].value,'{"a":1}'); assert.match(app.textContent,/not valid UTF-8/);
 } finally { global.FileReader=saved; }
});
await domTest('JSON Pointer pending imports cannot override lookup or edits', async () => {
 const app=await loadToolPage('json-pointer-lookup','developer'), editor=app.querySelector('textarea'), picker=app.querySelector('input[type=file]');
 const saved=global.FileReader, pending=[]; global.FileReader=class { readAsArrayBuffer(){pending.push(this);} };
 const choose=()=>{Object.defineProperty(picker,'files',{configurable:true,value:[new File(['x'],'data.json')]});fire(picker,'change');};
 try {
   choose(); click(btnByLabel(app,'Look up value')); pending[0].result=new TextEncoder().encode('{"late":1}').buffer; pending[0].onload(); await new Promise(r=>setTimeout(r,0)); assert.match(editor.value,/9007199254740993/);
   choose(); editor.value='{"manual":true}'; fire(editor,'input'); pending[1].result=new TextEncoder().encode('{}').buffer; pending[1].onload(); await new Promise(r=>setTimeout(r,0)); assert.equal(editor.value,'{"manual":true}');
   choose(); pending[2].result=new Uint8Array([255]).buffer; pending[2].onload(); await new Promise(r=>setTimeout(r,0)); assert.equal(editor.value,'{"manual":true}'); assert.match(app.textContent,/not valid UTF-8/);
 } finally {global.FileReader=saved;}
});
await domTest('HTML editor opt-in Tab inserts spaces and keeps Shift+Tab navigation', async () => {
 const app=await loadToolPage('html-live-preview','developer'), code=app.querySelector('textarea'), toggle=[...app.querySelectorAll('label.switch')].find(el=>el.textContent.includes('Tab inserts spaces')).querySelector('input');
 code.value='abcd';code.setSelectionRange(1,3);let ev=new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});code.dispatchEvent(ev);assert.equal(ev.defaultPrevented,false);assert.equal(code.value,'abcd');
 toggle.checked=true;ev=new window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});code.dispatchEvent(ev);assert.equal(ev.defaultPrevented,true);assert.equal(code.value,'a  d');assert.equal(code.selectionStart,3);
 ev=new window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true});code.dispatchEvent(ev);assert.equal(ev.defaultPrevented,false);
});
await domTest('JSON tree search shows matching ancestors and restores expansion', async () => {
 const app=await loadToolPage('json-formatter','developer'), code=app.querySelector('textarea');code.value='{"outer":{"big":9007199254740993},"other":1}';fire(code,'input');click(btnByLabel(app,'View tree'));
 const tree=app.querySelector('.json-tree'), details=tree.querySelectorAll('details'), search=tree.querySelector('input[type=search]');assert.equal(details[1].open,false);
 search.value='9007199254740993';fire(search,'input');assert.equal(details[1].open,true);assert.equal(tree.querySelectorAll('.json-tree-value[hidden]').length,1);assert.match(tree.textContent,/1 matching item/);
 search.value='missing';fire(search,'input');assert.match(tree.textContent,/0 matching items/);search.value='';fire(search,'input');assert.equal(details[1].open,false);assert.equal(tree.querySelectorAll('[hidden]').length,0);
});

/* ═════════════════ summary ═════════════════ */
console.log(`\n══════════════════════════════════`);
console.log(`DOM tests: ${passed} passed, ${failed} failed`);
if (consoleErrors.length) console.log(`Console errors captured: ${consoleErrors.length}\n${consoleErrors.slice(0, 5).join('\n')}`);
if (failed) {
  for (const [name, e] of failures) console.error(`\nFAILED: ${name}\n${e.stack}`);
  process.exit(1);
}
