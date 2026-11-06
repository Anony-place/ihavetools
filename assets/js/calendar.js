// Date-only Gregorian arithmetic uses UTC so elapsed clock offsets/DST do not
// change a calendar day. Input limits deliberately bound every public tool.
export const DAY_MS = 86400000;
export function parseCalendarDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Use a valid date in YYYY-MM-DD format.');
  const year = Number(text.slice(0,4));
  if (year < 1900 || year > 2100) throw new Error('Dates must be between 1900 and 2100.');
  const time = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0,10) !== text) throw new Error(`Invalid date: ${text}.`);
  return time;
}
export const dateISO = (day) => new Date(day).toISOString().slice(0,10);
export const localDateISO = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function addMonthsUTC(day, count) {
  const d=new Date(day), target=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+count,1));
  const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(),last)); return target.getTime();
}
// Complete years first, then months from that anniversary, then calendar days.
export function calendarSpan(first, last) {
  if (first > last) throw new Error('Start date must be on or before end date.');
  const a=new Date(first), b=new Date(last); let years=b.getUTCFullYear()-a.getUTCFullYear();
  if (addMonthsUTC(first, years*12)>last) years--;
  const anniversary=addMonthsUTC(first, years*12); let months=0;
  while (months < 11 && addMonthsUTC(anniversary, months+1) <= last) months++;
  return {years, months, days: (last-addMonthsUTC(anniversary,months))/DAY_MS};
}
export function isoWeek(text) {
  const day=parseCalendarDate(text), weekday=(new Date(day).getUTCDay()+6)%7;
  const monday=day-weekday*DAY_MS, thursday=monday+3*DAY_MS, weekYear=new Date(thursday).getUTCFullYear();
  const jan4=Date.UTC(weekYear,0,4), firstMonday=jan4-((new Date(jan4).getUTCDay()+6)%7)*DAY_MS;
  return {year:weekYear,week:(monday-firstMonday)/DAY_MS/7+1,weekday:weekday+1,monday:dateISO(monday),sunday:dateISO(monday+6*DAY_MS)};
}
