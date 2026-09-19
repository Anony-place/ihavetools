// =============================================================================
// iHaveTools — Student tools: scientific-calculator, fraction-calculator,
// time-duration-calculator
// =============================================================================
import { h, field, input, textarea, select, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, statsGrid, table, toast, copyText, mountTool } from '../ui.js';

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
  const src = String(input);
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
      let s = pos;
      while (pos < src.length && /[0-9._]/.test(src[pos])) pos++;
      let numStr = src.slice(s, pos).replace(/_/g, '');
      if (/^\.[0-9]+$/.test(numStr)) numStr = '0' + numStr;
      const v = Number(numStr);
      if (!Number.isFinite(v)) throw new Error(`“${numStr}” is not a valid number.`);
      return v;
    }
    if (/[a-zA-Z]/.test(c)) {
      let s = pos;
      while (pos < src.length && /[a-zA-Z0-9]/.test(src[pos])) pos++;
      const name = src.slice(s, pos).toLowerCase();
      if (name in CONSTS) {
        if (peek() === '(') throw new Error(`“${name}” is a constant — remove the parentheses.`);
        return CONSTS[name];
      }
      if (name in FUNCS1) {
        if (peek() !== '(') throw new Error(`“${name}” is a function — write it like ${name}(x).`);
        pos++;
        const arg = parseExpr();
        if (peek() !== ')') throw new Error(`Missing “)” after the ${name}(...) argument.`);
        pos++;
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
export function parseFraction(text) {
  const s = String(text).trim().replace(/\s+/g, ' ');
  let m = /^(-?)(\d+)\s+(\d+)\/(\d+)$/.exec(s); // mixed: -2 1/2
  if (m) {
    const [, sign, whole, num, den] = m;
    if (Number(den) === 0) throw new Error('A fraction cannot have a zero denominator.');
    return { n: (Number(whole) * Number(den) + Number(num)) * (sign ? -1 : 1), d: Number(den) };
  }
  m = /^(-?) (\d+) \/ (\d+)$/.exec(s);
  if (m) {
    const [, sign, num, den] = m;
    if (Number(den) === 0) throw new Error('A fraction cannot have a zero denominator.');
    return { n: Number(num) * (sign ? -1 : 1), d: Number(den) };
  }
  m = /^(-?)(\d+)\/(\d+)$/.exec(s.replace(/\s/g, ''));
  if (m) {
    const [, sign, num, den] = m;
    if (Number(den) === 0) throw new Error('A fraction cannot have a zero denominator.');
    return { n: Number(num) * (sign ? -1 : 1), d: Number(den) };
  }
  if (/^-?\d+$/.test(s)) return { n: Number(s), d: 1 };
  throw new Error(`“${text}” is not a fraction. Write 3/4 or a mixed number like 2 1/2.`);
}
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function simplify({ n, d }) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
export function fractionCalc(aText, op, bText) {
  const a = parseFraction(aText), b = parseFraction(bText);
  let r;
  switch (op) {
    case '+': r = { n: a.n * b.d + b.n * a.d, d: a.d * b.d }; break;
    case '-': r = { n: a.n * b.d - b.n * a.d, d: a.d * b.d }; break;
    case '*': r = { n: a.n * b.n, d: a.d * b.d }; break;
    case '/':
      if (b.n === 0) throw new Error('Division by the zero fraction is undefined.');
      r = { n: a.n * b.d, d: a.d * b.n };
      break;
    default: throw new Error('Unknown operation.');
  }
  const simp = simplify(r);
  const mixed = (() => {
    const whole = Math.trunc(simp.n / simp.d);
    const rem = Math.abs(simp.n % simp.d);
    return whole !== 0 && rem !== 0 ? `${whole} ${rem}/${simp.d}` : whole !== 0 ? `${whole}` : null;
  })();
  return { result: `${simp.n}/${simp.d}`, mixed, decimal: simp.n / simp.d, unsimplified: `${r.n}/${r.d}` };
}

/* ═══════════════════════════ Time durations ═══════════════════════════ */
export function durationTotal(rows, op) {
  let total = 0; // seconds
  for (let i = 0; i < rows.length; i++) {
    const [h, m, s] = rows[i];
    const secs = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    if (secs < 0) throw new Error(`Row ${i + 1} has a negative duration.`);
    if (i === 0) total = secs;
    else total += (op[i - 1] === '-' ? -1 : 1) * secs;
  }
  if (total < 0) throw new Error('The subtraction goes below zero — check your rows.');
  const hh = Math.floor(total / 3600), mm = Math.floor((total % 3600) / 60), ss = total % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return { h: hh, m: mm, s: ss, text: `${pad(hh)}:${pad(mm)}:${pad(ss)}`, decimalHours: total / 3600, totalSeconds: total };
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'scientific-calculator'(root) {
    let degrees = false;
    const inp = input({ type: 'text', class: 'input mono', placeholder: 'e.g. 2^10 + sin(30)*5', autocomplete: 'off', spellcheck: 'false', style: 'font-size:1.1rem' });
    const mode = segControl({ options: [{ v: 'deg', t: 'DEG' }, { v: 'rad', t: 'RAD' }], value: 'deg', ariaLabel: 'Angle unit' });
    mode.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { degrees = b.dataset.v === 'deg'; }));
    const grid = statsGrid();
    const status = statusLine('');
    const history = h('ul', { class: 'calc-history' });
    const historyData = [];
    const show = (expr) => {
      try {
        const r = evaluate(expr, { degrees });
        grid.set([{ label: 'Result', value: String(Number(r.toPrecision(12))), kind: 'good' }]);
        status.set('Evaluated ✓', 'success');
        historyData.unshift({ expr, res: Number(r.toPrecision(12)) });
        if (historyData.length > 30) historyData.pop();
        history.replaceChildren(...historyData.map((hh) => h('li', {},
          h('span', { class: 'h-expr', text: hh.expr }),
          h('button', { type: 'button', class: 'h-res', style: 'background:none;border:0;cursor:pointer;color:var(--primary);font:inherit;font-weight:700', text: `= ${hh.res}`, title: 'Reuse this result', onclick: () => { inp.value = String(hh.res); inp.focus(); } }))));
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
      PAD.map(([label, kind]) => h('button', { type: 'button', class: `btn ${kind && kind !== 'const' && kind !== 'fn' ? 'btn-fn' : ''}`, text: label, onclick: () => { inp.value += label; inp.focus(); } })));
    root.append(
      field({ label: 'Expression', control: inp, hint: 'Supports + − × ÷ ^ ! %, parentheses, sqrt, cbrt, ln, log (base 10), log2, exp, abs, floor, ceil, round, sign, sin/cos/tan (+ inverses, hyperbolic), pi, e, tau, phi' }),
      h('div', { class: 'field-row', style: 'align-items:end;margin-bottom:8px' },
        field({ label: 'Angles', control: mode }),
        field({ label: ' ', control: btn({ label: 'Calculate', icon: 'calculator', onClick: () => show(inp.value) }) })),
      grid, status,
      actionsRow(h('h3', { text: 'Keypad', style: 'margin:14px 0 4px' })),
      pad,
      h('h3', { text: 'History', style: 'margin:20px 0 6px' }),
      historyWrap(history));
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
          { label: 'Decimal', value: String(Number(r.decimal.toFixed(6))) },
        ]);
        steps.textContent = `Working: (${a.value}) ${op.getValue()} (${b.value}) = ${r.unsimplified} → simplified to ${r.result}`;
        status.set('Calculated ✓', 'success');
      } catch (e) { grid.replaceChildren(); steps.textContent = ''; status.set(e.message, 'error'); }
    };
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
    const mkRow = (i) => {
      const hh = input({ type: 'number', min: 0, step: '1', placeholder: 'h' });
      const mm = input({ type: 'number', min: 0, max: 59, step: '1', placeholder: 'm' });
      const ss = input({ type: 'number', min: 0, max: 59, step: '1', placeholder: 's' });
      const opSel = i === 0 ? null : select({ options: [{ v: '+', t: '+' }, { v: '-', t: '−' }], value: '+' });
      const row = h('div', { class: 'file-row', dataset: { row: String(i) } },
        opSel ? h('div', { style: 'width:64px' }, opSel) : h('span', { class: 'hint', text: 'Duration' }),
        hh, mm, ss,
        h('span', { class: 'fr-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Remove row', onclick: () => row.remove() }, '✕')));
      row.getValues = () => [Number(hh.value) || 0, Number(mm.value) || 0, Number(ss.value) || 0];
      return row;
    };
    rowsWrap.append(mkRow(0), mkRow(1));
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
          { label: 'Total minutes', value: Math.floor(r.totalSeconds / 60).toLocaleString() },
          { label: 'Total seconds', value: r.totalSeconds.toLocaleString() },
        ]);
        status.set('Calculated ✓', 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      rowsWrap,
      actionsRow(
        btn({ label: 'Add row', variant: 'secondary', icon: 'plus', onClick: () => rowsWrap.append(mkRow(rowsWrap.children.length)) }),
        btn({ label: 'Calculate total', icon: 'hourglass', onClick: run })),
      grid, status);
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { evaluate, parseFraction, fractionCalc, durationTotal };
