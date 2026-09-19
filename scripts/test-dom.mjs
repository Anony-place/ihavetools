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
    url: 'https://ihavetools.web.app/',
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

/* Load one tool page into the shared jsdom and mount its module. */
async function loadToolPage(toolId, moduleName) {
  const html = readFileSync(join(ROOT, 'tools', toolId, 'index.html'), 'utf8');
  document.open(); document.write(html); document.close();
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

/* ═════════════════ summary ═════════════════ */
console.log(`\n══════════════════════════════════`);
console.log(`DOM tests: ${passed} passed, ${failed} failed`);
if (consoleErrors.length) console.log(`Console errors captured: ${consoleErrors.length}\n${consoleErrors.slice(0, 5).join('\n')}`);
if (failed) {
  for (const [name, e] of failures) console.error(`\nFAILED: ${name}\n${e.stack}`);
  process.exit(1);
}
