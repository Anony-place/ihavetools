// =============================================================================
// iHaveTools — shared UI toolkit.
// Every tool module composes its interface from these primitives so all tools
// behave consistently (buttons, inputs, results, copy/download, errors, toasts).
// Node-safe: nothing touches `document` at import time.
// =============================================================================
import { icon } from './icons.js';

/* ---------- DOM ---------- */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v; // trusted, developer-authored markup only
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = true;
    else if (k === 'disabled') node.disabled = true;
    else if (k === 'selected') node.selected = true;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function $(sel, root = document) { return root.querySelector(sel); }

/* ---------- Toasts ---------- */
let toastBox = null;
export function toast(msg, kind = '') {
  if (!document.body) return;
  if (!toastBox) { toastBox = h('div', { class: 'toast-container', role: 'status', 'aria-live': 'polite' }); document.body.append(toastBox); }
  const t = h('div', { class: `toast ${kind}`.trim(), text: msg });
  toastBox.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; setTimeout(() => t.remove(), 260); }, 2100);
}

/* ---------- Clipboard & downloads ---------- */
export async function copyText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  let ta;
  try {
    ta = h('textarea', { value: text, 'aria-hidden': 'true' });
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta); ta.select(); ta.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch { return false; } finally { ta?.remove(); }
}

export function copyButton(getText, { label = 'Copy', small = true, onDone } = {}) {
  const b = h('button', { type: 'button', class: `btn btn-secondary${small ? ' btn-sm' : ''}`, 'aria-label': label || 'Copy' }, h('span', { html: icon('copy'), style: 'display:inline-flex' }), label);
  b.addEventListener('click', async () => {
    const text = typeof getText === 'function' ? getText() : getText;
    if (!text) { toast('Nothing to copy yet', 'error'); return; }
    const ok = await copyText(text);
    if (ok) {
      toast('Copied to clipboard', 'success');
      const old = b.innerHTML; b.innerHTML = `${icon('check')} Copied`;
      setTimeout(() => { b.innerHTML = old; }, 1400);
      onDone?.();
    } else toast('Copy failed — your browser blocked clipboard access. Select the text and copy manually.', 'error');
  });
  return b;
}

export function downloadBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch { return false; }
}

export function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  return downloadBlob(new Blob([text], { type: mime }), filename);
}

export function downloadButton(getContent, filename, { label = 'Download', mime = 'text/plain;charset=utf-8', small = true } = {}) {
  const b = h('button', { type: 'button', class: `btn btn-secondary${small ? ' btn-sm' : ''}`, 'aria-label': label || 'Download' }, h('span', { html: icon('download'), style: 'display:inline-flex' }), label);
  b.addEventListener('click', () => {
    try {
      const content = typeof getContent === 'function' ? getContent() : getContent;
      if (!content) { toast('Nothing to download yet', 'error'); return; }
      const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
      if (!downloadBlob(blob, filename)) throw new Error('Could not request a download.');
      toast(`Download requested: ${filename}`, 'success');
    } catch (e) { toast(`Download failed: ${e.message}`, 'error'); }
  });
  return b;
}

/* ---------- Inputs ---------- */
let uid = 0;
export function field({ label, hint, control, id }) {
  id = id || `f${++uid}`;
  const wrap = h('div', { class: 'field' });
  if (label) wrap.append(h('label', { for: id, text: label }));
  if (control) { if (id && control.id !== id) control.id = id; wrap.append(control); }
  if (hint) wrap.append(h('span', { class: 'hint', text: hint }));
  return wrap;
}

export function input(opts = {}) {
  const { type = 'text', value = '', ...rest } = opts;
  return h('input', { class: 'input', type, value, ...rest });
}

export function textarea(opts = {}) {
  const { value = '', rows = 9, mono = true, placeholder = '', spellcheck = false } = opts;
  const ta = h('textarea', { class: `textarea${mono ? ' mono' : ''}`, rows, placeholder, spellcheck: String(spellcheck) });
  ta.value = value;
  return ta;
}

