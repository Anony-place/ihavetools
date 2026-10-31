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

/* ---------- Favourites & recently used (localStorage, this device only) ----------
   Starred tools and the last-used list live in THIS browser only — no
   account, no server, nothing tracked. The homepage renders two personal
   sections from them; every card and tool page carries a star toggle. */
const FAV_KEY = 'iht-favourites';
const RECENT_KEY = 'iht-recent';
const RECENT_CAP = 12;

/** Pure: add id (front) or remove it. Exported for tests. */
export function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list];
}
/** Pure: most-recent-first, de-duplicated, capped. Exported for tests. */
export function pushRecentId(list, id, cap = RECENT_CAP) {
  return [id, ...list.filter((x) => x !== id)].slice(0, cap);
}
function readStoredList(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}
function writeStoredList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* private mode */ }
}

function syncFavButtons(favs) {
  $$('[data-fav-toggle]').forEach((btn) => {
    const on = favs.includes(btn.dataset.favToggle);
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Remove from favourites' : 'Save to favourites';
    const label = btn.querySelector('[data-fav-label]');
    if (label) label.textContent = on ? 'Remove from favourites' : 'Add to favourites';
  });
}

function personalCard(entry) {
  return h('div', { class: 'tool-card-shell' },
    h('a', { class: 'tool-card', href: `/tools/${entry.id}/` },
      h('span', { class: 'tool-icon', html: icon(entry.icon) }),
      h('h3', { text: entry.name }),
      h('span', { class: 'card-meta' }, h('span', { text: entry.c }), h('span', { class: 'go', text: 'Open →' }))),
    h('button', { type: 'button', class: 'fav-toggle', dataset: { favToggle: entry.id }, 'aria-pressed': 'false', 'aria-label': `Save ${entry.name} to favourites`, html: icon('star') }));
}

async function renderPersonalSections() {
  const favSection = $('#favourites-section');
  const recentSection = $('#recent-section');
  if (!favSection && !recentSection) return;
  const favs = readStoredList(FAV_KEY);
  const recent = readStoredList(RECENT_KEY);
  if (!favs.length && !recent.length) {
    if (favSection) favSection.hidden = true;
    if (recentSection) recentSection.hidden = true;
    return;
  }
  const byId = new Map((await loadSearchIndex()).map((e) => [e.id, e]));
  const fill = (section, gridSel, ids) => {
    if (!section) return;
    const grid = $(gridSel, section);
    if (!grid) return;
    const entries = ids.map((id) => byId.get(id)).filter(Boolean);
    grid.replaceChildren(...entries.map(personalCard));
    section.hidden = entries.length === 0;
  };
  fill(favSection, '#favourites-grid', favs);
  fill(recentSection, '#recent-grid', recent);
  syncFavButtons(favs);
}

export function initFavourites() {
  syncFavButtons(readStoredList(FAV_KEY));
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('[data-fav-toggle]') : null;
    if (!btn || !btn.dataset.favToggle) return;
    e.preventDefault();
    const next = toggleId(readStoredList(FAV_KEY), btn.dataset.favToggle);
    writeStoredList(FAV_KEY, next);
    syncFavButtons(next);
    renderPersonalSections();
  });
  renderPersonalSections();
}

export function initRecents() {
  const app = $('#tool-app[data-tool-id]');
  if (!app || !app.dataset.toolId) return;
  writeStoredList(RECENT_KEY, pushRecentId(readStoredList(RECENT_KEY), app.dataset.toolId));
}

/* ---------- Share: copy a link to this page ---------- */
export function initShare() {
  $$('[data-copy-link]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const label = btn.querySelector('[data-copy-label]') || btn;
      const original = label.textContent;
      try {
        await navigator.clipboard.writeText(location.href);
        label.textContent = 'Link copied ✓';
      } catch {
        label.textContent = 'Copy failed — use the address bar';
      }
      setTimeout(() => { label.textContent = original; }, 2200);
    });
  });
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

// Guarded so the module's pure helpers can be imported and unit-tested in
// Node (where there is no document). In the browser this always runs.
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    buildChrome();
    initTheme();
    initMobileNav();
    initDropdowns();
    initFooter();
    initSW();
    setupSearch();
    initFavourites();
    initRecents();
    initShare();
  });
}
