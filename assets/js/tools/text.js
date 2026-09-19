// =============================================================================
// iHaveTools — Text tools engine + UIs
// word-counter, character-counter, line-counter, case-converter,
// remove-duplicate-lines, text-sorter, text-diff, slug-generator,
// lorem-ipsum-generator
// =============================================================================
import { h, field, input, textarea, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, statsGrid, table, toast, copyText, privacyNote, mountTool } from '../ui.js';

/* ═══════════════════════════ Text statistics ═══════════════════════════ */
export function textStats(text) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/u).length : 0;
  const chars = [...text].length;
  const charsNoSpaces = [...text.replace(/\s/gu, '')].length;
  const sentences = text.split(/[.!?…]+[\s"')\]]*|$|$/u).map((s) => s.trim()).filter(Boolean).length;
  const paragraphs = text.split(/\n\s*\n+/u).filter((p) => p.trim()).length;
  const lines = text.split(/\n/).length;
  const nonEmptyLines = text.split(/\n/).filter((l) => l.trim()).length;
  const readingSeconds = Math.ceil((words / 200) * 60 / 5) * 5;
  const readingTime = words === 0 ? '0 sec' : readingSeconds < 60 ? `${readingSeconds} sec` : `${Math.ceil(readingSeconds / 60)} min`;
  const longestLine = text.split(/\n/).reduce((m, l) => Math.max(m, [...l].length), 0);
  const letters = (text.match(/\p{L}/gu) || []).length;
  const digits = (text.match(/\p{N}/gu) || []).length;
  return { words, chars, charsNoSpaces, sentences, paragraphs, lines, nonEmptyLines, blankLines: lines - nonEmptyLines, longestLine, letters, digits, readingTime };
}

/* ═══════════════════════════ Case conversion ═══════════════════════════ */
function wordsOf(text) {
  return text
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-./\\]+/g, ' ')
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
}
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

export function convertCase(text, mode) {
  if (!text) return '';
  switch (mode) {
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'title': return text.toLowerCase().replace(/\p{L}[\p{L}'’]*/gu, (w, off, s) => {
      const small = new Set(['a','an','and','as','at','but','by','for','if','in','nor','of','on','or','so','the','to','up','yet']);
      const prev = s.slice(0, off).trimEnd().slice(-1);
      if (off !== 0 && small.has(w) && prev !== '.' && prev !== '!' && prev !== '?') return w;
      return cap(w);
    });
    case 'sentence': return text.toLowerCase().replace(/(^\s*|[.!?…]\s+|\n\s*)(\p{L})/gu, (m, p, c) => p + c.toUpperCase());
    case 'camel': return wordsOf(text).map((w, i) => i === 0 ? w.toLowerCase() : cap(w.toLowerCase())).join('');
    case 'pascal': return wordsOf(text).map((w) => cap(w.toLowerCase())).join('');
    case 'snake': return wordsOf(text).map((w) => w.toLowerCase()).join('_');
    case 'kebab': return wordsOf(text).map((w) => w.toLowerCase()).join('-');
    case 'constant': return wordsOf(text).map((w) => w.toUpperCase()).join('_');
    case 'alternating': return [...text].map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join('');
    case 'inverse': return [...text].map((c) => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
    default: return text;
  }
}
export const CASE_MODES = [
  { v: 'upper', t: 'UPPER CASE' }, { v: 'lower', t: 'lower case' }, { v: 'title', t: 'Title Case' },
  { v: 'sentence', t: 'Sentence case' }, { v: 'camel', t: 'camelCase' }, { v: 'pascal', t: 'PascalCase' },
  { v: 'snake', t: 'snake_case' }, { v: 'kebab', t: 'kebab-case' }, { v: 'constant', t: 'CONSTANT_CASE' },
  { v: 'alternating', t: 'aLtErNaTiNg' }, { v: 'inverse', t: 'iNVERSE cASE' },
];

/* ═══════════════════════════ Line operations ═══════════════════════════ */
export function dedupeLines(text, { caseInsensitive = false, trim = false, keepEmpty = true } = {}) {
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = trim ? line.trim() : line;
    const cmp = caseInsensitive ? key.toLowerCase() : key;
    if (!keepEmpty && !key.trim()) continue;
    if (cmp === '' && !keepEmpty) continue;
    if (seen.has(cmp) && cmp !== '') continue;
    if (cmp === '' && seen.has('')) continue;
    seen.add(cmp);
    out.push(line);
  }
  return out;
}