export function select(opts = {}) {
  const { options, value, ...rest } = opts;
  const s = h('select', { class: 'select', ...rest },
    options.map((o) => h('option', { value: o.v, selected: String(o.v) === String(value) ? true : null, text: o.t })));
  return s;
}

export function checkbox({ label, checked = false, onChange } = {}) {
  const cb = h('input', { type: 'checkbox' });
  cb.checked = checked;
  cb.addEventListener('change', () => onChange?.(cb.checked));
  return h('label', { class: 'check' }, cb, label);
}

export function switchChip({ label, checked = false, name }) {
  const input = h('input', { type: 'checkbox' });
  if (name) input.name = name;
  input.checked = checked;
  return h('label', { class: 'switch' }, input, label);
}

export function segControl({ options, value, onChange, ariaLabel = 'Mode' }) {
  const row = h('div', { class: 'seg-row', role: 'group', 'aria-label': ariaLabel });
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', class: 'btn btn-sm', 'aria-pressed': String(o.v === value), dataset: { v: o.v }, text: o.t });
    b.addEventListener('click', () => {
      row.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      onChange?.(o.v);
    });
    row.append(b);
    return b;
  });
  row.getValue = () => row.querySelector('[aria-pressed="true"]')?.dataset.v;
  row.setValue = (v) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  return row;
}

export function btn({ label, variant = 'primary', onClick, id, type = 'button', icon: ic, disabled = false, title }) {
  return h('button', { type, id, class: `btn btn-${variant}`, onClick, disabled, title },
    ic ? h('span', { html: icon(ic), style: 'display:inline-flex' }) : null, label);
}

export function actionsRow(...buttons) { return h('div', { class: 'action-row' }, buttons); }

/* ---------- Results ---------- */
export function resultPanel({ label = 'Result', copy = true, download = null, downloadName = 'result.txt', downloadMime = 'text/plain;charset=utf-8', pre = true, placeholder = 'Result appears here.' } = {}) {
  const body = h('div', { class: 'result-body', tabindex: '0', role: 'region', 'aria-label': `${label} output` });
  const setPre = (content) => {
    body.replaceChildren(h('pre', { text: content ?? '' }));
    panel.dataset.has = content ? '1' : '';
  };
  const panel = h('section', { class: 'result-panel', 'aria-label': label });
  const head = h('div', { class: 'result-head' }, h('span', { class: 'result-label', text: label }), h('span', { class: 'spacer' }));
  if (copy) head.append(copyButton(() => lastText, { onDone: null }));
  if (download) head.append(downloadButton(() => lastText, downloadName, { label: 'Download', mime: downloadMime }));
  panel.append(head, body);
  let lastText = '';
  const api = {
    panel,
    body,
    get text() { return lastText; },
    set(content, { placeholderMode = false } = {}) {
      if (typeof content === 'string') { lastText = placeholderMode ? '' : content; setPre(content); }
      else { lastText = ''; body.replaceChildren(content); panel.dataset.has = '1'; }
    },
    placeholder(text = placeholder) { lastText = ''; body.replaceChildren(h('pre', { class: 'placeholder', text })); delete panel.dataset.has; },
  };
  api.placeholder();
  return api;
}

export function statusLine(initial = '', kind = 'info') {
  const el = h('p', { class: `status-line ${kind}`, role: 'status', 'aria-live': 'polite' });
  el.set = (msg, k = 'info') => { el.className = `status-line ${k}`; el.textContent = msg || ''; };
  if (initial) el.set(initial, kind);
  return el;
}

export function errorBanner(message, detail = '') {
  return h('div', { class: 'error-banner', role: 'alert' },
    h('span', { html: icon('x'), style: 'display:inline-flex' }),
    h('div', {}, h('strong', { text: message }), detail ? h('div', { text: detail }) : null));
}

