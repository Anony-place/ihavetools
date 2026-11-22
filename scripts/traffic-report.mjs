#!/usr/bin/env node
// Local, read-only comparison of two GSC Pages CSV exports. Never uploads data.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseCsv } from '../assets/js/tools/data.js';

const DAY = 86400000;
function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date: ${value}. Use YYYY-MM-DD.`);
  const n = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,10) !== value) throw new Error(`Invalid calendar date: ${value}.`);
  return n;
}
export function validateWindows(recent, previous, asOf) {
  const parseWindow = s => {
    const parts = String(s).split(':');
    if (parts.length !== 2) throw new Error('Windows must be START:END, with inclusive YYYY-MM-DD dates.');
    const [start,end] = parts.map(date);
    if (end < start) throw new Error('Window end must not precede its start.');
    return {start,end,days:(end-start)/DAY+1};
  };
  const a=parseWindow(recent), b=parseWindow(previous), now=date(asOf);
  if (a.end > now || b.end > now) throw new Error('A window ends after the stated as-of date; reconcile the export dates first.');
  if (b.end >= a.start) throw new Error('Previous window must end before the recent window starts.');
  if (a.days !== b.days) throw new Error('Windows must have equal length.');
  return {recent:a, previous:b};
}
function integer(text, label) {
  const s=String(text).trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s)) throw new Error(`Invalid ${label}: ${s}. Use non-negative whole numbers in English CSV format.`);
  const n=Number(s.replace(/,/g,''));
  if (!Number.isSafeInteger(n)) throw new Error(`${label} exceeds safe integer limits.`);
  return n;
}
export function parsePages(text, origin) {
  const parsed=parseCsv(text), required=['Top pages','Clicks','Impressions','Position'];
  for (const key of required) if (!parsed.headers.includes(key)) throw new Error(`Missing ${key} column. Export the English Search Console Pages table as CSV.`);
  const ix=Object.fromEntries(required.map(k=>[k,parsed.headers.indexOf(k)])), entries=new Map();
  const expected=new URL(origin);
  if (!['http:','https:'].includes(expected.protocol) || expected.username || expected.password || expected.pathname !== '/' || expected.search || expected.hash) throw new Error('Origin must be a plain HTTP(S) origin.');
  for (const [index,row] of parsed.rows.entries()) {
    let url; try {url=new URL(row[ix['Top pages']]);}catch{throw new Error(`Row ${index+2} has an invalid page URL.`);}
    if(url.origin!==expected.origin || url.username || url.password || url.search || url.hash) throw new Error(`Row ${index+2}: page must use the chosen origin without query or fragment; filter or investigate it manually.`);
    const key=url.href;
    if(entries.has(key)) throw new Error(`Duplicate page URL on row ${index+2}.`);
    const clicks=integer(row[ix.Clicks], 'clicks'), impressions=integer(row[ix.Impressions], 'impressions');
    if(clicks>impressions) throw new Error(`Row ${index+2}: clicks cannot exceed impressions.`);
    const p=row[ix.Position].trim();
    if(p && (!/^\d+(?:\.\d+)?$/.test(p) || !Number.isFinite(Number(p)) || Number(p)<1)) throw new Error(`Row ${index+2}: invalid position.`);
    entries.set(key,{url:key,clicks,impressions,position:p?Number(p):null});
  }
  return entries;
}
export function comparePages(recent, previous) {
  return [...recent.values()].map(now=>({now,before:previous.get(now.url) ?? null})).sort((a,b)=>b.now.impressions-a.now.impressions || a.now.url.localeCompare(b.now.url));
}
const fmtPos = n => n === null ? '—' : String(n);
const ctr = r => r.impressions ? (100*r.clicks/r.impressions).toFixed(2)+'%' : '—';
const safe = s => String(s).replace(/[\r\n|`]/g, ' ');
export function report(recentCsv, previousCsv, recentWindow, previousWindow, asOf, origin) {
  validateWindows(recentWindow,previousWindow,asOf);
  const rows=comparePages(parsePages(recentCsv,origin),parsePages(previousCsv,origin));
  const lines=[`# Search Console page comparison`,``,`Recent: ${recentWindow}; previous: ${previousWindow}; as-of: ${asOf}.`,`Origin: ${safe(new URL(origin).origin)}. Filters, completeness and dates are user-supplied, not independently verified.`,`Only recent-export rows are listed, sorted by recent impressions. Missing prior rows are unknown, not zero; exports can omit or truncate data. CTR is calculated from each row's clicks/impressions; position is Google's aggregate, not a fixed ranking. No site totals or query-to-page attribution are inferred.`,``,`| Page | Recent clicks / impressions / CTR / position | Previous clicks / impressions / CTR / position |`,`|---|---|---|`];
  for(const {now,before} of rows){const cells=r=>`${r.clicks} / ${r.impressions} / ${ctr(r)} / ${fmtPos(r.position)}`;lines.push(`| ${safe(now.url)} | ${cells(now)} | ${before?cells(before):'Not in export (unknown)'} |`);}
  if (!rows.length) lines.push('| No page rows in the recent export | — | — |');
  return lines.join('\n')+'\n';
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args=process.argv.slice(2);
    if(args.length!==6) throw new Error('Usage: node scripts/traffic-report.mjs RECENT.csv PREVIOUS.csv RECENT_START:END PREVIOUS_START:END AS_OF ORIGIN');
    const [current,previous,recentWindow,previousWindow,asOf,origin]=args;
    process.stdout.write(report(readFileSync(current,'utf8'),readFileSync(previous,'utf8'),recentWindow,previousWindow,asOf,origin));
  } catch(e) {console.error(`Traffic report: ${e.message}`);process.exitCode=1;}
}
