// =============================================================================
// iHaveTools — Calculators engine + UIs
// percentage-calculator, percentage-change, discount-calculator, age-calculator,
// bmi-calculator, gst-calculator, emi-calculator, tip-calculator,
// compound-interest-calculator, simple-interest-calculator
// =============================================================================
import { h, field, input, select, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, statsGrid, table, fmtNumber, mountTool } from '../ui.js';

const num = (el) => { const v = parseFloat(String(el.value).replace(/,/g, '')); return v; };
const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isFin = (n) => Number.isFinite(n);

/* ═══════════════════════════ Pure calculations ═══════════════════════════ */
export function pctOf(a, b) { return (a * b) / 100; }
export function pctWhat(a, b) { if (b === 0) throw new Error('The second number cannot be zero when asking “what percent”.'); return (a / b) * 100; }
export function pctChange(from, to) {
  if (from === 0) throw new Error('Percentage change is undefined when the starting value is zero — use an absolute difference instead.');
  return ((to - from) / Math.abs(from)) * 100;
}
export function discountCalc(price, pcts, taxPct = 0) {
  let p = price;
  const steps = [];
  for (const pct of pcts) {
    const cut = (p * pct) / 100;
    p -= cut;
    steps.push({ pct, cut, after: p });
  }
  const saved = price - p;
  const tax = (p * taxPct) / 100;
  return { steps, saved, afterDiscount: p, tax, final: p + tax };
}
export function ageCalc(dobStr, atStr) {
  const dob = new Date(`${dobStr}T00:00:00`);
  if (Number.isNaN(dob.getTime())) throw new Error('That date could not be parsed. Pick the date again.');
  const at = atStr ? new Date(`${atStr}T00:00:00`) : new Date();
  if (Number.isNaN(at.getTime())) throw new Error('The “age at date” could not be parsed.');
  if (dob > at) throw new Error('The date of birth must be before the reference date.');
  let years = at.getFullYear() - dob.getFullYear();
  let months = at.getMonth() - dob.getMonth();
  let days = at.getDate() - dob.getDate();
  if (days < 0) {
    months--;
    days += new Date(at.getFullYear(), at.getMonth(), 0).getDate();
  }
  if (months < 0) { years--; months += 12; }
  const totalDays = Math.floor((at - dob) / 864e5);
  const next = new Date(at.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < at) next.setFullYear(next.getFullYear() + 1);
  if (next.getTime() === new Date(at.getFullYear(), dob.getMonth(), dob.getDate()).getTime() && at.getDate() === dob.getDate() && at.getMonth() === dob.getMonth()) {
    next.setTime(next.getTime()); // birthday is today
  }
  const daysToBirthday = Math.round((next - at) / 864e5);
  return { years, months, days, totalDays, weeks: Math.floor(totalDays / 7), hours: totalDays * 24, daysToBirthday, birthdayToday: daysToBirthday === 0 || (days === 0 && months === 0) };
}
export function bmiCalc({ cm = null, ft = null, inch = null, kg = null, lb = null }) {
  let hMeters, kgWeight;
  if (cm != null) hMeters = cm / 100;
  else hMeters = ((ft || 0) * 12 + (inch || 0)) * 0.0254;
  if (kg != null) kgWeight = kg;
  else kgWeight = (lb || 0) * 0.45359237;
  if (!(hMeters > 0.5) || !(hMeters < 2.8)) throw new Error('Enter a plausible height (between about 50 cm and 2.8 m).');
  if (!(kgWeight > 10) || !(kgWeight < 700)) throw new Error('Enter a plausible weight.');
  const bmi = kgWeight / (hMeters * hMeters);
  let category, cls;
  if (bmi < 18.5) { category = 'Underweight'; cls = 'warn'; }
  else if (bmi < 25) { category = 'Healthy weight'; cls = 'good'; }
  else if (bmi < 30) { category = 'Overweight'; cls = 'warn'; }
  else { category = 'Obesity'; cls = 'bad'; }
  const healthyMin = 18.5 * hMeters * hMeters;
  const healthyMax = 24.9 * hMeters * hMeters;
  return { bmi: Math.round(bmi * 10) / 10, category, cls, healthyMin, healthyMax };
}
export function gstCalc({ amount, rate, mode }) {
  if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
  if (!(rate >= 0 && rate <= 100)) throw new Error('The GST rate must be between 0 and 100.');
  let net, gst;
  if (mode === 'add') { net = amount; gst = (amount * rate) / 100; }
  else { net = (amount * 100) / (100 + rate); gst = amount - net; }
  return { net, gst, gross: net + gst, cgst: gst / 2, sgst: gst / 2 };
}
export function emiCalc(principal, annualRatePct, months) {
  if (!(principal > 0)) throw new Error('Loan amount must be greater than zero.');
  if (!(months >= 1)) throw new Error('Tenure must be at least 1 month.');
  const r = annualRatePct / 12 / 100;
  const emi = r === 0 ? principal / months : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  const total = emi * months;
  // yearly amortization summary
  const years = [];
  let balance = principal;
  for (let m = 1; m <= months; m++) {
    const interest = balance * r;
    const principalPart = Math.min(emi - interest, balance);
    balance -= principalPart;
    if (m % 12 === 0 || m === months) {
      years.push({ year: Math.ceil(m / 12), paid: emi * m, interestTotal: emi * m - (principal - Math.max(balance, 0)), balance: Math.max(balance, 0) });
    }
  }
  return { emi, total, totalInterest: total - principal, years };
}
export function tipCalc(bill, tipPct, people, { roundTip = false, roundTotal = false } = {}) {
  if (!(bill >= 0)) throw new Error('Enter a valid bill amount.');
  if (!(tipPct >= 0 && tipPct <= 500)) throw new Error('Tip percentage must be between 0 and 500.');
  if (!(people >= 1)) throw new Error('There must be at least one person.');
  let tip = (bill * tipPct) / 100;
  if (roundTip) tip = Math.ceil(tip);
  let total = bill + tip;
  if (roundTotal) { total = Math.ceil(total); tip = total - bill; }
  return { tip, total, perPerson: total / people, tipPerPerson: tip / people };
}
export function compoundInterest({ principal, annualRatePct, years, perYear = 12, monthlyContribution = 0, contributionTiming = 'end' }) {
  if (!(principal >= 0)) throw new Error('Principal cannot be negative.');
  if (!(years > 0)) throw new Error('Years must be greater than zero.');
  if (![1, 2, 4, 12, 52, 365].includes(perYear)) throw new Error('Unsupported compounding frequency.');
  const periods = Math.round(years * perYear);
  const r = annualRatePct / 100 / perYear;
  let balance = principal;
  const schedule = [];
  let contributed = principal;
  for (let p = 1; p <= periods; p++) {
    if (contributionTiming === 'begin' && monthlyContribution) { balance += monthlyContribution; contributed += monthlyContribution; }
    balance *= 1 + r;
    if (contributionTiming === 'end' && monthlyContribution) { balance += monthlyContribution; contributed += monthlyContribution; }
    if (p % perYear === 0 || p === periods) {
      schedule.push({ year: Math.ceil(p / perYear), balance, contributed, interest: balance - contributed });
    }
  }
  return { finalBalance: balance, totalContributed: contributed, totalInterest: balance - contributed, schedule };
}
export function simpleInterest({ principal, annualRatePct, time, unit = 'years' }) {
  if (!(principal > 0)) throw new Error('Principal must be greater than zero.');
  const years = unit === 'years' ? time : unit === 'months' ? time / 12 : time / 365;
  if (!(years > 0)) throw new Error('Time must be greater than zero.');
  const interest = (principal * annualRatePct * years) / 100;
  return { interest, total: principal + interest, years };
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'percentage-calculator'(root) {
    const mode = segControl({ options: [{ v: 'of', t: 'X% of Y' }, { v: 'what', t: 'X is what % of Y' }, { v: 'change', t: '% change' }], value: 'of', ariaLabel: 'Calculation type' });
    const labelA = h('label', { text: 'Percentage (X)', for: 'pa' });
    const labelB = h('label', { text: 'Of number (Y)', for: 'pb' });
    const a = input({ type: 'number', step: 'any', id: 'pa', placeholder: 'e.g. 15' });
    const b = input({ type: 'number', step: 'any', id: 'pb', placeholder: 'e.g. 200' });
    const grid = statsGrid();
    const status = statusLine('');
    const formula = h('p', { class: 'hint', style: 'margin-top:8px' });
    const applyMode = () => {
      const m = mode.getValue();
      labelA.textContent = m === 'of' ? 'Percentage (X)' : m === 'what' ? 'Part (X)' : 'Starting value';
      labelB.textContent = m === 'of' ? 'Of number (Y)' : m === 'what' ? 'Whole (Y)' : 'New value';
      grid.replaceChildren();
      formula.textContent = '';
      status.set('');
    };
    mode.querySelectorAll('button').forEach((bt) => bt.addEventListener('click', () => setTimeout(applyMode, 0)));
    const run = () => {
      const x = num(a), y = num(b);
      if (!isFin(x) || !isFin(y)) { status.set('Enter both numbers.', 'warning'); grid.replaceChildren(); return; }
      const m = mode.getValue();
      try {
        if (m === 'of') {
          const r = pctOf(x, y);
          grid.set([{ label: `${fmtNumber(x)}% of ${fmtNumber(y)}`, value: fmtNumber(r), kind: 'good' }]);
          formula.textContent = `Formula: (${fmtNumber(x)} ÷ 100) × ${fmtNumber(y)} = ${fmtNumber(r)}`;
        } else if (m === 'what') {
          const r = pctWhat(x, y);
          grid.set([{ label: `${fmtNumber(x)} as % of ${fmtNumber(y)}`, value: `${fmtNumber(r, 4)}%`, kind: 'good' }]);
          formula.textContent = `Formula: (${fmtNumber(x)} ÷ ${fmtNumber(y)}) × 100 = ${fmtNumber(r, 4)}%`;
        } else {
          const r = pctChange(x, y);
          grid.set([
            { label: 'Change', value: `${r > 0 ? '+' : ''}${fmtNumber(r, 4)}%`, kind: r >= 0 ? 'good' : 'bad' },
            { label: r >= 0 ? 'Increase' : 'Decrease', value: fmtNumber(Math.abs(r), 4) + '%' },
            { label: 'Difference', value: fmtNumber(y - x) },
          ]);
          formula.textContent = `Formula: ((${fmtNumber(y)} − ${fmtNumber(x)}) ÷ |${fmtNumber(x)}|) × 100`;
        }
        status.set('Calculated ✓', 'success');
      } catch (e) { status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'Calculation type', control: mode }),
      h('div', { class: 'field-row' }, field({ label: 'X', control: a, id: 'pa' }), field({ label: 'Y', control: b, id: 'pb' })),
      // fix: labels above are duplicated by field(); use fields' own labels
      actionsRow(btn({ label: 'Calculate', icon: 'percent', onClick: run })),
      grid, formula, status);
    // replace the static labels injected by field() with dynamic ones
    const labels = root.querySelectorAll('.field > label');
    if (labels[0]) { const dyn = labelA; labels[0].replaceWith(dyn); }
    if (labels[1]) { const dyn = labelB; labels[1].replaceWith(dyn); }
    applyMode();
  },

  'percentage-change'(root) {
    const from = input({ type: 'number', step: 'any', placeholder: 'e.g. 80' });
    const to = input({ type: 'number', step: 'any', placeholder: 'e.g. 100' });
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      const a = num(from), b = num(to);
      if (!isFin(a) || !isFin(b)) { status.set('Enter both values.', 'warning'); return; }
      try {
        const r = pctChange(a, b);
        grid.set([
          { label: r >= 0 ? 'Percentage increase' : 'Percentage decrease', value: `${fmtNumber(Math.abs(r), 4)}%`, kind: r >= 0 ? 'good' : 'bad' },
          { label: 'Absolute difference', value: fmtNumber(b - a) },
          { label: 'Multiplier', value: `${fmtNumber(b / a, 4)}×` },
        ]);
        status.set(`The value went ${r >= 0 ? 'up' : 'down'} by ${fmtNumber(Math.abs(r), 4)}%.`, 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Starting value', control: from }), field({ label: 'New value', control: to })),
      actionsRow(btn({ label: 'Calculate change', icon: 'trending', onClick: run })), grid, status);
  },

  'discount-calculator'(root) {
    const price = input({ type: 'number', step: 'any', min: 0, placeholder: 'e.g. 249.99' });
    const d1 = input({ type: 'number', step: 'any', min: 0, max: 100, value: '20' });
    const d2 = input({ type: 'number', step: 'any', min: 0, max: 100, placeholder: 'optional' });
    const tax = input({ type: 'number', step: 'any', min: 0, placeholder: 'optional' });
    const grid = statsGrid();
    const status = statusLine('');
    const steps = h('div', {});
    const run = () => {
      const p = num(price);
      if (!(p >= 0)) { status.set('Enter the original price.', 'warning'); return; }
      const pcts = [num(d1), num(d2)].filter((v) => isFin(v) && v > 0);
      if (!pcts.length) { status.set('Enter at least one discount percentage (0–100).', 'warning'); return; }
      if (pcts.some((v) => v > 100)) { status.set('A discount cannot exceed 100%.', 'error'); return; }
      const t = isFin(num(tax)) && num(tax) > 0 ? num(tax) : 0;
      const r = discountCalc(p, pcts, t);
      grid.set([
        { label: 'Final price', value: money(r.final), kind: 'good' },
        { label: 'You save', value: money(r.saved), kind: r.saved > 0 ? 'good' : '' },
        { label: 'After discounts', value: money(r.afterDiscount) },
        ...(t ? [{ label: `Tax (${t}%)`, value: money(r.tax) }] : []),
      ]);
      steps.replaceChildren(table({ headers: ['Step', 'Discount', 'Amount off', 'Price after'], rows: r.steps.map((s, i) => [i + 1 === 1 ? 'Discount' : `Extra discount`, `${s.pct}%`, money(s.cut), money(s.after)]) }));
      status.set(`Original ${money(p)} → final ${money(r.final)}.`, 'success');
    };
    root.append(field({ label: 'Original price', control: price }),
      h('div', { class: 'field-row' }, field({ label: 'Discount %', control: d1 }), field({ label: 'Extra discount %', control: d2, hint: 'Applied after the first' }), field({ label: 'Tax %', control: tax, hint: 'On the discounted price' })),
      actionsRow(btn({ label: 'Calculate', icon: 'tag', onClick: run })), grid, steps, status);
  },

  'age-calculator'(root) {
    const dob = input({ type: 'date', max: new Date().toISOString().slice(0, 10) });
    const at = input({ type: 'date' });
    const grid = statsGrid();
    const status = statusLine('Pick a date of birth to begin.');
    const run = () => {
      if (!dob.value) { status.set('Pick a date of birth first.', 'warning'); return; }
      try {
        const r = ageCalc(dob.value, at.value || undefined);
        grid.set([
          { label: 'Age', value: `${r.years}y ${r.months}m ${r.days}d`, kind: 'good' },
          { label: 'In years', value: `${r.years}` },
          { label: 'Total months', value: fmtNumber(r.years * 12 + r.months) },
          { label: 'Total weeks', value: fmtNumber(r.weeks) },
          { label: 'Total days', value: fmtNumber(r.totalDays) },
          { label: 'Total hours', value: fmtNumber(r.hours) },
          { label: r.birthdayToday ? 'Birthday today! 🎂' : 'Next birthday in', value: r.birthdayToday ? `${r.years + 1}` : `${r.daysToBirthday} days`, kind: r.birthdayToday ? 'good' : '' },
        ]);
        status.set(`Age calculated${at.value ? ' at the chosen date' : ' as of today'} ✓`, 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(h('div', { class: 'field-row' },
        field({ label: 'Date of birth', control: dob }),
        field({ label: 'Age at date', control: at, hint: 'Defaults to today' })),
      actionsRow(btn({ label: 'Calculate age', icon: 'cake', onClick: run })), grid, status);
  },

  'bmi-calculator'(root) {
    const unit = segControl({ options: [{ v: 'metric', t: 'Metric (cm, kg)' }, { v: 'imperial', t: 'Imperial (ft/in, lb)' }], value: 'metric', ariaLabel: 'Units' });
    const cm = input({ type: 'number', step: 'any', placeholder: 'e.g. 172' });
    const kg = input({ type: 'number', step: 'any', placeholder: 'e.g. 68' });
    const ft = input({ type: 'number', step: 'any', placeholder: 'feet, e.g. 5' });
    const inch = input({ type: 'number', step: 'any', placeholder: 'inches, e.g. 8' });
    const lb = input({ type: 'number', step: 'any', placeholder: 'e.g. 150' });
    const metricRow = h('div', { class: 'field-row' }, field({ label: 'Height (cm)', control: cm }), field({ label: 'Weight (kg)', control: kg }));
    const imperialRow = h('div', { class: 'field-row', hidden: true }, field({ label: 'Height', control: h('div', { style: 'display:flex;gap:8px' }, ft, inch) }), field({ label: 'Weight (lb)', control: lb }));
    const applyUnits = () => {
      const imperial = unit.getValue() === 'imperial';
      metricRow.hidden = imperial;
      imperialRow.hidden = !imperial;
    };
    unit.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setTimeout(applyUnits, 0)));
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      try {
        const imperial = unit.getValue() === 'imperial';
        const r = imperial
          ? bmiCalc({ ft: num(ft) || 0, inch: num(inch) || 0, lb: num(lb) })
          : bmiCalc({ cm: num(cm), kg: num(kg) });
        grid.set([
          { label: 'Your BMI', value: r.bmi.toFixed(1), kind: r.cls },
          { label: 'Category', value: r.category, kind: r.cls },
          { label: 'Healthy range', value: `${r.healthyMin.toFixed(1)}–${r.healthyMax.toFixed(1)} kg`, kind: '' },
        ]);
        status.set('BMI calculated. BMI is a rough screen — it does not measure body fat or health directly.', 'info');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'Units', control: unit }), metricRow, imperialRow,
      actionsRow(btn({ label: 'Calculate BMI', icon: 'activity', onClick: run })), grid, status);
  },

  'gst-calculator'(root) {
    const mode = segControl({ options: [{ v: 'add', t: 'Add GST' }, { v: 'remove', t: 'Remove GST' }], value: 'add', ariaLabel: 'Mode' });
    const amount = input({ type: 'number', step: 'any', placeholder: 'e.g. 1000' });
    const rate = select({ options: [{ v: 5, t: '5%' }, { v: 12, t: '12%' }, { v: 18, t: '18%' }, { v: 28, t: '28%' }, { v: 'custom', t: 'Custom…' }], value: 18 });
    const custom = input({ type: 'number', step: 'any', placeholder: 'rate %', hidden: true });
    rate.addEventListener('change', () => { custom.hidden = rate.value !== 'custom'; });
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      const r = rate.value === 'custom' ? num(custom) : Number(rate.value);
      try {
        const res = gstCalc({ amount: num(amount), rate: r, mode: mode.getValue() });
        grid.set([
          { label: mode.getValue() === 'add' ? 'Base (net)' : 'Base (net)', value: money(res.net) },
          { label: `GST @ ${fmtNumber(r)}%`, value: money(res.gst), kind: 'warn' },
          { label: mode.getValue() === 'add' ? 'Total (gross)' : 'Pre-tax amount', value: money(res.gross), kind: 'good' },
          { label: 'CGST split', value: money(res.cgst) },
          { label: 'SGST split', value: money(res.sgst) },
        ]);
        status.set(mode.getValue() === 'add' ? 'GST added ✓' : 'GST extracted ✓', 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'Mode', control: mode }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: mode.getValue() === 'add' ? 'Amount (before GST)' : 'Amount (including GST)', control: amount }),
        field({ label: 'GST rate', control: rate }),
        field({ label: 'Custom rate', control: custom })),
      actionsRow(btn({ label: 'Calculate GST', icon: 'receipt', onClick: run })), grid, status);
  },

  'emi-calculator'(root) {
    const principal = input({ type: 'number', step: 'any', placeholder: 'e.g. 3000000' });
    const rate = input({ type: 'number', step: 'any', placeholder: 'e.g. 8.5', value: '8.5' });
    const years = input({ type: 'number', step: 'any', placeholder: 'e.g. 20', value: '20' });
    const monthsOnly = switchChip({ label: 'Tenure is in months' });
    const grid = statsGrid();
    const status = statusLine('');
    const scheduleWrap = h('div', {});
    const run = () => {
      const P = num(principal), R = num(rate);
      let n = num(years);
      if (monthsOnly.querySelector('input').checked) n = n;
      else n = n * 12;
      try {
        const r = emiCalc(P, R, n);
        grid.set([
          { label: 'Monthly EMI', value: money(r.emi), kind: 'good' },
          { label: 'Total interest', value: money(r.totalInterest), kind: 'warn' },
          { label: 'Total repayment', value: money(r.total) },
          { label: 'Payments', value: `${n}` },
        ]);
        scheduleWrap.replaceChildren(
          h('h3', { text: 'Year-by-year balance', style: 'margin:20px 0 10px' }),
          table({ headers: ['Year', 'Paid so far', 'Interest so far', 'Balance left'], rows: r.years.map((y) => [`Y${y.year}`, money(y.paid), money(y.interestTotal), money(y.balance)]) }));
        status.set(`EMI ${money(r.emi)} per month for ${n} payments.`, 'success');
      } catch (e) { grid.replaceChildren(); scheduleWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'Loan amount', control: principal }),
      h('div', { class: 'field-row' },
        field({ label: 'Annual interest rate %', control: rate }),
        field({ label: 'Tenure', control: years, hint: 'Years (or months if toggled below)' })),
      h('div', { class: 'switch-row', style: 'margin-bottom:6px' }, monthsOnly),
      actionsRow(btn({ label: 'Calculate EMI', icon: 'bank', onClick: run })), grid, scheduleWrap, status);
  },

  'tip-calculator'(root) {
    const bill = input({ type: 'number', step: 'any', min: 0, placeholder: 'e.g. 84.50' });
    const pct = input({ type: 'number', step: 'any', min: 0, value: '15' });
    const people = input({ type: 'number', step: '1', min: 1, value: '1' });
    const roundTip = switchChip({ label: 'Round tip up' });
    const roundTotal = switchChip({ label: 'Round total up' });
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      try {
        const r = tipCalc(num(bill), num(pct), Math.floor(num(people) || 1), {
          roundTip: roundTip.querySelector('input').checked,
          roundTotal: roundTotal.querySelector('input').checked,
        });
        const n = Math.floor(num(people) || 1);
        grid.set([
          { label: 'Tip', value: money(r.tip) },
          { label: 'Total', value: money(r.total), kind: 'good' },
          ...(n > 1 ? [
            { label: `Per person (${n})`, value: money(r.perPerson), kind: 'good' },
            { label: 'Tip per person', value: money(r.tipPerPerson) },
          ] : []),
        ]);
        status.set(`A ${fmtNumber(num(pct))}% tip on ${money(num(bill))}.`, 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'Bill amount', control: bill }),
      h('div', { class: 'field-row' },
        field({ label: 'Tip %', control: pct, hint: 'Try 10 / 15 / 18 / 20' }),
        field({ label: 'Split between', control: people }),
        ),
      h('div', { class: 'switch-row', style: 'margin-bottom:6px' }, roundTip, roundTotal),
      actionsRow(btn({ label: 'Calculate tip', icon: 'coins', onClick: run })), grid, status);
  },

  'compound-interest-calculator'(root) {
    const principal = input({ type: 'number', step: 'any', placeholder: 'e.g. 10000', value: '10000' });
    const rate = input({ type: 'number', step: 'any', placeholder: 'e.g. 7', value: '7' });
    const years = input({ type: 'number', step: 'any', placeholder: 'e.g. 10', value: '10' });
    const freq = select({ options: [{ v: 1, t: 'Yearly' }, { v: 2, t: 'Half-yearly' }, { v: 4, t: 'Quarterly' }, { v: 12, t: 'Monthly' }, { v: 365, t: 'Daily' }], value: 12 });
    const contrib = input({ type: 'number', step: 'any', placeholder: 'optional, per month' });
    const grid = statsGrid();
    const status = statusLine('');
    const scheduleWrap = h('div', {});
    const run = () => {
      try {
        const r = compoundInterest({
          principal: num(principal) || 0, annualRatePct: num(rate), years: num(years),
          perYear: Number(freq.value), monthlyContribution: num(contrib) || 0,
        });
        grid.set([
          { label: 'Final balance', value: money(r.finalBalance), kind: 'good' },
          { label: 'Interest earned', value: money(r.totalInterest), kind: 'warn' },
          { label: 'Total contributed', value: money(r.totalContributed) },
          { label: 'Growth multiple', value: `${fmtNumber(r.finalBalance / r.totalContributed, 2)}×` },
        ]);
        scheduleWrap.replaceChildren(
          h('h3', { text: 'Growth schedule', style: 'margin:20px 0 10px' }),
          table({ headers: ['Year', 'Balance', 'Contributed', 'Interest'], rows: r.schedule.map((s) => [`Y${s.year}`, money(s.balance), money(s.contributed), money(s.interest)]) }));
        status.set('Projection calculated ✓', 'success');
      } catch (e) { grid.replaceChildren(); scheduleWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Principal', control: principal }),
        field({ label: 'Annual rate %', control: rate }),
        field({ label: 'Years', control: years }),
        field({ label: 'Compounding', control: freq })),
      field({ label: 'Additional contribution', control: contrib, hint: 'Per month, optional' }),
      actionsRow(btn({ label: 'Calculate growth', icon: 'trending', onClick: run })), grid, scheduleWrap, status);
  },

  'simple-interest-calculator'(root) {
    const principal = input({ type: 'number', step: 'any', placeholder: 'e.g. 5000', value: '5000' });
    const rate = input({ type: 'number', step: 'any', placeholder: 'e.g. 6', value: '6' });
    const time = input({ type: 'number', step: 'any', placeholder: 'e.g. 3', value: '3' });
    const unit = select({ options: [{ v: 'years', t: 'Years' }, { v: 'months', t: 'Months' }, { v: 'days', t: 'Days' }], value: 'years' });
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      try {
        const r = simpleInterest({ principal: num(principal), annualRatePct: num(rate), time: num(time), unit: unit.value });
        grid.set([
          { label: 'Interest', value: money(r.interest), kind: 'warn' },
          { label: 'Total amount', value: money(r.total), kind: 'good' },
          { label: 'Interest per year', value: money(r.interest / r.years) },
        ]);
        status.set(`Formula: P × R × T = ${fmtNumber(num(principal))} × ${fmtNumber(num(rate))}% × ${fmtNumber(r.years, 4)} yr`, 'info');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Principal', control: principal }),
        field({ label: 'Annual rate %', control: rate }),
        field({ label: 'Time', control: time }),
        field({ label: 'Unit', control: unit })),
      actionsRow(btn({ label: 'Calculate interest', icon: 'trending', onClick: run })), grid, status);
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { pctOf, pctWhat, pctChange, discountCalc, ageCalc, bmiCalc, gstCalc, emiCalc, tipCalc, compoundInterest, simpleInterest };
