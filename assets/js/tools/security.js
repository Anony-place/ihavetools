// =============================================================================
// iHaveTools — Security tools: password-generator, password-strength-checker,
// random-string-generator. All randomness comes from crypto.getRandomValues
// with rejection sampling (no modulo bias).
// =============================================================================
import { h, field, input, textarea, select, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, statsGrid, toast, copyText, privacyNote, mountTool } from '../ui.js';

/* Unbiased random integer in [0, max) via rejection sampling */
export function randomInt(max, rng = globalThis.crypto) {
  if (!rng?.getRandomValues) throw new Error('Your browser does not provide crypto.getRandomValues. Please use a modern, secure browser.');
  if (max <= 0 || max > 4294967296) throw new Error('Invalid random range.');
  const limit = Math.floor(4294967296 / max) * max;
  const buf = new Uint32Array(1);
  let v;
  do { rng.getRandomValues(buf); v = buf[0]; } while (v >= limit);
  return v % max;
}
export function randomFrom(chars, rng) { return chars[randomInt(chars.length, rng)]; }

export const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
  lookalikes: 'Il1O0o|`\'"~;:,.{}[]()/\\',
};
export function buildCharset({ upper = true, lower = true, digits = true, symbols = true, excludeLookalikes = false, custom = '' } = {}) {
  let s = '';
  if (upper) s += CHARSETS.upper;
  if (lower) s += CHARSETS.lower;
  if (digits) s += CHARSETS.digits;
  if (symbols) s += CHARSETS.symbols;
  if (excludeLookalikes) s = [...s].filter((c) => !CHARSETS.lookalikes.includes(c)).join('');
  if (custom) s = custom;
  if (!s) throw new Error('Select at least one character set (or provide a custom alphabet).');
  return [...new Set([...s])].join('');
}

export function generatePassword(length, charset, rng) {
  if (!(length >= 4 && length <= 256)) throw new Error('Password length must be between 4 and 256.');
  const chars = buildCharset(charset);
  return Array.from({ length }, () => randomFrom(chars, rng)).join('');
}
export function passwordEntropyBits(length, charsetSize) {
  return Math.log2(charsetSize) * length;
}

/* Strength analysis (offline-attack model: 1e10 guesses/sec) */
const COMMON = new Set(['123456','password','123456789','12345678','12345','qwerty','1234567','111111','1234567890','123123','abc123','1234','password1','iloveyou','000000','qwerty123','zaq12wsx','dragon','sunshine','princess','letmein','654321','monkey','27653','1qaz2wsx','123321','qwertyuiop','superman','asdfghjkl','admin','welcome','login','master','hello','freedom','whatever','qazwsx','trustno1','batman','passw0rd','football','baseball','starwars','silver','white','whatever','cookie','flower','shadow','michael','ninja','solo','summer','winter','spring','test','abcd1234','asdf','zxcvbnm','qwerty12','987654321','123abc','file13','kittycat','9876543210','asdfgh','p@ssw0rd','passwort','pass1234','senha123','qwerty123456','1q2w3e4r','112233','121212','gamer','abcdef','aaaaaa','Password123','P@ssword1','Admin123']);
export function analyzePassword(pw) {
  if (!pw) return null;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33;
  let bits = pw.length * Math.log2(pool || 1);
  const issues = [];
  const lower = pw.toLowerCase();
  const contained = [...COMMON].find((c) => c.length >= 6 && lower.includes(c));
  if (contained) { bits = Math.min(bits, 8); issues.push(`It contains the common password “${contained}” — dictionary attacks try these first, regardless of what surrounds them.`); }
  if (pw.length < 8) issues.push('Shorter than 8 characters — length is the strongest predictor of strength. Aim for 14+.');
  if (/^(.)\1+$/.test(pw)) { bits = Math.min(bits, 6); issues.push('All characters are identical.'); }
  if (/^(?:012|123|234|345|456|567|678|789|abc|bcd|cde|def|qwe|wer|asd|zxc)+/i.test(pw)) { bits *= 0.6; issues.push('Starts with a keyboard or alphabet sequence (like “qwerty” or “123”).'); }
  if (/(.)\1{2,}/.test(pw)) { bits *= 0.85; issues.push('Contains a repeated character run (like “aaa” or “111”).'); }
  if (/^(19|20)\d{2}$/.test(pw) || /(19|20)\d{2}$/.test(pw)) issues.push('Ends with what looks like a year — dates are among the first patterns attackers try.');
  if (/^[A-Z][a-z]+\d+[!@#$]?$/.test(pw)) { bits *= 0.7; issues.push('Matches the very common “Word + digits + symbol” pattern.'); }
  const guesses = Math.pow(2, Math.min(bits, 128));
  const guessesPerSec = 1e10; // offline attack on a strong hash
  const seconds = guesses / guessesPerSec;
  const crackTime = humanSeconds(seconds);
  let verdict, cls;
  if (bits < 28) { verdict = 'Very weak'; cls = 'bad'; }
  else if (bits < 40) { verdict = 'Weak'; cls = 'bad'; }
  else if (bits < 60) { verdict = 'Fair'; cls = 'warn'; }
  else if (bits < 75) { verdict = 'Strong'; cls = 'good'; }
  else { verdict = 'Very strong'; cls = 'good'; }
  const advice = [];
  if (pw.length < 14) advice.push('Make it longer — each extra character multiplies the work for an attacker.');
  if (!/\d/.test(pw)) advice.push('Add digits.');
  if (!/[^A-Za-z0-9]/.test(pw)) advice.push('Add symbols.');
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw)) advice.push('Mix upper and lower case.');
  if (!issues.length && !advice.length) advice.push('Nothing to fix — just never reuse this password on another site.');
  return { bits, verdict, cls, crackTime, issues, advice, pool };
}
function humanSeconds(s) {
  if (!Number.isFinite(s)) return 'beyond estimation';
  if (s < 1) return 'instantly';
  const units = [['second', 1], ['minute', 60], ['hour', 3600], ['day', 86400], ['month', 2629800], ['year', 31557600], ['thousand years', 31557600e3], ['million years', 31557600e6], ['billion years', 31557600e9]];
  let out = 'instantly';
  for (const [name, size] of units) {
    if (s >= size) out = `${fmtCompact(s / size)} ${name}${s / size >= 2 ? 's' : ''}`;
  }
  return out;
}
const fmtCompact = (n) => n >= 1e12 ? n.toExponential(1).replace('e+', '×10^') : n.toLocaleString('en-US', { maximumFractionDigits: 1 });