export function statsGrid(entries) {
  const grid = h('div', { class: 'stats-grid', role: 'list' });
  grid.set = (list) => {
    grid.replaceChildren(...list.map((e) => h('div', { class: `stat-card ${e.kind || ''}`.trim(), role: 'listitem' },
      h('span', { class: 'stat-value', text: e.value }),
      h('span', { class: 'stat-label', text: e.label }))));
  };
  if (entries) grid.set(entries);
  return grid;
}

export function table({ headers, rows, caption }) {
  const thead = h('thead', {}, h('tr', {}, headers.map((hd, i) => h('th', { scope: 'col', class: i > 0 ? 'mono' : '', text: hd }))));
  const tbody = h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c, i) => h('td', { class: i > 0 ? 'mono' : '', text: String(c ?? '') })))));
  const wrap = h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Scrollable table' });
  const t = caption ? h('table', { class: 'data-table' }, caption) : h('table', { class: 'data-table' });
  t.append(thead, tbody);
  wrap.append(t);
  wrap.update = (newRows) => tbody.replaceChildren(...newRows.map((r) => h('tr', {}, r.map((c, i) => h('td', { class: i > 0 ? 'mono' : '', text: String(c ?? '') })))));
  return wrap;
}

/* ---------- Files ---------- */
const MAX_FILE_MB = 200;

export function dropzone({ accept = '', multiple = false, onFiles, title = 'Choose a file or drop it here', sub = '' } = {}) {
  const zone = h('div', { class: 'dropzone' },
    h('span', { html: icon('upload'), style: 'display:inline-flex' }),
    h('span', { class: 'dz-title', text: title }),
    sub ? h('span', { class: 'dz-sub', text: sub }) : null,
    h('input', { type: 'file', accept, multiple: multiple ? true : null, 'aria-label': title }));
  const fi = zone.querySelector('input[type=file]');
  const handle = (files) => {
    const list = [...files];
    if (!list.length) return;
    for (const f of list) if (f.size > MAX_FILE_MB * 1024 * 1024) { toast(`"${f.name}" is larger than ${MAX_FILE_MB} MB.`, 'error'); return; }
    onFiles(list);
  };
  fi.addEventListener('change', () => handle(fi.files));
  fi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fi.click(); } });
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('is-dragover'); }));
  zone.addEventListener('drop', (e) => handle(e.dataTransfer.files));
  zone.clear = () => { fi.value = ''; zone.classList.remove('has-file'); };
  return zone;
}

export function filePill(file) {
  return h('span', { class: 'file-pill' }, h('span', { class: 'fr-name', text: file.name }), h('span', { class: 'fp-size', text: fmtBytes(file.size) }));
}

export function readFile(file, as = 'text') {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error(`Could not read "${file.name}". The file may be unreadable or still changing.`));
    r.onload = () => resolve(r.result);
    if (as === 'text') r.readAsText(file);
    else if (as === 'dataURL') r.readAsDataURL(file);
    else r.readAsArrayBuffer(file);
  });
}

/* ---------- Formatting helpers ---------- */
export function fmtBytes(n, digits = 1) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let u = -1;
  do { n /= 1024; u++; } while (n >= 1024 && u < units.length - 1);
  return `${n.toFixed(n >= 100 ? 0 : digits)} ${units[u]}`;
}

