// =============================================================================
// iHaveTools — Student tools: scientific-calculator, fraction-calculator,
// time-duration-calculator, cgpa-calculator, attendance-calculator
// =============================================================================
import { h, field, input, textarea, select, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, statsGrid, table, toast, copyText, mountTool, shareState } from '../ui.js';

/* ═══════════════════════════ Expression engine (recursive descent) ═══════════════════════════ */
const FUNCS1 = {
  sin: (x) => Math.sin(x), cos: (x) => Math.cos(x), tan: (x) => Math.tan(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: (x) => { if (x < 0) throw new Error('sqrt of a negative number is not a real number.'); return Math.sqrt(x); },
  cbrt: Math.cbrt, abs: Math.abs, ln: (x) => { if (x <= 0) throw new Error('logarithms need a positive input.'); return Math.log(x); },
  log: (x) => { if (x <= 0) throw new Error('logarithms need a positive input.'); return Math.log10(x); },
  log2: (x) => { if (x <= 0) throw new Error('logarithms need a positive input.'); return Math.log2(x); },
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
};
const CONSTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

export function evaluate(input, { degrees = false, factorial = true } = {}) {
  const src = String(input).replace(/[−×÷]/g, ch => ({ '−': '-', '×': '*', '÷': '/' })[ch]);
  if (src.length > 512) throw new Error('Expressions are limited to 512 characters.');
  let depth = 0;
  for (const ch of src) { if (ch === '(' && ++depth > 64) throw new Error('Expressions are limited to 64 levels of parentheses.'); if (ch === ')') depth--; }
  let pos = 0;
  const skip = () => { while (pos < src.length && /\s/.test(src[pos])) pos++; };
  const peek = () => { skip(); return src[pos]; };
  const D2R = degrees ? Math.PI / 180 : 1;
  const R2D = degrees ? 180 / Math.PI : 1;

  function parseExpr() {
    let v = parseTerm();
    for (;;) {
      const c = peek();
      if (c === '+') { pos++; v += parseTerm(); }
      else if (c === '-') { pos++; v -= parseTerm(); }
      else return v;
    }
  }
  function parseTerm() {
    let v = parseUnary();
    for (;;) {
      const c = peek();
      if (c === '*') { pos++; v *= parseUnary(); }
      else if (c === '/') { pos++; const d = parseUnary(); if (d === 0) throw new Error('Division by zero.'); v /= d; }
      else if (c === '%') { pos++; const d = parseUnary(); if (d === 0) throw new Error('Modulo by zero.'); v %= d; }
      else return v;
    }
  }
  function parseUnary() {
    const c = peek();
    if (c === '-') { pos++; return -parseUnary(); }
    if (c === '+') { pos++; return parseUnary(); }
    return parsePower();
  }
  function parsePower() {
    let base = parsePostfix();
    if (peek() === '^') { pos++; const exp = parseUnary(); base = Math.pow(base, exp); }
    return base;
  }
  function parsePostfix() {
    let v = parseAtom();
    while (peek() === '!') {
      if (!factorial) break;
      pos++;
      if (!(Number.isInteger(v) && v >= 0 && v <= 170)) throw new Error('Factorial needs a whole number between 0 and 170.');
      let f = 1;
      for (let k = 2; k <= v; k++) f *= k;
      v = f;
    }
    return v;
  }
  function parseAtom() {
    const c = peek();
    if (c === undefined) throw new Error('The expression ends unexpectedly — something is missing.');
    if (c === '(') {
      pos++;
      const v = parseExpr();
      if (peek() !== ')') throw new Error('Missing a closing parenthesis.');
      pos++;
      return v;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(pos));
      if (!m) throw new Error('Invalid number.');
      pos += m[0].length;
      const v = Number(m[0]);
      if (!Number.isFinite(v)) throw new Error(`“${m[0]}” is not a valid finite number.`);
      if (v === 0 && /[1-9]/.test(m[0].split(/[eE]/)[0])) throw new Error('Number is too small to represent without rounding to zero.');
      return v;
    }
    if (/[a-zA-Z]/.test(c)) {
      let s = pos;
      while (pos < src.length && /[a-zA-Z0-9]/.test(src[pos])) pos++;
      const name = src.slice(s, pos).toLowerCase();
      if (Object.hasOwn(CONSTS, name)) {
        if (peek() === '(') throw new Error(`“${name}” is a constant — remove the parentheses.`);
        return CONSTS[name];
      }
      if (Object.hasOwn(FUNCS1, name)) {
        if (peek() !== '(') throw new Error(`“${name}” is a function — write it like ${name}(x).`);
        pos++;
        const arg = parseExpr();
        if (peek() !== ')') throw new Error(`Missing “)” after the ${name}(...) argument.`);
        pos++;
        // Reject exact degree-mode poles, but do not reject nearby finite angles.
        if (name === 'tan' && degrees && Number.isFinite(arg) && Math.abs(arg) <= Number.MAX_SAFE_INTEGER && Math.abs(arg % 180) === 90) throw new Error('Tangent is undefined at odd multiples of 90 degrees.');
        const trigIn = ['sin', 'cos', 'tan'].includes(name);
        const trigOut = ['asin', 'acos', 'atan'].includes(name);
        let r = FUNCS1[name](trigIn ? arg * D2R : arg);
        if (trigOut) r *= R2D;
        return r;
      }
      throw new Error(`Unknown name “${name}”. Known functions: ${Object.keys(FUNCS1).join(', ')}; constants: ${Object.keys(CONSTS).join(', ')}.`);
    }
    throw new Error(`Unexpected character “${c}” at position ${pos + 1}.`);
  }

  const result = parseExpr();
  skip();
  if (pos < src.length) throw new Error(`Unexpected “${src[pos]}” at position ${pos + 1} — check your operators.`);
  if (!Number.isFinite(result)) {
    if (Number.isNaN(result)) throw new Error('The result is not a number (NaN) — check your inputs.');
    throw new Error('The result is too large to represent.');
  }
  return result;
}