export function sortLines(text, { mode = 'alpha', direction = 'asc', caseInsensitive = true, unique = false } = {}) {
  let lines = text.split(/\r?\n/);
  if (unique) lines = dedupeLines(lines.join('\n'), { trim: false, keepEmpty: false });
  lines = lines.filter((l, i) => !(l === '' && (i === 0 || i === lines.length - 1)) || true);
  const coll = new Intl.Collator(undefined, { sensitivity: caseInsensitive ? 'base' : 'variant', numeric: mode === 'natural' });
  const cmp = (a, b) => {
    let r = 0;
    if (mode === 'alpha') r = coll.compare(a, b);
    else if (mode === 'natural') r = coll.compare(a, b);
    else if (mode === 'numeric') {
      const na = parseFloat(a.replace(/^[^\d-]*/, '')), nb = parseFloat(b.replace(/^[^\d-]*/, ''));
      r = (Number.isNaN(na) ? Infinity : na) - (Number.isNaN(nb) ? Infinity : nb) || coll.compare(a, b);
    } else if (mode === 'length') r = [...a].length - [...b].length || coll.compare(a, b);
    else if (mode === 'shuffle') r = Math.random() - 0.5;
    return direction === 'desc' && mode !== 'shuffle' ? -r : r;
  };
  lines.sort(cmp);
  return lines.join('\n');
}

/* ═══════════════════════════ Diff (LCS) ═══════════════════════════ */
export function diffLines(aText, bText) {
  const a = aText.split(/\r?\n/);
  const b = bText.split(/\r?\n/);
  const n = a.length, m = b.length;
  // LCS table (guard memory: cap at 4000×4000)
  if (n * m > 16e6) throw new Error('These texts are too long to diff in the browser (over ~4000 lines each). Split them into smaller pieces.');
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ type: 'same', line: a[i], a: i + 1, b: j + 1 }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', line: a[i], a: i + 1 }); i++; }
    else { ops.push({ type: 'add', line: b[j], b: j + 1 }); j++; }
  }
  while (i < n) { ops.push({ type: 'del', line: a[i], a: ++i }); }
  while (j < m) { ops.push({ type: 'add', line: b[j], b: ++j }); }
  return ops;
}
export function diffSummary(ops) {
  const add = ops.filter((o) => o.type === 'add').length;
  const del = ops.filter((o) => o.type === 'del').length;
  const same = ops.filter((o) => o.type === 'same').length;
  return { add, del, same, unchanged: add === 0 && del === 0 };
}

/* ═══════════════════════════ Slug ═══════════════════════════ */
export function slugify(text, { separator = '-', lowercase = true, stripStopWords = false } = {}) {
  const STOP = new Set(['a','an','and','are','as','at','be','but','by','for','if','in','into','is','it','of','on','or','the','to','was','were','with']);
  let s = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/Æ/gi, 'AE').replace(/Ø/gi, 'O').replace(/Å/gi, 'A').replace(/Ð/g, 'D').replace(/Þ/g, 'TH').replace(/ß/g, 'ss');
  let words = s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (stripStopWords) {
    words = words.filter((w, i) => !(STOP.has(w.toLowerCase()) && words.length > 2 && i > 0 && i < words.length - 1));
  }
  s = words.join(separator);
  return lowercase ? s.toLowerCase() : s;
}

