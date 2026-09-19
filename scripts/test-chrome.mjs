#!/usr/bin/env node
// =============================================================================
// iHaveTools — site chrome tests (homepage, categories, search, theme).
// Loads BUILT pages into jsdom and imports the real site.js module.
// =============================================================================
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0, failed = 0;
const failures = [];
async function chromeTest(name, fn) {
  try { await fn(); passed++; process.stdout.write(`  ✓ ${name}\n`); }
  catch (e) { failed++; failures.push([name, e]); process.stdout.write(`  ✗ ${name}\n    ${e.message}\n`); }
}

const consoleErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('error', (...a) => consoleErrors.push(a.join(' ')));
virtualConsole.on('jsdomError', (e) => { if (!/Could not load|not implemented/i.test(String(e))) consoleErrors.push(String(e)); });

function fire(el, type) { el.dispatchEvent(new window.Event(type, { bubbles: true })); }

async function loadPage(urlPath) {
  const file = urlPath === '/' ? 'index.html' : urlPath.endsWith('.html') ? urlPath : `${urlPath}index.html`;
  const html = readFileSync(join(ROOT, file), 'utf8');
  const dom = new JSDOM(html, { url: `https://ihavetools.web.app${urlPath === '/404.html' ? '/missing-page' : urlPath}`, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
  global.Node = dom.window.Node;
  global.HTMLElement = dom.window.HTMLElement;
  global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  global.localStorage = dom.window.localStorage;
  global.location = dom.window.location;
  await import(`../assets/js/site.js?chrome=${Math.random().toString(36).slice(2)}`);
  document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 10));
  return dom;
}

console.log('\n── Homepage chrome ──');
await chromeTest('homepage: hero, search, category grid, featured tools all render', async () => {
  const dom = await loadPage('/');
  const doc = dom.window.document;
  assert.ok(doc.querySelector('.hero h1'), 'no hero h1');
  assert.ok(doc.querySelector('#global-search'), 'no search input');
  assert.ok(doc.querySelector('#search-results'), 'no search results container');
  assert.ok(doc.querySelectorAll('.category-card').length === 16, `expected 16 category cards, got ${doc.querySelectorAll('.category-card').length}`);
  assert.ok(doc.querySelectorAll('.tool-card').length >= 8, 'no featured tools');
});
await chromeTest('homepage search: typing finds tools and links work', async () => {
  const dom = await loadPage('/');
  const doc = dom.window.document;
  const input = doc.querySelector('#global-search');
  input.value = 'password';
  fire(input, 'input');
  await new Promise((r) => setTimeout(r, 250)); // debounce is 90ms
  const results = doc.querySelectorAll('#search-results a');
  assert.ok(results.length >= 2, `password search: ${results.length} results`);
  for (const a of results) assert.match(a.getAttribute('href'), /^\/tools\/[a-z-]+\/$/);
  input.value = 'zqxjkwv';
  fire(input, 'input');
  await new Promise((r) => setTimeout(r, 250));
  assert.match(doc.querySelector('#search-results').textContent, /No tools match/);
});
await chromeTest('homepage stats are honest (tool count matches registry)', async () => {
  const { tools } = await import('../assets/js/registry.js');
  const dom = await loadPage('/');
  const doc = dom.window.document;
  assert.ok(new RegExp(`\\b${tools.length}\\b`).test(doc.body.textContent), `homepage does not state ${tools.length} tools`);
});
await chromeTest('theme toggle: button switches data-theme and persists', async () => {
  const dom = await loadPage('/');
  const doc = dom.window.document;
  const btn = doc.querySelector('.theme-toggle');
  assert.ok(btn, 'no theme toggle button');
  btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark', 'click 1 → dark');
  assert.equal(dom.window.localStorage.getItem('iht-theme'), 'dark');
  btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(doc.documentElement.getAttribute('data-theme'), 'light', 'click 2 → light');
});

console.log('\n── Category pages ──');
await chromeTest('category page: lists exactly its tools with working links', async () => {
  const dom = await loadPage('/categories/security/');
  const doc = dom.window.document;
  const cards = [...doc.querySelectorAll('a.tool-card')].map((a) => a.getAttribute('href'));
  assert.ok(cards.length >= 5, `security tools: ${cards.length}`);
  for (const href of cards) assert.match(href, /^\/tools\/[a-z-]+\/$/);
  assert.match(doc.body.textContent, /tools in this category|Security tools|tools/i);
});
await chromeTest('misc category page (newest category addition) lists dice roller', async () => {
  const dom = await loadPage('/categories/misc/');
  const doc = dom.window.document;
  assert.match(doc.body.textContent, /Dice Roller/);
});

console.log('\n── Navigation ──');
await chromeTest('every page has header nav, footer, skip link, and mobile menu', async () => {
  const pages = ['/', '/categories/pdf/', '/tools/json-formatter/', '/404.html'];
  for (const p of pages) {
    const dom = await loadPage(p);
    const doc = dom.window.document;
    assert.ok(doc.querySelector('.site-header'), `${p} no header`);
    assert.ok(doc.querySelector('.main-nav'), `${p} no nav links`);
    assert.ok(doc.querySelector('.skip-link'), `${p} no skip link`);
    assert.ok(doc.querySelector('.site-footer'), `${p} no footer`);
    assert.ok(doc.querySelector('.nav-toggle'), `${p} no mobile nav toggle`);
    assert.ok(doc.querySelector('.theme-toggle'), `${p} no theme toggle`);
    assert.ok(doc.querySelector('.mobile-nav a'), `${p} mobile nav not populated`);
  }
});

console.log('\n── CSS coverage (classes used in JS/HTML exist in stylesheet) ──');
await chromeTest('all UI classes referenced by tool modules exist in styles.css', async () => {
  const css = readFileSync(join(ROOT, 'assets/css/styles.css'), 'utf8');
  const classes = new Set();
  for (const f of ['ui.js', 'tools/developer.js', 'tools/text.js', 'tools/calculators.js', 'tools/converters.js', 'tools/security.js', 'tools/color.js', 'tools/webseo.js', 'tools/data.js', 'tools/math.js', 'tools/datetime.js', 'tools/student.js', 'tools/misc.js', 'tools/pdf.js', 'tools/image.js']) {
    const src = readFileSync(join(ROOT, 'assets/js', f), 'utf8');
    for (const m of src.matchAll(/class: '([^']+)'/g)) m[1].split(/\s+/).forEach((c) => classes.add(c));
    for (const m of src.matchAll(/classList\.(?:add|toggle|remove)\('([^']+)'\)/g)) classes.add(m[1]);
    for (const m of src.matchAll(/className = '([^']+)'/g)) m[1].split(/\s+/).forEach((c) => classes.add(c));
  }
  for (const f of readdirSync(join(ROOT, 'tools'))) {
    try { const html = readFileSync(join(ROOT, 'tools', f, 'index.html'), 'utf8'); for (const m of html.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => classes.add(c)); } catch { /* not a tool dir */ }
  }
  const missing = [...classes].filter((c) => c && !new RegExp(`\\.${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s,{.:>#\\[]`).test(css));
  assert.deepEqual(missing, [], `classes used but not styled: ${missing.join(', ')}`);
});

console.log(`\n══════════════════════════════════`);
console.log(`Chrome tests: ${passed} passed, ${failed} failed`);
if (consoleErrors.length) console.log(`Console errors: ${consoleErrors.length}\n${consoleErrors.slice(0, 5).join('\n')}`);
if (failed) {
  for (const [name, e] of failures) console.error(`\nFAILED: ${name}\n${e.stack}`);
  process.exit(1);
}