/* ═══════════════════════════ Fractions ═══════════════════════════ */
function safeFraction(n, d) {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new Error('Fraction is too large for exact integer arithmetic. Use smaller numbers.');
  return { n, d };
}
export function parseFraction(text) {
  if (String(text).length > 2048) throw new Error('Fraction input is limited to 2,048 characters.');
  const s = String(text).trim().replace(/\s+/g, ' ');
  let m = /^(-?)(\d+)\s+(\d+)\/(\d+)$/.exec(s); // mixed: -2 1/2
  if (m) {
    const [, sign, whole, num, den] = m;
    if (Number(den) === 0) throw new Error('A fraction cannot have a zero denominator.');
    return safeFraction((Number(whole) * Number(den) + Number(num)) * (sign ? -1 : 1), Number(den));
  }
  m = /^(-?) (\d+) \/ (\d+)$/.exec(s);
  if (m) {
    const [, sign, num, den] = m;
    if (Number(den) === 0) throw new Error('A fraction cannot have a zero denominator.');
    return safeFraction(Number(num) * (sign ? -1 : 1), Number(den));
  }
  m = /^(-?)(\d+)\/(\d+)$/.exec(s.replace(/\s/g, ''));
  if (m) {
    const [, sign, num, den] = m;
    if (Number(den) === 0) throw new Error('A fraction cannot have a zero denominator.');
    return safeFraction(Number(num) * (sign ? -1 : 1), Number(den));
  }
  if (/^-?\d+$/.test(s)) return safeFraction(Number(s), 1);
  throw new Error(`“${text}” is not a fraction. Write 3/4 or a mixed number like 2 1/2.`);
}
export function fractionCalc(aText, op, bText) {
  const a = parseFraction(aText), b = parseFraction(bText);
  const an = BigInt(a.n), ad = BigInt(a.d), bn = BigInt(b.n), bd = BigInt(b.d);
  let n, d;
  switch (op) {
    case '+': n = an * bd + bn * ad; d = ad * bd; break;
    case '-': n = an * bd - bn * ad; d = ad * bd; break;
    case '*': n = an * bn; d = ad * bd; break;
    case '/':
      if (bn === 0n) throw new Error('Division by the zero fraction is undefined.');
      n = an * bd; d = ad * bn; break;
    default: throw new Error('Unknown operation.');
  }
  const unsimplified = `${n}/${d}`;
  if (d < 0n) { n = -n; d = -d; }
  let x = n < 0n ? -n : n, y = d;
  while (y) [x, y] = [y, x % y];
  const divisor = x || 1n;
  n /= divisor; d /= divisor;
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (n > limit || n < -limit || d > limit) throw new Error('Fraction is too large for exact integer arithmetic. Use smaller numbers.');
  const simp = { n: Number(n), d: Number(d) };
  const mixed = (() => {
    const whole = Math.trunc(simp.n / simp.d);
    const rem = Math.abs(simp.n % simp.d);
    return whole !== 0 && rem !== 0 ? `${whole} ${rem}/${simp.d}` : whole !== 0 ? `${whole}` : null;
  })();
  return { result: `${simp.n}/${simp.d}`, mixed, decimal: simp.n / simp.d, unsimplified };
}