/* ═══════════════════════════ Lorem ipsum ═══════════════════════════ */
const LOREM = ['lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','sed','do','eiusmod','tempor','incididunt','ut','labore','et','dolore','magna','aliqua','enim','ad','minim','veniam','quis','nostrud','exercitation','ullamco','laboris','nisi','aliquip','ex','ea','commodo','consequat','duis','aute','irure','in','reprehenderit','voluptate','velit','esse','cillum','eu','fugiat','nulla','pariatur','excepteur','sint','occaecat','cupidatat','non','proident','sunt','culpa','qui','officia','deserunt','mollit','anim','id','est','laborum'];
export function lorem({ unit = 'paragraphs', count = 3, classic = true } = {}) {
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];
  const sentence = (startClassic) => {
    const len = 8 + rand(10);
    const words = [];
    for (let k = 0; k < len; k++) words.push(pick(LOREM));
    let s = words.join(' ');
    if (startClassic && classic) s = 'Lorem ipsum dolor sit amet, ' + s;
    s = s.charAt(0).toUpperCase() + s.slice(1);
    s = s.replace(/,/g, (m, off) => (off > 20 && off < s.length - 12 && Math.random() < 0.18 ? ', ' : m));
    return s.replace(/\s+,/g, ',') + '.';
  };
  const paragraph = (first) => {
    const count = 3 + rand(3);
    return Array.from({ length: count }, (_, k) => sentence(first && k === 0)).join(' ');
  };
  if (unit === 'words') {
    const words = Array.from({ length: count }, () => pick(LOREM));
    return (classic ? ['Lorem', 'ipsum', 'dolor', 'sit', 'amet', ...words.slice(5)] : words).join(' ');
  }
  if (unit === 'sentences') return Array.from({ length: count }, (_, k) => sentence(k === 0)).join(' ');
  return Array.from({ length: count }, (_, k) => paragraph(k === 0)).join('\n\n');
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'word-counter'(root) {
    const inp = textarea({ rows: 12, mono: false, placeholder: 'Type or paste your text here — statistics update live…' });
    const grid = statsGrid();
    const extra = h('div', {});
    const render = () => {
      const s = textStats(inp.value);
      grid.set([
        { label: 'Words', value: s.words.toLocaleString() },
        { label: 'Characters', value: s.chars.toLocaleString() },
        { label: 'Chars (no spaces)', value: s.charsNoSpaces.toLocaleString() },
        { label: 'Sentences', value: s.sentences.toLocaleString() },
        { label: 'Paragraphs', value: s.paragraphs.toLocaleString() },
        { label: 'Lines', value: s.lines.toLocaleString() },
        { label: 'Reading time', value: s.readingTime },
        { label: 'Speaking time', value: s.words === 0 ? '0 sec' : `${Math.max(1, Math.ceil(s.words / 130 / 0.5) * 0.5)} min` },
      ]);
      extra.replaceChildren();
      const longest = Math.max(...[...inp.value.split(/\n/)].map((l) => [...l].length).concat([0]));
      if (inp.value) extra.append(h('p', { class: 'hint', text: `Longest line: ${longest.toLocaleString()} characters · Letters: ${s.letters.toLocaleString()} · Numbers: ${s.digits.toLocaleString()} · Avg word length: ${(s.words ? s.charsNoSpaces / s.words : 0).toFixed(1)}` }));
    };
    inp.addEventListener('input', render);
    render();
    root.append(
      h('div', { class: 'field' }, h('div', { class: 'field-row', style: 'display:block' }, grid), h('div', {}, extra)),
      field({ label: 'Your text', control: inp }),
      actionsRow(btn({ label: 'Copy statistics', variant: 'secondary', icon: 'copy', onClick: async () => {
        const s = textStats(inp.value);
        const ok = await copyText(`Words: ${s.words}\nCharacters: ${s.chars}\nCharacters (no spaces): ${s.charsNoSpaces}\nSentences: ${s.sentences}\nParagraphs: ${s.paragraphs}\nLines: ${s.lines}\nReading time: ${s.readingTime}`);
        toast(ok ? 'Statistics copied' : 'Copy failed', ok ? 'success' : 'error');
      } }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; render(); inp.focus(); } })),
      privacyNote('Your text is counted locally in your browser and never uploaded.'));
  },

  'character-counter'(root) {
    const inp = textarea({ rows: 9, mono: false, placeholder: 'Type or paste text…' });
    const grid = statsGrid();
    const meters = h('div', { style: 'margin-top:14px' });
    const LIMITS = [
      { name: 'X (Twitter) post', limit: 280 },
      { name: 'SMS message', limit: 160 },
      { name: 'Meta description', limit: 160 },
      { name: 'Meta title', limit: 60 },
      { name: 'Instagram caption', limit: 2200 },
    ];
    const render = () => {
      const s = textStats(inp.value);
      grid.set([
        { label: 'Characters', value: s.chars.toLocaleString() },
        { label: 'No spaces', value: s.charsNoSpaces.toLocaleString() },
        { label: 'Letters', value: s.letters.toLocaleString() },
        { label: 'Digits', value: s.digits.toLocaleString() },
        { label: 'Words', value: s.words.toLocaleString() },
      ]);
      meters.replaceChildren(...LIMITS.map((l) => {
        const pct = Math.min(100, (s.chars / l.limit) * 100);
        const over = s.chars > l.limit;
        return h('div', { class: 'field', style: 'margin-bottom:10px' },
          h('label', { text: `${l.name} — ${s.chars.toLocaleString()} / ${l.limit.toLocaleString()}${over ? ' (over limit)' : ''}`, style: `font-weight:600;color:${over ? 'var(--danger)' : 'var(--text-2)'}` }),
          h('div', { class: 'strength-meter' }, h('div', { style: `width:${pct}%;background:${over ? 'var(--danger)' : pct > 85 ? 'var(--warning)' : 'var(--success)'}` })));
      }));
    };
    inp.addEventListener('input', render);
    render();
    root.append(h('div', { class: 'field-row', style: 'display:block' }, grid),
      field({ label: 'Your text', control: inp }), meters,
      actionsRow(btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; render(); } })));
  },

  'line-counter'(root) {
    const inp = textarea({ rows: 12, placeholder: 'Paste text to count lines…' });
    const grid = statsGrid();
    const render = () => {
      const s = textStats(inp.value);
      grid.set([
        { label: 'Total lines', value: (inp.value ? s.lines : 0).toLocaleString() },
        { label: 'Non-empty', value: s.nonEmptyLines.toLocaleString() },
        { label: 'Empty', value: s.blankLines.toLocaleString() },
        { label: 'Longest line', value: s.longestLine.toLocaleString() },
        { label: 'Characters', value: s.chars.toLocaleString() },
        { label: 'Words', value: s.words.toLocaleString() },
      ]);
    };
    inp.addEventListener('input', render);
    render();
    root.append(h('div', { class: 'field-row', style: 'display:block' }, grid),
      field({ label: 'Text', control: inp }),
      actionsRow(btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; render(); } })));
  },

  'case-converter'(root) {
    const inp = textarea({ rows: 8, mono: false, value: 'The quick brown fox jumps over the lazy dog', placeholder: 'Paste your text…' });
    const status = statusLine('');
    const out = resultPanel({ label: 'Converted text' });
    const apply = (mode) => {
      if (!inp.value.trim()) { status.set('Paste some text first.', 'warning'); out.placeholder(); return; }
      out.set(convertCase(inp.value, mode));
      status.set(`Converted to ${CASE_MODES.find((m) => m.v === mode)?.t}.`, 'success');
    };
    const pad = h('div', { class: 'switch-row', style: 'margin-bottom:14px' },
      CASE_MODES.map((m) => h('button', { type: 'button', class: 'switch', text: m.t, onclick: () => apply(m.v) })));
    root.append(field({ label: 'Input text', control: inp }), pad,
      actionsRow(btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'remove-duplicate-lines'(root) {
    const inp = textarea({ rows: 10, value: '', placeholder: 'One entry per line…' });
    const ci = switchChip({ label: 'Case-insensitive' });
    const trim = switchChip({ label: 'Trim whitespace before comparing', checked: true });
    const keepEmpty = switchChip({ label: 'Keep empty lines', checked: true });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Unique lines' });
    const run = () => {
      if (!inp.value.trim()) { status.set('Paste some lines first.', 'warning'); return; }
      const before = inp.value.split(/\r?\n/).filter((l) => l.trim()).length;
      const result = dedupeLines(inp.value, {
        caseInsensitive: ci.querySelector('input').checked,
        trim: trim.querySelector('input').checked,
        keepEmpty: keepEmpty.querySelector('input').checked,
      });
      const after = result.filter((l) => l.trim()).length;
      out.set(result.join('\n'));
      status.set(`Removed ${Math.max(0, before - after)} duplicate line${before - after === 1 ? '' : 's'}.`, 'success');
    };
    root.append(field({ label: 'Input lines', control: inp }),
      h('div', { class: 'switch-row', style: 'margin-bottom:6px' }, ci, trim, keepEmpty),
      actionsRow(btn({ label: 'Remove duplicates', icon: 'copy-x', onClick: run }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'text-sorter'(root) {
    const inp = textarea({ rows: 10, placeholder: 'One line per item…' });
    const mode = segControl({ options: [{ v: 'alpha', t: 'A→Z' }, { v: 'natural', t: 'Natural' }, { v: 'numeric', t: 'Numeric' }, { v: 'length', t: 'Length' }], value: 'alpha', ariaLabel: 'Sort mode' });
    const dir = segControl({ options: [{ v: 'asc', t: 'Ascending' }, { v: 'desc', t: 'Descending' }], value: 'asc', ariaLabel: 'Direction' });
    const ci = switchChip({ label: 'Case-insensitive', checked: true });
    const uniq = switchChip({ label: 'Remove duplicates' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Sorted lines' });
    const run = () => {
      if (!inp.value.trim()) { status.set('Paste some lines first.', 'warning'); return; }
      const result = sortLines(inp.value.replace(/\n+$/, ''), {
        mode: mode.getValue(), direction: dir.getValue(),
        caseInsensitive: ci.querySelector('input').checked,
        unique: uniq.querySelector('input').checked,
      });
      out.set(result);
      status.set(`Sorted ${result.split('\n').length.toLocaleString()} lines (${mode.getValue()}, ${dir.getValue()}).`, 'success');
    };
    root.append(field({ label: 'Lines to sort', control: inp }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Mode', control: mode }),
        field({ label: 'Direction', control: dir })),
      h('div', { class: 'switch-row', style: 'margin-bottom:6px' }, ci, uniq),
      actionsRow(btn({ label: 'Sort', icon: 'sort', onClick: run }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'text-diff'(root) {
    const a = textarea({ rows: 10, placeholder: 'Original text…' });
    const b = textarea({ rows: 10, placeholder: 'Changed text…' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Differences', copy: false });
    const run = () => {
      if (!a.value && !b.value) { status.set('Paste text in both boxes.', 'warning'); return; }
      try {
        const ops = diffLines(a.value.replace(/\n$/, ''), b.value.replace(/\n$/, ''));
        const sum = diffSummary(ops);
        if (sum.unchanged) { out.set('The two texts are identical.', { placeholderMode: false }); status.set('No differences found — the texts match.', 'success'); return; }
        const view = h('div', { class: 'diff-view' },
          ops.map((o) => h('span', {
            class: o.type === 'add' ? 'd-add' : o.type === 'del' ? 'd-del' : 'd-same',
            text: (o.type === 'add' ? '+ ' : o.type === 'del' ? '− ' : '  ') + o.line,
          })));
        out.set(view);
        status.set(`${sum.add} line${sum.add === 1 ? '' : 's'} added, ${sum.del} removed, ${sum.same} unchanged.`, 'info');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' }, field({ label: 'Original', control: a }), field({ label: 'Changed', control: b })),
      actionsRow(btn({ label: 'Compare', icon: 'diff', onClick: run }),
        btn({ label: 'Swap sides', variant: 'secondary', onClick: () => { [a.value, b.value] = [b.value, a.value]; } }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { a.value = ''; b.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'slug-generator'(root) {
    const inp = textarea({ rows: 6, mono: false, value: '10 Great Coffee Shops in São Paulo — 2026 Edition!', placeholder: 'One title per line…' });
    const sep = segControl({ options: [{ v: '-', t: 'Hyphen (-)' }, { v: '_', t: 'Underscore (_)' }], value: '-', ariaLabel: 'Separator' });
    const stop = switchChip({ label: 'Remove stop words (a, the, of…)' });
    const keepCase = switchChip({ label: 'Keep original letter case' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Slugs' });
    const run = () => {
      const lines = inp.value.split(/\r?\n/).filter((l) => l.trim());
      if (!lines.length) { status.set('Type a title first.', 'warning'); return; }
      const slugs = lines.map((l) => slugify(l, { separator: sep.getValue(), lowercase: !keepCase.querySelector('input').checked, stripStopWords: stop.querySelector('input').checked }));
      out.set(slugs.join('\n'));
      status.set(`${slugs.length} slug${slugs.length === 1 ? '' : 's'} generated.`, 'success');
    };
    root.append(field({ label: 'Titles (one per line for batch mode)', control: inp }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Separator', control: sep }),
        field({ label: 'Options', control: h('div', { class: 'switch-row' }, stop, keepCase) })),
      actionsRow(btn({ label: 'Generate slugs', icon: 'anchor', onClick: run }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'lorem-ipsum-generator'(root) {
    const unit = segControl({ options: [{ v: 'paragraphs', t: 'Paragraphs' }, { v: 'sentences', t: 'Sentences' }, { v: 'words', t: 'Words' }], value: 'paragraphs', ariaLabel: 'Unit' });
    const count = input({ type: 'number', min: 1, max: 100, value: '3' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Placeholder text' });
    const gen = () => {
      const n = Math.max(1, Math.min(100, Math.floor(Number(count.value) || 1)));
      count.value = String(n);
      const text = lorem({ unit: unit.getValue(), count: n });
      out.set(text);
      status.set(`Generated ${n} ${unit.getValue().replace(/s$/, '')}${n === 1 ? '' : 's'} of Lorem Ipsum.`, 'success');
    };
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Generate', control: unit }),
        field({ label: 'How many (1–100)', control: count })),
      actionsRow(btn({ label: 'Generate', icon: 'quote', onClick: gen }),
        btn({ label: 'Regenerate', variant: 'secondary', icon: 'refresh', onClick: gen })),
      status, h('br'), out.panel);
    gen();
  },
};

export function mount(id) {
  import('../ui.js').then(({ mountTool }) => mountTool(id, defs));
}

export const __test = { textStats, convertCase, dedupeLines, sortLines, diffLines, diffSummary, slugify, lorem };
