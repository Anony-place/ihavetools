// Math tools — bounded inputs and explicit calculation conventions.
import { h, field, input, textarea, btn, actionsRow, statusLine, statsGrid, table, mountTool } from '../ui.js';

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const display = (n) => n !== 0 && (Math.abs(n) < 1e-7 || Math.abs(n) >= 1e15)
  ? n.toExponential(6) : n.toLocaleString('en-US', { maximumFractionDigits: 8 });
function numeric(token) {
  if (!NUMBER.test(token) || !Number.isFinite(Number(token))) throw new Error(`“${token.slice(0, 40)}” is not a valid number.`);
  const n = Number(token);
  if (Math.abs(n) > 1e12) throw new Error('Each number must be between -1 trillion and 1 trillion.');
  return n;
}
export function parseNumbers(raw) {
  if (String(raw).length > 250000) throw new Error('Input is too long.');
  const parts = String(raw).split(/[\s,;]+/).filter(Boolean);
  if (!parts.length) throw new Error('Enter at least one number.');
  if (parts.length > 10000) throw new Error('Enter at most 10,000 numbers.');
  try { return parts.map(numeric); }
  catch (e) { if (/not a valid number/.test(e.message)) throw new Error(`These entries are not valid numbers: ${e.message}`); throw e; }
}
function validateValues(values) {
  if (!Array.isArray(values) || !values.length || values.length > 10000 || values.some(v => !Number.isFinite(v) || Math.abs(v) > 1e12)) throw new Error('Enter 1–10,000 valid numbers between -1 trillion and 1 trillion.');
}
export function averageStats(values) {
  validateValues(values);
  const sorted = [...values].sort((a, b) => a - b), counts = new Map();
  let sum = 0, compensation = 0, mean = 0, m2 = 0, n = 0;
  for (const v of values) {
    const y = v - compensation, t = sum + y; compensation = (t - sum) - y; sum = t;
    n++; const delta = v - mean; mean += delta / n; m2 += delta * (v - mean);
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const median = n % 2 ? sorted[(n - 1) / 2] : sorted[n / 2 - 1] / 2 + sorted[n / 2] / 2;
  const modeCount = Math.max(...counts.values());
  const modes = modeCount > 1 ? [...counts].filter(([, count]) => count === modeCount).map(([v]) => v).sort((a, b) => a - b) : [];
  const populationVariance = Math.max(0, m2 / n), sampleVariance = n > 1 ? Math.max(0, m2 / (n - 1)) : null;
  return { sum, mean, median, count: n, mode: modes[0] ?? null, modes, modeCount, min: sorted[0], max: sorted[n - 1], range: sorted[n - 1] - sorted[0], sorted, populationVariance, sampleVariance, populationSD: Math.sqrt(populationVariance), sampleSD: sampleVariance === null ? null : Math.sqrt(sampleVariance) };
}
function gcd2(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
function validateIntegers(nums) {
  if (!Array.isArray(nums) || nums.length < 2 || nums.length > 100 || nums.some(v => !Number.isSafeInteger(v) || v === 0 || Math.abs(v) > 1e9)) throw new Error('Enter 2–100 non-zero whole integers with absolute value at most 1 billion.');
}
export function gcdList(nums) { validateIntegers(nums); return nums.reduce((a, b) => gcd2(a, b)); }
export function lcmList(nums) {
  validateIntegers(nums);
  return nums.reduce((a, b) => { const result = Math.abs(a / gcd2(a, b) * b); if (!Number.isSafeInteger(result)) throw new Error('LCM exceeds the exact safe integer limit (9,007,199,254,740,991).'); return result; });
}
export function primeFactors(n) {
  if (!Number.isSafeInteger(n) || n === 0 || Math.abs(n) > 1e9) throw new Error('Prime factors require a non-zero integer of at most 1 billion in absolute value.');
  const factors = []; let x = Math.abs(n);
  for (let d = 2; d * d <= x; d++) while (x % d === 0) { factors.push(d); x /= d; }
  if (x > 1) factors.push(x);
  return factors;
}
// Exact decimal scaling before Euclid: no floating-point remainders.
function decimalParts(value, label, zeroAllowed = false) {
  const text = String(value).trim();
  if (text.length > 30 || !/^(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/.test(text)) throw new Error(`${label} must be a ${zeroAllowed ? 'non-negative' : 'positive'} decimal with at most 6 fractional digits.`);
  const [whole, fractional = ''] = (text.startsWith('.') ? `0${text}` : text).split('.');
  const scaled = BigInt(whole) * 1000000n + BigInt(fractional.padEnd(6, '0'));
  if (scaled > 1000000000000000n || (!zeroAllowed && scaled === 0n)) throw new Error(`${label} must be ${zeroAllowed ? 'between 0 and' : 'positive and at most'} 1 billion.`);
  return scaled;
}
export function ratioCalc(a, b) {
  let x = decimalParts(a, 'First ratio value'), y = decimalParts(b, 'Second ratio value');
  const factor = Number(x) / Number(y); let p = x, q = y;
  while (q) [p, q] = [q, p % q];
  return { simplified: [Number(x / p), Number(y / p)], factor };
}
export function ratioSolve(a, b, c) {
  const x = decimalParts(a, 'First ratio value'), y = decimalParts(b, 'Second ratio value'), z = decimalParts(c, 'Third value', true);
  return Number(z) / Number(x) * Number(y) / 1000000;
}
export function weightedAverage(raw) {
  if (String(raw).length > 100000) throw new Error('Input is too long.');
  const lines = String(raw).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length || lines.length > 1000) throw new Error('Enter 1–1,000 value and weight pairs.');
  let weightedSum = 0, totalWeight = 0;
  const pairs = lines.map((line, i) => {
    const parts = line.split(/[\s,;]+/).filter(Boolean);
    if (parts.length !== 2) throw new Error(`Line ${i + 1}: enter exactly one value and one weight.`);
    const value = numeric(parts[0]), weight = numeric(parts[1]);
    if (weight < 0 || weight > 1e9) throw new Error(`Line ${i + 1}: weight must be between 0 and 1 billion.`);
    weightedSum += value * weight; totalWeight += weight;
    return [value, weight];
  });
  if (totalWeight === 0) throw new Error('At least one weight must be greater than zero.');
  return { pairs, weightedSum, totalWeight, average: weightedSum / totalWeight };
}

const defs = {
  'average-calculator'(root) {
    const inp = textarea({ rows: 4, placeholder: 'e.g. 1, 2, 2, 3, 5' }), grid = statsGrid(), status = statusLine(''), detail = h('div', {});
    const run = () => { try {
      const s = averageStats(parseNumbers(inp.value));
      const modes = s.modes.length ? `${s.modes.slice(0, 20).map(display).join(', ')}${s.modes.length > 20 ? ` … (${s.modes.length} modes)` : ''} ×${s.modeCount}` : 'None (all unique)';
      grid.set([{label:'Mean (average)',value:display(s.mean),kind:'good'},{label:'Median',value:display(s.median)},{label:'Mode(s)',value:modes},{label:'Sum',value:display(s.sum)},{label:'Count',value:String(s.count)},{label:'Min',value:display(s.min)},{label:'Max',value:display(s.max)},{label:'Range',value:display(s.range)},{label:'Population variance (÷ n)',value:display(s.populationVariance)},{label:'Population standard deviation',value:display(s.populationSD)},{label:'Sample variance (÷ n − 1)',value:s.sampleVariance === null ? 'Undefined (need 2 values)' : display(s.sampleVariance)},{label:'Sample standard deviation',value:s.sampleSD === null ? 'Undefined (need 2 values)' : display(s.sampleSD)}]);
      detail.replaceChildren(table({ headers:['Sorted values'], rows:[[s.sorted.map(display).join('  ≤  ')]] }));
      status.set('Up to 10,000 values between −1 trillion and 1 trillion. Decimal results are rounded for display; floating-point precision is limited.', 'info');
    } catch(e) { grid.replaceChildren(); detail.replaceChildren(); status.set(e.message,'error'); } };
    root.append(field({label:'Your numbers',control:inp,hint:'Separate values with commas, spaces, semicolons or newlines.'}),actionsRow(btn({label:'Calculate',icon:'sigma',onClick:run})),grid,detail,status);
  },
  'ratio-calculator'(root) {
    const a=input({type:'text',inputmode:'decimal',placeholder:'e.g. 1920'}), b=input({type:'text',inputmode:'decimal',placeholder:'e.g. 1080'}), c=input({type:'text',inputmode:'decimal',placeholder:'optional'}), grid=statsGrid(), status=statusLine(''), detail=h('div',{});
    const run=()=>{try {
      const r=ratioCalc(a.value,b.value), rows=[['Simplified ratio',`${r.simplified[0]} : ${r.simplified[1]}`],['Decimal ratio (a ÷ b)',display(r.factor)],['As 1 : x',`1 : ${display(r.simplified[1]/r.simplified[0])}`]];
      if(c.value.trim() !== '') rows.push([`Solve ${a.value} : ${b.value} = ${c.value} : x`,`x = ${display(ratioSolve(a.value,b.value,c.value))}`]);
      grid.set([{label:'Simplified',value:`${r.simplified[0]} : ${r.simplified[1]}`,kind:'good'},{label:'Decimal',value:display(r.factor)}]); detail.replaceChildren(table({headers:['Calculation','Result'],rows}));
      status.set('Simplification uses exact decimal inputs; decimal and proportion results are rounded for display.', 'info');
    } catch(e){grid.replaceChildren();detail.replaceChildren();status.set(e.message,'error');}};
    root.append(h('div',{class:'field-row'},field({label:'a',control:a}),field({label:'b',control:b}),field({label:'c (optional): a : b = c : x',control:c})),h('p',{class:'hint',text:'a and b must be positive; c may be zero. Use decimal points, up to 6 decimal places and 1 billion.'}),actionsRow(btn({label:'Simplify / solve',icon:'ratio',onClick:run})),grid,detail,status);
  },
  'gcd-lcm-calculator'(root) {
    const inp=input({type:'text',inputmode:'text',placeholder:'e.g. 12, 18, 30'}),grid=statsGrid(),status=statusLine(''),detail=h('div',{});
    const run=()=>{try{const values=parseNumbers(inp.value), g=gcdList(values),l=lcmList(values);
      grid.set([{label:'GCD (HCF)',value:display(g),kind:'good'},{label:'LCM',value:l.toLocaleString('en-US'),kind:'good'},{label:'Numbers',value:String(values.length)}]);
      detail.replaceChildren(h('h3',{text:'Prime factorisation',style:'margin:18px 0 10px'}),table({headers:['Number','Prime factors of absolute value'],rows:values.map(v=>[String(v),primeFactors(v).join(' × ') || '1'])}));
      status.set('Uses absolute values. LCM must fit within JavaScript’s exact safe integer range.', 'info');
    }catch(e){grid.replaceChildren();detail.replaceChildren();status.set(e.message,'error');}};
    root.append(field({label:'Numbers (2–100 non-zero integers)',control:inp,hint:'Each absolute value must be at most 1 billion.'}),actionsRow(btn({label:'Calculate GCD & LCM',icon:'grid',onClick:run})),grid,detail,status);
  },
  'weighted-average-calculator'(root) {
    const inp=textarea({rows:5,value:'80, 3\n90, 2',placeholder:'One value and weight per line, e.g. 80, 3'}),grid=statsGrid(),status=statusLine(''),detail=h('div',{});
    const run=()=>{try{const r=weightedAverage(inp.value); grid.set([{label:'Weighted average',value:display(r.average),kind:'good'},{label:'Total weight',value:display(r.totalWeight)},{label:'Sum of value × weight',value:display(r.weightedSum)},{label:'Pairs',value:String(r.pairs.length)}]);detail.replaceChildren(table({headers:['Value','Weight','Value × weight'],rows:r.pairs.map(([v,w])=>[display(v),display(w),display(v*w)])}));status.set('Weights do not have to total 100. Results are rounded for display and use floating-point arithmetic.', 'info');}catch(e){grid.replaceChildren();detail.replaceChildren();status.set(e.message,'error');}};
    root.append(field({label:'Value, weight — one pair per line',control:inp,hint:'Separate the two entries with a comma, space or semicolon. Weights must be non-negative.'}),actionsRow(btn({label:'Calculate weighted average',icon:'sigma',onClick:run})),grid,detail,status);
  },
};
export function mount(id) { mountTool(id, defs); }
export const __test = { parseNumbers, averageStats, gcdList, lcmList, primeFactors, ratioCalc, ratioSolve, weightedAverage };
