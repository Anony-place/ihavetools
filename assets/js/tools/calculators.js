// =============================================================================
// iHaveTools — Calculators engine + UIs
// percentage-calculator, percentage-change, discount-calculator, age-calculator,
// bmi-calculator, gst-calculator, emi-calculator, tip-calculator,
// compound-interest-calculator, simple-interest-calculator, sip-calculator,
// ppf-calculator, fd-calculator, income-tax-calculator, rd-calculator,
// cagr-calculator, gratuity-calculator, lumpsum-calculator, nps-calculator,
// epf-calculator, hra-calculator
// Shareable calculators offer an opt-in link containing the entered values.
// =============================================================================
import { h, field, input, textarea, select, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, statsGrid, table, fmtNumber, mountTool, shareState } from '../ui.js';
import { DAY_MS, parseCalendarDate, localDateISO, dateISO, addMonthsUTC } from '../calendar.js';

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
export function ageCalc(dobStr, atStr, leapRule = 'feb28') {
  const birth = parseCalendarDate(dobStr), at = parseCalendarDate(atStr || localDateISO(new Date()));
  if (birth > at) throw new Error('The date of birth must be before or equal to the reference date.');
  if (!['feb28','mar1'].includes(leapRule)) throw new Error('Choose a valid leap-day birthday rule.');
  const bd = new Date(birth), reference = new Date(at);
  const birthdayIn = (year) => {
    const month=bd.getUTCMonth(), day=bd.getUTCDate();
    if (month===1 && day===29 && new Date(Date.UTC(year,2,0)).getUTCDate()===28) return Date.UTC(year, leapRule==='mar1' ? 2 : 1, leapRule==='mar1' ? 1 : 28);
    return Date.UTC(year,month,day);
  };
  const y=reference.getUTCFullYear(); let years=y-bd.getUTCFullYear();
  if (birthdayIn(y)>at) years--;
  const anniversary=birthdayIn(bd.getUTCFullYear()+years); let months=0;
  while (months<11 && addMonthsUTC(anniversary,months+1)<=at) months++;
  const days=(at-addMonthsUTC(anniversary,months))/DAY_MS;
  let next=birthdayIn(y); if(next<at) next=birthdayIn(y+1);
  const totalDays=(at-birth)/DAY_MS;
  return {years,months,days,totalDays,weeks:Math.floor(totalDays/7),hours:totalDays*24,daysToBirthday:(next-at)/DAY_MS,birthdayToday:next===at,nextBirthday:dateISO(next)};
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
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new Error('Enter an amount greater than zero and at most 1 trillion.');
  if (!(rate >= 0 && rate <= 100)) throw new Error('The GST rate must be between 0 and 100.');
  if (!['add', 'remove'].includes(mode)) throw new Error('Choose a valid GST calculation mode.');
  let net, gst;
  if (mode === 'add') { net = amount; gst = (amount * rate) / 100; }
  else { net = (amount * 100) / (100 + rate); gst = amount - net; }
  return { net, gst, gross: net + gst, cgst: gst / 2, sgst: gst / 2 };
}
export function emiCalc(principal, annualRatePct, months) {
  if (!Number.isFinite(principal) || principal <= 0 || principal > 1e12) throw new Error('Loan amount must be greater than zero and at most 1 trillion.');
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0 || annualRatePct > 100) throw new Error('Annual interest rate must be between 0 and 100%.');
  if (!Number.isInteger(months) || months < 1 || months > 1200) throw new Error('Tenure must be a whole number of months between 1 and 1200.');
  const r = annualRatePct / 1200;
  const emi = r === 0 ? principal / months : principal * r / -Math.expm1(-months * Math.log1p(r));
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
  if (!Number.isFinite(bill) || bill < 0 || bill > 1e12) throw new Error('Bill amount must be between 0 and 1 trillion.');
  if (!(tipPct >= 0 && tipPct <= 500)) throw new Error('Tip percentage must be between 0 and 500.');
  if (!Number.isInteger(people) || people < 1 || people > 10000) throw new Error('People must be a whole number from 1 to 10000.');
  let tip = (bill * tipPct) / 100;
  if (roundTip) tip = Math.ceil(tip);
  let total = bill + tip;
  if (roundTotal) { total = Math.ceil(total); tip = total - bill; }
  return { tip, total, perPerson: total / people, tipPerPerson: tip / people };
}
export function compoundInterest({ principal, annualRatePct, years, perYear = 12, monthlyContribution = 0, contributionTiming = 'end' }) {
  if (!Number.isFinite(principal) || principal < 0 || principal > 1e12) throw new Error('Principal must be between 0 and 1 trillion.');
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0 || monthlyContribution > 1e12) throw new Error('Monthly contribution must be between 0 and 1 trillion.');
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0 || annualRatePct > 100) throw new Error('Annual rate must be between 0 and 100%.');
  const months = Math.round(years * 12);
  if (!Number.isFinite(years) || months < 1 || months > 1200 || Math.abs(years * 12 - months) > 1e-8) throw new Error('Duration must be a whole number of months, between 1 month and 100 years.');
  if (![1, 2, 4, 12, 52, 365].includes(perYear)) throw new Error('Unsupported compounding frequency.');
  if (!['begin','end'].includes(contributionTiming)) throw new Error('Choose a valid contribution timing.');
  // Equivalent monthly growth from the nominal rate and selected frequency.
  // Contributions occur every month, regardless of compounding frequency.
  const monthlyGrowth = Math.expm1(Math.log1p(annualRatePct / 100 / perYear) * perYear / 12);
  let balance = principal, contributed = principal; const schedule = [];
  for (let m = 1; m <= months; m++) {
    if (contributionTiming === 'begin') { balance += monthlyContribution; contributed += monthlyContribution; }
    balance *= 1 + monthlyGrowth;
    if (contributionTiming === 'end') { balance += monthlyContribution; contributed += monthlyContribution; }
    if (m % 12 === 0 || m === months) schedule.push({ year: m / 12, balance, contributed, interest: balance - contributed });
  }
  if (!Number.isFinite(balance)) throw new Error('Result is too large to calculate.');
  return { finalBalance: balance, totalContributed: contributed, totalInterest: balance - contributed, schedule };
}
export function sipCalc({ monthly, annualRatePct, years, stepUpPct = 0 }) {
  if (!(monthly > 0)) throw new Error('Monthly investment must be greater than zero.');
  if (!(years > 0)) throw new Error('Duration must be greater than zero.');
  if (!(annualRatePct >= 0)) throw new Error('Expected return cannot be negative.');
  const i = annualRatePct / 12 / 100;
  const n = Math.round(years * 12);
  if (!Number.isFinite(years) || n < 1 || n > 1200 || Math.abs(years * 12 - n) > 1e-8) throw new Error('Duration must be a whole number of months between 1 and 1200.');
  if (!Number.isFinite(monthly) || monthly > 1e12 || !Number.isFinite(annualRatePct) || annualRatePct > 100) throw new Error('Use a monthly amount up to 1 trillion and a return of at most 100%.');
  if (!Number.isFinite(stepUpPct) || stepUpPct < 0 || stepUpPct > 100) throw new Error('Annual step-up must be between 0% and 100%.');
  let balance = 0, invested = 0, contribution = monthly;
  const schedule = [];
  for (let m = 1; m <= n; m++) {
    if (m > 1 && (m - 1) % 12 === 0) contribution *= 1 + stepUpPct / 100;
    invested += contribution;
    balance = (balance + contribution) * (1 + i); // start-of-month contribution
    if (!Number.isFinite(balance) || !Number.isFinite(invested)) throw new Error('Result is too large to calculate.');
    if (m % 12 === 0 || m === n) {
      schedule.push({ year: Math.ceil(m / 12), invested, balance, gain: balance - invested });
    }
  }
  return { invested, maturity: balance, gain: balance - invested, months: n, schedule };
}

export function ppfCalc({ yearlyDeposit, annualRatePct = 7.1, years = 15 }) {
  if (!Number.isFinite(yearlyDeposit) || yearlyDeposit <= 0 || yearlyDeposit > 1e12) throw new Error('Yearly deposit must be greater than zero and at most 1 trillion.');
  if (!Number.isInteger(years) || years < 1 || years > 50) throw new Error('Duration must be a whole number of years between 1 and 50.');
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0 || annualRatePct > 100) throw new Error('Interest rate must be between 0% and 100%.');
  const r = annualRatePct / 100;
  let balance = 0;
  const schedule = [];
  for (let y = 1; y <= years; y++) {
    const opening = balance + yearlyDeposit; // deposit at the start of the year
    const interest = opening * r;
    balance = opening + interest;
    schedule.push({ year: y, deposit: yearlyDeposit, interest, balance });
  }
  const invested = yearlyDeposit * years;
  return { invested, maturity: balance, totalInterest: balance - invested, schedule, overLimit: yearlyDeposit > 150000 };
}

export function fdCalc({ principal, annualRatePct, years, perYear = 4 }) {
  if (!Number.isFinite(principal) || principal <= 0 || principal > 1e12) throw new Error('Deposit amount must be greater than zero and at most 1 trillion.');
  if (!Number.isFinite(years) || years <= 0 || years > 100) throw new Error('Tenure must be greater than zero and at most 100 years.');
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0 || annualRatePct > 100) throw new Error('Interest rate must be between 0% and 100%.');
  if (![1, 2, 4, 12].includes(perYear)) throw new Error('Unsupported compounding frequency.');
  const logPeriod = Math.log1p(annualRatePct / 100 / perYear);
  const interest = principal * Math.expm1(logPeriod * perYear * years);
  const maturity = principal + interest;
  const effectiveYield = 100 * Math.expm1(logPeriod * perYear);
  if (![maturity, interest, effectiveYield].every(Number.isFinite)) throw new Error('Result is too large to calculate.');
  return { maturity, interest, effectiveYield };
}

export function rdCalc({ monthly, annualRatePct, months }) {
  if (!Number.isFinite(monthly) || monthly <= 0 || monthly > 1e12) throw new Error('Monthly deposit must be greater than zero and at most 1 trillion.');
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0 || annualRatePct > 100) throw new Error('Interest rate must be between 0% and 100%.');
  if (!Number.isInteger(months) || months < 3 || months > 1200 || months % 3 !== 0) throw new Error('RD tenure must be in whole quarters from 3 to 1200 months — interest compounds quarterly.');
  // Standard RD closed form with quarterly compounding (deposit at the
  // start of each month): A = P × [((1+i)^n − 1) / (1 − (1+i)^(−1/3))],
  // where i = R/400 is the quarterly rate and n = number of quarters.
  const i = annualRatePct / 400;
  const logPeriod = Math.log1p(i);
  const valueAt = (m) => (i === 0 ? monthly * m : monthly * (Math.expm1(logPeriod * m / 3) / -Math.expm1(-logPeriod / 3)));
  const maturity = valueAt(months);
  const deposited = monthly * months;
  const schedule = [];
  for (let m = 12; m <= months; m += 12) {
    const value = valueAt(m);
    schedule.push({ months: m, deposited: monthly * m, value, interest: value - monthly * m });
  }
  if (months % 12 !== 0) schedule.push({ months, deposited, value: maturity, interest: maturity - deposited });
  return { deposited, maturity, interest: maturity - deposited, months, schedule };
}

export function cagrCalc({ startValue, endValue, years }) {
  if (!Number.isFinite(startValue) || startValue <= 0 || startValue > 1e12) throw new Error('Starting value must be greater than zero and at most 1 trillion.');
  if (!Number.isFinite(endValue) || endValue < 0 || endValue > 1e12) throw new Error('Ending value must be between zero and 1 trillion.');
  if (!Number.isFinite(years) || years <= 0 || years > 100) throw new Error('Time period must be greater than zero and at most 100 years.');
  const growthMultiple = endValue / startValue;
  const cagrPct = endValue === 0 ? -100 : Math.expm1((Math.log(endValue) - Math.log(startValue)) / years) * 100;
  const absoluteReturnPct = (growthMultiple - 1) * 100;
  if (![growthMultiple, cagrPct, absoluteReturnPct].every(Number.isFinite)) throw new Error('Result is outside the supported numeric range.');
  return { cagrPct, growthMultiple, absoluteReturnPct, gain: endValue - startValue };
}

