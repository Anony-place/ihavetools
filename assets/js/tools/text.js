// =============================================================================
// iHaveTools — Text tools engine + UIs
// word-counter, character-counter, line-counter, case-converter,
// remove-duplicate-lines, text-sorter, text-diff, slug-generator,
// lorem-ipsum-generator
// =============================================================================
import { h, field, input, textarea, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, statsGrid, table, toast, copyText, privacyNote, mountTool, dropzone, readFile, downloadBlob } from '../ui.js';

/* ═══════════════════════════ Text statistics ═══════════════════════════ */
export function textStats(text) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/u).length : 0;
  const chars = [...text].length;
  const charsNoSpaces = [...text.replace(/\s/gu, '')].length;
  const sentences = text.split(/[.!?…]+[\s"')\]]*|$|$/u).map((s) => s.trim()).filter(Boolean).length;
  const paragraphs = text.split(/\n\s*\n+/u).filter((p) => p.trim()).length;
  const lineParts = text ? text.split(/\r\n|\r|\n/) : [];
  const lines = lineParts.length;
  const nonEmptyLines = lineParts.filter((l) => l.trim()).length;
  const readingSeconds = Math.ceil((words / 200) * 60 / 5) * 5;
  const readingTime = words === 0 ? '0 sec' : readingSeconds < 60 ? `${readingSeconds} sec` : `${Math.floor(readingSeconds / 60)} min${readingSeconds % 60 ? ` ${readingSeconds % 60} sec` : ''}`;
  const longestLine = lineParts.reduce((m, l) => Math.max(m, [...l].length), 0);
  const letters = (text.match(/\p{L}/gu) || []).length;
  const digits = (text.match(/\p{N}/gu) || []).length;
  return { words, chars, charsNoSpaces, sentences, paragraphs, lines, nonEmptyLines, blankLines: lines - nonEmptyLines, longestLine, letters, digits, readingTime };
}

/** Time estimate rounded up to five seconds, based on an assumed pace. */
export function wordTime(words, wpm) {
  if (!Number.isSafeInteger(words) || words < 0 || !Number.isInteger(wpm) || wpm < 40 || wpm > 1000) throw new Error('Pace must be a whole number from 40 to 1,000 words per minute.');
  const seconds = Math.ceil(words * 60 / wpm / 5) * 5;
  return seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} sec` : ''}`;
}
export function wordGoal(words, min, max) {
  if (!Number.isSafeInteger(words) || words < 0 || ![min,max].every(n => n === null || (Number.isSafeInteger(n) && n >= 0 && n <= 1000000))) throw new Error('Goals must be whole numbers from 0 to 1,000,000.');
  if (min !== null && max !== null && min > max) throw new Error('Minimum goal cannot exceed maximum goal.');
  if (min !== null && words < min) return `${min - words} more ${min - words === 1 ? 'word' : 'words'} to minimum.`;
  if (max !== null && words > max) return `${words - max} ${words - max === 1 ? 'word' : 'words'} over maximum.`;
  if (min !== null || max !== null) return max !== null ? `Within goal. ${max - words} ${max - words === 1 ? 'word' : 'words'} until maximum.` : 'Minimum goal reached.';
  return '';
}