/* ═══════════════════════════ Time durations ═══════════════════════════ */
export function durationTotal(rows, op) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 1000 || !Array.isArray(op) || op.length !== rows.length - 1 || op.some(o => o !== '+' && o !== '-')) throw new Error('Enter 1–1,000 duration rows with valid + or − operators.');
  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length !== 3 || row.some(v => !Number.isSafeInteger(v) || v < 0) || row[0] > 1000000 || row[1] > 59 || row[2] > 59) throw new Error(`Row ${i + 1}: enter whole non-negative hours (up to 1,000,000), minutes and seconds (0–59).`);
    const secs = row[0] * 3600 + row[1] * 60 + row[2];
    total += (i > 0 && op[i - 1] === '-' ? -1 : 1) * secs;
  }
  const magnitude = Math.abs(total);
  const hh = Math.floor(magnitude / 3600), mm = Math.floor((magnitude % 3600) / 60), ss = magnitude % 60;
  const pad = x => String(x).padStart(2, '0');
  return { h: hh, m: mm, s: ss, text: `${total < 0 ? '-' : ''}${pad(hh)}:${pad(mm)}:${pad(ss)}`, decimalHours: total / 3600, totalSeconds: total };
}

/* ═══════════════════════════ CGPA + attendance ═══════════════════════════ */
export function cgpaToPercentage(cgpa, { scale = 10, multiplier = 9.5 } = {}) {
  if (!(scale > 0 && scale <= 100)) throw new Error('Enter a valid grade scale, such as 10 or 4.');
  if (!(multiplier > 0 && multiplier <= 100)) throw new Error('Enter the conversion multiplier used by your institution.');
  if (!(cgpa >= 0 && cgpa <= scale)) throw new Error(`CGPA must be between 0 and ${scale} on this scale.`);
  const raw = cgpa * multiplier;
  return { percentage: Math.min(100, raw), rawPercentage: raw, capped: raw > 100 };
}

export function percentageToCgpa(percentage, { scale = 10, multiplier = 9.5 } = {}) {
  if (!(scale > 0 && scale <= 100)) throw new Error('Enter a valid grade scale, such as 10 or 4.');
  if (!(multiplier > 0 && multiplier <= 100)) throw new Error('Enter the conversion multiplier used by your institution.');
  if (!(percentage >= 0 && percentage <= 100)) throw new Error('Percentage must be between 0 and 100.');
  const raw = percentage / multiplier;
  return { cgpa: Math.min(scale, raw), rawCgpa: raw, capped: raw > scale };
}

export function weightedGpa(subjects = []) {
  if (!Array.isArray(subjects) || subjects.length > 1000) throw new Error('Enter at most 1,000 subjects.');
  const rows = subjects.filter(s => s && !(String(s.credits ?? '').trim() === '' && String(s.gradePoint ?? '').trim() === ''));
  if (!rows.length) throw new Error('Add at least one subject with credits and a grade point.');
  let weighted = 0;
  let credits = 0;
  for (const [i, s] of rows.entries()) {
    const gp = Number(s.gradePoint);
    const cr = Number(s.credits);
    if (String(s.gradePoint ?? '').trim() === '' || String(s.credits ?? '').trim() === '' || !(gp >= 0 && gp <= 100) || !(cr > 0 && cr <= 1000)) throw new Error(`Subject ${i + 1}: enter a valid grade point and credits greater than zero.`);
    weighted += gp * cr;
    credits += cr;
  }
  return { gpa: weighted / credits, totalCredits: credits, weightedPoints: weighted, subjects: rows.length };
}

