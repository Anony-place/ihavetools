// =============================================================================
// iHaveTools — Security tools: password-generator, password-strength-checker,
// random-string-generator. All randomness comes from crypto.getRandomValues
// with rejection sampling (no modulo bias).
// =============================================================================
import { h, field, input, textarea, select, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, statsGrid, toast, copyText, privacyNote, mountTool } from '../ui.js';

/* Unbiased random integer in [0, max) via rejection sampling */
export function randomInt(max, rng = globalThis.crypto) {
  if (!rng?.getRandomValues) throw new Error('Your browser does not provide crypto.getRandomValues. Please use a modern, secure browser.');
  if (!Number.isInteger(max) || max <= 0 || max > 4294967296) throw new Error('Invalid random range.');
  const limit = Math.floor(4294967296 / max) * max;
  const buf = new Uint32Array(1);
  let v;
  do { rng.getRandomValues(buf); v = buf[0]; } while (v >= limit);
  return v % max;
}
export function randomFrom(chars, rng) { const alphabet = Array.from(chars); return alphabet[randomInt(alphabet.length, rng)]; }

export const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
  lookalikes: 'Il1O0o|`\'"~;:,.{}[]()/\\',
};
export function buildCharset({ upper = true, lower = true, digits = true, symbols = true, excludeLookalikes = false, custom = '', exclude = '' } = {}) {
  let s = '';
  if (upper) s += CHARSETS.upper;
  if (lower) s += CHARSETS.lower;
  if (digits) s += CHARSETS.digits;
  if (symbols) s += CHARSETS.symbols;
  if (excludeLookalikes) s = [...s].filter((c) => !CHARSETS.lookalikes.includes(c)).join('');
  if (custom) s = custom;
  if (typeof exclude !== 'string' || exclude.length > 4096) throw new Error('Excluded characters must be at most 4096 UTF-16 code units.');
  if (Array.from(exclude).some(c => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff)) throw new Error('Excluded characters contain an unpaired Unicode surrogate.');
  if (exclude) { const removed = new Set([...exclude]); s = [...s].filter(c => !removed.has(c)).join(''); }
  if (!s) throw new Error('Select at least one character set (or provide a custom alphabet).');
  if (s.length > 4096) throw new Error('Alphabet must be at most 4096 UTF-16 code units.');
  if (Array.from(s).some(c => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff)) throw new Error('The alphabet contains an unpaired Unicode surrogate.');
  return [...new Set([...s])].join('');
}