export function gratuityCalc({ monthlySalary, years, months = 0 }) {
  if (!(monthlySalary > 0)) throw new Error('Enter the last drawn monthly salary (basic + DA).');
  if (!Number.isInteger(years) || years < 0 || years > 100 || !Number.isInteger(months) || months < 0 || months > 11) throw new Error('Enter service as whole years (0–100) plus 0–11 whole months.');
  if (years === 0 && months === 0) throw new Error('Service duration must be greater than zero.');
  // Payment of Gratuity Act, 1972: gratuity = (15/26) × last drawn monthly
  // salary (basic + DA) × years of service; a final-year fraction *over*
  // six months counts as a full year, six months or less does not.
  const roundedYears = years + (months > 6 ? 1 : 0);
  const amount = (15 / 26) * monthlySalary * roundedYears;
  const totalYears = years + months / 12;
  return { amount, roundedYears, totalYears, eligible: totalYears >= 5 };
}

export function npsCalc({ currentAge, retirementAge = 60, monthlyContribution, annualReturnPct, annualStepUpPct = 0, currentCorpus = 0, annuityPct = 40, annuityRatePct = 7 } = {}) {
  if (!Number.isInteger(currentAge) || currentAge < 18 || currentAge > 74) throw new Error('Enter your current age between 18 and 74.');
  if (!Number.isInteger(retirementAge) || retirementAge <= currentAge || retirementAge > 75) throw new Error('Retirement age must be after your current age and no later than 75 for this projection.');
  if (!(monthlyContribution >= 0) || !(currentCorpus >= 0) || (monthlyContribution === 0 && currentCorpus === 0)) throw new Error('Enter a monthly contribution or your current NPS corpus.');
  if (!(annualReturnPct >= 0 && annualReturnPct <= 30)) throw new Error('Expected return must be between 0% and 30%.');
  if (!(annualStepUpPct >= 0 && annualStepUpPct <= 50)) throw new Error('Annual contribution step-up must be between 0% and 50%.');
  if (!(annuityPct >= 0 && annuityPct <= 100)) throw new Error('The annuity share must be between 0% and 100% of the corpus.');
  if (!(annuityRatePct >= 0 && annuityRatePct <= 20)) throw new Error('Expected annuity rate must be between 0% and 20%.');

  const years = retirementAge - currentAge;
  const months = years * 12;
  const i = annualReturnPct / 1200;
  let balance = currentCorpus;
  let newContributions = 0;
  const schedule = [];
  for (let m = 1; m <= months; m++) {
    const yearIndex = Math.floor((m - 1) / 12);
    const contribution = monthlyContribution * Math.pow(1 + annualStepUpPct / 100, yearIndex);
    // Contribution at the start of each month, matching this site's SIP timing.
    balance = (balance + contribution) * (1 + i);
    newContributions += contribution;
    if (m % 12 === 0) {
      schedule.push({
        age: currentAge + m / 12,
        contributed: currentCorpus + newContributions,
        balance,
        gains: balance - currentCorpus - newContributions,
      });
    }
  }
  const corpus = balance;
  const annuityCorpus = corpus * annuityPct / 100;
  return {
    years,
    months,
    startingCorpus: currentCorpus,
    newContributions,
    corpus,
    gains: corpus - currentCorpus - newContributions,
    annuityCorpus,
    lumpSum: corpus - annuityCorpus,
    monthlyPension: annuityCorpus * annuityRatePct / 100 / 12,
    schedule,
  };
}

export function epfCalc({ monthlyBasicDa, years, annualSalaryGrowthPct = 5, annualInterestPct = 8.25, currentBalance = 0, employeePct = 12, employerPct = 12, epsMonthlyCap = 1250 } = {}) {
  if (!(monthlyBasicDa > 0)) throw new Error('Enter your monthly basic salary plus DA.');
  if (!Number.isInteger(years) || years < 1 || years > 50) throw new Error('Enter a whole contribution period between 1 and 50 years.');
  if (!(currentBalance >= 0)) throw new Error('Current EPF balance cannot be negative.');
  if (!(annualSalaryGrowthPct >= 0 && annualSalaryGrowthPct <= 30)) throw new Error('Salary growth must be between 0% and 30% a year.');
  if (!(annualInterestPct >= 0 && annualInterestPct <= 20)) throw new Error('EPF interest must be between 0% and 20%.');
  if (!(employeePct >= 0 && employeePct <= 100) || !(employerPct >= 0 && employerPct <= 100)) throw new Error('Contribution percentages must be between 0% and 100%.');
  if (!(epsMonthlyCap >= 0)) throw new Error('The EPS cap cannot be negative.');

  let balance = currentBalance;
  let employeeContribution = 0;
  let employerEpfContribution = 0;
  let epsContribution = 0;
  let totalInterest = 0;
  let accruedInterest = 0;
  const schedule = [];
  const months = years * 12;
  for (let m = 1; m <= months; m++) {
    const yearIndex = Math.floor((m - 1) / 12);
    const salary = monthlyBasicDa * Math.pow(1 + annualSalaryGrowthPct / 100, yearIndex);
    const employee = salary * employeePct / 100;
    const employerTotal = salary * employerPct / 100;
    const eps = Math.min(employerTotal, salary * 8.33 / 100, epsMonthlyCap);
    const employerEpf = employerTotal - eps;

    // Approximation of EPF's annual crediting: interest is calculated on
    // monthly running balances during the year and credited at year end.
    accruedInterest += balance * (annualInterestPct / 1200);
    balance += employee + employerEpf;
    employeeContribution += employee;
    employerEpfContribution += employerEpf;
    epsContribution += eps;

    if (m % 12 === 0) {
      balance += accruedInterest;
      totalInterest += accruedInterest;
      accruedInterest = 0;
      schedule.push({
        year: m / 12,
        employeeContribution,
        employerEpfContribution,
        interestCredited: totalInterest,
        balance,
      });
    }
  }
  return { balance, currentBalance, employeeContribution, employerEpfContribution, epsContribution, totalInterest, schedule };
}

export function hraCalc({ salaryBasicDaAnnual, hraReceivedAnnual, rentPaidAnnual, metro = false } = {}) {
  if (!(salaryBasicDaAnnual > 0)) throw new Error('Enter annual basic salary plus DA.');
  if (!(hraReceivedAnnual >= 0) || !(rentPaidAnnual >= 0)) throw new Error('HRA and rent cannot be negative.');
  const limits = {
    actualHra: hraReceivedAnnual,
    rentOverTenPercent: Math.max(0, rentPaidAnnual - salaryBasicDaAnnual * 0.10),
    salaryCap: salaryBasicDaAnnual * (metro ? 0.50 : 0.40),
  };
  const exempt = Math.min(limits.actualHra, limits.rentOverTenPercent, limits.salaryCap);
  const limitingFactor = Object.entries(limits).find(([, value]) => value === exempt)?.[0] || 'actualHra';
  return { ...limits, exempt, taxable: Math.max(0, hraReceivedAnnual - exempt), limitingFactor };
}

function slabTax(income, slabs) {
  // slabs: [[upperLimit, rate], ...] with last limit Infinity
  let tax = 0, prev = 0;
  const rows = [];
  for (const [limit, rate] of slabs) {
    if (income <= prev) break;
    const inSlab = Math.min(income, limit) - prev;
    if (inSlab > 0 && rate > 0) rows.push({ from: prev, to: Math.min(income, limit), rate: rate * 100, tax: inSlab * rate });
    tax += inSlab * rate;
    prev = limit;
  }
  return { tax, rows };
}
function surchargeRate(taxable, regime) {
  if (taxable > 50000000) return regime === 'old' ? 0.37 : 0.25;
  if (taxable > 20000000) return 0.25;
  if (taxable > 10000000) return 0.15;
  if (taxable > 5000000) return 0.10;
  return 0;
}
function taxWithSurcharge(income, slabs, regime) {
  const slab = slabTax(income, slabs).tax;
  let tax = slab;
  if (regime === 'new') {
    if (income <= 1200000) tax -= Math.min(tax, 60000);
    else tax = Math.min(tax, income - 1200000);
  } else if (income <= 500000) tax -= Math.min(tax, 12500);
  const rate = surchargeRate(income, regime);
  if (!rate) return { tax, surcharge: 0 };
  const threshold = income > 50000000 && regime === 'old' ? 50000000 : income > 20000000 ? 20000000 : income > 10000000 ? 10000000 : 5000000;
  const previous = taxWithSurcharge(threshold, slabs, regime);
  const total = Math.min(tax * (1 + rate), previous.tax + previous.surcharge + income - threshold);
  return { tax, surcharge: Math.max(0, total - tax) };
}
/** India income tax, FY 2025-26 (AY 2026-27), both regimes. Estimates only. */
export function incomeTaxIndia({ grossSalary = 0, otherIncome = 0, deductionsOld = 0, ageGroup = 'below60' } = {}) {
  if ([grossSalary, otherIncome, deductionsOld].some(v => !Number.isFinite(v) || v < 0 || v > 1e12)) throw new Error('Each income and deduction must be between zero and 1 trillion.');
  if (!['below60','60to79','80plus'].includes(ageGroup)) throw new Error('Choose a valid age group.');
  const gross = grossSalary + otherIncome;
  if (!(gross > 0)) throw new Error('Enter your salary or other income first.');

  // ── New regime (Section 115BAC, FY 2025-26 slabs) ──
  const stdNew = Math.min(grossSalary, 75000);
  const taxableNew = Math.max(0, gross - stdNew);
  const newSlabs = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]];
  const n = slabTax(taxableNew, newSlabs);
  let taxNew = n.tax;
  const rebateNew = taxableNew <= 1200000 ? Math.min(taxNew, 60000) : 0;
  taxNew -= rebateNew;
  // Marginal relief: just above ₹12L, tax cannot exceed the income above ₹12L.
  if (taxableNew > 1200000) taxNew = Math.min(taxNew, taxableNew - 1200000);
  const surNew = taxWithSurcharge(taxableNew, newSlabs, 'new').surcharge;
  const cessNew = (taxNew + surNew) * 0.04;
  const totalNew = taxNew + surNew + cessNew;

  // ── Old regime ──
  const stdOld = Math.min(grossSalary, 50000);
  const taxableOld = Math.max(0, gross - stdOld - deductionsOld);
  const exempt = ageGroup === '80plus' ? 500000 : ageGroup === '60to79' ? 300000 : 250000;
  const oldSlabs = [[exempt, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]].filter((s, i, a) => i === 0 || s[0] > a[i - 1][0]);
  const o = slabTax(taxableOld, oldSlabs);
  let taxOld = o.tax;
  const rebateOld = taxableOld <= 500000 ? Math.min(taxOld, 12500) : 0;
  taxOld -= rebateOld;
  const surOld = taxWithSurcharge(taxableOld, oldSlabs, 'old').surcharge;
  const cessOld = (taxOld + surOld) * 0.04;
  const totalOld = taxOld + surOld + cessOld;

  const pack = (taxable, rows, slab, rebate, surcharge, cess, total, marginalRelief = 0) => ({
    taxable, rows, slabTax: slab, rebate, marginalRelief, surcharge, cess, total,
    effectiveRate: gross > 0 ? (total / gross) * 100 : 0,
  });
  return {
    gross,
    newRegime: pack(taxableNew, n.rows, n.tax, rebateNew, surNew, cessNew, totalNew, Math.max(0, n.tax - rebateNew - taxNew)),
    oldRegime: pack(taxableOld, o.rows, o.tax, rebateOld, surOld, cessOld, totalOld),
    better: totalNew <= totalOld ? 'new' : 'old',
    saving: Math.abs(totalNew - totalOld),
  };
}

