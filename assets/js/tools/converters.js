// =============================================================================
// iHaveTools — Unit converters (shared engine)
// length, weight, temperature, time, speed, data-storage, area, volume
// =============================================================================
import { h, field, input, select, segControl, btn, actionsRow, resultPanel, statusLine, table, fmtNumber, mountTool } from '../ui.js';

/* Engine: convert(value, from, to) via base-unit factors; temperature is special. */
export const UNIT_SETS = {
  length: {
    base: 'metre',
    units: {
      'nanometre': 1e-9, 'micrometre': 1e-6, 'millimetre': 0.001, 'centimetre': 0.01, 'metre': 1, 'kilometre': 1000,
      'inch': 0.0254, 'foot': 0.3048, 'yard': 0.9144, 'mile': 1609.344, 'nautical mile': 1852,
      'light-year': 9.4607304725808e15,
    },
  },
  weight: {
    base: 'kilogram',
    units: {
      'microgram': 1e-9, 'milligram': 1e-6, 'gram': 0.001, 'kilogram': 1, 'metric tonne': 1000,
      'ounce': 0.028349523125, 'pound': 0.45359237, 'stone': 6.35029318, 'US ton (short)': 907.18474, 'UK ton (long)': 1016.0469088,
    },
  },
  temperature: {
    base: 'celsius',
    special: true,
    units: { 'Celsius': 'C', 'Fahrenheit': 'F', 'Kelvin': 'K', 'Rankine': 'R' },
  },
  time: {
    base: 'second',
    units: {
      'nanosecond': 1e-9, 'microsecond': 1e-6, 'millisecond': 0.001, 'second': 1, 'minute': 60, 'hour': 3600,
      'day': 86400, 'week': 604800, 'month (avg)': 2629746, 'year (avg)': 31556952, 'decade': 315569520, 'century': 3155695200,
    },
  },
  speed: {
    base: 'metres per second',
    units: {
      'metres/second': 1, 'kilometres/hour': 1 / 3.6, 'kilometres/second': 1000, 'miles/hour': 0.44704,
      'feet/second': 0.3048, 'knot': 0.5144444444444445, 'Mach (sea level)': 340.29,
    },
  },
  data: {
    base: 'byte',
    units: {
      'bit': 0.125, 'byte': 1, 'kilobyte (KB)': 1e3, 'megabyte (MB)': 1e6, 'gigabyte (GB)': 1e9, 'terabyte (TB)': 1e12, 'petabyte (PB)': 1e15,
      'kibibyte (KiB)': 1024, 'mebibyte (MiB)': 1024 ** 2, 'gibibyte (GiB)': 1024 ** 3, 'tebibyte (TiB)': 1024 ** 4,
    },
  },
  area: {
    base: 'square metre',
    units: {
      'square millimetre': 1e-6, 'square centimetre': 1e-4, 'square metre': 1, 'hectare': 1e4, 'square kilometre': 1e6,
      'square inch': 0.00064516, 'square foot': 0.09290304, 'square yard': 0.83612736, 'acre': 4046.8564224, 'square mile': 2589988.110336,
    },
  },
  volume: {
    base: 'litre',
    units: {
      'millilitre': 0.001, 'litre': 1, 'cubic centimetre': 0.001, 'cubic metre': 1000, 'cubic inch': 0.016387064,
      'cubic foot': 28.316846592, 'US teaspoon': 0.00492892159375, 'US tablespoon': 0.01478676478125, 'US fluid ounce': 0.0295735295625,
      'US cup': 0.2365882365, 'US pint': 0.473176473, 'US quart': 0.946352946, 'US gallon': 3.785411784,
      'UK fluid ounce': 0.0284130625, 'UK pint': 0.56826125, 'UK gallon': 4.54609,
    },
  },
  pressure: { base: 'pascal', units: {
    'pascal (Pa)': 1, 'kilopascal (kPa)': 1000, 'megapascal (MPa)': 1e6, 'bar': 100000,
    'standard atmosphere (atm)': 101325, 'psi': 6894.757293168, 'torr': 101325/760,
  } },
  energy: { base: 'joule', units: {
    'joule (J)': 1, 'kilojoule (kJ)': 1000, 'megajoule (MJ)': 1e6,
    'watt-hour (Wh)': 3600, 'kilowatt-hour (kWh)': 3600000,
    'calorie (thermochemical)': 4.184, 'kilocalorie (thermochemical)': 4184,
    'BTU (international table)': 1055.05585262,
  } },
  power: { base: 'watt', units: {
    'watt (W)': 1, 'kilowatt (kW)': 1000, 'megawatt (MW)': 1e6,
    'horsepower (mechanical)': 745.6998715822702, 'horsepower (metric)': 735.49875,
  } },
  fuel: { base: 'kilometres per litre', special: 'fuel', units: {
    'kilometres/litre (km/L)': 1, 'miles/US gallon (mpg US)': 1.609344/3.785411784,
    'miles/UK gallon (mpg UK)': 1.609344/4.54609, 'litres/100 km (L/100 km)': 'reciprocal',
  } },
};

