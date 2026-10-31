// =============================================================================
// iHaveTools — shared page behaviour: theme, mobile navigation, dropdowns,
// footer year, service worker and (where a search box exists) tool search.
//
// Performance note: this module intentionally does NOT import the full tool
// registry any more. The header/footer are static HTML (built by
// scripts/build.mjs), and search runs on a slim generated index
// (search-index.js) that is loaded lazily — on first search interaction or
// when the browser is idle. Tool pages therefore ship ~80 KB less JS.
// =============================================================================
import { icon, brandMark } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('iht-theme', theme); } catch { /* private mode */ }
  $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', theme === 'dark' ? '#0b0d12' : '#4f46e5'));
  $$('.theme-toggle').forEach((b) => {
    b.innerHTML = icon(theme === 'dark' ? 'sun' : 'moon');
    b.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  });
}
export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('iht-theme'); } catch { /* ignore */ }
  const initial = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(initial);
  $$('.theme-toggle').forEach((b) => b.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }));
}

/* ---------- Mobile navigation ---------- */
export function initMobileNav() {
  const toggle = $('.nav-toggle');
  const panel = $('.mobile-nav');
  if (!toggle || !panel) return;
  toggle.addEventListener('click', () => {
    const open = panel.hasAttribute('open');
    if (open) panel.removeAttribute('open');
    else panel.setAttribute('open', '');
    toggle.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { panel.removeAttribute('open'); toggle.setAttribute('aria-expanded', 'false'); } });
}

/* ---------- Category dropdown (close on outside click / Escape) ---------- */
export function initDropdowns() {
  $$('details.nav-drop').forEach((d) => {
    document.addEventListener('click', (e) => { if (d.open && !d.contains(e.target)) d.removeAttribute('open'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && d.open) d.removeAttribute('open'); });
  });
}

/* ---------- Header chrome ----------
   The header, nav, toggles and mobile menu are now static HTML from the
   build (crawlable, zero layout shift). This stays as a safety net for any
   legacy page whose brand mark is still an empty placeholder span. */
export function buildChrome() {
  const mark = $('.brand-mark');
  if (mark && mark.tagName === 'SPAN' && !mark.dataset.built) {
    mark.dataset.built = '1';
    mark.outerHTML = brandMark('brand-mark');
  }
}

/* ---------- Tool search (homepage + 404) — lazy slim index ---------- */
let indexPromise = null;
function loadSearchIndex() {
  if (!indexPromise) {
    indexPromise = import('./search-index.js')
      .then((m) => m.SEARCH_INDEX || [])
      .catch(() => { indexPromise = null; return []; });
  }
  return indexPromise;
}

function scoreEntry(entry, terms) {
  const name = entry.name.toLowerCase();
  const hay = `${name} ${entry.k.toLowerCase()} ${entry.c.toLowerCase()}`;
  let score = 0;
  for (const term of terms) {
    let t = 0;
    if (name === term) t = 220;
    else if (name.startsWith(term)) t = 150;
    else if (name.includes(term)) t = 110;
    else if (hay.includes(term)) t = 60;
    if (t === 0) return 0; // every term must match somewhere
    score = Math.max(score, t) + t * 0.1;
  }
  return score + entry.p * 0.05;
}

function searchIndex(index, query, limit = 8) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return index
    .map((e) => [scoreEntry(e, terms), e])
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([, e]) => e);
}

function setupSearch() {
  const box = $('.search-box');
  if (!box) return;
  const input = $('#global-search', box);
  const list = $('.search-results', box);
  if (!input || !list) return;
  let active = -1;
  let results = [];

  const close = () => { list.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); };
  const render = (items, q) => {
    results = items;
    active = -1;
    if (!q.trim()) { close(); return; }
    list.replaceChildren(...(items.length
      ? items.map((t, i) => h('li', {}, h('a', {
          href: `/tools/${t.id}/`, dataset: { i: String(i) },
          onmouseenter: () => setActive(i),
        },
          h('span', { html: icon(t.icon), style: 'display:inline-flex;color:var(--text-3)' }),
          h('span', {}, h('strong', { text: t.name }), h('div', { class: 'sr-cat-inline', style: 'font-size:.76rem;color:var(--text-3)', text: t.c })),
          h('span', { class: 'sr-cat', text: t.c }))))
      : [h('li', { class: 'no-results', text: `No tools match “${q}”. Try “json”, “image” or “password”.` })]));
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const setActive = (i) => {
    active = i;
    $$('a', list).forEach((a) => a.classList.toggle('active', Number(a.dataset.i) === i));
  };
  const runSearch = () => loadSearchIndex().then((index) => render(searchIndex(index, input.value, 8), input.value));
  const run = debounce(runSearch, 90);

  input.addEventListener('input', run);
  input.addEventListener('focus', () => { loadSearchIndex(); if (input.value.trim()) runSearch(); });
  input.addEventListener('keydown', (e) => {
    if (list.hidden && ['ArrowDown', 'ArrowUp'].includes(e.key) && input.value.trim()) { runSearch(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter') {
      const target = results[active >= 0 ? active : 0];
      if (target) { location.href = `/tools/${target.id}/`; }
    } else if (e.key === 'Escape') close();
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) close(); });

  // "/" or Ctrl/⌘+K focuses search; prefill from ?q=
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
      if (document.activeElement !== input) { e.preventDefault(); input.focus(); input.select(); }
    }
  });
  const q = new URLSearchParams(location.search).get('q');
  if (q) { input.value = q; runSearch(); }
  else if ('requestIdleCallback' in window) requestIdleCallback(() => loadSearchIndex(), { timeout: 2500 });
}

/* ---------- Footer year ---------- */
function initFooter() {
  const y = $('#footer-year');
  if (y) y.textContent = String(new Date().getFullYear());
}

/* ---------- Service worker ----------
   Registered from the domain root (/sw.js) on real HTTPS hosts — a worker
   under /assets/ could only control /assets/ pages, which is useless.
   Localhost and ephemeral preview hosts are skipped so development and
   previews never serve stale files. */
function initSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:') return;
  if (/^(localhost|127\.)/.test(location.hostname) || location.hostname.endsWith('.e2b.app')) return;
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
}

document.addEventListener('DOMContentLoaded', () => {
  buildChrome();
  initTheme();
  initMobileNav();
  initDropdowns();
  initFooter();
  initSW();
  setupSearch();
});