/* ═══════════════════════════ Case conversion ═══════════════════════════ */
function wordsOf(text) {
  return text
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-./\\]+/g, ' ')
    .split(/[^\p{L}\p{M}\p{N}']+/u)
    .filter(Boolean);
}
const cap = (w) => { const [first = '', ...rest] = w; return first.toUpperCase() + rest.join(''); };

export function convertCase(text, mode) {
  if (!text) return '';
  switch (mode) {
    case 'upper': return text.toUpperCase();
    case 'lower': return text.toLowerCase();
    case 'title': return text.toLowerCase().replace(/\p{L}[\p{L}'’]*/gu, (w, off, s) => {
      const small = new Set(['a','an','and','as','at','but','by','for','if','in','nor','of','on','or','so','the','to','up','yet']);
      let i = off - 1;
      while (i >= 0 && /\s/u.test(s[i])) i--;
      const prev = i >= 0 ? s[i] : '';
      if (prev && small.has(w) && prev !== '.' && prev !== '!' && prev !== '?' && prev !== '…') return w;
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
  const lines = text.split(/\r\n|\r|\n/);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = trim ? line.trim() : line;
    const cmp = caseInsensitive ? key.toLowerCase() : key;
    if (!key.trim()) { if (keepEmpty) out.push(line); continue; }
    if (seen.has(cmp)) continue;
    seen.add(cmp);
    out.push(line);
  }
  return out;
}

export function sortLines(text, { mode = 'alpha', direction = 'asc', caseInsensitive = true, unique = false, random = Math.random } = {}) {
  let lines = text.split(/\r\n|\r|\n/);
  if (unique) lines = dedupeLines(lines.join('\n'), { caseInsensitive, trim: false, keepEmpty: true });
  if (mode === 'shuffle') {
    for (let i = lines.length - 1; i > 0; i--) {
      const draw = random();
      if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random value must be in the range [0, 1).');
      const j = Math.floor(draw * (i + 1));
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    return lines.join('\n');
  }
  const coll = new Intl.Collator(undefined, { sensitivity: caseInsensitive ? 'accent' : 'variant', numeric: mode === 'natural' });
  const cmp = (a, b) => {
    let r = 0;
    if (mode === 'alpha') r = coll.compare(a, b);
    else if (mode === 'natural') r = coll.compare(a, b);
    else if (mode === 'numeric') {
      const na = parseFloat(a.replace(/^[^\d-]*/, '')), nb = parseFloat(b.replace(/^[^\d-]*/, ''));
      const va = Number.isFinite(na), vb = Number.isFinite(nb);
      r = va !== vb ? (va ? -1 : 1) : va ? (na < nb ? -1 : na > nb ? 1 : coll.compare(a, b)) : coll.compare(a, b);
    } else if (mode === 'length') r = [...a].length - [...b].length || coll.compare(a, b);
    return direction === 'desc' && mode !== 'shuffle' ? -r : r;
  };
  lines.sort(cmp);
  return lines.join('\n');
}

/* ═══════════════════════════ Diff (LCS) ═══════════════════════════ */
export function diffLines(aText, bText) {
  if (aText.length + bText.length > 500000) throw new Error('Texts exceed the combined 500,000-character diff limit.');
  const a = aText ? aText.split(/\r\n|\r|\n/) : [];
  const b = bText ? bText.split(/\r\n|\r|\n/) : [];
  const n = a.length, m = b.length;
  // Bound both dimensions and total cells, including the allocated border.
  if (n > 4000 || m > 4000 || (n + 1) * (m + 1) > 4e6) throw new Error('Diff limit: at most 4,000 lines per side and 4 million table cells. Split the texts into smaller pieces.');
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
  // Strip marks only from Latin bases; marks are essential in many other scripts.
  let s = text.normalize('NFKD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1');
  s = s.replace(/[ÆæØøÐðÞþß]/g, c => ({Æ:'AE',æ:'ae',Ø:'O',ø:'o',Ð:'D',ð:'d',Þ:'TH',þ:'th',ß:'ss'})[c]);
  let words = s.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
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
    return (classic ? ['Lorem', 'ipsum', 'dolor', 'sit', 'amet'].slice(0, count).concat(words.slice(5)) : words).join(' ');
  }
  if (unit === 'sentences') return Array.from({ length: count }, (_, k) => sentence(k === 0)).join(' ');
  return Array.from({ length: count }, (_, k) => paragraph(k === 0)).join('\n\n');
}

/* ═══════════════════════════ Morse code (ITU) ═══════════════════════════ */
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.',
  '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
export function textToMorse(text) {
  const words = String(text).toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return words.map((w) => [...w].map((ch) => {
    const code = MORSE[ch];
    if (!code) throw new Error(`No Morse code exists for “${ch}” — letters A–Z, digits and common punctuation are supported.`);
    return code;
  }).join(' ')).join(' / ');
}
export function morseToText(code) {
  const s = String(code).trim().replace(/_/g, '-');
  if (!s) return '';
  // Words split on “/” or a gap of 3+ spaces; letters on single spaces.
  return s.split(/\s*\/\s*|\s{3,}/).map((word) => word.split(/\s+/).filter(Boolean).map((tok) => {
    const ch = MORSE_REV[tok];
    if (!ch) throw new Error(`“${tok}” is not a Morse code group — check the dots, dashes and spacing.`);
    return ch;
  }).join('')).join(' ');
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'word-counter'(root) {
    const inp = textarea({ rows: 12, mono: false, placeholder: 'Type or paste your text here — statistics update live…' });
    const file = input({type:'file', accept:'.txt,.md,text/plain,text/markdown'});
    const reading = input({type:'number',min:40,max:1000,step:1,value:'200'});
    const speaking = input({type:'number',min:40,max:1000,step:1,value:'130'});
    const minGoal = input({type:'number',min:0,max:1000000,step:1,placeholder:'Optional'});
    const maxGoal = input({type:'number',min:0,max:1000000,step:1,placeholder:'Optional'});
    const grid = statsGrid(), extra = h('div', {}), status = statusLine('');
    let revision = 0, summary = '';
    const parseOptional = el => el.value === '' ? null : Number(el.value);
    const render = () => {
      summary = ''; grid.replaceChildren(); extra.replaceChildren();
      if (inp.value.length > 1000000) { status.set('Text exceeds 1,000,000 characters. Shorten it to calculate.', 'error'); return; }
      let readTime, speakTime, goal;
      const stats = textStats(inp.value);
      try {
        readTime = wordTime(stats.words, reading.value === '' ? NaN : Number(reading.value));
        speakTime = wordTime(stats.words, speaking.value === '' ? NaN : Number(speaking.value));
        goal = wordGoal(stats.words, parseOptional(minGoal), parseOptional(maxGoal));
      } catch (e) { status.set(e.message, 'error'); return; }
      grid.set([
        {label:'Words',value:stats.words.toLocaleString()}, {label:'Characters',value:stats.chars.toLocaleString()},
        {label:'Chars (no spaces)',value:stats.charsNoSpaces.toLocaleString()}, {label:'Sentences',value:stats.sentences.toLocaleString()},
        {label:'Paragraphs',value:stats.paragraphs.toLocaleString()}, {label:'Lines',value:stats.lines.toLocaleString()},
        {label:'Reading time',value:readTime}, {label:'Speaking time',value:speakTime},
      ]);
      if (inp.value) extra.append(h('p',{class:'hint',text:`Longest line: ${stats.longestLine.toLocaleString()} characters · Letters: ${stats.letters.toLocaleString()} · Numbers: ${stats.digits.toLocaleString()} · Non-space characters per word: ${(stats.words ? stats.charsNoSpaces / stats.words : 0).toFixed(1)}`}));
      if (goal) extra.append(h('p',{class:'hint',text:`Word goal: ${goal}`}));
      summary = `Words: ${stats.words}\nCharacters: ${stats.chars}\nCharacters (no spaces): ${stats.charsNoSpaces}\nSentences: ${stats.sentences}\nParagraphs: ${stats.paragraphs}\nLines: ${stats.lines}\nReading time (${reading.value} wpm): ${readTime}\nSpeaking time (${speaking.value} wpm): ${speakTime}${goal ? `\nWord goal: ${goal}` : ''}`;
      status.set('', 'info');
    };
    inp.addEventListener('input', () => {revision++; render();});
    [reading,speaking,minGoal,maxGoal].forEach(el=>el.addEventListener('input',render));
    file.addEventListener('change', async () => {
      const selected = file.files?.[0]; file.value=''; if (!selected) return;
      const token=++revision;
      try {
        if (!/\.(txt|md)$/i.test(selected.name) || selected.size > 4000000) throw new Error('Choose a UTF-8 .txt or .md file up to 4,000,000 bytes.');
        status.set('Reading file locally…','info');
        const bytes=await readFile(selected,'buffer'); if (token!==revision) return;
        let text; try {text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);} catch {throw new Error('File is not valid UTF-8.');}
        if (text.length > 1000000) throw new Error('File exceeds 1,000,000 characters.');
        inp.value=text; render(); if (summary) status.set('File loaded locally.','success');
      } catch (e) {if(token===revision) status.set(`${e.message || 'Could not read file.'} Existing text was kept.`, 'error');}
    });
    window.addEventListener('pagehide',()=>{revision++;},{once:true});
    render();
    root.append(
      h('div',{class:'field'},h('div',{class:'field-row',style:'display:block'},grid),extra),
      field({label:'Your text',control:inp,hint:'Up to 1,000,000 UTF-16 characters. Words are whitespace-separated; results can differ from other editors.'}),
      field({label:'Load text file (optional)',control:file,hint:'UTF-8 .txt or .md, up to 4,000,000 bytes and 1,000,000 characters. Replaces the text; Markdown is not rendered.'}),
      h('div',{class:'field-row'},field({label:'Reading pace (words/min)',control:reading}),field({label:'Speaking pace (words/min)',control:speaking}),field({label:'Minimum word goal (optional)',control:minGoal}),field({label:'Maximum word goal (optional)',control:maxGoal})),
      h('p',{class:'hint',text:'Time estimates use the chosen pace and round up to 5 seconds. Actual times vary; characters count Unicode code points, not grapheme clusters.'}),
      actionsRow(btn({label:'Copy statistics',variant:'secondary',icon:'copy',onClick:async()=>{if(!summary){status.set('Fix the input or settings before copying.','warning');return;} const ok=await copyText(summary);toast(ok?'Statistics copied':'Copy failed',ok?'success':'error');}}),
        btn({label:'Clear',variant:'ghost',icon:'x',onClick:()=>{revision++; inp.value='';file.value='';render();status.set('Text cleared.','info');inp.focus();}})),
      status, privacyNote('Your text is counted locally in your browser and never uploaded.'));
  },

  'character-counter'(root) {
    const inp = textarea({ rows: 9, mono: false, placeholder: 'Type or paste text…' });
    const grid = statsGrid();
    const custom = input({type:'number',min:1,max:1000000,step:1,placeholder:'Optional'});
    const customStatus = statusLine('');
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
      const customLimit = custom.value === '' ? null : Number(custom.value);
      const valid = customLimit === null || (Number.isSafeInteger(customLimit) && customLimit >= 1 && customLimit <= 1000000);
      customStatus.set(valid ? '' : 'Custom limit must be a whole number from 1 to 1,000,000.', valid ? 'info' : 'error');
      const limits = valid && customLimit !== null ? [{name:'Custom code-point limit',limit:customLimit}, ...LIMITS] : LIMITS;
      meters.replaceChildren(...limits.map((l) => {
        const pct = Math.min(100, (s.chars / l.limit) * 100);
        const over = s.chars > l.limit;
        return h('div', { class: 'field', style: 'margin-bottom:10px' },
          h('label', { text: `${l.name} — ${s.chars.toLocaleString()} / ${l.limit.toLocaleString()}${over ? ' (over limit)' : ''}`, style: `font-weight:600;color:${over ? 'var(--danger)' : 'var(--text-2)'}` }),
          h('div', { class: 'strength-meter' }, h('div', { style: `width:${pct}%;background:${over ? 'var(--danger)' : pct > 85 ? 'var(--warning)' : 'var(--success)'}` })));
      }));
    };
    inp.addEventListener('input', render);
    custom.addEventListener('input',render);
    render();
    root.append(h('div', { class: 'field-row', style: 'display:block' }, grid),
      field({ label: 'Your text', control: inp }), field({label:'Custom character limit (optional)',control:custom,hint:'Counts code points, including whitespace; verify the target service’s counting rules.'}), customStatus, h('p', { class: 'hint', text: 'Counts Unicode code points, not grapheme clusters. Platform meters are rough references only: SMS encoding, X weighted characters and search-result pixel widths differ.' }), meters,
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
    const invalidate = () => { out.placeholder(); status.set('Input or settings changed. Run again.', 'info'); };
    root.addEventListener('input', invalidate);
    root.addEventListener('change', invalidate);
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
    const invalidate = () => { out.placeholder(); status.set('Input or settings changed. Run again.', 'info'); };
    root.addEventListener('input', invalidate);
    root.addEventListener('change', invalidate);
    const run = () => {
      if (!inp.value.trim()) { status.set('Paste some lines first.', 'warning'); return; }
      const before = inp.value.split(/\r\n|\r|\n/).filter((l) => l.trim()).length;
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
    [mode, dir].forEach(control => control.addEventListener('click', () => { out.placeholder(); status.set('Settings changed. Run again.', 'info'); }));
    const invalidate = () => { out.placeholder(); status.set('Input or settings changed. Run again.', 'info'); };
    root.addEventListener('input', invalidate);
    root.addEventListener('change', invalidate);
    const run = () => {
      if (!inp.value.trim()) { status.set('Paste some lines first.', 'warning'); return; }
      const result = sortLines(inp.value, {
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
      h('p', { class: 'hint', text: 'Alphabetical order depends on your browser locale. Numeric mode parses the first number after a non-numeric prefix; non-numeric lines sort after numbers in ascending order. Blank lines are retained; line endings in output are normalized to LF.' }),
      actionsRow(btn({ label: 'Sort', icon: 'sort', onClick: run }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'text-diff'(root) {
    const a = textarea({ rows: 10, placeholder: 'Original text…' });
    const b = textarea({ rows: 10, placeholder: 'Changed text…' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Differences', copy: false });
    const onlyChanges = switchChip({ label: 'Show changed lines only', checked: false });
    const versions = [0, 0]; let report = '';
    window.addEventListener('pagehide', () => { versions[0]++; versions[1]++; }, { once:true });
    const clearReport = () => { report = ''; out.placeholder(); copy.disabled = true; download.disabled = true; };
    const copy = btn({ label:'Copy report', variant:'secondary', onClick: async () => {
      const text = report; if (!text) return;
      const ok = await copyText(text); if (report === text) status.set(ok ? 'Report copied.' : 'Copy failed; select the displayed result and copy manually.', ok ? 'success' : 'error');
    } });
    const download = btn({ label:'Download report', variant:'secondary', icon:'download', onClick: () => {
      if (!report) return; const ok = downloadBlob(new Blob([report], {type:'text/plain;charset=utf-8'}), 'text-diff-report.txt');
      status.set(ok ? 'Report download requested. Check your browser downloads.' : 'Could not start the download.', ok ? 'success' : 'error');
    } });
    copy.disabled = download.disabled = true;
    const invalidate = side => { if (side !== null) versions[side]++; clearReport(); status.set('Input or settings changed. Compare again.', 'info'); };
    a.addEventListener('input', () => invalidate(0)); b.addEventListener('input', () => invalidate(1));
    onlyChanges.addEventListener('change', () => invalidate(null));
    const makeImport = (side, control, title) => {
      const zone = dropzone({ accept: '.txt,.md,.csv,.json,.log,text/plain,application/json,text/csv', title, sub: 'UTF-8 text, up to 2 MiB and 500,000 characters; read locally.',
        onReject: () => { versions[side]++; zone.clear(); clearReport(); status.set('File rejected. Existing text was kept; choose a file up to 2 MiB.', 'error'); },
        onFiles: async files => {
          zone.clear(); const token = ++versions[side]; clearReport();
          try {
            const file = files[0]; if (!file || file.size > 2 * 1024 * 1024) throw new Error('File exceeds 2 MiB.');
            status.set(`Reading ${side ? 'changed' : 'original'} file locally…`, 'info');
            const bytes = await readFile(file, 'buffer'); if (token !== versions[side]) return;
            let text; try { text = new TextDecoder('utf-8', {fatal:true}).decode(bytes); } catch { throw new Error('File is not valid UTF-8 text.'); }
            if (text.length > 500000) throw new Error('File exceeds 500,000 characters.');
            control.value = text; clearReport(); status.set(`${side ? 'Changed' : 'Original'} file loaded. Compare when ready.`, 'success');
          } catch (e) { if (token === versions[side]) { clearReport(); status.set(`${e.message} Existing text was kept.`, 'error'); } }
        } });
      return zone;
    };
    const zoneA = makeImport(0, a, 'Choose original text file');
    const zoneB = makeImport(1, b, 'Choose changed text file');
    const run = () => {
      versions[0]++; versions[1]++; clearReport();
      if (!a.value && !b.value) { status.set('Enter text in at least one box.', 'warning'); return; }
      try {
        const ops = diffLines(a.value, b.value), sum = diffSummary(ops);
        const shown = onlyChanges.querySelector('input').checked ? ops.filter(o => o.type !== 'same') : ops;
        const lines = shown.map(o => `A:${o.a ?? '–'} B:${o.b ?? '–'} ${o.type === 'add' ? '+' : o.type === 'del' ? '-' : ' '} ${o.line}`);
        report = ['Text comparison report (line endings normalized; not a patch)', `Added: ${sum.add}, removed: ${sum.del}, unchanged: ${sum.same}`, onlyChanges.querySelector('input').checked ? 'Showing changed lines only' : 'Showing all lines', '', ...(lines.length ? lines : ['No changed lines.'])].join('\n');
        const view = h('div', { class: 'diff-view' }, shown.map((o, i) => h('span', { class: o.type === 'add' ? 'd-add' : o.type === 'del' ? 'd-del' : 'd-same', text: lines[i] })));
        if (shown.length) out.set(view); else out.set('No changed lines in this view.');
        copy.disabled = download.disabled = false;
        status.set(sum.unchanged ? 'No differences found — the texts match.' : `${sum.add} line${sum.add === 1 ? '' : 's'} added, ${sum.del} removed, ${sum.same} unchanged.`, sum.unchanged ? 'success' : 'info');
      } catch (e) { clearReport(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' }, h('div', {}, field({ label: 'Original', control: a }), zoneA), h('div', {}, field({ label: 'Changed', control: b }), zoneB)),
      onlyChanges,
      h('p', { class: 'hint', text: 'A = original line, B = changed line. A dash means no line on that side. Exact line comparison; line endings are normalized and a final newline counts as an extra blank line. Limits: 4,000 lines per side, 4 million table cells and 500,000 combined characters. The report is not a patch.' }),
      actionsRow(btn({ label: 'Compare', icon: 'diff', onClick: run }),
        btn({ label: 'Swap sides', variant: 'secondary', onClick: () => { versions[0]++; versions[1]++; [a.value, b.value] = [b.value, a.value]; clearReport(); status.set('Inputs swapped. Compare again.', 'info'); } }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { versions[0]++; versions[1]++; a.value = ''; b.value = ''; zoneA.clear(); zoneB.clear(); clearReport(); status.set('Cleared.'); } }), copy, download),
      status, h('br'), out.panel);
  },

  'slug-generator'(root) {
    const inp = textarea({ rows: 6, mono: false, value: '10 Great Coffee Shops in São Paulo — 2026 Edition!', placeholder: 'One title per line…' });
    const sep = segControl({ options: [{ v: '-', t: 'Hyphen (-)' }, { v: '_', t: 'Underscore (_)' }], value: '-', ariaLabel: 'Separator' });
    const stop = switchChip({ label: 'Remove stop words (a, the, of…)' });
    const keepCase = switchChip({ label: 'Keep original letter case' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Slugs' });
    [sep].forEach(control => control.addEventListener('click', () => { out.placeholder(); status.set('Settings changed. Run again.', 'info'); }));
    const invalidate = () => { out.placeholder(); status.set('Input or settings changed. Run again.', 'info'); };
    root.addEventListener('input', invalidate);
    root.addEventListener('change', invalidate);
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

  'morse-code-translator'(root) {
    const mode = segControl({ options: [{ v: 'encode', t: 'Text → Morse' }, { v: 'decode', t: 'Morse → Text' }], value: 'encode', ariaLabel: 'Direction' });
    const inp = textarea({ rows: 5, mono: false, placeholder: 'Type text, e.g. SOS', value: 'SOS' });
    const status = statusLine('Letters are separated by spaces, words by “ / ”. Press Play to hear it.');
    const out = resultPanel({ label: 'Translation' });
    let lastMorse = '';
    const run = () => {
      try {
        if (mode.getValue() === 'encode') {
          lastMorse = textToMorse(inp.value);
          out.set(lastMorse || '—');
          if (inp.value.trim()) status.set('Encoded ✓', 'success');
        } else {
          lastMorse = inp.value.trim();
          out.set(morseToText(inp.value) || '—');
          if (inp.value.trim()) status.set('Decoded ✓', 'success');
        }
      } catch (e) { lastMorse = ''; out.placeholder(); status.set(e.message, 'error'); }
    };
    let audioCtx = null;
    let playing = false;
    const play = () => {
      if (!lastMorse) { status.set('Nothing to play yet — enter text or code first.', 'warning'); return; }
      if (playing) return;
      try {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) { status.set('Audio playback is not available in this browser.', 'warning'); return; }
        audioCtx = audioCtx || new AC();
        audioCtx.resume();
        playing = true;
        const unit = 0.07; // seconds per dot
        let t = audioCtx.currentTime + 0.05;
        const beep = (dur) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.frequency.value = 650;
          osc.connect(gain); gain.connect(audioCtx.destination);
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.35, t + 0.008);
          osc.start(t);
          gain.gain.setValueAtTime(0.35, t + dur - 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          osc.stop(t + dur);
          t += dur + unit;
        };
        for (const ch of lastMorse) {
          if (ch === '.') beep(unit);
          else if (ch === '-') beep(unit * 3);
          else if (ch === ' ') t += unit * 2; // +1 trailing gap = 3-unit letter gap
          else if (ch === '/') t += unit * 4; // word gap
        }
        status.set('Playing…', 'info');
        setTimeout(() => { playing = false; status.set('Played ✓', 'success'); }, Math.max(50, (t - audioCtx.currentTime) * 1000));
      } catch { playing = false; status.set('Could not play audio here.', 'warning'); }
    };
    inp.addEventListener('input', run);
    mode.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setTimeout(() => {
      inp.placeholder = mode.getValue() === 'encode' ? 'Type text, e.g. SOS' : 'Type Morse, e.g. ... --- ...';
      run();
    }, 0)));
    root.append(field({ label: 'Direction', control: mode }),
      field({ label: 'Input', control: inp }),
      actionsRow(
        btn({ label: 'Translate', icon: 'morse', onClick: run }),
        btn({ label: 'Play sound', variant: 'secondary', icon: 'volume', onClick: play }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; lastMorse = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel,
      privacyNote('Translation and sound playback happen locally in your browser.'));
    run();
  },
};

export function mount(id) {
  import('../ui.js').then(({ mountTool }) => mountTool(id, defs));
}

export const __test = { textStats, convertCase, dedupeLines, sortLines, diffLines, diffSummary, slugify, lorem, textToMorse, morseToText };