export function convert(value, from, to, set = 'length') {
  const s = UNIT_SETS[set];
  if (!s) throw new Error('Unknown conversion category.');
  if (!Number.isFinite(value) || Math.abs(value)>1e100 || (value!==0 && Math.abs(value)<1e-100)) throw new Error('Enter a valid number: finite, with magnitude between 1e-100 and 1e100, or zero.');
  if (!Object.hasOwn(s.units, from)) throw new Error(`Unknown unit “${from}”.`);
  if (!Object.hasOwn(s.units, to)) throw new Error(`Unknown unit “${to}”.`);
  let out;
  if (s.special === 'fuel') {
    if (value <= 0) throw new Error('Fuel economy must be greater than zero.');
    const kmPerL = s.units[from] === 'reciprocal' ? 100 / value : value * s.units[from];
    out = s.units[to] === 'reciprocal' ? 100 / kmPerL : kmPerL / s.units[to];
  } else if (s.special) {
    const min = { C: -273.15, F: -459.67, K: 0, R: 0 }[s.units[from]];
    if (value < min) throw new Error('That temperature is below absolute zero (−273.15 °C).');
    const c = Math.max(-273.15, { C: (v) => v, F: (v) => (v - 32) * 5 / 9, K: (v) => v - 273.15, R: (v) => (v - 491.67) * 5 / 9 }[s.units[from]](value));
    if (from === to) out = value;
    else if (s.units[from] === 'K' && s.units[to] === 'R') out = value * 9 / 5;
    else if (s.units[from] === 'R' && s.units[to] === 'K') out = value * 5 / 9;
    else out = { C: (v) => v, F: (v) => v * 9 / 5 + 32, K: (v) => v + 273.15, R: (v) => (v + 273.15) * 9 / 5 }[s.units[to]](c);
  } else out = value * (s.units[from] / s.units[to]);
  if (!Number.isFinite(out) || (out === 0 && value !== 0 && !s.special)) throw new Error('Result is outside the supported numeric range.');
  return out;
}

