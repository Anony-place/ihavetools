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
  const rows = subjects.filter((s) => s && (Number(s.credits) > 0 || Number(s.gradePoint) > 0));
  if (!rows.length) throw new Error('Add at least one subject with credits and a grade point.');
  let weighted = 0;
  let credits = 0;
  for (const [i, s] of rows.entries()) {
    const gp = Number(s.gradePoint);
    const cr = Number(s.credits);
    if (!(gp >= 0 && gp <= 100) || !(cr > 0 && cr <= 1000)) throw new Error(`Subject ${i + 1}: enter a valid grade point and credits greater than zero.`);
    weighted += gp * cr;
    credits += cr;
  }
  return { gpa: weighted / credits, totalCredits: credits, weightedPoints: weighted, subjects: rows.length };
}

export function attendanceCalc({ held, attended, targetPct } = {}) {
  if (!Number.isInteger(held) || held < 1) throw new Error('Enter at least one class held so far.');
  if (!Number.isInteger(attended) || attended < 0 || attended > held) throw new Error('Classes attended must be a whole number between 0 and classes held.');
  if (!(targetPct > 0 && targetPct <= 100)) throw new Error('Target attendance must be between 1% and 100%.');
  const target = targetPct / 100;
  const currentPct = attended / held * 100;
  let classesNeeded = 0;
  let classesCanMiss = 0;
  let impossible = false;
  if (attended / held >= target) {
    classesCanMiss = Math.max(0, Math.floor(attended / target - held + 1e-9));
  } else if (targetPct === 100) {
    classesNeeded = null;
    impossible = true;
  } else {
    classesNeeded = Math.max(0, Math.ceil((target * held - attended) / (1 - target) - 1e-9));
  }
  return {
    currentPct,
    classesNeeded,
    classesCanMiss,
    impossible,
    projectedAttended: classesNeeded == null ? null : attended + classesNeeded,
    projectedHeld: classesNeeded == null ? null : held + classesNeeded,
  };
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
        const options = { scale: Number(scale.value), multiplier: Number(multiplier.value) };
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
        h('span', { class: 'fr-actions' }, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Remove subject', onclick: () => row.remove() }, '✕')));
      row.getSubject = () => ({ gradePoint: Number(gp.value), credits: Number(cr.value) });
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
        btn({ label: 'Add subject', variant: 'secondary', icon: 'plus', onClick: () => rowsWrap.append(mkRow()) }),
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
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      try {
        const r = attendanceCalc({ held: Math.floor(Number(held.value)), attended: Math.floor(Number(attended.value)), targetPct: Number(target.value) });
        const targetLabel = `${Number(target.value).toFixed(2).replace(/\.00$/, '')}% target`;
        grid.set([
          { label: 'Current attendance', value: `${r.currentPct.toFixed(2)}%`, kind: r.classesNeeded ? 'bad' : 'good' },
          r.impossible
            ? { label: targetLabel, value: 'No longer possible', kind: 'bad' }
            : r.classesNeeded
              ? { label: 'Attend next classes', value: String(r.classesNeeded), kind: 'warn' }
              : { label: 'Classes you can miss', value: String(r.classesCanMiss), kind: 'good' },
          { label: 'Attended / held', value: `${attended.value} / ${held.value}` },
        ]);
        status.set(r.impossible
          ? 'A missed class can never be removed from the denominator, so exactly 100% is no longer reachable. Attending every remaining class still gets you as close as possible.'
          : r.classesNeeded
            ? `Attend the next ${r.classesNeeded} class${r.classesNeeded === 1 ? '' : 'es'} in a row to reach ${r.projectedAttended}/${r.projectedHeld} and meet the target.`
            : `You are at or above the target. Missing ${r.classesCanMiss} more class${r.classesCanMiss === 1 ? '' : 'es'} keeps you at or above it, assuming no other attendance rules apply.`,
        r.classesNeeded || r.impossible ? 'warning' : 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Classes held so far', control: held }),
        field({ label: 'Classes attended', control: attended }),
        field({ label: 'Target attendance %', control: target })),
      actionsRow(btn({ label: 'Calculate attendance', icon: 'calendar', onClick: run })), grid, status);
    shareState(root, [['held', held], ['attended', attended], ['target', target]], run);
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { evaluate, parseFraction, fractionCalc, durationTotal, cgpaToPercentage, percentageToCgpa, weightedGpa, attendanceCalc };