export function fmtNumber(n, maxFrac = 10) {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function privacyNote(text = 'Runs entirely in your browser — your data is never uploaded.') {
  return h('p', { class: 'privacy-note' }, h('span', { html: icon('shield-check'), style: 'display:inline-flex' }), text);
}

export function privacyText(kind) {
  const map = {
    text: 'This tool processes everything locally in your browser. Your text is never uploaded or stored.',
    file: 'Your file is processed locally in your browser and is not uploaded to any server.',
    crypto: 'Everything is generated locally in your browser with its cryptographic APIs. Nothing is sent anywhere.',
    none: null,
  };
  return map[kind] ?? null;
}

/* ---------- Tool mounting ---------- */
/* Shareable calculator state is opt-in. New links use a fragment, which is
   not sent as part of an HTTP request; it is still visible to anyone who has
   the link and can remain in browser history or the clipboard. Legacy query
   links remain readable, but their initial request may already have been logged. */
export function urlParams() {
  try {
    if (location.hash.startsWith('#iht=')) {
      try { return new URLSearchParams(decodeURIComponent(location.hash.slice(5))); } catch { /* try an old query link */ }
    }
    return new URLSearchParams(location.search);
  } catch { return new URLSearchParams(); }
}
function pairGet(target) {
  if (typeof target === 'function') return target();
  if (target && typeof target.get === 'function') return target.get();
  return target?.value;
}
function pairSet(target, v) {
  if (typeof target === 'function') target(v);
  else if (target && typeof target.set === 'function') target.set(v);
  else if (target) target.value = v;
}
export function prefillFromUrl(pairs) {
  const q = urlParams();
  let any = false;
  for (const [key, target] of pairs) {
    const v = q.get(key);
    if (v == null || v === '') continue;
    pairSet(target, v); any = true;
  }
  // Remove only known legacy calculator parameters; unrelated queries and
  // anchors are preserved. This cannot retract the initial network request.
  try {
    const u = new URL(location.href);
    let changed = false;
    for (const [key] of pairs) if (u.searchParams.has(key)) { u.searchParams.delete(key); changed = true; }
    if (changed) history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch { /* history may be unavailable */ }
  return any;
}
export function shareState(root, pairs, run) {
  const applied = prefillFromUrl(pairs);
  const help = h('p', { class: 'hint', text: 'Optional: sharing inputs creates a link containing your values. Anyone with it can see them, and links may remain in history or clipboard. Do not share sensitive information.' });
  const output = input({ type: 'text', readonly: true, 'aria-label': 'Generated link with inputs' });
  const fallback = h('div', { hidden: true }, field({ label: 'Link with inputs (select and copy if needed)', control: output }));
  const message = h('p', { class: 'hint', role: 'status', 'aria-live': 'polite' });
  const copy = btn({ label: 'Copy link with inputs', icon: 'link', onClick: async () => {
    try {
      const params = new URLSearchParams();
      for (const [key, target] of pairs) {
        const v = pairGet(target);
        if (v !== '' && v != null) params.set(key, String(v));
      }
      const base = new URL(location.href); base.search = ''; base.hash = '';
      const fragment = params.toString();
      if (!fragment) { message.textContent = 'Enter some values first.'; return; }
      if (fragment.length > 4000) { message.textContent = 'Inputs are too long to share as a link.'; return; }
      output.value = `${base.href}#iht=${encodeURIComponent(fragment)}`;
      fallback.hidden = false;
      const copied = await copyText(output.value);
      message.textContent = copied ? 'Link copied. It contains your inputs.' : 'Clipboard unavailable. Select and copy the link below.';
    } catch { message.textContent = 'Could not create a share link.'; }
  } });
  const clearGenerated = () => { if (!fallback.hidden) { fallback.hidden = true; output.value = ''; message.textContent = 'Inputs changed; generate a new link to share them.'; } };
  root.addEventListener('input', clearGenerated);
  root.addEventListener('change', clearGenerated);
  root.append(h('div', { class: 'share-inputs' }, help, copy, message, fallback));
  if (applied && typeof run === 'function') setTimeout(() => { try { run(); } catch { /* tool reports invalid values */ } }, 0);
  return applied;
}

export function mountTool(id, defs) {
  const root = document.getElementById('tool-app');
  if (!root) return;
  const def = defs[id];
  if (!def) {
    root.append(errorBanner('This tool could not load.', `No interface is registered for “${id}”.`));
    return;
  }
  try { def(root); }
  catch (err) {
    root.replaceChildren(errorBanner('Something went wrong while starting this tool.', 'Try refreshing the page. If it keeps happening, your browser may be missing a required feature.'));
    if (typeof console !== 'undefined') console.error(err);
  }
}