/* ═══════════════════ Roman numerals (1–3999, strict standard form) ═══════════════════ */
const ROMAN_TABLE = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function toRoman(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new Error('Enter a whole number between 1 and 3999 — the standard Roman system has no zero, and numbers beyond 3999 need overline (vinculum) notation.');
  let out = '';
  let rest = n;
  for (const [v, sym] of ROMAN_TABLE) { while (rest >= v) { out += sym; rest -= v; } }
  return out;
}
export function romanBreakdown(n) {
  toRoman(n); let rest = n; const parts = [];
  for (const [value, symbol] of ROMAN_TABLE) {
    const count = Math.floor(rest / value);
    if (count) { parts.push({symbol: symbol.repeat(count), value: value * count}); rest %= value; }
  }
  return parts;
}
const ROMAN_RE = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
export function fromRoman(str) {
  const s = String(str).trim().toUpperCase();
  if (!s || !ROMAN_RE.test(s)) throw new Error('That is not a standard Roman numeral — watch for repeats like IIII or invalid subtractions like IC (99 is XCIX, 49 is XLIX).');
  const val = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = val[s[i]];
    const next = val[s[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

// Avoid displaying a nonzero conversion as zero in either the result or table.
export function formatConversion(value, digits = 8) {
  if (value !== 0 && (Math.abs(value) < 1e-6 || Math.abs(value) >= 1e15)) return value.toExponential(digits);
  return fmtNumber(value, digits);
}

/* UI: generic builder used by unit converter pages */
function converterUI(root, setId, defaults) {
  const s = UNIT_SETS[setId];
  const unitNames = Object.keys(s.units);
  const value = input({ type: 'number', step: 'any', value: defaults.value });
  const from = select({ options: unitNames.map((u) => ({ v: u, t: u })), value: defaults.from });
  const to = select({ options: unitNames.map((u) => ({ v: u, t: u })), value: defaults.to });
  const status = statusLine('');
  const out = resultPanel({ label: 'Result', copy: false, placeholder: 'Enter a value to convert.' });
  const allWrap = h('div', {});
  const render = () => {
    try {
      const raw = value.value.trim();
      if (!raw || value.validity.badInput) throw new Error('Enter a valid number.');
      const v = Number(raw);
      if (v === 0 && /[1-9]/.test(raw.split(/[eE]/)[0])) throw new Error('Input is too small to represent; enter a valid number within the supported range.');
      const result = convert(v, from.value, to.value, setId);
      const pretty = formatConversion(result, 8);
      out.set(h('div', {},
        h('p', { style: 'font-size:1.5rem;font-weight:750;letter-spacing:-0.02em;margin:0 0 4px;font-variant-numeric:tabular-nums', text: `${pretty} ${to.value}` }),
        h('p', { class: 'hint', style: 'margin:0', text: `${formatConversion(v, 8)} ${from.value} = ${pretty} ${to.value}` })));
      status.set('Converted ✓ — results are rounded for display; floating-point arithmetic is approximate.', 'success');
      // table of all units
      allWrap.replaceChildren(
        h('h3', { text: `Equal to…`, style: 'margin:18px 0 10px' }),
        table({ headers: ['Unit', 'Value'], rows: unitNames.filter((u) => u !== from.value).map((u) => {
          const r = convert(v, from.value, u, setId);
          return [u, formatConversion(r, 8)];
        }) }));
    } catch (e) { out.placeholder(); allWrap.replaceChildren(); status.set(e.message, 'error'); }
  };
  const swap = () => { [from.value, to.value] = [to.value, from.value]; render(); };
  [value, from, to].forEach((el) => el.addEventListener('input', render));
  [from, to].forEach((el) => el.addEventListener('change', render));
  root.append(
    field({ label: 'Value', control: value, hint: setId === 'fuel' ? 'Positive values only; finite magnitude 1e-100 to 1e100.' : 'Finite values: magnitude 1e-100 to 1e100, or zero.' }),
    h('div', { class: 'field-row', style: 'align-items:end' },
      field({ label: 'From', control: from }),
      h('div', { class: 'field', style: 'max-width:56px;justify-content:flex-end' }, btn({ label: '⇄', variant: 'secondary', title: 'Swap units', onClick: swap })),
      field({ label: 'To', control: to })),
    actionsRow(btn({ label: 'Convert', icon: 'swap', onClick: render })),
    status, h('br'), out.panel, allWrap);
  render();
}

const defs = {
  'length-converter': (root) => converterUI(root, 'length', { value: '100', from: 'centimetre', to: 'inch' }),
  'weight-converter': (root) => converterUI(root, 'weight', { value: '70', from: 'kilogram', to: 'pound' }),
  'temperature-converter': (root) => converterUI(root, 'temperature', { value: '37', from: 'Celsius', to: 'Fahrenheit' }),
  'time-converter': (root) => converterUI(root, 'time', { value: '90', from: 'minute', to: 'hour' }),
  'speed-converter': (root) => converterUI(root, 'speed', { value: '100', from: 'kilometres/hour', to: 'miles/hour' }),
  'data-storage-converter': (root) => converterUI(root, 'data', { value: '1', from: 'gigabyte (GB)', to: 'megabyte (MB)' }),
  'area-converter': (root) => converterUI(root, 'area', { value: '1', from: 'hectare', to: 'acre' }),
  'volume-converter': (root) => converterUI(root, 'volume', { value: '1', from: 'US gallon', to: 'litre' }),
  'pressure-converter': (root) => converterUI(root, 'pressure', { value:'1', from:'bar', to:'psi' }),
  'energy-converter': (root) => converterUI(root, 'energy', { value:'1', from:'kilowatt-hour (kWh)', to:'megajoule (MJ)' }),
  'power-converter': (root) => converterUI(root, 'power', { value:'1', from:'horsepower (mechanical)', to:'kilowatt (kW)' }),
  'fuel-economy-converter': (root) => converterUI(root, 'fuel', { value:'30', from:'miles/US gallon (mpg US)', to:'litres/100 km (L/100 km)' }),
  'roman-numeral-converter'(root) {
    const mode = segControl({ options: [{ v: 'to-roman', t: 'Number → Roman' }, { v: 'to-number', t: 'Roman → Number' }], value: 'to-roman', ariaLabel: 'Direction' });
    const val = input({ type: 'text', placeholder: 'e.g. 2026', value: '2026' });
    const status = statusLine('');
    const out = resultPanel({ label: 'Result', copy: true, placeholder: 'Enter a value to convert.' });
    const details = h('p', {class:'hint'});
    const run = () => {
      try {
        if (mode.getValue() === 'to-roman') {
          const raw = val.value.trim();
          if (!/^[0-9]+$/.test(raw)) throw new Error('Enter a whole decimal number between 1 and 3999.');
          const n = Number(raw);
          const r = toRoman(n);
          out.set(r);
          details.textContent = romanBreakdown(n).map(p => `${p.symbol} = ${p.value}`).join(' + ');
          status.set(`${n} in Roman numerals ✓`, 'success');
        } else {
          const n = fromRoman(val.value);
          out.set(String(n));
          details.textContent = romanBreakdown(n).map(p => `${p.symbol} = ${p.value}`).join(' + ');
          status.set(`${val.value.trim().toUpperCase()} = ${n} ✓`, 'success');
        }
      } catch (e) { out.placeholder(); details.textContent = ''; status.set(e.message, 'error'); }
    };
    val.addEventListener('input', run);
    mode.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setTimeout(() => {
      val.placeholder = mode.getValue() === 'to-roman' ? 'e.g. 2026' : 'e.g. MMXXVI';
      run();
    }, 0)));
    root.append(field({ label: 'Direction', control: mode }),
      field({ label: 'Value', control: val, hint: 'Numbers 1–3999; Roman input is case-insensitive' }),
      actionsRow(btn({ label: 'Convert', icon: 'type', onClick: run })),
      status, h('br'), out.panel, h('h3', {text:'Value breakdown'}), details);
    run();
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { UNIT_SETS, convert, toRoman, fromRoman };
