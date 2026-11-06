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
await domTest('sip-calculator: a shared link pre-fills inputs, auto-runs, and URL stays in sync', async () => {
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
  assert.match(document.defaultView.location.search, /monthly=7000/, 'recalculating must sync the URL so Copy link shares the latest result');
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
  assert.match(statusText(document), /not a valid absolute URL/);
  ta.value = 'https://a.b/\nhttps://a.c/d';
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
await domTest('csv-to-json: quoted values convert correctly', async () => {
  const app = await loadToolPage('csv-to-json', 'data');
  click(btnByLabel(app, 'Convert to JSON'));
  const out = resultText(document);
  assert.match(out, /"role": "Admiral, USN"/);
  assert.match(statusText(document), /2 records converted/);
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
  const stsd = box('stsd', [...u32(0), ...u32(1), ...u32(16), ...enc('avc1')]);
  const stbl = box('stbl', [...stsd]);
  const minf = box('minf', [...stbl]);
  const mdia = box('mdia', [...mdhd, ...minf]);
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
  assert.match(resultText(document), /color: red;/);
});
await domTest('html-formatter: minify output', async () => {
  const app = await loadToolPage('html-formatter', 'developer');
  const ta = app.querySelector('textarea');
  ta.value = '<div>\n<p>hi</p>\n</div>';
  click(btnByLabel(app, 'Minify'));
  assert.equal(resultText(document).trim(), '<div><p>hi</p></div>');
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
  click(app.querySelector('[aria-label="Remove page 2"]'));
  click(app.querySelector('[aria-label="Move page 3 up"]'));
  click(app.querySelector('[aria-label="Rotate page 3 clockwise"]'));
  let output; const original = URL.createObjectURL; URL.createObjectURL = (blob) => { output = blob; return 'blob:test'; };
  try { click(btnByLabel(app, 'Export organized PDF')); await new Promise(r => setTimeout(r, 100));
    assert.ok(output, 'download was not created'); const result = await lib.PDFDocument.load(await output.arrayBuffer());
    assert.equal(result.getPageCount(), 2); assert.equal(result.getPage(0).getWidth(), 300); assert.equal(result.getPage(0).getRotation().angle, 90);
    click(btnByLabel(app, 'Restore original')); assert.equal(app.querySelectorAll('.file-row').length, 3);
  } finally { URL.createObjectURL = original; }
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

console.log('\n── Batch-10 UIs ──');
for (const [id, query, expected] of [
 ['budget-calculator','?income=50000&needs=24000&wants=16000&savings=8000',/25,000\.00Needs target.*15,000\.00Wants target.*10,000\.00Savings target.*2,000\.00Unallocated/s],
 ['emergency-fund-calculator','?monthly=25000&months=6&saved=50000&contribution=10000',/150,000\.00Fund target.*100,000\.00Still needed.*10Months to reach goal/s],
 ['debt-to-income-calculator','?income=100000&debts=35000',/35\.00%Debt-to-income ratio.*65,000\.00Income less debt/s],
 ['break-even-calculator','?fixed=10000&price=100&variable=60',/40\.00Contribution per unit.*250Break-even whole units.*25,000\.00Sales/s],
]) { await domTest(`${id}: shared result, edit and invalid input`,async()=>{
 const app=await loadToolPage(id,'calculators',query); assert.match(app.textContent,expected);
 const first=app.querySelector('input'); first.value=''; click(btnByLabel(app,'Calculate')); assert.match(app.textContent,/must be|valid/i); assert.doesNotMatch(app.textContent,expected);
 first.value=id==='debt-to-income-calculator'?'100000':'100'; fire(first,'input'); click(btnByLabel(app,'Calculate')); await new Promise(r=>setTimeout(r,10)); assert.equal(new URL(window.location.href).searchParams.get(first===app.querySelector('input') ? (id==='budget-calculator'||id==='debt-to-income-calculator'?'income':id==='emergency-fund-calculator'?'monthly':'fixed'):'none'), first.value);
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

/* ═════════════════ summary ═════════════════ */
console.log(`\n══════════════════════════════════`);
console.log(`DOM tests: ${passed} passed, ${failed} failed`);
if (consoleErrors.length) console.log(`Console errors captured: ${consoleErrors.length}\n${consoleErrors.slice(0, 5).join('\n')}`);
if (failed) {
  for (const [name, e] of failures) console.error(`\nFAILED: ${name}\n${e.stack}`);
  process.exit(1);
}
