// Math tools — bounded inputs and explicit calculation conventions.
import { h, field, input, textarea, select, btn, actionsRow, resultPanel, statusLine, statsGrid, table, mountTool } from '../ui.js';

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const display = (n) => n !== 0 && (Math.abs(n) < 1e-7 || Math.abs(n) >= 1e15)
  ? n.toExponential(6) : n.toLocaleString('en-US', { maximumFractionDigits: 8 });
function numeric(token) {
  if (!NUMBER.test(token) || !Number.isFinite(Number(token))) throw new Error(`“${token.slice(0, 40)}” is not a valid number.`);
  const n = Number(token);
  if (n === 0 && /[1-9]/.test(token.split(/[eE]/)[0])) throw new Error('Number is too small to represent without rounding to zero.');
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

function pixelInteger(value, label) {
  const text = String(value).trim();
  if (!/^\d{1,10}$/.test(text) || Number(text) < 1 || Number(text) > 1000000000) throw new Error(`${label} must be a whole number from 1 to 1,000,000,000.`);
  return Number(text);
}
export function aspectDimensions(width, height, target = '', axis = 'width') {
  const w = pixelInteger(width, 'Width'), h = pixelInteger(height, 'Height'), g = gcd2(w, h);
  if (!['width','height'].includes(axis)) throw new Error('Choose a valid target dimension.');
  let scaled = null;
  if (String(target).trim() !== '') {
    const t = pixelInteger(target, 'Target dimension');
    const numerator = BigInt(t) * BigInt(axis === 'width' ? h : w);
    const denominator = BigInt(axis === 'width' ? w : h);
    const rounded = (numerator * 2n + denominator) / (2n * denominator);
    if (rounded < 1n || rounded > 1000000000n) throw new Error('The rounded dimension is outside the supported 1–1,000,000,000 pixel range.');
    scaled = {width: axis === 'width' ? t : Number(rounded), height: axis === 'height' ? t : Number(rounded), rounded: numerator % denominator !== 0n};
  }
  return {ratio:`${w / g}:${h / g}`, scaled};
}
function positiveDecimal(value, label, max) {
  const text = String(value).trim();
  if (text.length > 24 || !/^(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/.test(text)) throw new Error(`${label} must be a positive decimal with at most six decimal places.`);
  const n = Number(text);
  if (!(n > 0 && n <= max)) throw new Error(`${label} must be greater than zero and at most ${max.toLocaleString('en-US')}.`);
  return n;
}
export function pixelsInches(value, ppi, direction) {
  const density = positiveDecimal(ppi, 'PPI', 1000000);
  if (direction === 'pixels') {
    const pixels = pixelInteger(value, 'Pixels');
    return {pixels, inches:pixels / density};
  }
  if (direction === 'inches') {
    const inches = positiveDecimal(value, 'Inches', 1000000000), exact = inches * density;
    const pixels = Math.round(exact);
    if (pixels < 1) throw new Error('The rounded result is less than one pixel.');
    return {pixels, inches, unroundedPixels:exact};
  }
  throw new Error('Choose a conversion direction.');
}

export function circleGeometry(kind, value, angle = '') {
  const n = positiveDecimal(value, 'Known measurement', 1000000);
  let radius;
  if (kind === 'radius') radius = n;
  else if (kind === 'diameter') radius = n / 2;
  else if (kind === 'circumference') radius = n / (2 * Math.PI);
  else if (kind === 'area') radius = Math.sqrt(n / Math.PI);
  else throw new Error('Choose a valid known measurement.');
  const circumference = 2 * Math.PI * radius, area = Math.PI * radius * radius;
  let sector = null;
  if (String(angle).trim() !== '') {
    const text = String(angle).trim();
    if (text.length > 24 || !/^(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/.test(text) || Number(text) > 360) throw new Error('Central angle must be between 0 and 360 degrees, with at most six decimal places.');
    const fraction = Number(text) / 360;
    sector = { angle: Number(text), arc: circumference * fraction, area: area * fraction };
  }
  return { radius, diameter: 2 * radius, circumference, area, sector };
}
export function rightTriangle(mode, first, second) {
  const a = positiveDecimal(first, 'First leg', 1000000), other = positiveDecimal(second, 'Second measurement', 1000000);
  let b, c;
  if (mode === 'legs') { b = other; c = Math.hypot(a, b); }
  else if (mode === 'leg-hypotenuse') {
    c = other;
    if (c <= a) throw new Error('The hypotenuse must be greater than the known leg.');
    b = Math.sqrt(c - a) * Math.sqrt(c + a);
  } else throw new Error('Choose a valid pair of sides.');
  return { a, b, c, area: a * b / 2, perimeter: a + b + c,
    angleA: Math.atan2(a, b) * 180 / Math.PI, angleB: Math.atan2(b, a) * 180 / Math.PI };
}

// All coefficients share a scale of 10^6, so the discriminant sign is exact.
function quadraticCoefficient(value, label) {
  const s=String(value).trim();
  if(s.length>25 || !/^[+-]?(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/.test(s)) throw new Error(`${label} must be a decimal with at most 6 fractional digits.`);
  const neg=s[0]==='-', unsigned=s.replace(/^[+-]/,''), [whole,frac='']=unsigned.split('.');
  let scaled=BigInt(whole||'0')*1000000n+BigInt(frac.padEnd(6,'0')); if(neg)scaled=-scaled;
  if(scaled>1000000000000000n||scaled< -1000000000000000n) throw new Error(`${label} must be between -1 billion and 1 billion.`);
  return scaled;
}
function scaledDecimal(n,places) { const neg=n<0n; if(neg)n=-n; const factor=10n**BigInt(places);const rest=(n%factor).toString().padStart(places,'0').replace(/0+$/,'');return `${neg?'-':''}${n/factor}${rest?'.'+rest:''}`; }
export function quadraticRoots(a,b,c) {
  const A=quadraticCoefficient(a,'a'),B=quadraticCoefficient(b,'b'),C=quadraticCoefficient(c,'c');
  if(A===0n)throw new Error('Coefficient a must not be zero; otherwise the equation is not quadratic.');
  const d=B*B-4n*A*C,an=Number(A),bn=Number(B),cn=Number(C),vertexX=-bn/(2*an),vertexY=-Number(d)/(4*an*1000000);
  let roots,kind;
  if(d===0n){kind='Repeated real root';roots=[{real:vertexX,imag:0}];}
  else if(d>0n){kind='Two distinct real roots';const square=Math.sqrt(Number(d));const q=-0.5*(bn+(bn>=0?square:-square)); roots=[{real:q/an,imag:0},{real:cn/q,imag:0}];}
  else {kind='Two complex conjugate roots';const imaginary=Math.sqrt(Number(-d))/(2*Math.abs(an));roots=[{real:vertexX,imag:imaginary},{real:vertexX,imag:-imaginary}];}
  return {kind,discriminant:scaledDecimal(d,12),roots,vertexX,vertexY};
}
function boundedWhole(value,label,max) {
  const s=String(value).trim();if(!/^\d{1,10}$/.test(s)) throw new Error(`${label} must be a whole number from 0 to ${max}.`);
  const n=Number(s);if(n>max)throw new Error(`${label} must be a whole number from 0 to ${max}.`);return n;
}
export function countingResults(nValue,rValue) {
  const n=boundedWhole(nValue,'n',500),r=boundedWhole(rValue,'r',500);if(r>n)throw new Error('r cannot exceed n when choosing without replacement.');
  let factorial=1n,permutation=1n,combination=1n;
  for(let i=2;i<=n;i++)factorial*=BigInt(i);
  for(let i=0;i<r;i++)permutation*=BigInt(n-i);
  const k=Math.min(r,n-r);for(let i=1;i<=k;i++)combination=combination*BigInt(n-k+i)/BigInt(i);
  return {n,r,factorial,permutation,combination};
}
export function primeAnalysis(value) {
  const n=boundedWhole(value,'Number',1000000000); if(n<1)throw new Error('Number must be between 1 and 1,000,000,000.');
  const factors=primeFactors(n), powers=[];
  for(const factor of factors){const last=powers[powers.length-1];if(last?.prime===factor)last.exponent++;else powers.push({prime:factor,exponent:1});}
  let divisors=[1];for(const {prime,exponent} of powers){const base=[...divisors];let power=1;for(let e=1;e<=exponent;e++){power*=prime;for(const item of base)divisors.push(item*power);}}
  divisors.sort((a,b)=>a-b);
  return {n,factors,powers,divisors,classification:n===1?'Neither prime nor composite':factors.length===1?'Prime':'Composite'};
}

const defs = {
  'quadratic-equation-solver'(root) {
    const a=input({type:'text',inputmode:'decimal',value:'1'}),b=input({type:'text',inputmode:'decimal',value:'-5'}),c=input({type:'text',inputmode:'decimal',value:'6'}),out=resultPanel({label:'Quadratic solution'}),status=statusLine('');
    const run=()=>{try{const r=quadraticRoots(a.value,b.value,c.value);const roots=r.roots.map((x,i)=>`x${i+1} ≈ ${display(x.real)}${x.imag?` ${x.imag<0?'−':'+'} ${display(Math.abs(x.imag))}i`:''}`).join('\n');out.set(`Discriminant b² − 4ac = ${r.discriminant} (exact)\n${r.kind}\n${roots}\nVertex ≈ (${display(r.vertexX)}, ${display(r.vertexY)})`);status.set('Discriminant is exact for entered decimals; roots and vertex use floating point and are rounded for display.','info');}catch(e){out.placeholder();status.set(e.message,'error');}};
    for(const el of [a,b,c])el.addEventListener('input',()=>{out.placeholder();status.set('Input changed. Solve again.');});
    root.append(h('p',{class:'hint',text:'Solve ax² + bx + c = 0. Enter decimal coefficients with up to 6 fractional digits, each between −1 billion and 1 billion; a cannot be zero.'}),h('div',{class:'field-row'},field({label:'Coefficient a',control:a}),field({label:'Coefficient b',control:b}),field({label:'Coefficient c',control:c})),actionsRow(btn({label:'Solve quadratic',onClick:run})),status,out.panel);
  },
  'permutation-combination-calculator'(root) {
    const n=input({type:'text',inputmode:'numeric',value:'10'}),r=input({type:'text',inputmode:'numeric',value:'3'}),out=resultPanel({label:'Counting results'}),status=statusLine('');
    const run=()=>{try{const x=countingResults(n.value,r.value);out.set(`Combination C(${x.n}, ${x.r}) = ${x.combination}\nPermutation P(${x.n}, ${x.r}) = ${x.permutation}\nFactorial ${x.n}! = ${x.factorial}`);status.set('Exact integers. Selections are from distinct items without replacement.','success');}catch(e){out.placeholder();status.set(e.message,'error');}};
    for(const el of [n,r])el.addEventListener('input',()=>{out.placeholder();status.set('Input changed. Calculate again.');});
    root.append(h('div',{class:'field-row'},field({label:'Total distinct items n',control:n}),field({label:'Items chosen r',control:r})),h('p',{class:'hint',text:'Use whole numbers 0–500 with r ≤ n; assumes no replacement.'}),actionsRow(btn({label:'Calculate counting',onClick:run})),status,out.panel);
  },
  'prime-factorization-calculator'(root) {
    const n=input({type:'text',inputmode:'numeric',value:'360'}),out=resultPanel({label:'Prime analysis'}),status=statusLine('');
    const run=()=>{try{const r=primeAnalysis(n.value),factorization=r.powers.map(p=>p.exponent===1?String(p.prime):`${p.prime}^${p.exponent}`).join(' × ')||'1 (no prime factors)';out.set(`${r.n}: ${r.classification}\nPrime factorization: ${factorization}\nPositive divisors (${r.divisors.length}): ${r.divisors.join(', ')}`);status.set('Divisors and prime factors are exact for this bounded whole number.','success');}catch(e){out.placeholder();status.set(e.message,'error');}};
    n.addEventListener('input',()=>{out.placeholder();status.set('Input changed. Calculate again.');});
    root.append(field({label:'Positive whole number',control:n,hint:'Enter an integer from 1 to 1,000,000,000.'}),actionsRow(btn({label:'Analyze number',onClick:run})),status,out.panel);
  },

  'circle-calculator'(root) {
    const kind=select({options:[{v:'radius',t:'Radius'},{v:'diameter',t:'Diameter'},{v:'circumference',t:'Circumference'},{v:'area',t:'Area'}],value:'radius'}), value=input({type:'text',inputmode:'decimal',value:'7'}),angle=input({type:'text',inputmode:'decimal',placeholder:'Optional (0–360)'}),grid=statsGrid(),status=statusLine('');
    const run=()=>{try {const r=circleGeometry(kind.value,value.value,angle.value);
      grid.set([{label:'Radius (length units)',value:display(r.radius),kind:'good'},{label:'Diameter (length units)',value:display(r.diameter)},{label:'Circumference (length units)',value:display(r.circumference)},{label:'Area (square units)',value:display(r.area)}, ...(r.sector ? [{label:'Arc length (length units)',value:display(r.sector.arc)},{label:'Sector area (square units)',value:display(r.sector.area)}] : [])]);
      status.set('Use one consistent length unit; areas use its square. Results use floating-point arithmetic and are rounded for display.', 'info');
    }catch(e){grid.replaceChildren();status.set(e.message,'error');}};
    const invalidate=()=>{grid.replaceChildren();status.set('Input changed. Calculate again.','info');};root.addEventListener('input',invalidate);root.addEventListener('change',invalidate);
    root.append(h('div',{class:'field-row'},field({label:'Known measurement',control:kind}),field({label:'Measurement value',control:value}),field({label:'Central angle in degrees (optional)',control:angle})),h('p',{class:'hint',text:'Enter a positive measurement up to 1,000,000. Angle 0–360° is optional and gives the corresponding arc and sector.'}),actionsRow(btn({label:'Calculate circle',icon:'calculator',onClick:run})),grid,status);
  },
  'right-triangle-calculator'(root) {
    const mode=select({options:[{v:'legs',t:'Two legs'},{v:'leg-hypotenuse',t:'A leg and hypotenuse'}],value:'legs'}), first=input({type:'text',inputmode:'decimal',value:'3'}),second=input({type:'text',inputmode:'decimal',value:'4'}),grid=statsGrid(),status=statusLine('');
    const run=()=>{try {const r=rightTriangle(mode.value,first.value,second.value);
      grid.set([{label:'Leg a (length units)',value:display(r.a)},{label:'Leg b (length units)',value:display(r.b)},{label:'Hypotenuse c (length units)',value:display(r.c),kind:'good'},{label:'Area (square units)',value:display(r.area)},{label:'Perimeter (length units)',value:display(r.perimeter)},{label:'Angle opposite leg a (degrees)',value:display(r.angleA)},{label:'Angle opposite leg b (degrees)',value:display(r.angleB)}]);
      status.set('Assumes a right triangle and consistent length units. Results use floating-point arithmetic and are rounded for display.', 'info');
    }catch(e){grid.replaceChildren();status.set(e.message,'error');}};
    const invalidate=()=>{grid.replaceChildren();status.set('Input changed. Calculate again.','info');};root.addEventListener('input',invalidate);root.addEventListener('change',invalidate);
    root.append(h('div',{class:'field-row'},field({label:'Known sides',control:mode}),field({label:'First leg a',control:first}),field({label:'Second leg b or hypotenuse c',control:second})),h('p',{class:'hint',text:'Enter two positive lengths in the same unit, each up to 1,000,000. Choose which side the second value represents; the hypotenuse must be longest.'}),actionsRow(btn({label:'Calculate right triangle',icon:'calculator',onClick:run})),grid,status);
  },
  'aspect-ratio-calculator'(root) {
    const width=input({type:'number',step:1,min:1,max:1000000000,value:'1920'}), height=input({type:'number',step:1,min:1,max:1000000000,value:'1080'}), target=input({type:'number',step:1,min:1,max:1000000000,placeholder:'Optional'});
    const axis=select({options:[{v:'width',t:'New width'},{v:'height',t:'New height'}],value:'width'}), grid=statsGrid(), status=statusLine('');
    const run=()=>{try { const r=aspectDimensions(width.value,height.value,target.value,axis.value);
      grid.set([{label:'Simplified aspect ratio',value:r.ratio,kind:'good'}, ...(r.scaled ? [{label:'New dimensions (pixels)',value:`${r.scaled.width} × ${r.scaled.height}`}] : [])]);
      status.set(r.scaled?.rounded ? 'The missing dimension is rounded to the nearest whole pixel; the resulting ratio is approximate.' : 'The ratio is exact for the entered whole-pixel dimensions.', 'info');
    }catch(e){grid.replaceChildren();status.set(e.message,'error');}};
    const invalidate=()=>{grid.replaceChildren();status.set('Input changed. Calculate again.','info');}; root.addEventListener('input',invalidate);root.addEventListener('change',invalidate);
    root.append(h('div',{class:'field-row'},field({label:'Original width (pixels)',control:width}),field({label:'Original height (pixels)',control:height}),field({label:'Scale using',control:axis}),field({label:'New dimension (pixels, optional)',control:target})),actionsRow(btn({label:'Calculate aspect ratio',icon:'ratio',onClick:run})),grid,status);
  },
  'pixels-to-inches-converter'(root) {
    const direction=select({options:[{v:'pixels',t:'Pixels to inches'},{v:'inches',t:'Inches to pixels'}],value:'pixels'});
    const value=input({type:'text',inputmode:'decimal',value:'3000'}), ppi=input({type:'text',inputmode:'decimal',value:'300'}),grid=statsGrid(),status=statusLine('');
    const run=()=>{try { const r=pixelsInches(value.value,ppi.value,direction.value);
      grid.set([{label:'Pixels (whole)',value:display(r.pixels),kind:'good'},{label:'Inches',value:display(r.inches)},{label:'Centimetres',value:display(r.inches*2.54)},{label:'Millimetres',value:display(r.inches*25.4)}, ...(direction.value==='inches' ? [{label:'Pixels before rounding',value:display(r.unroundedPixels)}] : [])]);
      status.set('Uses the entered pixels per inch; results are rounded for display. Print and screen settings can change the actual size.', 'info');
    }catch(e){grid.replaceChildren();status.set(e.message,'error');}};
    const invalidate=()=>{grid.replaceChildren();status.set('Input changed. Convert again.','info');};root.addEventListener('input',invalidate);root.addEventListener('change',invalidate);
    root.append(h('div',{class:'field-row'},field({label:'Conversion direction',control:direction}),field({label:'Value (pixels or inches)',control:value}),field({label:'Pixels per inch (PPI)',control:ppi})),h('p',{class:'hint',text:'Enter whole pixels or a positive inch value, depending on direction. PPI is an assumed pixel density, not a guarantee of print quality or screen size.'}),actionsRow(btn({label:'Convert pixels and inches',icon:'repeat',onClick:run})),grid,status);
  },
  'average-calculator'(root) {
    const inp = textarea({ rows: 4, placeholder: 'e.g. 1, 2, 2, 3, 5' }), grid = statsGrid(), status = statusLine(''), detail = h('div', {});
    const run = () => { try {
      const s = averageStats(parseNumbers(inp.value));
      const modes = s.modes.length ? `${s.modes.slice(0, 20).map(display).join(', ')}${s.modes.length > 20 ? ` … (${s.modes.length} modes)` : ''} ×${s.modeCount}` : 'None (all unique)';
      grid.set([{label:'Mean (average)',value:display(s.mean),kind:'good'},{label:'Median',value:display(s.median)},{label:'Mode(s)',value:modes},{label:'Sum',value:display(s.sum)},{label:'Count',value:String(s.count)},{label:'Min',value:display(s.min)},{label:'Max',value:display(s.max)},{label:'Range',value:display(s.range)},{label:'Population variance (÷ n)',value:display(s.populationVariance)},{label:'Population standard deviation',value:display(s.populationSD)},{label:'Sample variance (÷ n − 1)',value:s.sampleVariance === null ? 'Undefined (need 2 values)' : display(s.sampleVariance)},{label:'Sample standard deviation',value:s.sampleSD === null ? 'Undefined (need 2 values)' : display(s.sampleSD)}]);
      detail.replaceChildren(table({ headers:['Sorted values'], rows:[[s.sorted.map(display).join('  ≤  ')]] }));
      status.set('Up to 10,000 values between −1 trillion and 1 trillion. Decimal results are rounded for display; floating-point precision is limited.', 'info');
    } catch(e) { grid.replaceChildren(); detail.replaceChildren(); status.set(e.message,'error'); } };
    root.addEventListener('input', () => { grid.replaceChildren(); detail.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); });
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
    root.addEventListener('input', () => { grid.replaceChildren(); detail.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); });
    root.append(h('div',{class:'field-row'},field({label:'a',control:a}),field({label:'b',control:b}),field({label:'c (optional): a : b = c : x',control:c})),h('p',{class:'hint',text:'a and b must be positive; c may be zero. Use decimal points, up to 6 decimal places and 1 billion.'}),actionsRow(btn({label:'Simplify / solve',icon:'ratio',onClick:run})),grid,detail,status);
  },
  'gcd-lcm-calculator'(root) {
    const inp=input({type:'text',inputmode:'text',placeholder:'e.g. 12, 18, 30'}),grid=statsGrid(),status=statusLine(''),detail=h('div',{});
    const run=()=>{try{const values=parseNumbers(inp.value), g=gcdList(values),l=lcmList(values);
      grid.set([{label:'GCD (HCF)',value:display(g),kind:'good'},{label:'LCM',value:l.toLocaleString('en-US'),kind:'good'},{label:'Numbers',value:String(values.length)}]);
      detail.replaceChildren(h('h3',{text:'Prime factorisation',style:'margin:18px 0 10px'}),table({headers:['Number','Prime factors of absolute value'],rows:values.map(v=>[String(v),primeFactors(v).join(' × ') || '1'])}));
      status.set('Uses absolute values. LCM must fit within JavaScript’s exact safe integer range.', 'info');
    }catch(e){grid.replaceChildren();detail.replaceChildren();status.set(e.message,'error');}};
    root.addEventListener('input', () => { grid.replaceChildren(); detail.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); });
    root.append(field({label:'Numbers (2–100 non-zero integers)',control:inp,hint:'Each absolute value must be at most 1 billion.'}),actionsRow(btn({label:'Calculate GCD & LCM',icon:'grid',onClick:run})),grid,detail,status);
  },
  'weighted-average-calculator'(root) {
    const inp=textarea({rows:5,value:'80, 3\n90, 2',placeholder:'One value and weight per line, e.g. 80, 3'}),grid=statsGrid(),status=statusLine(''),detail=h('div',{});
    const run=()=>{try{const r=weightedAverage(inp.value); grid.set([{label:'Weighted average',value:display(r.average),kind:'good'},{label:'Total weight',value:display(r.totalWeight)},{label:'Sum of value × weight',value:display(r.weightedSum)},{label:'Pairs',value:String(r.pairs.length)}]);detail.replaceChildren(table({headers:['Value','Weight','Value × weight'],rows:r.pairs.map(([v,w])=>[display(v),display(w),display(v*w)])}));status.set('Weights do not have to total 100. Results are rounded for display and use floating-point arithmetic.', 'info');}catch(e){grid.replaceChildren();detail.replaceChildren();status.set(e.message,'error');}};
    root.addEventListener('input', () => { grid.replaceChildren(); detail.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); });
    root.append(field({label:'Value, weight — one pair per line',control:inp,hint:'Separate the two entries with a comma, space or semicolon. Weights must be non-negative.'}),actionsRow(btn({label:'Calculate weighted average',icon:'sigma',onClick:run})),grid,detail,status);
  },
};
export function mount(id) { mountTool(id, defs); }
export const __test = { parseNumbers, averageStats, gcdList, lcmList, primeFactors, ratioCalc, ratioSolve, weightedAverage };
