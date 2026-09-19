// =============================================================================
// iHaveTools — Date & Time tools: date-difference, date-add-calculator,
// time-zone-converter (uses the browser's built-in IANA tz database via Intl)
// =============================================================================
import { h, field, input, select, switchChip, btn, actionsRow, statusLine, statsGrid, toast, mountTool } from '../ui.js';

export function dateDiff(startStr, endStr, includeEnd = false) {
  const parse = (s, label) => {
    const d = new Date(`${s}T00:00:00`);
    if (Number.isNaN(d.getTime())) throw new Error(`The ${label} date is invalid — pick it again.`);
    return d;
  };
  const a = parse(startStr, 'start'), b = parse(endStr, 'end');
  const [first, second] = a <= b ? [a, b] : [b, a];
  const totalDays = Math.round((second - first) / 864e5) + (includeEnd ? 1 : 0);
  // calendar difference (years/months/days) counted forward from first date
  let years = second.getFullYear() - first.getFullYear();
  let months = second.getMonth() - first.getMonth();
  let days = second.getDate() - first.getDate();
  if (days < 0) { months--; days += new Date(second.getFullYear(), second.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  let businessDays = 0;
  const cur = new Date(first);
  for (let k = 0; k < totalDays; k++) {
    const wd = cur.getDay();
    if (wd !== 0 && wd !== 6) businessDays++;
    cur.setDate(cur.getDate() + 1);
  }
  const weekendDays = totalDays - businessDays;
  return {
    totalDays, years, months, days, businessDays, weekendDays,
    weeks: Math.floor(totalDays / 7), remainderDays: totalDays % 7,
    hours: totalDays * 24, minutes: totalDays * 1440,
    reversed: a > b,
  };
}

export function dateAdd(startStr, amount, unit, direction) {
  const d = new Date(`${startStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error('That start date is invalid — pick it again.');
  const sign = direction === 'sub' ? -1 : 1;
  const n = amount * sign;
  if (!Number.isFinite(amount) || amount === 0) throw new Error('Enter a non-zero amount.');
  switch (unit) {
    case 'days': d.setDate(d.getDate() + n); break;
    case 'weeks': d.setDate(d.getDate() + n * 7); break;
    case 'months': {
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, maxDay));
      break;
    }
    case 'years': {
      const day = d.getDate();
      d.setFullYear(d.getFullYear() + n);
      if (d.getDate() !== day) d.setDate(0); // Feb 29 → Feb 28
      break;
    }
    default: throw new Error('Unknown unit.');
  }
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
  // interpret the wall time in fromTz
  const naive = Date.parse(`${dateStr}T${timeStr}:00Z`);
  if (Number.isNaN(naive)) throw new Error('That date/time could not be parsed.');
  let ts = naive - zoneOffset(fromTz, new Date(naive)) * 6e4;
  ts = naive - zoneOffset(fromTz, new Date(ts)) * 6e4; // second pass handles DST edges
  const d = new Date(ts);
  const fmt = (tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(d);
  const off = (tz) => {
    const mins = zoneOffset(tz, d);
    const sign = mins < 0 ? '-' : '+';
    const abs = Math.abs(mins);
    return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  };
  return { from: { text: fmt(fromTz), offset: off(fromTz) }, to: { text: fmt(toTz), offset: off(toTz) }, utc: `${d.toISOString().slice(0, 16)} UTC` };
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
  'date-difference'(root) {
    const start = input({ type: 'date', value: new Date().toISOString().slice(0, 10) });
    const end = input({ type: 'date', value: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
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
          { label: 'Hours', value: (r.hours * (includeEnd.querySelector('input').checked ? 24 : 24)).toLocaleString() },
        ]);
        status.set(r.reversed ? 'Note: the end date is before the start date — the count is shown as a magnitude.' : 'Calculated ✓', 'info');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Start date', control: start }),
        field({ label: 'End date', control: end })),
      h('div', { class: 'switch-row', style: 'margin-bottom:6px' }, includeEnd),
      actionsRow(btn({ label: 'Calculate difference', icon: 'calendar', onClick: run })), grid, status,
      h('p', { class: 'hint', text: 'Business days exclude Saturdays and Sundays. Public holidays are not considered.' }));
  },

  'date-add-calculator'(root) {
    const start = input({ type: 'date', value: new Date().toISOString().slice(0, 10) });
    const amount = input({ type: 'number', step: '1', value: '30' });
    const unit = select({ options: [{ v: 'days', t: 'Days' }, { v: 'weeks', t: 'Weeks' }, { v: 'months', t: 'Months' }, { v: 'years', t: 'Years' }], value: 'days' });
    const dir = select({ options: [{ v: 'add', t: 'Add (after)' }, { v: 'sub', t: 'Subtract (before)' }], value: 'add' });
    const grid = statsGrid();
    const status = statusLine('');
    const run = () => {
      try {
        const d = dateAdd(start.value, Math.abs(Number(amount.value) || 0), unit.value, dir.value);
        grid.set([
          { label: 'Resulting date', value: d.toLocaleDateString(undefined, { dateStyle: 'full' }), kind: 'good' },
          { label: 'ISO', value: d.toISOString().slice(0, 10) },
          { label: 'Weekday', value: d.toLocaleDateString(undefined, { weekday: 'long' }) },
          { label: 'Unix (s)', value: String(Math.floor(d.getTime() / 1000)) },
        ]);
        status.set('Calculated ✓ — month-end dates are clamped to the last valid day (Jan 31 + 1 month = Feb 28/29).', 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'Start date', control: start }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Amount', control: amount }),
        field({ label: 'Unit', control: unit }),
        field({ label: 'Direction', control: dir })),
      actionsRow(btn({ label: 'Calculate', icon: 'calendar-plus', onClick: run })), grid, status);
  },

  'time-zone-converter'(root) {
    const now = new Date();
    const dateIn = input({ type: 'date', value: now.toISOString().slice(0, 10) });
    const timeIn = input({ type: 'time', value: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` });
    const fromTz = select({ options: TIME_ZONES.map((tz) => ({ v: tz, t: tz })), value: Intl.DateTimeFormat().resolvedOptions().timeZone });
    const toTz = select({ options: TIME_ZONES.map((tz) => ({ v: tz, t: tz })), value: 'UTC' });
    const grid = statsGrid();
    const status = statusLine('Daylight-saving time is handled automatically by your browser’s timezone database.');
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
    root.append(h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Date', control: dateIn }),
        field({ label: 'Time', control: timeIn }),
        field({ label: 'From zone', control: fromTz }),
        field({ label: 'To zone', control: toTz })),
      actionsRow(btn({ label: 'Convert', icon: 'globe', onClick: run }),
        btn({ label: 'Now', variant: 'secondary', onClick: () => {
          const n = new Date();
          dateIn.value = n.toISOString().slice(0, 10);
          timeIn.value = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
          run();
        } })),
      grid, status);
    run();
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { dateDiff, dateAdd, convertTimeZone, zoneOffset, TIME_ZONES };