export function simpleInterest({ principal, annualRatePct, time, unit = 'years' }) {
  if (!Number.isFinite(principal) || principal <= 0 || principal > 1e12) throw new Error('Principal must be greater than zero and at most 1 trillion.');
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0 || annualRatePct > 100) throw new Error('Annual rate must be between 0% and 100%.');
  if (!['years', 'months', 'days'].includes(unit)) throw new Error('Choose years, months or days.');
  const years = unit === 'years' ? time : unit === 'months' ? time / 12 : time / 365;
  if (!Number.isFinite(years) || years <= 0 || years > 100) throw new Error('Time must be greater than zero and at most 100 years.');
  const interest = (principal * annualRatePct * years) / 100;
  return { interest, total: principal + interest, years };
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
function clearOnEdit(root, status, ...results) {
  const clear = () => { results.forEach(el => el.replaceChildren()); status.set('Inputs changed. Calculate again.', 'info'); };
  root.addEventListener('input', clear); root.addEventListener('change', clear);
  root.querySelectorAll('.seg-row button').forEach(button => button.addEventListener('click', clear));
}

// Batch-6 planning engines. Monetary values use the user's chosen currency.
function bounded(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`);
}
export function finalGradeCalc(current, target, weight, exam) {
  for (const [v, label] of [[current, 'Current grade'], [target, 'Target grade'], [weight, 'Final weight'], [exam, 'Exam score']]) bounded(v, 0, 100, label);
  const w = weight / 100, base = current * (1 - w);
  return { required: w === 0 ? null : (target - base) / w, overall: base + exam * w, minimum: base, maximum: base + 100 * w, targetMetWithoutExam: w === 0 && current >= target };
}
/** Disjoint completed components with weights as percentages of the whole course. */
export function completedGradeComponents(text) {
  const lines = String(text).split(/\r?\n/).filter(line => line.trim());
  if (!lines.length || lines.length > 50) throw new Error('Enter 1 to 50 completed components.');
  let totalUnits=0, weighted=0;
  for (const [i,line] of lines.entries()) {
    const m = /^\s*(\d{1,3}(?:\.\d{1,6})?)\s*,\s*(\d{1,3}(?:\.\d{1,6})?)\s*$/.exec(line);
    if (!m) throw new Error(`Line ${i+1}: enter score, weight using numbers with up to 6 decimal places.`);
    const score=Number(m[1]), weight=Number(m[2]);
    if (score > 100 || weight <= 0 || weight > 100) throw new Error(`Line ${i+1}: score must be 0–100 and weight must be greater than 0 and at most 100.`);
    const units=Math.round(weight*1000000);totalUnits+=units;weighted+=score*units;
  }
  if (totalUnits > 100000000) throw new Error('Completed weights cannot exceed 100% of the course.');
  return {average:weighted/totalUnits, completedWeight:totalUnits/1000000, remainingWeight:(100000000-totalUnits)/1000000, count:lines.length};
}
export function savingsGoalCalc(goal, initial, annualRate, months) {
  bounded(goal, 0, 1e12, 'Goal'); bounded(initial, 0, 1e12, 'Current savings'); bounded(annualRate, 0, 100, 'Annual return');
  if (!Number.isInteger(months) || months < 1 || months > 1200) throw new Error('Months must be a whole number from 1 to 1200.');
  const r = annualRate / 1200, growthFactor = Math.expm1(months * Math.log1p(r)), factor = 1 + growthFactor;
  const annuityFactor = r === 0 ? months : growthFactor / r;
  const payment = Math.max(0, (goal - initial * factor) / annuityFactor);
  const final = initial * factor + payment * annuityFactor;
  return { payment, final, contributed: payment * months, growth: final - initial - payment * months };
}
export function swpCalc(initial, withdrawal, annualRate, months) {
  bounded(initial, 0, 1e12, 'Starting corpus'); bounded(withdrawal, 0.01, 1e12, 'Monthly withdrawal'); bounded(annualRate, 0, 100, 'Annual return');
  if (!Number.isInteger(months) || months < 1 || months > 1200) throw new Error('Months must be a whole number from 1 to 1200.');
  let balance = initial, withdrawn = 0, growth = 0, depletedMonth = initial === 0 ? 0 : null, lastWithdrawal = 0;
  for (let i = 1; i <= months && balance > 0; i++) {
    const interest = balance * annualRate / 1200; growth += interest; balance += interest;
    const roundingTolerance = Number.EPSILON * Math.max(balance, withdrawal) * 8;
    lastWithdrawal = balance <= withdrawal + roundingTolerance ? balance : withdrawal;
    balance -= lastWithdrawal; withdrawn += lastWithdrawal;
    if (balance <= 0) { balance = 0; depletedMonth = i; }
  }
  return { balance, withdrawn, growth, depletedMonth, lastWithdrawal };
}
export function electricityCostCalc(watts, hours, days, rate, fixed) {
  bounded(watts, 0, 1e7, 'Power'); bounded(hours, 0, 24, 'Hours per day'); bounded(days, 1, 366, 'Days'); bounded(rate, 0, 1e6, 'Unit rate'); bounded(fixed, 0, 1e12, 'Fixed charge');
  const units = watts * hours * days / 1000;
  return { units, energyCost: units * rate, total: units * rate + fixed };
}
export function fuelCostCalc(distance, mileage, price, trips, people) {
  bounded(distance, 0, 1e9, 'Distance'); bounded(mileage, 0.001, 1e6, 'Mileage'); bounded(price, 0, 1e6, 'Fuel price');
  if (!Number.isInteger(trips) || trips < 1 || trips > 10000 || !Number.isInteger(people) || people < 1 || people > 10000) throw new Error('Trips and people must be whole numbers between 1 and 10000.');
  const totalDistance = distance * trips, litres = totalDistance / mileage, total = litres * price;
  return { totalDistance, litres, total, perPerson: total / people };
}

// Batch-8: deterministic estimates, not lender or payroll statements.
export function loanPrepaymentCalc(principal, annualRate, payment, extra, lump, lumpMonth) {
  bounded(principal, 0.01, 1e12, 'Outstanding balance'); bounded(annualRate, 0, 100, 'Annual rate');
  bounded(payment, 0.01, 1e12, 'Monthly payment'); bounded(extra, 0, 1e12, 'Extra monthly payment'); bounded(lump, 0, 1e12, 'Lump sum');
  if (!Number.isInteger(lumpMonth) || lumpMonth < 1 || lumpMonth > 1200) throw new Error('Lump sum month must be a whole number from 1 to 1200.');
  const rate = annualRate / 1200;
  if (payment <= principal * rate) throw new Error('Monthly payment must exceed the first month of interest for the baseline loan.');
  const simulate = (accelerated) => {
    let balance = principal, interest = 0, paid = 0, lumpApplied = 0;
    for (let month = 1; month <= 1200; month++) {
      const charge = balance * rate; interest += charge; balance += charge;
      const regular = Math.min(balance, payment + (accelerated ? extra : 0)); balance -= regular; paid += regular;
      if (accelerated && month === lumpMonth && balance > 0) { lumpApplied = Math.min(balance, lump); balance -= lumpApplied; paid += lumpApplied; }
      // Eliminate only floating-point residue and include it in total paid.
      if (balance <= Number.EPSILON * principal * 8) { paid += balance; return { months: month, interest, paid, lumpApplied }; }
    }
    throw new Error('Loan takes over 1,200 months to repay under these assumptions.');
  };
  const baseline = simulate(false), accelerated = simulate(true);
  return { baseline, accelerated, interestSaved: baseline.interest - accelerated.interest, monthsSaved: baseline.months - accelerated.months };
}
export function inflationCalc(amount, rate, years) {
  bounded(amount, 0, 1e12, 'Amount'); bounded(rate, 0, 100, 'Annual inflation'); bounded(years, 0, 100, 'Years');
  const factor = Math.pow(1 + rate / 100, years);
  return { futureCost: amount * factor, purchasingPower: amount / factor, increase: amount * (factor - 1) };
}
export function workHoursCalc(start, end, breakMinutes, hourlyRate) {
  const minutes = (time) => { const m = /^(\d{2}):(\d{2})$/.exec(time); if (!m || +m[1] > 23 || +m[2] > 59) throw new Error('Enter valid start and end times.'); return +m[1] * 60 + +m[2]; };
  const a = minutes(start), b = minutes(end), gross = b < a ? b + 1440 - a : b - a;
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > gross) throw new Error('Break minutes must be a whole number no greater than the shift duration.');
  bounded(hourlyRate, 0, 1e9, 'Hourly rate'); const net = gross - breakMinutes;
  return { grossMinutes: gross, netMinutes: net, decimalHours: net / 60, pay: net / 60 * hourlyRate, overnight: b < a };
}
export function profitMarginCalc(cost, revenue) {
  bounded(cost, 0, 1e12, 'Cost'); bounded(revenue, 0, 1e12, 'Selling price');
  const profit = revenue - cost;
  return { profit, margin: revenue === 0 ? null : profit / revenue * 100, markup: cost === 0 ? null : profit / cost * 100 };
}

export function budget503020(income, needs, wants, savings) {
  bounded(income, 0.01, 1e12, 'Monthly take-home income');
  for (const [value, name] of [[needs,'Needs'],[wants,'Wants'],[savings,'Savings and debt repayment']]) bounded(value, 0, 1e12, name);
  return { needsTarget: income * 0.5, wantsTarget: income * 0.3, savingsTarget: income * 0.2, remaining: income - needs - wants - savings, total: needs + wants + savings };
}
export function emergencyFund(monthly, months, saved, contribution) {
  bounded(monthly, 0, 1e12, 'Monthly essential expenses'); bounded(months, 1, 120, 'Target months');
  bounded(saved, 0, 1e12, 'Current emergency savings'); bounded(contribution, 0, 1e12, 'Monthly contribution');
  const target = monthly * months, gap = Math.max(0, target - saved);
  const raw = gap / contribution, nearest = Math.round(raw);
  const monthsToGoal = gap === 0 ? 0 : contribution === 0 ? null : Math.abs(raw - nearest) <= Math.min(1e-7, Number.EPSILON * Math.max(1, raw) * 8) ? nearest : Math.ceil(raw);
  if (monthsToGoal !== null && !Number.isSafeInteger(monthsToGoal)) throw new Error('Time to goal exceeds the supported limit.');
  return { target, gap, surplus: Math.max(0, saved - target), monthsToGoal };
}
export function debtToIncome(income, debts) {
  bounded(income, 0.01, 1e12, 'Gross monthly income'); bounded(debts, 0, 1e12, 'Monthly debt payments');
  return { ratio: debts / income * 100, incomeAfterDebts: income - debts };
}
export function breakEven(fixed, price, variable) {
  bounded(fixed, 0, 1e12, 'Fixed costs'); bounded(price, 0, 1e12, 'Selling price'); bounded(variable, 0, 1e12, 'Variable cost');
  const contribution = price - variable;
  if (contribution <= 0) return { contribution, units: null, revenue: null };
  const raw = fixed / contribution;
  if (!Number.isFinite(raw) || raw > 1e9) throw new Error('Break-even exceeds the supported limit of 1 billion units.');
  const nearest = Math.round(raw), tolerance = Math.min(1e-7, Number.EPSILON * Math.max(1, raw) * 8);
  const units = Math.abs(raw - nearest) <= tolerance ? nearest : Math.ceil(raw);
  return { contribution, units, revenue: units * price };
}

const defs = {
  'budget-calculator'(root) {
    const income = input({ type: 'number', step: 'any', value: '50000' }), needs = input({ type: 'number', step: 'any', value: '24000' }), wants = input({ type: 'number', step: 'any', value: '16000' }), savings = input({ type: 'number', step: 'any', value: '8000' });
    const grid = statsGrid(), status = statusLine(''), detail = h('div', {});
    const run = () => { try { const r = budget503020(num(income),num(needs),num(wants),num(savings));
      grid.set([{ label: 'Needs target (50%)', value: money(r.needsTarget) }, { label: 'Wants target (30%)', value: money(r.wantsTarget) }, { label: 'Savings target (20%)', value: money(r.savingsTarget) }, { label: 'Unallocated / overspend', value: money(r.remaining), kind: r.remaining < 0 ? 'bad' : 'good' }]);
      detail.replaceChildren(table({ headers:['Category','Target','Actual','Actual minus target'], rows: [['Needs',r.needsTarget,num(needs)],['Wants',r.wantsTarget,num(wants)],['Savings and extra debt',r.savingsTarget,num(savings)]].map(([label,target,actual])=>[label,money(target),money(actual),money(actual-target)]) }));
      status.set('Use monthly take-home income. Minimum debt payments can be needs; extra debt repayment may be in savings. Avoid counting the same payment twice. This is a guideline, not financial advice.', 'info');
    } catch (e) { grid.replaceChildren(); detail.replaceChildren(); status.set(e.message,'error'); } };
    root.append(h('div',{class:'field-row'},field({label:'Monthly take-home income',control:income}),field({label:'Actual needs',control:needs}),field({label:'Actual wants',control:wants}),field({label:'Actual savings and extra debt',control:savings})),actionsRow(btn({label:'Calculate budget',icon:'calculator',onClick:run})),grid,detail,status);
    shareState(root,[['income',income],['needs',needs],['wants',wants],['savings',savings]],run);
  },
  'emergency-fund-calculator'(root) {
    const monthly=input({type:'number',step:'any',value:'25000'}), months=input({type:'number',step:'any',value:'6'}), saved=input({type:'number',step:'any',value:'50000'}), contribution=input({type:'number',step:'any',value:'10000'});
    const grid=statsGrid(), status=statusLine('');
    const run=()=>{ try { const r=emergencyFund(num(monthly),num(months),num(saved),num(contribution)); grid.set([{label:'Fund target',value:money(r.target)},{label:'Still needed',value:money(r.gap),kind:'good'},{label:'Above target',value:money(r.surplus)},{label:'Months to reach goal',value:r.monthsToGoal === null ? 'Not reachable at zero contribution' : String(r.monthsToGoal)}]); status.set('Uses essential expenses and fixed end-of-month contributions; excludes interest, inflation, withdrawals and unexpected changes. Choose a target appropriate to your circumstances.', 'info'); } catch(e){grid.replaceChildren(); status.set(e.message,'error');} };
    root.append(h('div',{class:'field-row'},field({label:'Essential expenses per month',control:monthly}),field({label:'Target months',control:months}),field({label:'Current emergency savings',control:saved}),field({label:'Monthly contribution',control:contribution})),actionsRow(btn({label:'Calculate emergency fund',icon:'calculator',onClick:run})),grid,status);
    shareState(root,[['monthly',monthly],['months',months],['saved',saved],['contribution',contribution]],run);
  },
  'debt-to-income-calculator'(root) {
    const income=input({type:'number',step:'any',value:'100000'}),debts=input({type:'number',step:'any',value:'35000'}),grid=statsGrid(),status=statusLine('');
    const run=()=>{try {const r=debtToIncome(num(income),num(debts));grid.set([{label:'Debt-to-income ratio',value:`${r.ratio.toFixed(2)}%`},{label:'Income less debt payments',value:money(r.incomeAfterDebts)}]);status.set('Based on gross monthly income, before tax. Include relevant minimum monthly debt payments yourself. This is not disposable income, a lender decision or an eligibility guarantee.', 'info');}catch(e){grid.replaceChildren();status.set(e.message,'error');}};
    root.append(h('div',{class:'field-row'},field({label:'Gross monthly income',control:income}),field({label:'Monthly debt payments',control:debts})),actionsRow(btn({label:'Calculate debt ratio',icon:'calculator',onClick:run})),grid,status);
    shareState(root,[['income',income],['debts',debts]],run);
  },
  'break-even-calculator'(root) {
    const fixed=input({type:'number',step:'any',value:'10000'}),price=input({type:'number',step:'any',value:'100'}),variable=input({type:'number',step:'any',value:'60'}),grid=statsGrid(),status=statusLine('');
    const run=()=>{try{const r=breakEven(num(fixed),num(price),num(variable));grid.set([{label:'Contribution per unit',value:money(r.contribution)},{label:'Break-even whole units',value:r.units === null ? (num(fixed) === 0 && r.contribution === 0 ? 'Every sales volume breaks even' : num(fixed) === 0 ? 'Zero units only' : 'Not attainable') : r.units.toLocaleString('en-US')},{label:'Sales at break-even units',value:r.revenue === null ? 'Not applicable' : money(r.revenue)}]);status.set(r.units === null ? 'Price must exceed variable cost to cover fixed costs through sales. With zero fixed costs and zero contribution every sales volume breaks even; negative contribution loses money on positive sales.' : 'Uses a constant selling price and variable cost per unit. Rounded up to whole units; taxes and any omitted costs are excluded.',r.units === null ? 'warning' : 'info');}catch(e){grid.replaceChildren();status.set(e.message,'error');}};
    root.append(h('div',{class:'field-row'},field({label:'Fixed costs for period',control:fixed}),field({label:'Selling price per unit',control:price}),field({label:'Variable cost per unit',control:variable})),actionsRow(btn({label:'Calculate break-even',icon:'calculator',onClick:run})),grid,status);
    shareState(root,[['fixed',fixed],['price',price],['variable',variable]],run);
  },

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
    shareState(root, [['mode', { get: () => mode.getValue(), set: (v) => { mode.setValue(v); applyMode(); } }], ['x', a], ['y', b]], run);
  },

  'percentage-change'(root) {
    const from = input({ type: 'number', step: 'any', placeholder: 'e.g. 80' });
    const to = input({ type: 'number', step: 'any', placeholder: 'e.g. 100' });
    const grid = statsGrid();
    const formula = h('p', { class: 'hint', style: 'margin-top:8px' });
    const status = statusLine('');
    const run = () => {
      const a = num(from), b = num(to);
      if (!isFin(a) || !isFin(b)) { grid.replaceChildren(); formula.textContent = ''; status.set('Enter both values.', 'warning'); return; }
      try {
        const r = pctChange(a, b);
        const signed = `${r > 0 ? '+' : ''}${fmtNumber(r, 4)}%`;
        const reverse = b !== 0 ? pctChange(b, a) : null;
        grid.set([
          { label: 'Percentage change', value: signed, kind: r >= 0 ? 'good' : 'bad' },
          { label: 'Absolute difference', value: fmtNumber(b - a) },
          { label: 'Multiplier', value: `${fmtNumber(b / a, 4)}×` },
          { label: 'Reverse change', value: reverse == null ? 'Undefined' : `${reverse > 0 ? '+' : ''}${fmtNumber(reverse, 4)}%` },
        ]);
        formula.textContent = `Formula: ((${fmtNumber(b)} − ${fmtNumber(a)}) ÷ |${fmtNumber(a)}|) × 100 = ${signed}`;
        status.set(r === 0
          ? 'No change — the starting and new values are the same.'
          : `The value went ${r > 0 ? 'up' : 'down'} by ${fmtNumber(Math.abs(r), 4)}%. ${reverse == null ? 'The reverse percentage change is undefined from a new value of zero.' : `Going back would be a ${fmtNumber(Math.abs(reverse), 4)}% change because the base value is different.`}`,
        'success');
      } catch (e) { grid.replaceChildren(); formula.textContent = ''; status.set(e.message, 'error'); }
    };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Starting value', control: from }), field({ label: 'New value', control: to })),
      actionsRow(btn({ label: 'Calculate change', icon: 'trending', onClick: run })), grid, formula, status);
    const invalidate = () => { grid.replaceChildren(); formula.textContent = ''; status.set('Inputs changed. Calculate again.', 'info'); };
    from.addEventListener('input', invalidate); to.addEventListener('input', invalidate);
    shareState(root, [['from', from], ['to', to]], run);
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
    shareState(root, [['price', price], ['off', d1], ['extra', d2], ['tax', tax]], run);
  },

  'age-calculator'(root) {
    const dob = input({ type: 'date' });
    const at = input({ type: 'date' });
    const leap = select({ options: [{v:'feb28',t:'February 28'}, {v:'mar1',t:'March 1'}], value:'feb28' });
    const grid = statsGrid();
    const status = statusLine('Pick a date of birth to begin.');
    const run = () => {
      if (!dob.value) { grid.replaceChildren(); status.set('Pick a date of birth first.', 'warning'); return; }
      try {
        const r = ageCalc(dob.value, at.value || undefined, leap.value);
        grid.set([
          { label: 'Age', value: `${r.years}y ${r.months}m ${r.days}d`, kind: 'good' },
          { label: 'In years', value: `${r.years}` },
          { label: 'Total months', value: fmtNumber(r.years * 12 + r.months) },
          { label: 'Total weeks', value: fmtNumber(r.weeks) },
          { label: 'Total days', value: fmtNumber(r.totalDays) },
          { label: 'Total hours', value: fmtNumber(r.hours) },
          { label: 'Next birthday on or after reference date', value: r.nextBirthday },
          { label: r.birthdayToday ? 'Birthday today! 🎂' : 'Next birthday in', value: r.birthdayToday ? 'Today' : `${r.daysToBirthday} days`, kind: r.birthdayToday ? 'good' : '' },
        ]);
        status.set('Calendar age counts complete years, then months from the last birthday, then remaining days. Hours are 24 per calendar day, not actual elapsed hours. February 29 policy is a convention, not legal advice.', 'info');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(h('div', { class: 'field-row' },
        field({ label: 'Date of birth', control: dob }),
        field({ label: 'Age at date', control: at, hint: 'Defaults to today' }),
        field({ label: 'February 29 birthday in non-leap years', control: leap })),
      actionsRow(btn({ label: 'Calculate age', icon: 'cake', onClick: run })), grid, status);
    shareState(root, [['dob', dob], ['at', at], ['leap', leap]], run);
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
    shareState(root, [['units', { get: () => unit.getValue(), set: (v) => { unit.setValue(v); applyUnits(); } }], ['cm', cm], ['kg', kg], ['ft', ft], ['in', inch], ['lb', lb]], run);
  },

  'gst-calculator'(root) {
    const mode = segControl({ options: [{ v: 'add', t: 'Add GST' }, { v: 'remove', t: 'Remove GST' }], value: 'add', ariaLabel: 'Mode' });
    const amount = input({ type: 'number', step: 'any', placeholder: 'e.g. 1000' });
    const rate = select({ options: [{ v: 0, t: '0%' }, { v: 5, t: '5%' }, { v: 12, t: '12% (if applicable)' }, { v: 18, t: '18%' }, { v: 28, t: '28% (if applicable)' }, { v: 40, t: '40% (if applicable)' }, { v: 'custom', t: 'Custom…' }], value: 18 });
    const custom = input({ type: 'number', step: 'any', placeholder: 'rate %', hidden: true });
    rate.addEventListener('change', () => { custom.hidden = rate.value !== 'custom'; });
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      const r = rate.value === 'custom' ? num(custom) : Number(rate.value);
      try {
        const res = gstCalc({ amount: num(amount), rate: r, mode: mode.getValue() });
        grid.set([
          { label: 'Base (net)', value: money(res.net) },
          { label: `GST @ ${fmtNumber(r)}%`, value: money(res.gst), kind: 'warn' },
          { label: 'Total (gross)', value: money(res.gross), kind: 'good' },
          { label: 'CGST split', value: money(res.cgst) },
          { label: 'SGST split', value: money(res.sgst) },
        ]);
        status.set(`${mode.getValue() === 'add' ? 'GST added' : 'GST extracted'}. Equal CGST/SGST is an illustrative intra-state split; inter-state supplies generally use IGST. Cess and special rules are excluded.`, 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'Mode', control: mode }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Amount', control: amount, hint: 'Before GST when adding; including GST when extracting.' }),
        field({ label: 'GST rate', control: rate, hint: 'Choose the applicable rate yourself; presets do not determine the rate for a supply.' }),
        field({ label: 'Custom rate', control: custom })),
      actionsRow(btn({ label: 'Calculate GST', icon: 'receipt', onClick: run })), grid, status);
    clearOnEdit(root, status, grid);
    shareState(root, [
      ['mode', { get: () => mode.getValue(), set: (v) => mode.setValue(v) }],
      ['amount', amount],
      ['rate', {
        get: () => (rate.value === 'custom' ? custom.value : rate.value),
        set: (v) => {
          if ([...rate.options].some((o) => o.value === String(v) && o.value !== 'custom')) { rate.value = String(v); custom.hidden = true; }
          else { rate.value = 'custom'; custom.hidden = false; custom.value = v; }
        },
      }],
    ], run);
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
    shareState(root, [
      ['amount', principal], ['rate', rate], ['tenure', years],
      ['unit', { get: () => (monthsOnly.querySelector('input').checked ? 'months' : ''), set: (v) => { monthsOnly.querySelector('input').checked = v === 'months'; } }],
    ], run);
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
        const r = tipCalc(num(bill), num(pct), num(people), {
          roundTip: roundTip.querySelector('input').checked,
          roundTotal: roundTotal.querySelector('input').checked,
        });
        const n = num(people);
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
    clearOnEdit(root, status, grid);
    shareState(root, [
      ['bill', bill], ['tip', pct], ['people', people],
      ['round', {
        get: () => [roundTip.querySelector('input').checked ? 'tip' : '', roundTotal.querySelector('input').checked ? 'total' : ''].filter(Boolean).join('-'),
        set: (v) => { roundTip.querySelector('input').checked = v.includes('tip'); roundTotal.querySelector('input').checked = v.includes('total'); },
      }],
    ], run);
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
          { label: 'Growth multiple', value: r.totalContributed ? `${fmtNumber(r.finalBalance / r.totalContributed, 2)}×` : '—' },
        ]);
        scheduleWrap.replaceChildren(
          h('h3', { text: 'Growth schedule', style: 'margin:20px 0 10px' }),
          table({ headers: ['Year', 'Balance', 'Contributed', 'Interest'], rows: r.schedule.map((s) => [`Y${s.year}`, money(s.balance), money(s.contributed), money(s.interest)]) }));
        status.set('Contributions are added at the end of each month. Monthly growth is the equivalent rate derived from the selected compounding frequency; results are estimates.', 'info');
      } catch (e) { grid.replaceChildren(); scheduleWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Principal', control: principal }),
        field({ label: 'Annual rate %', control: rate }),
        field({ label: 'Years', control: years, hint: 'Whole months only; up to 100 years.' }),
        field({ label: 'Compounding', control: freq })),
      field({ label: 'Additional contribution', control: contrib, hint: 'Per month, optional' }),
      actionsRow(btn({ label: 'Calculate growth', icon: 'trending', onClick: run })), grid, scheduleWrap, status);
    shareState(root, [['principal', principal], ['rate', rate], ['years', years], ['freq', freq], ['contrib', contrib]], run);
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
        status.set(`Formula: P × R × T = ${fmtNumber(num(principal))} × ${fmtNumber(num(rate))}% × ${fmtNumber(r.years, 4)} yr. Days use a fixed 365-day year; results are estimates.`, 'info');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Principal', control: principal }),
        field({ label: 'Annual rate %', control: rate, hint: '0–100%' }),
        field({ label: 'Time', control: time, hint: 'Up to 100 years; days use 365 per year' }),
        field({ label: 'Unit', control: unit })),
      actionsRow(btn({ label: 'Calculate interest', icon: 'trending', onClick: run })), grid, status);
    clearOnEdit(root, status, grid);
    shareState(root, [['principal', principal], ['rate', rate], ['time', time], ['unit', unit]], run);
  },

  'sip-calculator'(root) {
    const monthly = input({ type: 'number', step: 'any', placeholder: 'e.g. 10000', value: '10000' });
    const rate = input({ type: 'number', step: 'any', placeholder: 'e.g. 12', value: '12' });
    const years = input({ type: 'number', step: 'any', placeholder: 'e.g. 15', value: '15' });
    const step = input({ type: 'number', min: 0, max: 100, step: 'any', value: '0' });
    const grid = statsGrid();
    const status = statusLine('');
    const scheduleWrap = h('div', {});
    const run = () => {
      try {
        const r = sipCalc({ monthly: num(monthly), annualRatePct: num(rate), years: num(years), stepUpPct: num(step) });
        grid.set([
          { label: 'Invested amount', value: money(r.invested) },
          { label: 'Est. gains', value: money(r.gain), kind: 'warn' },
          { label: 'Maturity value', value: money(r.maturity), kind: 'good' },
          { label: 'Months', value: `${r.months}` },
        ]);
        scheduleWrap.replaceChildren(
          h('h3', { text: 'Year-by-year growth', style: 'margin:20px 0 10px' }),
          table({ headers: ['Year', 'Invested', 'Est. gains', 'Value'], rows: r.schedule.map((y) => [`Y${y.year}`, money(y.invested), money(y.gain), money(y.balance)]) }));
        status.set(`Starting at ${money(num(monthly))} a month with ${fmtNumber(num(step))}% annual step-up for ${fmtNumber(num(years))} years at ${fmtNumber(num(rate))}% expected return. Estimates only — mutual fund returns are not guaranteed.`, 'success');
      } catch (e) { grid.replaceChildren(); scheduleWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Monthly investment', control: monthly }),
        field({ label: 'Expected return % (p.a.)', control: rate }),
        field({ label: 'Duration (years)', control: years }),
        field({ label: 'Annual step-up (%)', control: step, hint: 'Increase the monthly contribution after every 12 deposits. 0% keeps it fixed.' })),
      actionsRow(btn({ label: 'Calculate SIP', icon: 'trending', onClick: run })), grid, scheduleWrap, status);
    clearOnEdit(root, status, grid, scheduleWrap);
    shareState(root, [['monthly', monthly], ['rate', rate], ['years', years], ['step', step]], run);
  },

  'ppf-calculator'(root) {
    const yearly = input({ type: 'number', step: 'any', placeholder: 'e.g. 150000', value: '150000' });
    const rate = input({ type: 'number', step: 'any', placeholder: 'e.g. 7.1', value: '7.1' });
    const years = input({ type: 'number', step: 'any', placeholder: 'e.g. 15', value: '15' });
    const grid = statsGrid();
    const status = statusLine('');
    const scheduleWrap = h('div', {});
    const run = () => {
      try {
        const r = ppfCalc({ yearlyDeposit: num(yearly), annualRatePct: num(rate), years: num(years) });
        grid.set([
          { label: 'Total deposited', value: money(r.invested) },
          { label: 'Total interest', value: money(r.totalInterest), kind: 'warn' },
          { label: 'Maturity value', value: money(r.maturity), kind: 'good' },
        ]);
        scheduleWrap.replaceChildren(
          h('h3', { text: 'Year-by-year balance', style: 'margin:20px 0 10px' }),
          table({ headers: ['Year', 'Deposit', 'Interest', 'Balance'], rows: r.schedule.map((y) => [`Y${y.year}`, money(y.deposit), money(y.interest), money(y.balance)]) }));
        status.set(r.overLimit
          ? 'Note: PPF rules allow at most ₹1,50,000 per financial year — amounts above that are shown for illustration only.'
          : `Depositing ${money(num(yearly))} a year at ${fmtNumber(num(rate))}% for ${fmtNumber(num(years))} years. The PPF rate is set by the Government of India and can change every quarter.`, r.overLimit ? 'warning' : 'success');
      } catch (e) { grid.replaceChildren(); scheduleWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Yearly deposit', control: yearly, hint: 'PPF limit: ₹1,50,000 per year' }),
        field({ label: 'Interest rate % (p.a.)', control: rate }),
        field({ label: 'Duration (years)', control: years, hint: 'PPF matures in 15 years, extendable by 5' })),
      actionsRow(btn({ label: 'Calculate PPF', icon: 'bank', onClick: run })), grid, scheduleWrap, status);
    shareState(root, [['yearly', yearly], ['rate', rate], ['years', years]], run);
  },

  'fd-calculator'(root) {
    const principal = input({ type: 'number', step: 'any', placeholder: 'e.g. 100000', value: '100000' });
    const rate = input({ type: 'number', step: 'any', placeholder: 'e.g. 6.5', value: '6.5' });
    const years = input({ type: 'number', step: 'any', placeholder: 'e.g. 5', value: '5' });
    const freq = select({ options: [{ v: '4', t: 'Quarterly' }, { v: '2', t: 'Half-yearly' }, { v: '1', t: 'Yearly' }, { v: '12', t: 'Monthly' }], value: '4' });
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      try {
        const r = fdCalc({ principal: num(principal), annualRatePct: num(rate), years: num(years), perYear: Number(freq.value) });
        grid.set([
          { label: 'Deposit amount', value: money(num(principal)) },
          { label: 'Interest earned', value: money(r.interest), kind: 'warn' },
          { label: 'Maturity value', value: money(r.maturity), kind: 'good' },
          { label: 'Effective yield', value: `${fmtNumber(r.effectiveYield, 2)}% p.a.` },
        ]);
        status.set(`Estimate after ${fmtNumber(num(years))} years using fractional-period exponential compounding; banks may calculate broken periods differently. Taxes, TDS and fees are excluded.`, 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Deposit amount', control: principal }),
        field({ label: 'Interest rate % (p.a.)', control: rate, hint: '0–100%' }),
        field({ label: 'Tenure (years)', control: years, hint: 'Up to 100 years; fractional periods are estimated' }),
        field({ label: 'Compounding', control: freq })),
      actionsRow(btn({ label: 'Calculate FD', icon: 'coins', onClick: run })), grid, status);
    clearOnEdit(root, status, grid);
    shareState(root, [['principal', principal], ['rate', rate], ['years', years], ['freq', freq]], run);
  },

  'income-tax-calculator'(root) {
    const salary = input({ type: 'number', step: 'any', placeholder: 'e.g. 1500000', value: '1500000' });
    const other = input({ type: 'number', step: 'any', placeholder: 'e.g. 50000', value: '0' });
    const deductions = input({ type: 'number', step: 'any', placeholder: 'e.g. 150000', value: '150000' });
    const age = select({ options: [{ v: 'below60', t: 'Below 60 years' }, { v: '60to79', t: '60–79 years (senior)' }, { v: '80plus', t: '80+ years (super senior)' }], value: 'below60' });
    const inr = (v) => `₹${money(v)}`;
    const grid = statsGrid();
    const status = statusLine('');
    const detailWrap = h('div', {});
    const breakdown = (title, r, stdNote) => h('div', {},
      h('h3', { text: title, style: 'margin:20px 0 10px' }),
      table({
        headers: ['Step', 'Amount'],
        rows: [
          ['Taxable income', inr(r.taxable)],
          ...r.rows.map((s) => [`${inr(s.from)} – ${s.to === Infinity ? 'above' : inr(s.to)} @ ${s.rate}%`, inr(s.tax)]),
          ...(r.rebate > 0 ? [['Less: rebate u/s 87A', `− ${inr(r.rebate)}`]] : []),
          ...(r.marginalRelief > 0 ? [['Less: marginal relief', `− ${inr(r.marginalRelief)}`]] : []),
          ...(r.surcharge > 0 ? [['Add: surcharge', inr(r.surcharge)]] : []),
          ['Add: health & education cess (4%)', inr(r.cess)],
          ['Total tax payable', inr(r.total)],
        ],
      }),
      h('p', { class: 'hint', text: stdNote }));
    const run = () => {
      try {
        const r = incomeTaxIndia({ grossSalary: num(salary), otherIncome: num(other), deductionsOld: num(deductions), ageGroup: age.value });
        grid.set([
          { label: 'New regime tax', value: inr(r.newRegime.total), kind: r.saving > 0 && r.better === 'new' ? 'good' : undefined },
          { label: 'Old regime tax', value: inr(r.oldRegime.total), kind: r.saving > 0 && r.better === 'old' ? 'good' : undefined },
          { label: 'You save with', value: r.saving === 0 ? 'Neither (tie)' : `${r.better === 'new' ? 'New' : 'Old'} regime` },
          { label: 'Saving', value: inr(r.saving), kind: 'good' },
        ]);
        detailWrap.replaceChildren(
          breakdown('New regime — FY 2025-26 slabs', r.newRegime, 'Includes up to ₹75,000 standard deduction (limited to salary), 87A rebate up to ₹60,000 (taxable income up to ₹12 lakh) and marginal relief.'),
          breakdown('Old regime', r.oldRegime, `Includes up to ₹50,000 standard deduction (limited to salary) plus your deductions of ${inr(num(deductions))}, and 87A rebate up to ₹12,500 (taxable income up to ₹5 lakh).`));
        status.set(r.saving < 0.5
          ? 'Both regimes give almost the same tax for these inputs.'
          : `The ${r.better} regime is cheaper by ${inr(r.saving)} for FY 2025-26. Resident-individual estimate using ordinary slab-rate income only. Special-rate incomes (capital gains etc.) and other filing rules are not modelled.`, 'success');
      } catch (e) { grid.replaceChildren(); detailWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('p', { class: 'hint', text: 'Historical estimate for FY 2025–26 (AY 2026–27), resident individuals and ordinary slab-rate income only. This calculator does not model Tax Year 2026–27, capital gains or special-rate income. It does not check whether your deductions are eligible; verify rules before planning or filing.' }),
      h('div', { class: 'field-row' },
        field({ label: 'Gross salary (yearly)', control: salary }),
        field({ label: 'Other income (yearly)', control: other, hint: 'Ordinary slab-rate taxable income only; exclude capital gains and other special-rate income.' }),
        field({ label: 'Deductions (old regime)', control: deductions, hint: 'Enter eligible deductions and exemptions only; do not include the standard deduction again. Limits and eligibility are not checked.' }),
        field({ label: 'Age', control: age })),
      actionsRow(btn({ label: 'Calculate tax (FY 2025-26)', icon: 'receipt', onClick: run })), grid, detailWrap, status);
    clearOnEdit(root, status, grid, detailWrap);
    shareState(root, [['salary', salary], ['other', other], ['deductions', deductions], ['age', age]], run);
  },

  'rd-calculator'(root) {
    const monthly = input({ type: 'number', step: 'any', placeholder: 'e.g. 5000', value: '5000' });
    const rate = input({ type: 'number', step: 'any', placeholder: 'e.g. 7', value: '7' });
    const years = input({ type: 'number', step: '1', placeholder: 'e.g. 5', value: '5' });
    const extraMonths = select({ options: [{ v: '0', t: '0 months' }, { v: '3', t: '3 months' }, { v: '6', t: '6 months' }, { v: '9', t: '9 months' }], value: '0' });
    const grid = statsGrid();
    const status = statusLine('');
    const scheduleWrap = h('div', {});
    const run = () => {
      try {
        const wholeYears = num(years);
        if (!Number.isInteger(wholeYears) || wholeYears < 0) throw new Error('Tenure years must be a non-negative whole number.');
        const totalMonths = wholeYears * 12 + Number(extraMonths.value);
        const r = rdCalc({ monthly: num(monthly), annualRatePct: num(rate), months: totalMonths });
        grid.set([
          { label: 'Total deposited', value: money(r.deposited) },
          { label: 'Interest earned', value: money(r.interest), kind: 'warn' },
          { label: 'Maturity value', value: money(r.maturity), kind: 'good' },
          { label: 'Tenure', value: `${r.months} months` },
        ]);
        scheduleWrap.replaceChildren(
          h('h3', { text: 'Year-by-year growth', style: 'margin:20px 0 10px' }),
          table({ headers: ['After', 'Deposited', 'Interest', 'Value'], rows: r.schedule.map((y) => [y.months % 12 === 0 ? `Y${y.months / 12}` : `${y.months} mo`, money(y.deposited), money(y.interest), money(y.value)]) }));
        status.set(`Depositing ${money(num(monthly))} a month at ${fmtNumber(num(rate))}% with quarterly compounding. Interest is taxed at your slab rate; the bank's method, actual deposit dates and taxes can change the result.`, 'success');
      } catch (e) { grid.replaceChildren(); scheduleWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Monthly deposit', control: monthly }),
        field({ label: 'Interest rate % (p.a.)', control: rate, hint: '0–100%' }),
        field({ label: 'Tenure (years)', control: years, hint: 'Whole years plus the selected extra months; 3–1200 months total' }),
        field({ label: 'Plus', control: extraMonths })),
      actionsRow(btn({ label: 'Calculate RD', icon: 'bank', onClick: run })), grid, scheduleWrap, status);
    clearOnEdit(root, status, grid, scheduleWrap);
    shareState(root, [['monthly', monthly], ['rate', rate], ['years', years], ['months', extraMonths]], run);
  },

  'cagr-calculator'(root) {
    const start = input({ type: 'number', step: 'any', placeholder: 'e.g. 100000', value: '100000' });
    const end = input({ type: 'number', step: 'any', placeholder: 'e.g. 250000', value: '250000' });
    const years = input({ type: 'number', step: 'any', placeholder: 'e.g. 7', value: '7' });
    const grid = statsGrid();
    const status = statusLine('');
    const pathWrap = h('div', {});
    const run = () => {
      try {
        const r = cagrCalc({ startValue: num(start), endValue: num(end), years: num(years) });
        grid.set([
          { label: 'CAGR', value: `${fmtNumber(r.cagrPct, 2)}%`, kind: r.cagrPct >= 0 ? 'good' : 'bad' },
          { label: 'Total growth', value: `${fmtNumber(r.absoluteReturnPct, 2)}%` },
          { label: 'Growth multiple', value: `${fmtNumber(r.growthMultiple, 3)}×` },
          { label: r.gain >= 0 ? 'Gain' : 'Loss', value: money(Math.abs(r.gain)), kind: r.gain >= 0 ? 'good' : 'bad' },
        ]);
        const yrs = num(years);
        if (Number.isInteger(yrs) && yrs >= 1 && yrs <= 40 && num(end) > 0) {
          const g = r.cagrPct / 100;
          const rows = [];
          for (let y = 1; y <= yrs; y++) rows.push([`Y${y}`, money(num(start) * Math.pow(1 + g, y))]);
          pathWrap.replaceChildren(
            h('h3', { text: 'The smooth path CAGR implies', style: 'margin:20px 0 10px' }),
            table({ headers: ['Year', 'Value if growth were perfectly steady'], rows }),
            h('p', { class: 'hint', text: 'CAGR irons out all the ups and downs in between — the real path was bumpier than this.' }));
        } else pathWrap.replaceChildren();
        status.set(`Growing from ${money(num(start))} to ${money(num(end))} in ${fmtNumber(yrs)} years is a ${fmtNumber(r.cagrPct, 2)}% CAGR.`, 'success');
      } catch (e) { grid.replaceChildren(); pathWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Starting value', control: start }),
        field({ label: 'Ending value', control: end }),
        field({ label: 'Time period (years)', control: years })),
      actionsRow(btn({ label: 'Calculate CAGR', icon: 'trending', onClick: run })), grid, pathWrap, status);
    clearOnEdit(root, status, grid, pathWrap);
    shareState(root, [['start', start], ['end', end], ['years', years]], run);
  },

  'gratuity-calculator'(root) {
    const salary = input({ type: 'number', step: 'any', placeholder: 'e.g. 50000', value: '50000' });
    const years = input({ type: 'number', step: '1', placeholder: 'e.g. 20', value: '20' });
    const months = input({ type: 'number', step: '1', min: 0, max: 11, placeholder: '0–11', value: '0' });
    const inr = (v) => `₹${money(v)}`;
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      try {
        const r = gratuityCalc({ monthlySalary: num(salary), years: Math.floor(num(years)), months: Math.floor(num(months) || 0) });
        grid.set([
          { label: 'Estimated gratuity', value: inr(r.amount), kind: 'good' },
          { label: 'Service counted', value: `${r.roundedYears} years` },
          { label: 'Eligibility (5+ years)', value: r.eligible ? 'Eligible ✓' : 'Not yet', kind: r.eligible ? 'good' : 'warn' },
        ]);
        status.set(r.eligible
          ? `Formula: (15 ÷ 26) × ${inr(num(salary))} × ${r.roundedYears} years. Salary here means last drawn basic + DA; service over 6 months in the final year is counted as a full year.`
          : 'Note: under the Payment of Gratuity Act, gratuity is generally payable only after 5 years of continuous service (exceptions such as death or disablement apply). The amount above shows what the formula gives for the service entered.', r.eligible ? 'success' : 'warning');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Last monthly salary (basic + DA)', control: salary }),
        field({ label: 'Years of service', control: years }),
        field({ label: 'Extra months', control: months, hint: 'Over 6 counts as a full year' })),
      actionsRow(btn({ label: 'Calculate gratuity', icon: 'receipt', onClick: run })), grid, status);
    shareState(root, [['salary', salary], ['years', years], ['months', months]], run);
  },

  'lumpsum-calculator'(root) {
    const amount = input({ type: 'number', step: 'any', placeholder: 'e.g. 100000', value: '100000' });
    const rate = input({ type: 'number', step: 'any', placeholder: 'e.g. 12', value: '12' });
    const years = input({ type: 'number', step: 'any', placeholder: 'e.g. 10', value: '10' });
    const grid = statsGrid();
    const status = statusLine('');
    const scheduleWrap = h('div', {});
    const run = () => {
      try {
        const r = compoundInterest({ principal: num(amount) || 0, annualRatePct: num(rate), years: num(years), perYear: 1 });
        grid.set([
          { label: 'Invested amount', value: money(num(amount)) },
          { label: 'Est. gains', value: money(r.totalInterest), kind: 'warn' },
          { label: 'Maturity value', value: money(r.finalBalance), kind: 'good' },
          { label: 'Growth multiple', value: `${fmtNumber(r.finalBalance / (num(amount) || 1), 2)}×` },
        ]);
        scheduleWrap.replaceChildren(
          h('h3', { text: 'Year-by-year growth', style: 'margin:20px 0 10px' }),
          table({ headers: ['Year', 'Invested', 'Est. gains', 'Value'], rows: r.schedule.map((y) => [`Y${y.year}`, money(y.contributed), money(y.interest), money(y.balance)]) }));
        status.set(`A one-time ${money(num(amount))} for ${fmtNumber(num(years))} years at ${fmtNumber(num(rate))}% expected return, compounded yearly. Estimates only — market returns are not guaranteed.`, 'success');
      } catch (e) { grid.replaceChildren(); scheduleWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'One-time investment', control: amount }),
        field({ label: 'Expected return % (p.a.)', control: rate }),
        field({ label: 'Duration (years)', control: years })),
      actionsRow(btn({ label: 'Calculate lumpsum', icon: 'coins', onClick: run })), grid, scheduleWrap, status);
    shareState(root, [['amount', amount], ['rate', rate], ['years', years]], run);
  },

  'nps-calculator'(root) {
    const age = input({ type: 'number', step: '1', min: 18, max: 74, value: '30' });
    const retire = input({ type: 'number', step: '1', min: 19, max: 75, value: '60' });
    const monthly = input({ type: 'number', step: 'any', value: '10000' });
    const corpusNow = input({ type: 'number', step: 'any', value: '0' });
    const rate = input({ type: 'number', step: 'any', value: '10' });
    const stepUp = input({ type: 'number', step: 'any', value: '5' });
    const annuityPct = input({ type: 'number', step: 'any', min: 0, max: 100, value: '40' });
    const annuityRate = input({ type: 'number', step: 'any', value: '7' });
    const grid = statsGrid();
    const status = statusLine('');
    const scheduleWrap = h('div', {});
    const inr = (v) => `₹${money(v)}`;
    const run = () => {
      try {
        const r = npsCalc({
          currentAge: Math.floor(num(age)), retirementAge: Math.floor(num(retire)),
          monthlyContribution: num(monthly), currentCorpus: num(corpusNow) || 0,
          annualReturnPct: num(rate), annualStepUpPct: num(stepUp) || 0,
          annuityPct: num(annuityPct), annuityRatePct: num(annuityRate),
        });
        grid.set([
          { label: 'Projected NPS corpus', value: inr(r.corpus), kind: 'good' },
          { label: 'You contribute from today', value: inr(r.newContributions) },
          { label: 'Estimated gains', value: inr(r.gains), kind: 'warn' },
          { label: 'Lump sum portion', value: inr(r.lumpSum) },
          { label: 'Used to buy annuity', value: inr(r.annuityCorpus) },
          { label: 'Estimated monthly pension', value: inr(r.monthlyPension), kind: 'good' },
        ]);
        scheduleWrap.replaceChildren(
          h('h3', { text: 'Corpus by age', style: 'margin:20px 0 10px' }),
          table({ headers: ['Age', 'Starting + contributed', 'Est. gains', 'Corpus'], rows: r.schedule.map((y) => [String(y.age), inr(y.contributed), inr(y.gains), inr(y.balance)]) }));
        status.set(`Projection assumes contributions at the start of each month and a steady ${fmtNumber(num(rate))}% return. NPS is market-linked and annuity income depends on the annuity plan chosen at exit — this is an estimate, not a promise.`, 'success');
      } catch (e) { grid.replaceChildren(); scheduleWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Current age', control: age }),
        field({ label: 'Retirement age', control: retire }),
        field({ label: 'Monthly contribution (₹)', control: monthly }),
        field({ label: 'Current corpus (₹)', control: corpusNow })),
      h('div', { class: 'field-row' },
        field({ label: 'Expected return % (p.a.)', control: rate }),
        field({ label: 'Yearly contribution step-up %', control: stepUp }),
        field({ label: 'Corpus used for annuity %', control: annuityPct }),
        field({ label: 'Expected annuity rate % (p.a.)', control: annuityRate })),
      actionsRow(btn({ label: 'Calculate NPS', icon: 'bank', onClick: run })), grid, scheduleWrap, status);
    shareState(root, [['age', age], ['retire', retire], ['monthly', monthly], ['corpus', corpusNow], ['rate', rate], ['step', stepUp], ['annuity', annuityPct], ['annuityRate', annuityRate]], run);
  },

  'epf-calculator'(root) {
    const basic = input({ type: 'number', step: 'any', value: '50000' });
    const age = input({ type: 'number', step: '1', min: 18, max: 70, value: '25' });
    const retire = input({ type: 'number', step: '1', min: 19, max: 70, value: '58' });
    const balanceNow = input({ type: 'number', step: 'any', value: '0' });
    const growth = input({ type: 'number', step: 'any', value: '5' });
    const rate = input({ type: 'number', step: 'any', value: '8.25' });
    const grid = statsGrid();
    const status = statusLine('');
    const scheduleWrap = h('div', {});
    const inr = (v) => `₹${money(v)}`;
    const run = () => {
      try {
        const years = Math.floor(num(retire)) - Math.floor(num(age));
        if (!(years >= 1)) throw new Error('Retirement age must be after your current age.');
        const r = epfCalc({
          monthlyBasicDa: num(basic), years, currentBalance: num(balanceNow) || 0,
          annualSalaryGrowthPct: num(growth) || 0, annualInterestPct: num(rate),
        });
        grid.set([
          { label: 'Projected EPF balance', value: inr(r.balance), kind: 'good' },
          { label: 'Your contributions', value: inr(r.employeeContribution) },
          { label: 'Employer’s EPF share', value: inr(r.employerEpfContribution) },
          { label: 'Interest credited', value: inr(r.totalInterest), kind: 'warn' },
          { label: 'Diverted to EPS (not EPF)', value: inr(r.epsContribution) },
        ]);
        scheduleWrap.replaceChildren(
          h('h3', { text: 'Year-by-year EPF projection', style: 'margin:20px 0 10px' }),
          table({ headers: ['Year', 'Employee', 'Employer EPF', 'Interest', 'Balance'], rows: r.schedule.map((y) => [String(y.year), inr(y.employeeContribution), inr(y.employerEpfContribution), inr(y.interestCredited), inr(y.balance)]) }));
        status.set('Assumes 12% employee + 12% employer contributions on basic + DA, with the employer EPS diversion capped at ₹1,250/month. Actual EPFO crediting, exemptions and joining-date rules can change the passbook figure.', 'success');
      } catch (e) { grid.replaceChildren(); scheduleWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Monthly basic + DA (₹)', control: basic }),
        field({ label: 'Current age', control: age }),
        field({ label: 'Retirement age', control: retire }),
        field({ label: 'Current EPF balance (₹)', control: balanceNow })),
      h('div', { class: 'field-row' },
        field({ label: 'Salary growth % (p.a.)', control: growth }),
        field({ label: 'Expected EPF interest % (p.a.)', control: rate })),
      actionsRow(btn({ label: 'Calculate EPF', icon: 'shield', onClick: run })), grid, scheduleWrap, status);
    shareState(root, [['basic', basic], ['age', age], ['retire', retire], ['balance', balanceNow], ['growth', growth], ['rate', rate]], run);
  },

  'loan-prepayment-calculator'(root) {
    const principal = input({ type: 'number', step: 'any', value: '120000' }), rate = input({ type: 'number', step: 'any', value: '0' }), payment = input({ type: 'number', step: 'any', value: '10000' }), extra = input({ type: 'number', step: 'any', value: '1000' }), lump = input({ type: 'number', step: 'any', value: '20000' }), month = input({ type: 'number', step: '1', value: '3' });
    const grid = statsGrid(), status = statusLine('');
    const run = () => { try { const r = loanPrepaymentCalc(num(principal), num(rate), num(payment), num(extra), num(lump), num(month));
      grid.set([{ label: 'Time saved (months)', value: String(r.monthsSaved), kind: 'good' }, { label: 'Interest saved', value: money(r.interestSaved), kind: 'good' }, { label: 'Baseline months', value: String(r.baseline.months) }, { label: 'With prepayment months', value: String(r.accelerated.months) }, { label: 'Baseline interest', value: money(r.baseline.interest) }, { label: 'With prepayment interest', value: money(r.accelerated.interest) }, { label: 'Lump sum applied', value: money(r.accelerated.lumpApplied) }]);
      status.set('Fixed rate and payment. Interest accrues monthly; extra and lump sum are paid after that month’s interest. Fees, rate changes, tax and lender rounding excluded. Lump sum is capped to the remaining balance.', 'success');
    } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Outstanding balance', control: principal }), field({ label: 'Annual rate (%)', control: rate }), field({ label: 'Monthly payment', control: payment }), field({ label: 'Extra every month', control: extra }), field({ label: 'One-time prepayment', control: lump }), field({ label: 'Prepayment month', control: month })), actionsRow(btn({ label: 'Calculate prepayment', icon: 'calculator', onClick: run })), grid, status);
    clearOnEdit(root, status, grid);
    shareState(root, [['principal', principal], ['rate', rate], ['payment', payment], ['extra', extra], ['lump', lump], ['month', month]], run);
  },
  'inflation-calculator'(root) {
    const amount = input({ type: 'number', step: 'any', value: '100000' }), rate = input({ type: 'number', step: 'any', value: '6' }), years = input({ type: 'number', step: 'any', value: '10' });
    const grid = statsGrid(), status = statusLine('');
    const run = () => { try { const r = inflationCalc(num(amount), num(rate), num(years)); grid.set([{ label: 'Equivalent future cost', value: money(r.futureCost) }, { label: 'Increase in cost', value: money(r.increase) }, { label: 'Future money in today’s buying power', value: money(r.purchasingPower) }]); status.set('Constant assumed annual inflation, compounded yearly. Actual inflation varies; this is not an official CPI forecast.', 'success'); } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Amount today', control: amount }), field({ label: 'Annual inflation (%)', control: rate }), field({ label: 'Years', control: years })), actionsRow(btn({ label: 'Calculate inflation', icon: 'calculator', onClick: run })), grid, status);
    shareState(root, [['amount', amount], ['rate', rate], ['years', years]], run);
  },
  'work-hours-calculator'(root) {
    const start = input({ type: 'time', value: '09:00' }), end = input({ type: 'time', value: '17:00' }), pause = input({ type: 'number', step: '1', value: '60' }), hourly = input({ type: 'number', step: 'any', value: '20' });
    const grid = statsGrid(), status = statusLine('');
    const run = () => { try { const r = workHoursCalc(start.value, end.value, num(pause), num(hourly)); const clock = `${Math.floor(r.netMinutes / 60)}h ${String(r.netMinutes % 60).padStart(2, '0')}m`;
      grid.set([{ label: 'Paid time', value: clock, kind: 'good' }, { label: 'Decimal hours', value: r.decimalHours.toFixed(2) }, { label: 'Estimated gross pay', value: money(r.pay) }, { label: 'Shift span', value: `${r.grossMinutes} minutes` }]);
      status.set(`${r.overnight ? 'End is earlier than start: treated as next day. ' : 'Equal times mean a zero-length shift. '}Uses clock times, not calendar dates or daylight-saving changes. Pay excludes overtime, taxes and other deductions.`, 'success');
    } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Start time', control: start }), field({ label: 'End time', control: end }), field({ label: 'Unpaid break (minutes)', control: pause }), field({ label: 'Hourly rate (optional; use 0)', control: hourly })), actionsRow(btn({ label: 'Calculate work hours', icon: 'calculator', onClick: run })), grid, status);
    shareState(root, [['start', start], ['end', end], ['break', pause], ['hourly', hourly]], run);
  },
  'profit-margin-calculator'(root) {
    const cost = input({ type: 'number', step: 'any', value: '60' }), revenue = input({ type: 'number', step: 'any', value: '100' });
    const grid = statsGrid(), status = statusLine('');
    const run = () => { try { const r = profitMarginCalc(num(cost), num(revenue)); grid.set([{ label: 'Profit / loss', value: money(r.profit), kind: r.profit < 0 ? 'bad' : 'good' }, { label: 'Profit margin', value: r.margin === null ? 'Undefined (zero sales)' : `${r.margin.toFixed(2)}%` }, { label: 'Markup on cost', value: r.markup === null ? 'Undefined (zero cost)' : `${r.markup.toFixed(2)}%` }]); status.set('Margin divides profit by selling price; markup divides profit by cost. Include all relevant costs yourself; taxes and other expenses are not added automatically.', 'success'); } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Total cost', control: cost }), field({ label: 'Selling price / revenue', control: revenue })), actionsRow(btn({ label: 'Calculate profit margin', icon: 'calculator', onClick: run })), grid, status);
    shareState(root, [['cost', cost], ['revenue', revenue]], run);
  },

  'final-grade-calculator'(root) {
    const current = input({ type: 'number', step: 'any', value: '86' });
    const target = input({ type: 'number', step: 'any', value: '88' });
    const weight = input({ type: 'number', step: 'any', value: '25' });
    const exam = input({ type: 'number', step: 'any', value: '80' });
    const grid = statsGrid(), status = statusLine('');
    const run = () => { try {
      const r = finalGradeCalc(num(current), num(target), num(weight), num(exam));
      const required = r.required === null ? 'No effect' : r.required <= 0 ? '0% is enough' : r.required > 100 ? `${r.required.toFixed(2)}% (above 100%)` : `${r.required.toFixed(2)}%`;
      grid.set([{ label: 'Exam score needed', value: required }, { label: 'Overall with your exam score', value: `${r.overall.toFixed(2)}%`, kind: 'good' }, { label: 'Possible overall range', value: `${r.minimum.toFixed(2)}–${r.maximum.toFixed(2)}%` }]);
      status.set(r.required === null ? (r.targetMetWithoutExam ? 'The final has zero weight; your current grade already meets the target.' : 'The final has zero weight; it cannot change your current grade to reach the target.') : r.required > 100 ? 'Target exceeds the maximum without extra credit or a grading adjustment.' : 'Assumes current grade is the average of all work excluding the final. Check your syllabus for rounding and grading rules.', r.required > 100 ? 'warn' : 'success');
    } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Current grade (%)', control: current }), field({ label: 'Target grade (%)', control: target }), field({ label: 'Final exam weight (%)', control: weight }), field({ label: 'What-if exam score (%)', control: exam })), actionsRow(btn({ label: 'Calculate final grade', icon: 'calculator', onClick: run })), grid, status);
    for (const el of [current,target,weight,exam]) el.addEventListener('input',()=>{grid.replaceChildren();status.set('Inputs changed. Calculate again.','info');});
    const components = textarea({rows:4,value:'80, 30\n90, 45',placeholder:'score, course weight — one per line'});
    const componentGrid = statsGrid(), componentStatus = statusLine('');
    const clearComponents = () => {componentGrid.replaceChildren();componentStatus.set('Coursework changed. Calculate again.','info');};
    components.addEventListener('input',clearComponents);
    const calculateComponents = (apply = false) => {try {
      const r = completedGradeComponents(components.value);
      componentGrid.set([{label:'Completed coursework average',value:`${r.average.toFixed(4)}%`},{label:'Completed course weight',value:`${r.completedWeight}%`},{label:'Remaining course weight',value:`${r.remainingWeight}%`}]);
      if (apply) {
        current.value=String(Number(r.average.toFixed(10)));weight.value=String(r.remainingWeight);
        current.dispatchEvent(new window.Event('input',{bubbles:true}));weight.dispatchEvent(new window.Event('input',{bubbles:true}));
        run();
      }
      componentStatus.set(apply ? 'Applied the weighted average and remaining weight above. The what-if score represents all remaining work combined.' : 'Calculated only. Apply to use this average and remaining weight in the final-grade calculator above.', 'success');
    } catch(e){componentGrid.replaceChildren();componentStatus.set(e.message,'error');}};
    root.append(h('h2',{text:'Calculate current grade from coursework'}),h('p',{class:'hint',text:'Enter one completed component per line as score percentage, weight percentage of the entire course. These must be separate, non-overlapping course weights. The remaining weight is treated as one combined final or set of tasks.'}),
      field({label:'Completed scores and course weights',control:components,hint:'Example: 80, 30 means score 80% on work worth 30% of the whole course. Up to 50 rows; 6 decimal places.'}),
      actionsRow(btn({label:'Calculate average',variant:'secondary',onClick:()=>calculateComponents(false)}),btn({label:'Apply to final grade',onClick:()=>calculateComponents(true)})),componentGrid,componentStatus,
      h('p',{class:'hint',text:'Does not model letter grades, nested categories, dropped work, extra credit or institution-specific rounding. Verify your syllabus. Only the main calculator inputs are included in optional share links; coursework rows are not shared.'}));
    shareState(root, [['current', current], ['target', target], ['weight', weight], ['exam', exam]], run);
  },
  'savings-goal-calculator'(root) {
    const goal = input({ type: 'number', value: '100000' }), initial = input({ type: 'number', value: '10000' }), rate = input({ type: 'number', step: 'any', value: '0' }), months = input({ type: 'number', step: '1', value: '12' });
    const grid = statsGrid(), status = statusLine('');
    const run = () => { try { const r = savingsGoalCalc(num(goal), num(initial), num(rate), num(months));
      grid.set([{ label: 'Monthly savings needed', value: money(r.payment), kind: 'good' }, { label: 'Projected final balance', value: money(r.final) }, { label: 'New contributions', value: money(r.contributed) }, { label: 'Estimated growth', value: money(r.growth) }]);
      status.set('Fixed annual return divided by 12, compounded monthly; deposits at month end. Taxes, fees, inflation and variable returns are excluded.', 'success');
    } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Target amount', control: goal }), field({ label: 'Current savings', control: initial }), field({ label: 'Annual return (%)', control: rate }), field({ label: 'Months to goal', control: months })), actionsRow(btn({ label: 'Calculate savings goal', icon: 'calculator', onClick: run })), grid, status);
    clearOnEdit(root, status, grid);
    shareState(root, [['goal', goal], ['initial', initial], ['rate', rate], ['months', months]], run);
  },
  'swp-calculator'(root) {
    const initial = input({ type: 'number', value: '100000' }), withdrawal = input({ type: 'number', value: '10000' }), rate = input({ type: 'number', step: 'any', value: '0' }), months = input({ type: 'number', step: '1', value: '12' });
    const grid = statsGrid(), status = statusLine('');
    const run = () => { try { const r = swpCalc(num(initial), num(withdrawal), num(rate), num(months));
      grid.set([{ label: 'Remaining balance', value: money(r.balance), kind: r.depletedMonth === null ? 'good' : 'warn' }, { label: 'Total withdrawn', value: money(r.withdrawn) }, { label: 'Estimated growth', value: money(r.growth) }, { label: 'Depleted in month', value: r.depletedMonth === null ? 'Not in this period' : String(r.depletedMonth) }]);
      status.set(r.depletedMonth !== null && r.depletedMonth > 0 ? `Corpus exhausted in month ${r.depletedMonth}; last withdrawal was ${money(r.lastWithdrawal)}. Fixed monthly return is applied before withdrawal; taxes and fees excluded.` : 'Fixed annual return divided by 12 is applied monthly before withdrawal. Actual returns vary; taxes, fees and inflation are excluded.', r.depletedMonth !== null ? 'warn' : 'success');
    } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Starting corpus', control: initial }), field({ label: 'Monthly withdrawal', control: withdrawal }), field({ label: 'Annual return (%)', control: rate }), field({ label: 'Projection months', control: months })), actionsRow(btn({ label: 'Calculate SWP', icon: 'calculator', onClick: run })), grid, status);
    clearOnEdit(root, status, grid);
    shareState(root, [['initial', initial], ['withdrawal', withdrawal], ['rate', rate], ['months', months]], run);
  },
  'electricity-cost-calculator'(root) {
    const watts = input({ type: 'number', value: '1000' }), hours = input({ type: 'number', step: 'any', value: '2' }), days = input({ type: 'number', value: '30' }), rate = input({ type: 'number', step: 'any', value: '8' }), fixed = input({ type: 'number', step: 'any', value: '0' });
    const grid = statsGrid(), status = statusLine('');
    const run = () => { try { const r = electricityCostCalc(num(watts), num(hours), num(days), num(rate), num(fixed));
      grid.set([{ label: 'Energy (kWh / units)', value: r.units.toFixed(2) }, { label: 'Energy charge', value: money(r.energyCost) }, { label: 'Estimated total', value: money(r.total), kind: 'good' }]);
      status.set('Uses one flat price per kWh and a user-entered fixed charge. Real bills can include slabs, taxes, subsidies and variable appliance power.', 'success');
    } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Power (watts)', control: watts }), field({ label: 'Hours per day', control: hours }), field({ label: 'Days', control: days }), field({ label: 'Price per kWh / unit', control: rate }), field({ label: 'Fixed charge for period', control: fixed })), actionsRow(btn({ label: 'Calculate electricity cost', icon: 'calculator', onClick: run })), grid, status);
    shareState(root, [['watts', watts], ['hours', hours], ['days', days], ['rate', rate], ['fixed', fixed]], run);
  },
  'fuel-cost-calculator'(root) {
    const distance = input({ type: 'number', step: 'any', value: '100' }), mileage = input({ type: 'number', step: 'any', value: '20' }), price = input({ type: 'number', step: 'any', value: '100' }), trips = input({ type: 'number', value: '2' }), people = input({ type: 'number', value: '1' });
    const grid = statsGrid(), status = statusLine('');
    const run = () => { try { const r = fuelCostCalc(num(distance), num(mileage), num(price), num(trips), num(people));
      grid.set([{ label: 'Total distance (km)', value: r.totalDistance.toFixed(2) }, { label: 'Fuel needed (litres)', value: r.litres.toFixed(2) }, { label: 'Total fuel cost', value: money(r.total), kind: 'good' }, { label: 'Cost per person', value: money(r.perPerson) }]);
      status.set('Trips multiplies the entered distance: use 2 for a return journey if distance is one-way. Tolls, parking and changes in mileage are excluded.', 'success');
    } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Distance per trip (km)', control: distance }), field({ label: 'Mileage (km per litre)', control: mileage }), field({ label: 'Fuel price per litre', control: price }), field({ label: 'Number of trips', control: trips }), field({ label: 'People sharing', control: people })), actionsRow(btn({ label: 'Calculate fuel cost', icon: 'calculator', onClick: run })), grid, status);
    shareState(root, [['distance', distance], ['mileage', mileage], ['price', price], ['trips', trips], ['people', people]], run);
  },

  'hra-calculator'(root) {
    const basic = input({ type: 'number', step: 'any', value: '50000' });
    const hra = input({ type: 'number', step: 'any', value: '20000' });
    const rent = input({ type: 'number', step: 'any', value: '20000' });
    const city = select({ options: [{ v: 'metro', t: 'Metro (Delhi, Mumbai, Kolkata, Chennai)' }, { v: 'nonmetro', t: 'Non-metro' }], value: 'metro' });
    const grid = statsGrid();
    const status = statusLine('');
    const breakdown = h('div', {});
    const inr = (v) => `₹${money(v)}`;
    const labels = {
      actualHra: 'Actual HRA received',
      rentOverTenPercent: 'Rent paid minus 10% of basic + DA',
      salaryCap: '50% / 40% of basic + DA',
    };
    const run = () => {
      try {
        const r = hraCalc({
          salaryBasicDaAnnual: num(basic) * 12,
          hraReceivedAnnual: num(hra) * 12,
          rentPaidAnnual: num(rent) * 12,
          metro: city.value === 'metro',
        });
        grid.set([
          { label: 'Exempt HRA (year)', value: inr(r.exempt), kind: 'good' },
          { label: 'Exempt HRA (month)', value: inr(r.exempt / 12) },
          { label: 'Taxable HRA (year)', value: inr(r.taxable), kind: r.taxable ? 'warn' : 'good' },
          { label: 'Limit that decided it', value: labels[r.limitingFactor] },
        ]);
        breakdown.replaceChildren(
          h('h3', { text: 'The three HRA limits', style: 'margin:20px 0 10px' }),
          table({ headers: ['Limit', 'Annual amount', 'Result'], rows: [
            ['Actual HRA received', inr(r.actualHra), r.limitingFactor === 'actualHra' ? 'Lowest ✓' : '—'],
            ['Rent paid − 10% of basic + DA', inr(r.rentOverTenPercent), r.limitingFactor === 'rentOverTenPercent' ? 'Lowest ✓' : '—'],
            [city.value === 'metro' ? '50% of basic + DA (metro)' : '40% of basic + DA (non-metro)', inr(r.salaryCap), r.limitingFactor === 'salaryCap' ? 'Lowest ✓' : '—'],
          ] }));
        status.set('HRA exemption is an old-regime calculation and needs rent actually paid for a home you occupy. The lowest of the three limits is exempt; the rest of the HRA is taxable salary.', 'success');
      } catch (e) { grid.replaceChildren(); breakdown.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Monthly basic + DA (₹)', control: basic }),
        field({ label: 'Monthly HRA received (₹)', control: hra }),
        field({ label: 'Monthly rent paid (₹)', control: rent }),
        field({ label: 'City type', control: city })),
      actionsRow(btn({ label: 'Calculate HRA exemption', icon: 'receipt', onClick: run })), grid, breakdown, status);
    shareState(root, [['basic', basic], ['hra', hra], ['rent', rent], ['city', city]], run);
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { pctOf, pctWhat, pctChange, discountCalc, ageCalc, bmiCalc, gstCalc, emiCalc, tipCalc, compoundInterest, simpleInterest, sipCalc, ppfCalc, fdCalc, incomeTaxIndia, rdCalc, cagrCalc, gratuityCalc, npsCalc, epfCalc, hraCalc, finalGradeCalc, savingsGoalCalc, swpCalc, electricityCostCalc, fuelCostCalc, loanPrepaymentCalc, inflationCalc, workHoursCalc, profitMarginCalc, budget503020, emergencyFund, debtToIncome, breakEven };
