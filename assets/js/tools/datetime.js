// =============================================================================
// iHaveTools — Date & Time tools: date-difference, date-add-calculator,
// time-zone-converter (uses the browser's built-in IANA tz database via Intl)
// =============================================================================
import { h, field, input, textarea, select, switchChip, btn, actionsRow, statusLine, statsGrid, toast, mountTool } from '../ui.js';
import { DAY_MS, parseCalendarDate, localDateISO, calendarSpan, isoWeek, addMonthsUTC, dateISO } from '../calendar.js';
export { parseCalendarDate, localDateISO, isoWeek } from '../calendar.js';

// Business days use calendar dates in UTC, avoiding local DST shifts.
const WEEKENDS = { sat_sun: [0, 6], fri_sat: [5, 6], sun: [0], none: [] };
function businessRules(weekend, holidays) {
  if (!Object.hasOwn(WEEKENDS, weekend)) throw new Error('Choose a valid weekend.');
  const parts = String(holidays || '').split(/[\s,;]+/).filter(Boolean);
  if (parts.length > 500) throw new Error('Enter no more than 500 holiday dates.');
  const holidayDays = new Set(parts.map(parseCalendarDate));
  return (day) => !WEEKENDS[weekend].includes(new Date(day).getUTCDay()) && !holidayDays.has(day);
}
export function countBusinessDays(start, end, weekend = 'sat_sun', holidays = '') {
  const first = parseCalendarDate(start), last = parseCalendarDate(end), isWorking = businessRules(weekend, holidays);
  if (last < first) throw new Error('End date must be on or after the start date.');
  const days = (last - first) / DAY_MS + 1;
  if (days > 36600) throw new Error('Date range must be at most 36,600 days.');
  let working = 0;
  for (let day = first; day <= last; day += DAY_MS) if (isWorking(day)) working++;
  return { working, nonWorking: days - working, calendarDays: days };
}
export function addBusinessDays(start, amount, weekend = 'sat_sun', holidays = '') {
  let day = parseCalendarDate(start); const isWorking = businessRules(weekend, holidays);
  if (!Number.isInteger(amount) || Math.abs(amount) > 10000) throw new Error('Working days must be a whole number between -10000 and 10000.');
  let remaining = Math.abs(amount), steps = 0, direction = Math.sign(amount);
  while (remaining) {
    day += direction * DAY_MS;
    if (++steps > 36600 || day < parseCalendarDate('1900-01-01') || day > parseCalendarDate('2100-12-31')) throw new Error('The result is outside the supported date range.');
    if (isWorking(day)) remaining--;
  }
  return new Date(day).toISOString().slice(0, 10);
}

export function dateDiff(startStr, endStr, includeEnd = false) {
  const a=parseCalendarDate(startStr), b=parseCalendarDate(endStr), first=Math.min(a,b), last=Math.max(a,b);
  const span=calendarSpan(first,last), totalDays=(last-first)/DAY_MS+(includeEnd ? 1 : 0);
  // Use whole weeks + a bounded remainder, not a loop over centuries.
  const fullWeeks=Math.floor(totalDays/7); let businessDays=fullWeeks*5;
  for(let i=0;i<totalDays%7;i++) {const wd=new Date(first+i*DAY_MS).getUTCDay(); if(wd!==0&&wd!==6) businessDays++;}
  return {...span,totalDays,businessDays,weekendDays:totalDays-businessDays,weeks:fullWeeks,remainderDays:totalDays%7,hours:totalDays*24,minutes:totalDays*1440,reversed:a>b};
}
export function dateAdd(startStr, amount, unit, direction) {
  const start=parseCalendarDate(startStr);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000) throw new Error('Enter a whole number between 1 and 100,000.');
  if (!['add','sub'].includes(direction)) throw new Error('Choose add or subtract.');
  const n=amount*(direction==='sub' ? -1 : 1);
  let result;
  if (unit==='days') result=start+n*DAY_MS;
  else if (unit==='weeks') result=start+n*7*DAY_MS;
  else if (unit==='months') result=addMonthsUTC(start,n);
  else if (unit==='years') result=addMonthsUTC(start,n*12);
  else throw new Error('Unknown unit.');
  if (!Number.isFinite(result) || result < parseCalendarDate('1900-01-01') || result > parseCalendarDate('2100-12-31')) throw new Error('The result is outside the supported date range (1900–2100).');
  const iso=dateISO(result), d=new Date(`${iso}T00:00:00`);
  if (localDateISO(d)!==iso) throw new Error('This local calendar date does not exist in your time zone.');
  return d;
}

