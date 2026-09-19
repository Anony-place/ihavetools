// =============================================================================
// iHaveTools — shared page behavior: theme, mobile navigation, global search.
// Loaded by every page. Homepage additionally gets the live search dropdown.
// =============================================================================
import { icon, brandMark } from './icons.js';
import { searchTools, categories, categoryById, toolsByCategory, popularTools } from './registry.js';
import { debounce } from './ui.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

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

/* ---------- Build header navigation (injected to keep pages in sync) ---------- */
export function buildChrome({ home = false } = {}) {
  const nav = $('.main-nav');
  if (nav && !nav.dataset.built) {
    nav.dataset.built = '1';
    const drop = h('details', { class: 'nav-drop' },
      h('summary', {}, 'Categories ', h('span', { html: icon('arrow-down'), style: 'display:inline-flex;width:14px' })),
      h('div', { class: 'dropdown-panel' },
        categories.map((c) => h('a', { href: `/categories/${c.id}/` },
          h('span', { html: icon(c.icon), style: 'display:inline-flex' }),
          c.name,
          h('span', { class: 'dd-count', text: String(toolsByCategory(c.id).length) })))));
    nav.append(drop);
    nav.append(h('a', { href: '/#all-tools', text: 'All tools' }));
    nav.append(h('a', { href: '/#about', text: 'About' }));
  }
  const actions = $('.header-actions');
  if (actions && !actions.dataset.built) {
    actions.dataset.built = '1';
    actions.append(h('button', { class: 'icon-btn theme-toggle', type: 'button' }));
    if (!home) {
      const jump = h('a', { class: 'btn btn-secondary btn-sm hide-sm', href: '/', 'aria-label': 'Search all tools', style: 'gap:7px' },
        h('span', { html: icon('search'), style: 'display:inline-flex' }), 'Search');
      actions.append(jump);
    }
    const mt = h('button', { class: 'nav-toggle', type: 'button', 'aria-expanded': 'false', 'aria-label': 'Open menu', html: icon('menu') });
    actions.append(mt);
  }
  const mobile = $('.mobile-nav');
  if (mobile && !mobile.dataset.built) {
    mobile.dataset.built = '1';
    mobile.append(h('h3', { text: 'Popular tools' }));
    mobile.append(h('ul', {}, popularTools(6).map((t) => h('li', {}, h('a', { href: `/tools/${t.id}/` },
      h('span', { html: icon(t.icon), style: 'display:inline-flex' }), t.name)))));
    mobile.append(h('h3', { text: 'Categories' }));
    mobile.append(h('ul', {}, categories.map((c) => h('li', {}, h('a', { href: `/categories/${c.id}/` },
      h('span', { html: icon(c.icon), style: 'display:inline-flex' }), c.name)))));
  }
  // replace static brand svg if present
  const mark = $('.brand-mark');
  if (mark && !mark.dataset.built) { mark.dataset.built = '1'; mark.outerHTML = brandMark('brand-mark'); }
}

/* ---------- Global search (homepage dropdown) ---------- */
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
          h('span', {}, h('strong', { text: t.name }), h('div', { class: 'sr-cat-inline', style: 'font-size:.76rem;color:var(--text-3)', text: categoryById.get(t.categories[0])?.name || '' })),
          h('span', { class: 'sr-cat', text: categoryById.get(t.categories[0])?.name || '' }))))
      : [h('li', { class: 'no-results', text: `No tools match “${q}”. Try “json”, “image” or “password”.` })]));
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const setActive = (i) => {
    active = i;
    $$('a', list).forEach((a) => a.classList.toggle('active', Number(a.dataset.i) === i));
  };
  const run = debounce(() => render(searchTools(input.value, 8), input.value), 90);

  input.addEventListener('input', run);
  input.addEventListener('focus', () => { if (input.value.trim()) render(searchTools(input.value, 8), input.value); });
  input.addEventListener('keydown', (e) => {
    if (list.hidden && ['ArrowDown', 'ArrowUp'].includes(e.key) && input.value.trim()) { render(searchTools(input.value, 8), input.value); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter') {
      const target = results[active >= 0 ? active : 0];
      if (target) { location.href = `/tools/${target.id}/`; }
    } else if (e.key === 'Escape') close();
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) close(); });

  // "/" focuses search; prefill from ?q=
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault(); input.focus();
    }
  });
  const q = new URLSearchParams(location.search).get('q');
  if (q) { input.value = q; render(searchTools(q, 8), q); }
}

/* ---------- Footer year ---------- */
function initFooter() {
  const y = $('#footer-year');
  if (y) y.textContent = String(new Date().getFullYear());
}

/* ---------- Service worker (production hosts only) ---------- */
function initSW() {
  if (!location.hostname.endsWith('.web.app') && !location.hostname.endsWith('.firebaseapp.com')) return;
  if (!('serviceWorker' in navigator)) return;
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
  const home = document.body.classList.contains('page-home');
  buildChrome({ home });
  initTheme();
  initMobileNav();
  initDropdowns();
  initFooter();
  initSW();
  if (home) setupSearch();
});