export function attendanceCalc({ held, attended, targetPct } = {}) {
  if (!Number.isSafeInteger(held) || held < 1 || held > 1000000000) throw new Error('Enter 1 to 1,000,000,000 classes held as a whole number.');
  if (!Number.isSafeInteger(attended) || attended < 0 || attended > held) throw new Error('Classes attended must be a whole number between 0 and classes held.');
  const targetText = String(targetPct);
  if (!/^(?:\d+)(?:\.\d{1,6})?$/.test(targetText) || !(targetPct >= 1 && targetPct <= 100)) throw new Error('Target attendance must be from 1% to 100%, with at most 6 decimal places.');
  const [whole, fraction = ''] = targetText.split('.');
  const t = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  const scale = 100000000n, h = BigInt(held), a = BigInt(attended);
  const currentPct = attended / held * 100;
  let classesNeeded = 0, classesCanMiss = 0, impossible = false;
  if (a * scale >= t * h) classesCanMiss = Number(a * scale / t - h);
  else if (t === scale) { classesNeeded = null; impossible = true; }
  else { const numerator = t * h - a * scale, denominator = scale - t; const need = (numerator + denominator - 1n) / denominator; if (need + h > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Required class count exceeds the exact safe integer limit; choose a lower target.'); classesNeeded = Number(need); }
  return { currentPct, classesNeeded, classesCanMiss, impossible,
    projectedAttended: classesNeeded == null ? null : attended + classesNeeded,
    projectedHeld: classesNeeded == null ? null : held + classesNeeded };
}

/** Finite end-of-term plan using the same exact six-decimal target arithmetic. */
export function attendanceTermPlan({ held, attended, targetPct, remaining }) {
  attendanceCalc({held, attended, targetPct});
  if (!Number.isSafeInteger(remaining) || remaining < 0 || remaining > 1000000000) throw new Error('Remaining classes must be a whole number from 0 to 1,000,000,000.');
  const [whole, fraction = ''] = String(targetPct).split('.');
  const target = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  const scale = 100000000n, total = BigInt(held) + BigInt(remaining);
  const neededTotal = (target * total + scale - 1n) / scale;
  const minimum = neededTotal > BigInt(attended) ? Number(neededTotal - BigInt(attended)) : 0;
  return { reachable: minimum <= remaining, minimumAttend: minimum <= remaining ? minimum : null,
    canMiss: minimum <= remaining ? remaining - minimum : null,
    maxFinalPct: (attended + remaining) / (held + remaining) * 100 };
}

/** Compare a particular future-attendance scenario against the exact target. */
export function attendanceScenario({ held, attended, targetPct, remaining, plannedAttend }) {
  const term = attendanceTermPlan({ held, attended, targetPct, remaining });
  if (!Number.isSafeInteger(plannedAttend) || plannedAttend < 0 || plannedAttend > remaining) throw new Error('Planned attendance must be a whole number between 0 and remaining classes.');
  const finalAttended = attended + plannedAttend, finalHeld = held + remaining;
  return { finalAttended, finalHeld, finalPct: finalAttended / finalHeld * 100,
    meetsTarget: term.reachable && plannedAttend >= term.minimumAttend };
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'scientific-calculator'(root) {
    let degrees = true;
    const inp = input({ type: 'text', class: 'input mono', placeholder: 'e.g. 2^10 + sin(30)*5', autocomplete: 'off', spellcheck: 'false', style: 'font-size:1.1rem' });
    const mode = segControl({ options: [{ v: 'deg', t: 'DEG' }, { v: 'rad', t: 'RAD' }], value: 'deg', ariaLabel: 'Angle unit' });
    mode.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { degrees = b.dataset.v === 'deg'; grid.replaceChildren(); status.set('Angle mode changed. Calculate again.', 'info'); }));
    const grid = statsGrid();
    const status = statusLine('');
    const history = h('ul', { class: 'calc-history' });
    const historyData = [];
    const show = (expr) => {
      try {
        const r = evaluate(expr, { degrees });
        grid.set([{ label: 'Result', value: String(Number(r.toPrecision(12))), kind: 'good' }]);
        status.set('Evaluated ✓', 'success');
        historyData.unshift({ expr, res: r, degrees });
        if (historyData.length > 30) historyData.pop();
        history.replaceChildren(...historyData.map((hh) => h('li', {},
          h('span', { class: 'h-expr', text: `${hh.expr} (${hh.degrees ? 'DEG' : 'RAD'})` }),
          h('button', { type: 'button', class: 'h-res', style: 'background:none;border:0;cursor:pointer;color:var(--primary);font:inherit;font-weight:700', text: `= ${Number(hh.res.toPrecision(12))}`, title: 'Reuse the full-precision result', onclick: () => { inp.value = String(hh.res); grid.replaceChildren(); status.set('History value loaded. Calculate again.', 'info'); inp.focus(); } }))));
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    const PAD = [
      ['(', ')', false], [')', ')', false], ['pi', 'const'], ['e', 'const'],
      ['7'], ['8'], ['9'], ['/', 'op'],
      ['4'], ['5'], ['6'], ['*', 'op'],
      ['1'], ['2'], ['3'], ['-', 'op'],
      ['0'], ['.'], ['!', 'op'], ['+', 'op'],
      ['sqrt(', 'fn'], ['^', 'op'], ['ln(', 'fn'], ['log(', 'fn'],
      ['sin(', 'fn'], ['cos(', 'fn'], ['tan(', 'fn'], ['exp(', 'fn'],
    ];
    const pad = h('div', { class: 'calc-pad' },
      PAD.map(([label, kind]) => h('button', { type: 'button', class: `btn ${kind && kind !== 'const' && kind !== 'fn' ? 'btn-fn' : ''}`, text: label, onclick: () => { inp.value += label; grid.replaceChildren(); status.set('Expression changed. Calculate again.', 'info'); inp.focus(); } })));
    root.append(
      field({ label: 'Expression', control: inp, hint: 'Supports + − × ÷ ^ ! %, parentheses, sqrt, cbrt, ln, log (base 10), log2, exp, abs, floor, ceil, round, sign, sin/cos/tan (+ inverses, hyperbolic), pi, e, tau, phi' }),
      h('div', { class: 'field-row', style: 'align-items:end;margin-bottom:8px' },
        field({ label: 'Angles', control: mode }),
        h('div', { class: 'field' }, btn({ label: 'Calculate', icon: 'calculator', onClick: () => show(inp.value) }))),
      grid, status,
      actionsRow(h('h3', { text: 'Keypad', style: 'margin:14px 0 4px' })),
      pad,
      h('h3', { text: 'History', style: 'margin:20px 0 6px' }),
      h('p', { class: 'hint', text: 'Results are displayed to 12 significant digits; history reuse inserts the full JavaScript number. Calculations use floating-point arithmetic.' }),
      actionsRow(btn({ label: 'Clear history', variant: 'ghost', onClick: () => { historyData.length = 0; history.replaceChildren(); status.set('History cleared.', 'info'); } })),
      historyWrap(history));
    inp.addEventListener('input', () => { grid.replaceChildren(); status.set('Expression changed. Calculate again.', 'info'); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); show(inp.value); } });
    function historyWrap(el) { return h('div', { class: 'result-panel result-body', style: 'padding:8px 14px;max-height:220px' }, el); }
  },

  'fraction-calculator'(root) {
    const a = input({ type: 'text', class: 'input mono', value: '3/4', placeholder: 'e.g. 3/4 or 2 1/2' });
    const b = input({ type: 'text', class: 'input mono', value: '5/6', placeholder: 'e.g. 5/6' });
    const op = segControl({ options: [{ v: '+', t: '+' }, { v: '-', t: '−' }, { v: '*', t: '×' }, { v: '/', t: '÷' }], value: '+', ariaLabel: 'Operation' });
    const grid = statsGrid();
    const status = statusLine('');
    const steps = h('p', { class: 'hint' });
    const run = () => {
      try {
        const r = fractionCalc(a.value, op.getValue(), b.value);
        grid.set([
          { label: 'Result', value: r.result, kind: 'good' },
          ...(r.mixed ? [{ label: 'Mixed number', value: r.mixed }] : []),
          { label: 'Decimal (approx.)', value: String(Number(r.decimal.toPrecision(8))) },
        ]);
        steps.textContent = `Working: (${a.value}) ${op.getValue()} (${b.value}) = ${r.unsimplified} → simplified to ${r.result}`;
        status.set('Calculated ✓', 'success');
      } catch (e) { grid.replaceChildren(); steps.textContent = ''; status.set(e.message, 'error'); }
    };
    [a, b].forEach(el => el.addEventListener('input', () => { grid.replaceChildren(); steps.textContent = ''; status.set('Input changed. Calculate again.', 'info'); }));
    op.addEventListener('click', () => { grid.replaceChildren(); steps.textContent = ''; status.set('Operation changed. Calculate again.', 'info'); });
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'First fraction', control: a }),
        field({ label: 'Operation', control: op }),
        field({ label: 'Second fraction', control: b })),
      actionsRow(btn({ label: 'Calculate', icon: 'divide', onClick: run })),
      grid, steps, status);
  },

  'time-duration-calculator'(root) {
    const rowsWrap = h('div', { class: 'file-list' });
    const grid = statsGrid();
    const status = statusLine('Tip: use this like a timesheet — add rows, then choose + or − between them.');
    let addButton;
    const updateRows = () => {
      const rows = [...rowsWrap.children];
      rows.forEach((row, i) => {
        const op = row.querySelector('select'); op.parentElement.hidden = i === 0;
        if (i === 0) op.value = '+';
        row.querySelector('.duration-row-number').textContent = `Row ${i + 1}`;
        row.querySelectorAll('input').forEach((el, j) => el.setAttribute('aria-label', `Row ${i + 1} ${['hours','minutes','seconds'][j]}`));
        op.setAttribute('aria-label', `Row ${i + 1} operation`);
        const remove = row.querySelector('button'); remove.disabled = rows.length === 1;
        remove.setAttribute('aria-label', `Remove row ${i + 1}`);
      });
      if (addButton) addButton.disabled = rows.length >= 1000;
    };
    const mkRow = () => {
      const hh = input({ type: 'number', min: 0, max: 1000000, step: '1', placeholder: 'h' });
      const mm = input({ type: 'number', min: 0, max: 59, step: '1', placeholder: 'm' });
      const ss = input({ type: 'number', min: 0, max: 59, step: '1', placeholder: 's' });
      const opSel = select({ options: [{ v: '+', t: '+' }, { v: '-', t: '−' }], value: '+' });
      const row = h('div', { class: 'file-row duration-row' },
        h('span', { class: 'hint duration-row-number' }), h('div', { style: 'width:64px' }, opSel), hh, mm, ss,
        h('span', { class: 'fr-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { row.remove(); updateRows(); grid.replaceChildren(); status.set('Rows changed. The first row is always added. Calculate again.', 'info'); } }, '✕')));
      row.getValues = () => [hh, mm, ss].map(el => el.value === '' ? 0 : Number(el.value));
      return row;
    };
    rowsWrap.append(mkRow(), mkRow());
    addButton = btn({ label: 'Add row', variant: 'secondary', icon: 'plus', onClick: () => { if (rowsWrap.children.length >= 1000) return; rowsWrap.append(mkRow()); updateRows(); grid.replaceChildren(); status.set('Rows changed. Calculate again.', 'info'); } });
    updateRows();
    const run = () => {
      const rowEls = [...rowsWrap.querySelectorAll('.file-row')];
      const rows = rowEls.map((r) => r.getValues());
      // operators are read in DOM order, so removing a middle row stays correct
      const rowOps = rowEls.slice(1).map((r) => (r.querySelector('select')?.value ?? '+'));
      try {
        const r = durationTotal(rows, rowOps);
        grid.set([
          { label: 'Total', value: r.text, kind: 'good' },
          { label: 'Decimal hours', value: r.decimalHours.toFixed(4) },
          { label: 'Whole minutes (toward zero)', value: (Math.trunc(r.totalSeconds / 60) || 0).toLocaleString() },
          { label: 'Total seconds', value: r.totalSeconds.toLocaleString() },
        ]);
        status.set('Calculated ✓', 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    rowsWrap.addEventListener('input', () => { grid.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); });
    rowsWrap.addEventListener('change', () => { grid.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); });
    root.append(
      rowsWrap, h('p', { class: 'hint', text: 'Blank fields count as zero. Enter whole non-negative hours up to 1,000,000 per row; minutes and seconds must be 0–59. The first row is always added. Up to 1,000 rows.' }),
      actionsRow(
        addButton,
        btn({ label: 'Calculate total', icon: 'hourglass', onClick: run })),
      grid, status);
  },

  'cgpa-calculator'(root) {
    const mode = segControl({ options: [{ v: 'to-pct', t: 'CGPA → Percentage' }, { v: 'to-cgpa', t: 'Percentage → CGPA' }], value: 'to-pct', ariaLabel: 'Conversion direction' });
    const value = input({ type: 'number', step: 'any', min: 0, value: '8.5' });
    const preset = select({ options: [
      { v: 'x95', t: '10-point × 9.5 (common CBSE-style)' },
      { v: 'linear10', t: '10-point linear (×10)' },
      { v: 'four', t: '4-point linear (×25)' },
      { v: 'custom', t: 'Custom scale / multiplier' },
    ], value: 'x95' });
    const scale = input({ type: 'number', step: 'any', value: '10' });
    const multiplier = input({ type: 'number', step: 'any', value: '9.5' });
    preset.addEventListener('change', () => {
      if (preset.value === 'x95') { scale.value = '10'; multiplier.value = '9.5'; }
      if (preset.value === 'linear10') { scale.value = '10'; multiplier.value = '10'; }
      if (preset.value === 'four') { scale.value = '4'; multiplier.value = '25'; }
    });
    const grid = statsGrid();
    const status = statusLine('Institutions publish their own conversion rules — always use the multiplier on your marksheet or university notice when one is given.');
    const fmt = (n, d = 2) => String(Number(n.toFixed(d)));
    const runConvert = () => {
      try {
        const options = { scale: scale.value === '' ? NaN : Number(scale.value), multiplier: multiplier.value === '' ? NaN : Number(multiplier.value) };
        if (value.value === '') throw new Error('Enter a value to convert.');
        if (mode.getValue() === 'to-pct') {
          const r = cgpaToPercentage(Number(value.value), options);
          grid.set([
            { label: 'Percentage', value: `${fmt(r.percentage)}%`, kind: 'good' },
            { label: 'Formula', value: `${value.value} × ${multiplier.value}` },
            { label: 'Scale', value: `${scale.value}-point` },
          ]);
          status.set(r.capped ? 'The raw multiplication exceeds 100%, so the result is capped at 100%.' : 'Converted ✓', r.capped ? 'warning' : 'success');
        } else {
          const r = percentageToCgpa(Number(value.value), options);
          grid.set([
            { label: 'CGPA', value: fmt(r.cgpa, 2), kind: 'good' },
            { label: 'Formula', value: `${value.value} ÷ ${multiplier.value}` },
            { label: 'Scale', value: `${scale.value}-point` },
          ]);
          status.set(r.capped ? `The raw result is ${fmt(r.rawCgpa, 2)}, so it is capped at the ${scale.value}-point maximum.` : 'Converted ✓', r.capped ? 'warning' : 'success');
        }
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };

    const rowsWrap = h('div', { class: 'file-list' });
    const sgpaGrid = statsGrid();
    const sgpaStatus = statusLine('');
    const mkRow = (grade = '', credits = '') => {
      const gp = input({ type: 'number', step: 'any', min: 0, placeholder: 'Grade point', value: grade });
      const cr = input({ type: 'number', step: 'any', min: 0, placeholder: 'Credits', value: credits });
      const row = h('div', { class: 'file-row' },
        h('span', { class: 'hint', text: 'Subject' }), gp, cr,
        h('span', { class: 'fr-actions' }, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Remove subject', onclick: () => { row.remove(); sgpaGrid.replaceChildren(); sgpaStatus.set('Subjects changed. Calculate again.', 'info'); } }, '✕')));
      row.getSubject = () => ({ gradePoint: gp.value, credits: cr.value });
      return row;
    };
    rowsWrap.append(mkRow('9', '4'), mkRow('8', '3'), mkRow('10', '2'));
    const runSgpa = () => {
      try {
        const subjects = [...rowsWrap.querySelectorAll('.file-row')].map((r) => r.getSubject());
        const r = weightedGpa(subjects);
        sgpaGrid.set([
          { label: 'SGPA / weighted GPA', value: fmt(r.gpa, 2), kind: 'good' },
          { label: 'Total credits', value: fmt(r.totalCredits, 2) },
          { label: 'Subjects counted', value: String(r.subjects) },
        ]);
        sgpaStatus.set(`Weighted points ${fmt(r.weightedPoints, 2)} ÷ total credits ${fmt(r.totalCredits, 2)}.`, 'success');
      } catch (e) { sgpaGrid.replaceChildren(); sgpaStatus.set(e.message, 'error'); }
    };

    const clearConversion = () => { grid.replaceChildren(); status.set('Input changed. Convert again.', 'info'); };
    [value, preset, scale, multiplier].forEach(el => { el.addEventListener('input', clearConversion); el.addEventListener('change', clearConversion); });
    mode.addEventListener('click', clearConversion);
    rowsWrap.addEventListener('input', () => { sgpaGrid.replaceChildren(); sgpaStatus.set('Subjects changed. Calculate again.', 'info'); });
    root.append(
      field({ label: 'Direction', control: mode }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Value to convert', control: value }),
        field({ label: 'Preset', control: preset }),
        field({ label: 'Grade scale', control: scale }),
        field({ label: 'Multiplier', control: multiplier })),
      actionsRow(btn({ label: 'Convert', icon: 'graduation', onClick: runConvert })),
      grid, status,
      h('h3', { text: 'SGPA from subjects', style: 'margin:24px 0 10px' }),
      h('p', { class: 'hint', text: 'Enter each subject’s grade point and credits. The SGPA is the credit-weighted average.' }),
      rowsWrap,
      actionsRow(
        btn({ label: 'Add subject', variant: 'secondary', icon: 'plus', onClick: () => { rowsWrap.append(mkRow()); sgpaGrid.replaceChildren(); sgpaStatus.set('Subjects changed. Calculate again.', 'info'); } }),
        btn({ label: 'Calculate SGPA', icon: 'calculator', onClick: runSgpa })),
      sgpaGrid, sgpaStatus);
    shareState(root, [
      ['mode', { get: () => mode.getValue(), set: (v) => mode.setValue(v) }],
      ['value', value], ['scale', scale], ['multiplier', multiplier],
    ], runConvert);
  },

  'attendance-calculator'(root) {
    const held = input({ type: 'number', step: '1', min: 1, value: '40' });
    const attended = input({ type: 'number', step: '1', min: 0, value: '28' });
    const target = input({ type: 'number', step: 'any', min: 1, max: 100, value: '75' });
    const remaining = input({type:'number', step:'1', min:0, max:1000000000, placeholder:'Optional'});
    const planned = input({type:'number', step:'1', min:0, max:1000000000, placeholder:'Optional'});
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      try {
        const r = attendanceCalc({ held: held.value === '' ? NaN : Number(held.value), attended: attended.value === '' ? NaN : Number(attended.value), targetPct: target.value === '' ? NaN : Number(target.value) });
        const targetLabel = `${Number(target.value)}% target`;
        const term = remaining.value === '' ? null : attendanceTermPlan({held:Number(held.value), attended:Number(attended.value), targetPct:Number(target.value), remaining:Number(remaining.value)});
        if (planned.value !== '' && remaining.value === '') throw new Error('Enter remaining classes to use a planned attendance scenario.');
        const scenario = planned.value === '' ? null : attendanceScenario({held:Number(held.value), attended:Number(attended.value), targetPct:Number(target.value), remaining:Number(remaining.value), plannedAttend:Number(planned.value)});
        grid.set([
          { label: 'Current attendance', value: `${r.currentPct.toFixed(2)}%`, kind: r.classesNeeded || r.impossible ? 'bad' : 'good' },
          r.impossible
            ? { label: targetLabel, value: 'No longer possible', kind: 'bad' }
            : r.classesNeeded
              ? { label: 'Attend next classes', value: String(r.classesNeeded), kind: 'warn' }
              : { label: 'Classes you can miss', value: String(r.classesCanMiss), kind: 'good' },
          { label: 'Attended / held', value: `${attended.value} / ${held.value}` },
          ...(term ? [term.reachable ? {label:'Attend in remaining classes', value:`${term.minimumAttend} of ${remaining.value}`, kind:'good'} : {label:'End-of-term target', value:'Not reachable', kind:'bad'}, {label:'Maximum final attendance', value:`${term.maxFinalPct.toFixed(2)}%`}, ...(term.reachable ? [{label:'Can miss by term end', value:String(term.canMiss)}] : [])] : []),
          ...(scenario ? [{label:'Planned final attendance', value:`${scenario.finalAttended} / ${scenario.finalHeld} (${scenario.finalPct.toFixed(2)}%)`}, {label:'Planned result vs target', value:scenario.meetsTarget ? 'Meets target' : 'Below target', kind:scenario.meetsTarget ? 'good' : 'bad'}] : []),
        ]);
        status.set(r.impossible
          ? 'A missed class can never be removed from the denominator, so exactly 100% is no longer reachable. Attending every remaining class still gets you as close as possible.'
          : r.classesNeeded
            ? `Attend the next ${r.classesNeeded} class${r.classesNeeded === 1 ? '' : 'es'} in a row to reach ${r.projectedAttended}/${r.projectedHeld} and meet the target.`
            : `You are at or above the target. Missing ${r.classesCanMiss} more class${r.classesCanMiss === 1 ? '' : 'es'} keeps you at or above it, assuming no other attendance rules apply.`,
        r.classesNeeded || r.impossible ? 'warning' : 'success');
        if (term) status.set(`${status.textContent} ${term.reachable ? `With ${remaining.value} remaining, attend at least ${term.minimumAttend} by term end; you can miss at most ${term.canMiss}.` : `Even attending all ${remaining.value} remaining classes will not meet the target by term end.`} Assumes all classes count equally.`, term.reachable ? 'info' : 'warning');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    const clear = () => { grid.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); };
    [held, attended, target, remaining, planned].forEach(el => { el.addEventListener('input', clear); el.addEventListener('change', clear); });
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Classes held so far', control: held }),
        field({ label: 'Classes attended', control: attended }),
        field({ label: 'Target attendance %', control: target, hint: '1–100%, up to 6 decimal places.' }),
        field({label:'Remaining classes (optional)', control:remaining, hint:'For end-of-term planning; all classes count equally.'}),
        field({label:'Planned classes to attend (optional)', control:planned, hint:'Out of remaining classes; leave blank to skip.'})),
      h('p', {class:'hint', text:'Percentages are rounded for display. Target decisions use the unrounded fraction; school rules, exemptions and rounding may differ.'}),
      actionsRow(btn({ label: 'Calculate attendance', icon: 'calendar', onClick: run })), grid, status);
    shareState(root, [['held', held], ['attended', attended], ['target', target], ['remaining', remaining], ['planned', planned]], run);
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { evaluate, parseFraction, fractionCalc, durationTotal, cgpaToPercentage, percentageToCgpa, weightedGpa, attendanceCalc };