export function zoneOffset(timeZone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const parts = Object.fromEntries(dtf.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour === '24' ? 0 : parts.hour, parts.minute, parts.second);
  return (asUTC - Math.floor(date.getTime() / 1000) * 1000) / 6e4; // minutes
}

export function convertTimeZone({ dateStr, timeStr, fromTz, toTz }) {
  if (!dateStr || !timeStr) throw new Error('Pick both a date and a time.');
  const day = parseCalendarDate(dateStr), match = /^(\d{2}):(\d{2})$/.exec(timeStr);
  if (!match || +match[1] > 23 || +match[2] > 59) throw new Error('Enter a valid time.');
  const naive = day + (+match[1] * 60 + +match[2]) * 60000;
  // Candidate offsets around the wall time are checked by round-trip; do not
  // silently guess when DST creates a missing or repeated local time.
  const offsets = new Set();
  for (let hour=-48;hour<=48;hour+=3) offsets.add(zoneOffset(fromTz,new Date(naive+hour*3600000)));
  const candidates = [...offsets].map(o => naive-o*60000).filter(t => Math.abs(t+zoneOffset(fromTz,new Date(t))*60000-naive)<1);
  if (!candidates.length) throw new Error('That local time does not exist in the selected source time zone (clock transition).');
  if (candidates.length>1) throw new Error('That local time occurs twice in the selected source time zone (clock transition); choose an unambiguous time.');
  const ts = candidates[0];
  const d = new Date(ts);
  // Historic IANA offsets may include seconds; never silently truncate them.
  const secondsNeeded = d.getUTCSeconds() !== 0 || [fromTz, toTz].some(tz => !Number.isInteger(zoneOffset(tz, d)));
  const fmt = (tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: secondsNeeded ? 'medium' : 'short' }).format(d);
  const off = (tz) => {
    const mins = zoneOffset(tz, d);
    const sign = mins < 0 ? '-' : '+';
    const seconds = Math.round(Math.abs(mins)*60), hh=Math.floor(seconds/3600), mm=Math.floor(seconds%3600/60), ss=seconds%60;
    return `UTC${sign}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${ss ? `:${String(ss).padStart(2,'0')}` : ''}`;
  };
  return { from: { text: fmt(fromTz), offset: off(fromTz) }, to: { text: fmt(toTz), offset: off(toTz) }, utc: `${d.toISOString().slice(0, d.getUTCSeconds() ? 19 : 16)} UTC` };
}

