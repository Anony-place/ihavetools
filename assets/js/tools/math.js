// =============================================================================
// iHaveTools — Math tools: average-calculator, ratio-calculator, gcd-lcm-calculator
// =============================================================================
import { h, field, input, textarea, btn, actionsRow, resultPanel, statusLine, statsGrid, table, fmtNumber, mountTool } from '../ui.js';

export function parseNumbers(raw) {
  const parts = String(raw).split(/[\s,;]+/).filter(Boolean);
  const nums = parts.map((p) => Number(p));
  const bad = parts.filter((p, i) => !Number.isFinite(nums[i]));
  if (bad.length) throw new Error(`These entries are not valid numbers: ${bad.slice(0, 5).map((b) => `“${b}”`).join(', ')}.`);
  if (!nums.length) throw new Error('Enter at least one number.');
  return nums;
}

export function averageStats(values) {
  if (!values.length) throw new Error('Enter at least one number.');
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((s, v) => s + v, 0);
  const mean = sum / values.length;
  const median = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let mode = null, modeCount = 0;
  for (const [v, c] of counts) if (c > modeCount) { mode = v; modeCount = c; }
  return {
    sum, mean, median, count: values.length,
    mode: modeCount > 1 ? mode : null, modeCount,
    min: sorted[0], max: sorted[sorted.length - 1],
    range: sorted[sorted.length - 1] - sorted[0],
    sorted,
  };
}

function gcd2(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
export function gcdList(nums) { return nums.reduce((a, b) => gcd2(a, b)); }
export function lcmList(nums) {
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
  return nums.reduce((a, b) => Math.abs(a * b) / gcd(a, b));
}
export function primeFactors(n) {
  const factors = [];
  let x = Math.abs(n);
  for (let d = 2; d * d <= x; d++) {
    while (x % d === 0) { factors.push(d); x /= d; }
  }
  if (x > 1) factors.push(x);
  return factors;
}
export function ratioCalc(a, b) {
  if (!(a > 0) || !(b > 0)) throw new Error('Both ratio values must be positive numbers.');
  const g = gcd2(a, b);
  return { simplified: [a / g, b / g], factor: a / b };
}
export function ratioSolve(a, b, c) {
  if (!(a > 0) || !(b > 0)) throw new Error('The known ratio values (a and b) must be positive.');
  return (c * b) / a;
}

const defs = {
  'average-calculator'(root) {
    const inp = textarea({ rows: 4, mono: false, value: '', placeholder: 'e.g. 12, 15.5, 9  — commas, spaces or newlines all work' });
    const grid = statsGrid();
    const status = statusLine('');
    const detail = h('div', {});
    const run = () => {
      try {
        const values = parseNumbers(inp.value);
        const s = averageStats(values);
        grid.set([
          { label: 'Mean (average)', value: fmtNumber(s.mean, 6), kind: 'good' },
          { label: 'Median', value: fmtNumber(s.median, 6) },
          { label: 'Mode', value: s.mode === null ? 'none' : `${fmtNumber(s.mode)} ×${s.modeCount}` },
          { label: 'Sum', value: fmtNumber(s.sum, 6) },
          { label: 'Count', value: `${s.count}` },
          { label: 'Min', value: fmtNumber(s.min) },
          { label: 'Max', value: fmtNumber(s.max) },
          { label: 'Range', value: fmtNumber(s.range) },
        ]);
        detail.replaceChildren(table({ headers: ['Sorted values', ''], rows: [[s.sorted.map((v) => fmtNumber(v, 4)).join('  ≤  '), '']] }));
        status.set(`${s.count} values processed ✓`, 'success');
      } catch (e) { grid.replaceChildren(); detail.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'Your numbers', control: inp }),
      actionsRow(btn({ label: 'Calculate', icon: 'sigma', onClick: run })), grid, detail, status);
  },

  'ratio-calculator'(root) {
    const a = input({ type: 'number', step: 'any', placeholder: 'e.g. 1920' });
    const b = input({ type: 'number', step: 'any', placeholder: 'e.g. 1080' });
    const c = input({ type: 'number', step: 'any', placeholder: 'optional — solve for x' });
    const grid = statsGrid();
    const status = statusLine('a : b simplification, or a : b = c : x');
    const run = () => {
      const va = Number(a.value.replace(/,/g, '')), vb = Number(b.value.replace(/,/g, ''));
      try {
        const r = ratioCalc(va, vb);
        const rows = [
          ['Simplified ratio', `${fmtNumber(r.simplified[0], 6)} : ${fmtNumber(r.simplified[1], 6)}`],
          ['Decimal ratio (a÷b)', fmtNumber(r.factor, 6)],
          ['As 1 : x', `1 : ${fmtNumber(r.simplified[1] / r.simplified[0], 6)}`],
        ];
        const vc = Number(c.value.replace(/,/g, ''));
        if (c.value.trim() !== '' && Number.isFinite(vc)) {
          const x = ratioSolve(va, vb, vc);
          rows.push([`Solve ${fmtNumber(va)} : ${fmtNumber(vb)} = ${fmtNumber(vc)} : x`, `x = ${fmtNumber(x, 6)}`]);
        }
        grid.set([
          { label: 'Simplified', value: `${fmtNumber(r.simplified[0], 4)} : ${fmtNumber(r.simplified[1], 4)}`, kind: 'good' },
          { label: 'Decimal', value: fmtNumber(r.factor, 4) },
        ]);
        status.set('', 'info');
        status.set(`Ratio simplified by dividing both sides by ${fmtNumber(r.simplified[0] ? va / r.simplified[0] : 1)}.`, 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'a', control: a }),
        h('span', { style: 'padding-bottom:12px;font-weight:700;color:var(--text-3)', text: ':' }),
        field({ label: 'b', control: b })),
      field({ label: 'Solve missing value x in  a : b = c : x  (optional)', control: h('div', { style: 'max-width:220px' }, c) }),
      actionsRow(btn({ label: 'Simplify / solve', icon: 'ratio', onClick: run })), grid, status);
  },

  'gcd-lcm-calculator'(root) {
    const inp = input({ type: 'text', inputmode: 'numeric', placeholder: 'e.g. 12, 18, 30' });
    const grid = statsGrid();
    const status = statusLine('');
    const detail = h('div', {});
    const run = () => {
      try {
        const values = parseNumbers(inp.value);
        if (values.some((v) => !Number.isInteger(v) || v === 0)) throw new Error('Enter whole non-zero integers only.');
        if (values.length < 2) throw new Error('Enter at least two numbers.');
        const g = gcdList(values), l = lcmList(values);
        grid.set([
          { label: 'GCD (HCF)', value: fmtNumber(g), kind: 'good' },
          { label: 'LCM', value: fmtNumber(l), kind: 'good' },
          { label: 'Numbers', value: `${values.length}` },
        ]);
        detail.replaceChildren(
          h('h3', { text: 'Prime factorisation', style: 'margin:18px 0 10px' }),
          table({ headers: ['Number', 'Prime factors'], rows: values.map((v) => [fmtNumber(v), primeFactors(v).join(' × ') || String(v)]) }));
        status.set('Calculated with the Euclidean algorithm ✓', 'success');
      } catch (e) { grid.replaceChildren(); detail.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'Numbers (two or more, comma-separated)', control: inp }),
      actionsRow(btn({ label: 'Calculate GCD & LCM', icon: 'grid', onClick: run })), grid, detail, status);
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { parseNumbers, averageStats, gcdList, lcmList, primeFactors, ratioCalc, ratioSolve };