const defs = {
  'password-generator'(root) {
    const length = input({ type: 'number', min: 4, max: 256, value: '20' });
    const range = input({ type: 'range', min: 4, max: 64, value: '20', 'aria-label': 'Password length' });
    range.addEventListener('input', () => { length.value = range.value; });
    length.addEventListener('input', () => { if (Number(length.value) >= 4 && Number(length.value) <= 64) range.value = length.value; });
    const sets = ['upper', 'lower', 'digits', 'symbols'].map((s) => switchChip({ label: { upper: 'A–Z', lower: 'a–z', digits: '0–9', symbols: '!@#…' }[s], checked: s !== 'symbols' ? true : true, name: s }));
    const noLook = switchChip({ label: 'Exclude look-alikes (I, l, 1, O, 0…)' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Password', copy: true, placeholder: 'Click Generate.' });
    out.panel.querySelector('.result-body pre').style.cssText = 'font-size:1.15rem;word-break:break-all;font-weight:600';
    const meter = h('div', {});
    const gen = () => {
      const opts = {};
      sets.forEach((c) => { opts[c.querySelector('input').name] = c.querySelector('input').checked; });
      try {
        const pw = generatePassword(Math.max(4, Math.min(256, Number(length.value) || 20)), { ...opts, excludeLookalikes: noLook.querySelector('input').checked });
        out.set(pw);
        const cs = buildCharset({ ...opts, excludeLookalikes: noLook.querySelector('input').checked }).length;
        const bits = passwordEntropyBits(pw.length, cs);
        meter.replaceChildren(
          h('div', { class: 'strength-meter' }, h('div', { style: `width:${Math.min(100, (bits / 128) * 100)}%;background:${bits >= 75 ? 'var(--success)' : bits >= 50 ? 'var(--warning)' : 'var(--danger)'}` })),
          h('p', { class: 'status-line info', text: `Entropy: ${bits.toFixed(0)} bits (${bits >= 75 ? 'excellent' : bits >= 50 ? 'decent — go longer for critical accounts' : 'too weak for real accounts'}) · Alphabet size: ${cs} · Crack estimate: ${analyzePassword(pw).crackTime}` }));
        status.set(`Generated a ${pw.length}-character password locally ✓`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Length (4–256)', control: length }),
        field({ label: 'Quick pick', control: range })),
      h('div', { class: 'field' }, h('span', { class: 'field-legend', text: 'Character sets' }), h('div', { class: 'switch-row' }, sets[0], sets[1], sets[2], sets[3], noLook)),
      actionsRow(btn({ label: 'Generate', icon: 'refresh', onClick: gen }),
        btn({ label: 'Copy', variant: 'secondary', icon: 'copy', onClick: async () => { const t = out.text; if (!t) { toast('Generate a password first', 'error'); return; } (await copyText(t)) ? toast('Password copied — handle it carefully', 'success') : toast('Copy failed', 'error'); } })),
      status, h('br'), out.panel, meter,
      privacyNote('Passwords are generated in your browser with crypto.getRandomValues and are never sent anywhere.'));
    gen();
  },

  'password-strength-checker'(root) {
    const pw = input({ type: 'text', placeholder: 'Type a test password (not a real one!)', autocomplete: 'off', spellcheck: 'false' });
    const meter = h('div', { class: 'strength-meter' }, h('div'));
    const grid = statsGrid();
    const status = statusLine('Analysis happens locally — nothing you type is transmitted or stored.');
    const details = h('div', {});
    const render = () => {
      const r = analyzePassword(pw.value);
      if (!pw.value) { meter.firstChild.style.width = '0'; grid.replaceChildren(); details.replaceChildren(); status.set('Type a test password to analyse.', 'info'); return; }
      meter.firstChild.style.width = `${Math.min(100, (r.bits / 100) * 100)}%`;
      meter.firstChild.style.background = r.cls === 'good' ? 'var(--success)' : r.cls === 'warn' ? 'var(--warning)' : 'var(--danger)';
      grid.set([
        { label: 'Verdict', value: r.verdict, kind: r.cls },
        { label: 'Entropy', value: `${r.bits.toFixed(0)} bits` },
        { label: 'Length', value: `${pw.value.length}` },
        { label: 'Crack time*', value: r.crackTime, kind: r.cls },
      ]);
      details.replaceChildren(
        ...(r.issues.length ? [h('div', { class: 'error-banner' }, h('div', {}, h('strong', { text: 'Weaknesses detected' }), ...r.issues.map((i) => h('div', { text: `• ${i}` }))))] : []),
        h('h3', { text: 'How to make it stronger', style: 'margin:14px 0 6px' }),
        h('ul', { style: 'margin:0;padding-left:20px;color:var(--text-2);font-size:.93rem' }, r.advice.map((a) => h('li', { text: a }))),
        h('p', { class: 'hint', style: 'margin-top:10px', text: '*Crack time assumes an offline attack against a strong hash at 10 billion guesses per second. Against weak hashes or online forms, times shrink dramatically.' }));
      status.set('Analysed locally ✓', 'success');
    };
    pw.addEventListener('input', render);
    root.append(field({ label: 'Password to test', control: pw, hint: 'Test a pattern similar to yours — not your actual password.' }),
      meter, grid, details, status,
      privacyNote('This checker runs entirely in your browser. Nothing you type is sent, logged, or stored.'));
  },

  'random-string-generator'(root) {
    const count = input({ type: 'number', min: 1, max: 100, value: '10' });
    const length = input({ type: 'number', min: 1, max: 256, value: '32' });
    const preset = select({ options: [
      { v: 'alnum', t: 'Letters + digits' }, { v: 'hex', t: 'Hexadecimal (0-9a-f)' }, { v: 'base58', t: 'Base58 (no look-alikes)' },
      { v: 'digits', t: 'Digits only' }, { v: 'letters', t: 'Letters only' }, { v: 'all', t: 'Letters + digits + symbols' }, { v: 'custom', t: 'Custom…' },
    ], value: 'alnum' });
    const custom = input({ type: 'text', value: '', placeholder: 'Your custom alphabet', hidden: true });
    preset.addEventListener('change', () => { custom.hidden = preset.value !== 'custom'; });
    const status = statusLine('Ready.');
    const listWrap = h('div', { class: 'file-list' });
    let current = [];
    const PRESETS = {
      alnum: buildCharset({}), hex: '0123456789abcdef', base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
      digits: '0123456789', letters: buildCharset({ digits: false, symbols: false }), all: buildCharset({ symbols: true }),
    };
    const render = () => {
      listWrap.replaceChildren(...current.map((s) => h('div', { class: 'file-row' },
        h('code', { class: 'mono', text: s, style: 'overflow-wrap:anywhere;flex:1' }),
        h('span', { class: 'fr-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `Copy ${s}`, onclick: async () => { (await copyText(s)) ? toast('Copied', 'success') : toast('Copy failed', 'error'); } }, 'Copy')))));
    };
    const gen = () => {
      try {
        const n = Math.max(1, Math.min(100, Number(count.value) || 1));
        const len = Math.max(1, Math.min(256, Number(length.value) || 1));
        count.value = String(n); length.value = String(len);
        const charset = preset.value === 'custom' ? custom.value : PRESETS[preset.value];
        if (!charset) throw new Error('Type a custom alphabet first.');
        current = Array.from({ length: n }, () => Array.from({ length: len }, () => randomFrom(charset)).join(''));
        render();
        status.set(`${n} strings of ${len} characters · entropy per string ≈ ${(len * Math.log2(charset.length)).toFixed(0)} bits`, 'success');
      } catch (e) { status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'How many (1–100)', control: count }),
        field({ label: 'Length (1–256)', control: length }),
        field({ label: 'Character set', control: preset }),
        field({ label: 'Custom alphabet', control: custom })),
      actionsRow(btn({ label: 'Generate', icon: 'shuffle', onClick: gen }),
        btn({ label: 'Copy all', variant: 'secondary', icon: 'copy', onClick: async () => { if (!current.length) { toast('Generate first', 'error'); return; } (await copyText(current.join('\n'))) ? toast('All strings copied', 'success') : toast('Copy failed', 'error'); } })),
      status, listWrap);
    gen();
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { randomInt, buildCharset, generatePassword, passwordEntropyBits, analyzePassword, CHARSETS };