const PASSWORD_SETS = ['upper', 'lower', 'digits', 'symbols'];
function passwordGroups(options) {
  if (options.custom) throw new Error('Required character sets cannot be combined with a custom alphabet.');
  const groups = PASSWORD_SETS.filter(key => options[key] ?? true).map(key => {
    const only = Object.fromEntries(PASSWORD_SETS.map(k => [k, k === key]));
    try { return buildCharset({ ...only, excludeLookalikes: options.excludeLookalikes, exclude: options.exclude }); }
    catch (error) {
      if (/Select at least one character set/.test(error.message)) throw new Error(`No characters remain in the selected ${key} set. Change exclusions or deselect it.`);
      throw error;
    }
  });
  if (!groups.length) throw new Error('Select at least one character set.');
  return groups;
}
/** Number of valid suffixes for each number of remaining characters and coverage mask. */
function coverageCounts(length, groups) {
  if (length < groups.length) throw new Error('Length must be at least the number of selected character sets.');
  const full = (1 << groups.length) - 1;
  const counts = [Array.from({ length: full + 1 }, (_, mask) => mask === full ? 1n : 0n)];
  for (let n = 1; n <= length; n++) {
    counts.push(Array.from({ length: full + 1 }, (_, mask) => groups.reduce((sum, chars, i) => sum + BigInt(chars.length) * counts[n - 1][mask | (1 << i)], 0n)));
  }
  return counts;
}
function randomBigInt(max, rng = globalThis.crypto) {
  if (!rng?.getRandomValues) throw new Error('Your browser does not provide crypto.getRandomValues. Please use a modern, secure browser.');
  if (max <= 0n) throw new Error('Invalid random range.');
  if (max === 1n) return 0n;
  const bits = (max - 1n).toString(2).length;
  const words = Math.ceil(bits / 32), topBits = bits - (words - 1) * 32;
  const buffer = new Uint32Array(words);
  let value;
  do {
    rng.getRandomValues(buffer);
    if (topBits < 32) buffer[0] &= (2 ** topBits - 1);
    value = buffer.reduce((n, word) => (n << 32n) + BigInt(word), 0n);
  } while (value >= max);
  return value;
}
function log2BigInt(value) {
  const bits = value.toString(2).length;
  const shift = Math.max(0, bits - 53);
  return Math.log2(Number(value >> BigInt(shift))) + shift;
}
export function passwordSpaceBits(length, charset) {
  if (!Number.isInteger(length) || length < 4 || length > 256) throw new Error('Password length must be between 4 and 256.');
  if (!charset?.requireEach) return passwordEntropyBits(length, Array.from(buildCharset(charset)).length);
  const groups = passwordGroups(charset);
  return log2BigInt(coverageCounts(length, groups)[length][0]);
}
export function generatePassword(length, charset = {}, rng) {
  if (!Number.isInteger(length) || length < 4 || length > 256) throw new Error('Password length must be between 4 and 256.');
  if (!charset.requireEach) {
    const chars = buildCharset(charset);
    return Array.from({ length }, () => randomFrom(chars, rng)).join('');
  }
  const groups = passwordGroups(charset), counts = coverageCounts(length, groups);
  let mask = 0, result = '';
  for (let left = length; left > 0; left--) {
    let choice = randomBigInt(counts[left][mask], rng);
    for (let i = 0; i < groups.length; i++) {
      const next = mask | (1 << i);
      const weight = BigInt(groups[i].length) * counts[left - 1][next];
      if (choice < weight) { result += randomFrom(groups[i], rng); mask = next; break; }
      choice -= weight;
    }
  }
  return result;
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
  const contained = [...COMMON].map(c => c.toLowerCase()).find((c) => c.length >= 6 && lower.includes(c));
  if (contained) { bits = Math.min(bits, 8); issues.push(`It contains the common password “${contained}” — dictionary attacks try these first, regardless of what surrounds them.`); }
  if (pw.length < 8) issues.push('Shorter than 8 characters — length is the strongest predictor of strength. Aim for 14+.');
  if (/^(.)\1+$/.test(pw)) { bits = Math.min(bits, 6); issues.push('All characters are identical.'); }
  if (/^(?:012|123|234|345|456|567|678|789|abc|bcd|cde|def|qwe|wer|asd|zxc)+/i.test(pw)) { bits *= 0.6; issues.push('Starts with a keyboard or alphabet sequence (like “qwerty” or “123”).'); }
  if (/(.)\1{2,}/.test(pw)) { bits *= 0.85; issues.push('Contains a repeated character run (like “aaa” or “111”).'); }
  if (/^(19|20)\d{2}$/.test(pw) || /(19|20)\d{2}$/.test(pw)) issues.push('Ends with what looks like a year — dates are among the first patterns attackers try.');
  if (/^[A-Z][a-z]+\d+[!@#$]?$/.test(pw)) { bits *= 0.7; issues.push('Matches the very common “Word + digits + symbol” pattern.'); }
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
  if (!issues.length && !advice.length) advice.push('No listed pattern detected; this does not prove the password is strong. Use a unique random password and a password manager.');
  return { bits, verdict, cls, issues, advice, pool };
}

const defs = {
  'password-generator'(root) {
    const length = input({ type: 'number', min: 4, max: 256, value: '20' });
    const range = input({ type: 'range', min: 4, max: 64, value: '20', 'aria-label': 'Password length' });
    range.addEventListener('input', () => { length.value = range.value; });
    length.addEventListener('input', () => { if (Number(length.value) >= 4 && Number(length.value) <= 64) range.value = length.value; });
    const sets = ['upper', 'lower', 'digits', 'symbols'].map((s) => switchChip({ label: { upper: 'A–Z', lower: 'a–z', digits: '0–9', symbols: '!@#…' }[s], checked: s !== 'symbols' ? true : true, name: s }));
    const noLook = switchChip({ label: 'Exclude look-alikes (I, l, 1, O, 0…)' });
    const requireEach = switchChip({ label: 'Include each selected character type' });
    const exclude = input({ type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'Characters to omit (optional)' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Password', copy: true, placeholder: 'Click Generate.' });
    out.panel.querySelector('.result-body pre').style.cssText = 'font-size:1.15rem;word-break:break-all;font-weight:600';
    const meter = h('div', {});
    const gen = () => {
      const opts = {};
      sets.forEach((c) => { opts[c.querySelector('input').name] = c.querySelector('input').checked; });
      try {
        const config = { ...opts, excludeLookalikes: noLook.querySelector('input').checked, exclude: exclude.value, requireEach: requireEach.querySelector('input').checked };
        const pw = generatePassword(Number(length.value), config);
        out.set(pw);
        const cs = Array.from(buildCharset(config)).length;
        const bits = passwordSpaceBits(Number(length.value), config);
        meter.replaceChildren(
          h('div', { class: 'strength-meter' }, h('div', { style: `width:${Math.min(100, (bits / 128) * 100)}%;background:${bits >= 75 ? 'var(--success)' : bits >= 50 ? 'var(--warning)' : 'var(--danger)'}` })),
          h('p', { class: 'status-line info', text: `Entropy: ${bits.toFixed(0)} bits (${bits >= 75 ? 'excellent' : bits >= 50 ? 'decent — go longer for critical accounts' : 'too weak for real accounts'}) · Alphabet size: ${cs} · ${config.requireEach ? 'Uniform among passwords covering each selected type' : 'Independent uniform random characters'}` }));
        status.set(`Generated a ${pw.length}-character password locally ✓`, 'success');
      } catch (e) { out.placeholder(); meter.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.addEventListener('input', () => { out.placeholder(); meter.replaceChildren(); status.set('Settings changed. Generate a new password.', 'info'); });
    root.addEventListener('change', () => { out.placeholder(); meter.replaceChildren(); status.set('Settings changed. Generate a new password.', 'info'); });
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Length (4–256)', control: length }),
        field({ label: 'Quick pick', control: range })),
      h('div', { class: 'field' }, h('span', { class: 'field-legend', text: 'Character sets' }), h('div', { class: 'switch-row' }, sets[0], sets[1], sets[2], sets[3], noLook, requireEach)),
      field({ label: 'Exclude specific characters', control: exclude, hint: 'Optional: remove characters your destination does not accept. Spaces are treated as characters.' }),
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
        { label: 'Heuristic verdict', value: r.verdict, kind: r.cls },
        { label: 'Heuristic score (not entropy)', value: `${r.bits.toFixed(0)}` },
        { label: 'Length', value: `${pw.value.length}` },
      ]);
      details.replaceChildren(
        ...(r.issues.length ? [h('div', { class: 'error-banner' }, h('div', {}, h('strong', { text: 'Weaknesses detected' }), ...r.issues.map((i) => h('div', { text: `• ${i}` }))))] : []),
        h('h3', { text: 'How to make it stronger', style: 'margin:14px 0 6px' }),
        h('ul', { style: 'margin:0;padding-left:20px;color:var(--text-2);font-size:.93rem' }, r.advice.map((a) => h('li', { text: a }))),
        h('p', { class: 'hint', style: 'margin-top:10px', text: 'This simple pattern heuristic cannot determine real entropy, predict crack time, detect breaches, or guarantee safety. Use unique randomly generated passwords and MFA.' }));
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
      alnum: buildCharset({ symbols: false }), hex: '0123456789abcdef', base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
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
        const n = Number(count.value), len = Number(length.value);
        if (!Number.isInteger(n) || n < 1 || n > 100 || !Number.isInteger(len) || len < 1 || len > 256) throw new Error('Count and length must be whole numbers within the displayed limits.');
        const raw = preset.value === 'custom' ? custom.value : PRESETS[preset.value];
        if (!raw) throw new Error('Type a custom alphabet first.');
        const charset = buildCharset({custom: raw});
        current = Array.from({ length: n }, () => Array.from({ length: len }, () => randomFrom(charset)).join(''));
        render();
        status.set(`${n} strings of ${len} characters · entropy per string ≈ ${(len * Math.log2(Array.from(charset).length)).toFixed(0)} bits`, 'success');
      } catch (e) { current = []; render(); status.set(e.message, 'error'); }
    };
    root.addEventListener('input', () => { current = []; render(); status.set('Settings changed. Generate new strings.', 'info'); });
    root.addEventListener('change', () => { current = []; render(); status.set('Settings changed. Generate new strings.', 'info'); });
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
export const __test = { randomInt, buildCharset, generatePassword, passwordEntropyBits, passwordSpaceBits, analyzePassword, CHARSETS };