// Produce wall-clock fields in the selected source zone, not the browser zone.
export function wallTimeAt(timeZone, instant = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = Object.fromEntries(formatter.formatToParts(instant).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export const TIME_ZONES = (() => {
  const list = [
    'UTC', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Denver', 'America/Chicago',
    'America/New_York', 'America/Toronto', 'America/Mexico_City', 'America/Bogota', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
    'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris', 'Europe/Amsterdam', 'Europe/Berlin',
    'Europe/Zurich', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Warsaw', 'Europe/Athens', 'Europe/Helsinki', 'Europe/Istanbul',
    'Europe/Moscow', 'Africa/Casablanca', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Nairobi',
    'Asia/Dubai', 'Asia/Tehran', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Jakarta',
    'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Taipei', 'Asia/Manila', 'Asia/Seoul', 'Asia/Tokyo', 'Australia/Perth',
    'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Sydney', 'Pacific/Auckland', 'Pacific/Fiji',
  ];
  try {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (local && !list.includes(local)) list.unshift(local);
  } catch { /* ignore */ }
  return list;
})();

const defs = {
  'iso-week-calculator'(root) {
    const date = input({ type:'date', value: localDateISO(new Date()) }), grid=statsGrid(), status=statusLine('');
    const run=()=>{try{const r=isoWeek(date.value);grid.set([{label:'ISO week',value:`${r.year}-W${String(r.week).padStart(2,'0')}`,kind:'good'},{label:'ISO weekday (Monday = 1)',value:String(r.weekday)},{label:'Week starts Monday',value:r.monday},{label:'Week ends Sunday',value:r.sunday}]);status.set('ISO weeks run Monday to Sunday. Week 1 contains January 4; the week-year can differ from the calendar year.', 'info');}catch(e){grid.replaceChildren();status.set(e.message,'error');}};
    root.addEventListener('input', () => { grid.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); });
    root.append(field({label:'Date',control:date,hint:'Supported dates: 1900–2100.'}),actionsRow(btn({label:'Calculate ISO week',icon:'calendar',onClick:run})),grid,status);
  },
  'business-day-calculator'(root) {
    const today = new Date(), nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
    const start = input({ type: 'date', value: localDateISO(today) }), end = input({ type: 'date', value: localDateISO(nextWeek) });
    const amount = input({ type: 'number', step: '1', value: '5' });
    const weekend = select({ options: [{ v: 'sat_sun', t: 'Saturday and Sunday' }, { v: 'fri_sat', t: 'Friday and Saturday' }, { v: 'sun', t: 'Sunday only' }, { v: 'none', t: 'No weekend' }], value: 'sat_sun' });
    const holidays = textarea({ rows: 3, placeholder: 'YYYY-MM-DD, one date per line (optional)' });
    const grid = statsGrid(), status = statusLine('Enter holidays manually; no holidays are automatically applied.');
    const runCount = () => { try { const r = countBusinessDays(start.value, end.value, weekend.value, holidays.value); grid.set([{ label: 'Working days (inclusive)', value: String(r.working), kind: 'good' }, { label: 'Non-working days', value: String(r.nonWorking) }, { label: 'Calendar days (inclusive)', value: String(r.calendarDays) }]); status.set('Both start and end are included. Weekend holidays are not subtracted twice. No holiday calendar is loaded automatically.', 'success'); } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    const runAdd = () => { try { if (!amount.value.trim()) throw new Error('Enter a whole number of working days.'); const result = addBusinessDays(start.value, Number(amount.value), weekend.value, holidays.value); grid.set([{ label: 'Resulting date', value: result, kind: 'good' }, { label: 'Offset (working days)', value: amount.value }]); status.set('The start date is excluded for nonzero offsets; negative values subtract. Zero returns the start date. Verify the holiday list for your region.', 'success'); } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); } };
    const invalidate = () => { grid.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); };
    root.addEventListener('input', invalidate); root.addEventListener('change', invalidate);
    root.append(h('div', { class: 'field-row' }, field({ label: 'Start date', control: start }), field({ label: 'End date (for counting)', control: end }), field({ label: 'Weekend', control: weekend }), field({ label: 'Working days to add (negative to subtract)', control: amount })), field({ label: 'Holidays (YYYY-MM-DD)', control: holidays, hint: 'Optional: separate dates with commas or new lines. No automatic holidays.' }), actionsRow(btn({ label: 'Count working days', icon: 'calendar', onClick: runCount }), btn({ label: 'Add / subtract working days', icon: 'calendar-plus', onClick: runAdd })), grid, status);
  },

  'date-difference'(root) {
    const today = new Date(), tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const start = input({ type: 'date', value: localDateISO(today) });
    const end = input({ type: 'date', value: localDateISO(tomorrow) });
    const includeEnd = switchChip({ label: 'Include the end day in the count' });
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      try {
        const r = dateDiff(start.value, end.value, includeEnd.querySelector('input').checked);
        grid.set([
          { label: r.reversed ? 'Days (end before start)' : 'Total days', value: r.totalDays.toLocaleString(), kind: 'good' },
          { label: 'Calendar', value: `${r.years}y ${r.months}m ${r.days}d` },
          { label: 'Weeks', value: `${r.weeks.toLocaleString()}w ${r.remainderDays}d` },
          { label: 'Business days', value: r.businessDays.toLocaleString() },
          { label: 'Weekend days', value: r.weekendDays.toLocaleString() },
          { label: 'Hours', value: r.hours.toLocaleString() },
        ]);
        status.set(`${r.reversed ? 'Dates were reversed; the earlier date is counted first. ' : ''}The calendar breakdown excludes the end date; the include-end switch affects day, week, weekday and hour totals only. Hours use 24 per calendar day, not DST-adjusted elapsed time.`, 'info');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    const invalidate = () => { grid.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); };
    root.addEventListener('input', invalidate); root.addEventListener('change', invalidate);
    root.append(h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Start date', control: start }),
        field({ label: 'End date', control: end })),
      h('div', { class: 'switch-row', style: 'margin-bottom:6px' }, includeEnd),
      actionsRow(btn({ label: 'Calculate difference', icon: 'calendar', onClick: run })), grid, status,
      h('p', { class: 'hint', text: 'Business days exclude Saturdays and Sundays. Public holidays are not considered.' }));
  },

  'date-add-calculator'(root) {
    const start = input({ type: 'date', value: localDateISO(new Date()) });
    const amount = input({ type: 'number', step: '1', value: '30' });
    const unit = select({ options: [{ v: 'days', t: 'Days' }, { v: 'weeks', t: 'Weeks' }, { v: 'months', t: 'Months' }, { v: 'years', t: 'Years' }], value: 'days' });
    const dir = select({ options: [{ v: 'add', t: 'Add (after)' }, { v: 'sub', t: 'Subtract (before)' }], value: 'add' });
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      try {
        const d = dateAdd(start.value, Number(amount.value), unit.value, dir.value);
        grid.set([
          { label: 'Resulting date', value: d.toLocaleDateString(undefined, { dateStyle: 'full' }), kind: 'good' },
          { label: 'ISO', value: localDateISO(d) },
          { label: 'Weekday', value: d.toLocaleDateString(undefined, { weekday: 'long' }) },
          { label: 'Unix (s)', value: String(Math.floor(d.getTime() / 1000)) },
        ]);
        status.set('Calculated ✓ — month-end dates are clamped (Jan 31 + 1 month = Feb 28/29). Unix seconds represent the start of the resulting date in your browser’s local time zone, not UTC midnight.', 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    const invalidate = () => { grid.replaceChildren(); status.set('Input changed. Calculate again.', 'info'); };
    root.addEventListener('input', invalidate); root.addEventListener('change', invalidate);
    root.append(field({ label: 'Start date', control: start }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Amount', control: amount }),
        field({ label: 'Unit', control: unit }),
        field({ label: 'Direction', control: dir })),
      actionsRow(btn({ label: 'Calculate', icon: 'calendar-plus', onClick: run })), grid, status);
  },

  'time-zone-converter'(root) {
    const now = new Date();
    const dateIn = input({ type: 'date', value: localDateISO(now) });
    const timeIn = input({ type: 'time', value: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` });
    const fromTz = select({ options: TIME_ZONES.map((tz) => ({ v: tz, t: tz })), value: Intl.DateTimeFormat().resolvedOptions().timeZone });
    const toTz = select({ options: TIME_ZONES.map((tz) => ({ v: tz, t: tz })), value: 'UTC' });
    const grid = statsGrid();
    const status = statusLine('Your browser’s timezone database is used. Missing or repeated clock-transition times must be changed to an unambiguous time.');
    const run = () => {
      try {
        const r = convertTimeZone({ dateStr: dateIn.value, timeStr: timeIn.value, fromTz: fromTz.value, toTz: toTz.value });
        grid.set([
          { label: `Source (${fromTz.value.split('/').pop().replace(/_/g, ' ')})`, value: r.from.text, kind: '' },
          { label: `Target (${toTz.value.split('/').pop().replace(/_/g, ' ')})`, value: r.to.text, kind: 'good' },
          { label: 'Source offset', value: r.from.offset },
          { label: 'Target offset', value: r.to.offset },
          { label: 'As UTC', value: r.utc },
        ]);
        status.set('Converted ✓', 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    const invalidate = () => { grid.replaceChildren(); status.set('Input changed. Convert again.', 'info'); };
    root.addEventListener('input', invalidate); root.addEventListener('change', invalidate);
    root.append(h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Date', control: dateIn }),
        field({ label: 'Time', control: timeIn }),
        field({ label: 'From zone', control: fromTz }),
        field({ label: 'To zone', control: toTz })),
      actionsRow(btn({ label: 'Convert', icon: 'globe', onClick: run }),
        btn({ label: 'Now', variant: 'secondary', onClick: () => {
          try {
            const nowInSource = wallTimeAt(fromTz.value);
            dateIn.value = nowInSource.date;
            timeIn.value = nowInSource.time;
            run();
          } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
        } })),
      grid, status, h('p', { class: 'hint', text: 'Now uses the selected source time zone and rounds down to the minute. Time-zone rules depend on your browser’s database.' }));
    run();
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { dateDiff, dateAdd, convertTimeZone, zoneOffset, TIME_ZONES, wallTimeAt, countBusinessDays, addBusinessDays, parseCalendarDate, localDateISO };
