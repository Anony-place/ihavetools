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

/* ---------- Tool search (homepage, header and 404) — lazy slim index ---------- */
let indexPromise = null;
function loadSearchIndex() {
  if (!indexPromise) {
    indexPromise = import('./search-index.js')
      .then((m) => m.SEARCH_INDEX || [])
      .catch((error) => { indexPromise = null; throw error; });
  }
  return indexPromise;
}

// Keep search bounded and deterministic; normalize punctuation without regex
// interpolation or fuzzy matches that silently drop a user's terms.
export const MAX_SEARCH_QUERY = 256;
const SEARCH_FILLER = new Set(['a', 'an', 'the', 'my', 'free', 'online', 'tool', 'tools', 'file', 'files', 'calculate', 'convert']);
const normalizeSearch = value => String(value).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{M}\p{N}+#]+/gu, ' ').trim().replace(/\s+/g, ' ');
export function searchIndex(index, query, limit = 8) {
  if (String(query).length > MAX_SEARCH_QUERY) return [];
  const q = normalizeSearch(query);
  if (!q) return [];
  // Retain directional "to" and all unrecognized terms. Only discard this
  // explicit set if no full query matches; never fuzzy-match missing intent.
  const core = q.replace(/^how to /, '').split(' ').filter(t => !SEARCH_FILLER.has(t));
  const coreQuery = core.join(' ');
  const rank = (terms) => index.map((entry, position) => {
    const name = normalizeSearch(entry.name);
    const aliases = (entry.a || []).map(normalizeSearch);
    const hay = normalizeSearch(`${entry.name} ${entry.k} ${entry.c} ${entry.cats || ''}`);
    let score = 0;
    for (const term of terms) {
      if (!hay.includes(term)) return null;
      score += name.includes(term) ? 30 : 10;
    }
    // Ordered phrases distinguish e.g. CSV to JSON from JSON to CSV.
    if (name === q) score += 2000;
    else if (name.includes(q)) score += 1000;
    else if (aliases.includes(q)) score += 900;
    else if (aliases.some(alias => alias.includes(q))) score += 400;
    if (coreQuery && coreQuery !== q) {
      if (name === coreQuery) score += 800;
      else if (name.includes(coreQuery)) score += 700;
      else if (aliases.includes(coreQuery)) score += 650;
      else if (aliases.some(alias => alias.includes(coreQuery))) score += 300;
      else if (hay.includes(coreQuery)) score += 100;
    }
    score += (entry.p || 0) * 0.05;
    return { entry, score, position };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.position - b.position);
  let matches = rank(q.split(' '));
  if (!matches.length && core.length && coreQuery !== q) matches = rank(core);
  return matches.slice(0, Math.max(0, limit)).map(item => item.entry);
}

function setupSearch() {
  const box = $('.search-box');
  if (!box) return;
  const input = $('#global-search', box);
  const list = $('.search-results', box);
  if (!input || !list) return;
  const status = $('.search-status', box);
  const launch = $('.mobile-search-launch');
  let active = -1, results = [], revision = 0;

  const close = () => {
    revision++; list.hidden = true; active = -1; results = [];
    input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    if (status) status.textContent = '';
  };
  const setActive = (i) => {
    active = i;
    $$('[role="option"]', list).forEach((option, index) => {
      const selected = index === i;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-selected', String(selected));
    });
    const option = i >= 0 ? list.querySelector(`#search-option-${i}`) : null;
    if (option) { input.setAttribute('aria-activedescendant', option.id); option.scrollIntoView?.({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  };
  const render = (items, q) => {
    results = items; active = -1;
    if (!q.trim()) { close(); return; }
    list.replaceChildren(...(items.length
      ? items.map((t, i) => h('li', { role: 'presentation' }, h('a', {
          href: `/tools/${t.id}/`, id: `search-option-${i}`, role: 'option', 'aria-selected': 'false', tabindex: '-1',
          onmouseenter: () => setActive(i),
        },
          h('span', { html: icon(t.icon), style: 'display:inline-flex;color:var(--text-3)', 'aria-hidden': 'true' }),
          h('span', { class: 'search-result-name', text: t.name }),
          h('span', { class: 'sr-cat', text: t.c }))))
      : [h('li', { class: 'no-results', role: 'option', 'aria-disabled': 'true', 'aria-selected': 'false', text: `No tools match “${q}”. Try “json”, “image” or “password”.` })]));
    input.removeAttribute('aria-activedescendant'); list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (status) status.textContent = items.length ? `${items.length} matching tools. Use arrow keys to choose.` : 'No matching tools.';
  };
  const runSearch = async (token = ++revision) => {
    if (token !== revision) return;
    const query = input.value;
    if (!query.trim()) { close(); return; }
    if (query.length > MAX_SEARCH_QUERY) {
      results = []; list.replaceChildren(h('li', {class:'no-results', role:'option', 'aria-disabled':'true', 'aria-selected':'false', text:`Search is limited to ${MAX_SEARCH_QUERY} characters. Shorten your query.`}));
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
      if (status) status.textContent = `Search is limited to ${MAX_SEARCH_QUERY} characters.`;
      return;
    }
    try {
      const index = await loadSearchIndex();
      if (token !== revision || input.value !== query) return;
      render(searchIndex(index, query, 8), query);
    } catch {
      if (token !== revision) return;
      results = []; list.replaceChildren(h('li', {class:'no-results', role:'option', 'aria-disabled':'true', 'aria-selected':'false', text:'Search could not load. Check your connection and try again.'}));
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
      if (status) status.textContent = 'Search could not load. Check your connection and try again.';
    }
  };
  const run = debounce((token) => runSearch(token), 90);
  input.addEventListener('input', () => {
    const token = ++revision;
    results = []; active = -1; list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    if (status) status.textContent = '';
    if (!input.value.trim()) { close(); return; }
    run(token);
  });
  input.addEventListener('focus', () => { if (input.value.trim()) runSearch(); else loadSearchIndex().catch(() => {}); });
  input.addEventListener('keydown', (e) => {
    if (list.hidden && ['ArrowDown', 'ArrowUp'].includes(e.key) && input.value.trim()) { e.preventDefault(); runSearch(); return; }
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive(Math.min(active + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter') {
      const target = results[active >= 0 ? active : 0];
      if (target) { e.preventDefault(); location.href = `/tools/${target.id}/`; }
    } else if (e.key === 'Escape') { close(); if (box.classList.contains('is-open')) { box.classList.remove('is-open'); launch?.setAttribute('aria-expanded', 'false'); launch?.focus(); } }
  });
  if (launch) launch.addEventListener('click', (e) => {
    e.preventDefault();
    const open = box.classList.toggle('is-open');
    launch.setAttribute('aria-expanded', String(open));
    if (open) input.focus(); else { close(); launch.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && !launch?.contains(e.target)) {
      close(); box.classList.remove('is-open'); launch?.setAttribute('aria-expanded', 'false');
    }
  });
  box.addEventListener('focusout', () => setTimeout(() => { if (!box.contains(document.activeElement) && document.activeElement !== launch) close(); }, 0));

  // "/" or Ctrl/⌘+K focuses search; prefill from ?q=
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
      if (document.activeElement !== input) { e.preventDefault(); if (launch && matchMedia('(max-width: 900px)').matches) { box.classList.add('is-open'); launch.setAttribute('aria-expanded', 'true'); } input.focus(); input.select(); }
    }
  });
  const q = new URLSearchParams(location.search).get('q');
  if (q) { input.value = q; runSearch(); }
  else if ('requestIdleCallback' in window) requestIdleCallback(() => loadSearchIndex().catch(() => {}), { timeout: 2500 });
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
  let index;
  try { index = await loadSearchIndex(); } catch { return; }
  const byId = new Map(index.map((e) => [e.id, e]));
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
        const page = new URL(location.href); page.search = ''; page.hash = '';
        await navigator.clipboard.writeText(page.href);
        label.textContent = 'Link copied ✓';
      } catch {
        label.textContent = 'Copy failed — remove any query or fragment before sharing';
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

/* ---------- Optional native install ----------
   Listen immediately: the browser may fire before DOMContentLoaded. */
let installPrompt = null;
function showInstall() {
  const button = $('.install-app');
  if (button) button.hidden = !installPrompt;
}
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    showInstall();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; showInstall(); });
}
export function initInstall() {
  const button = $('.install-app');
  if (!button) return;
  showInstall();
  button.addEventListener('click', async () => {
    const prompt = installPrompt;
    if (!prompt) return;
    installPrompt = null;
    showInstall();
    try { await prompt.prompt(); } catch { /* Browser declined or prompt expired. */ }
  });
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
    initInstall();
    setupSearch();
    initFavourites();
    initRecents();
    initShare();
  });
}
