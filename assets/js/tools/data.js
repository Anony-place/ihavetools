// =============================================================================
// iHaveTools — Data tools: csv-to-json, json-to-csv, json-lines-converter
// Includes an RFC 4180-compliant CSV parser (quotes, escaped quotes,
// embedded commas/newlines) — no naive splitting.
// =============================================================================
import { h, field, input, textarea, select, switchChip, btn, actionsRow, resultPanel, statusLine, statsGrid, table, toast, readFile, mountTool } from '../ui.js';

/* ═══════════════════════════ RFC 4180 CSV parser ═══════════════════════════ */
export function parseCsv(text, { delimiter = ',', headerRow = true } = {}) {
  const rows = [];
  let row = [];
  let fieldBuf = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  const endField = () => { row.push(fieldBuf); fieldBuf = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };
  if (!text.trim()) throw new Error('Paste some CSV text first.');
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { fieldBuf += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      fieldBuf += c; i++; continue;
    }
    if (c === '"') {
      if (fieldBuf === '') { inQuotes = true; i++; continue; }
      throw new Error(`Unexpected double quote at position ${i + 1} — quotes are only valid at the start of a field.`);
    }
    if (c === delimiter) { endField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { endRow(); i++; continue; }
    fieldBuf += c; i++;
  }
  if (inQuotes) throw new Error('A quoted field was left open — check for a missing closing double quote.');
  if (fieldBuf !== '' || row.length) endRow();
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  if (!rows.length) throw new Error('No rows found in the CSV input.');
  const width = Math.max(...rows.map((r) => r.length));
  const ragged = rows.filter((r) => r.length !== width).length;
  if (ragged) throw new Error(`${ragged} row${ragged === 1 ? ' has' : 's have'} a different number of columns than the widest row (${width}). Check for missing delimiters.`);
  if (!headerRow) return { headers: rows[0].map((_, k) => `column_${k + 1}`), rows };
  return { headers: rows[0].map((hd, k) => hd.trim() || `column_${k + 1}`), rows: rows.slice(1) };
}

export function csvToJson(text, opts = {}) {
  const { headers, rows } = parseCsv(text, opts);
  return rows.map((r) => Object.fromEntries(headers.map((hd, k) => [hd, coerce(r[k] ?? '')])));
}
function coerce(v) {
  if (v === '') return '';
  const t = v.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t) && t.length < 16) return Number(t);
  return v;
}
export function csvToJsonString(text, opts = {}) { return JSON.stringify(csvToJson(text, opts), null, 2); }

/* ═══════════════════════════ JSON → CSV ═══════════════════════════ */
export function jsonToCsv(jsonText, { delimiter = ',', columns = null, includeHeader = true } = {}) {
  let data;
  try { data = JSON.parse(jsonText); }
  catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
  if (!Array.isArray(data)) throw new Error('The JSON must be an array of objects — wrap single objects in an array.');
  if (!data.length) throw new Error('The array is empty — there is nothing to convert.');
  const objs = data.map((row, i) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Row ${i + 1} is not an object. Flatten nested structures first.`);
    return row;
  });
  let headers = columns && columns.length ? columns : [...new Set(objs.flatMap((o) => Object.keys(o)))];
  if (!headers.length) throw new Error('No columns found — the objects have no keys.');
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (s.includes('"') || s.includes(delimiter) || /[\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [];
  if (includeHeader) lines.push(headers.map(cell).join(delimiter));
  for (const o of objs) lines.push(headers.map((hd) => cell(o[hd])).join(delimiter));
  return lines.join('\n');
}

/* ═══════════════════════════ JSON Lines ═══════════════════════════ */
export function jsonlToJsonArray(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Paste some JSON Lines first.');
  const out = [];
  const errors = [];
  lines.forEach((line, idx) => {
    try { out.push(JSON.parse(line)); }
    catch (e) { errors.push({ line: idx + 1, message: e.message }); }
  });
  if (errors.length) {
    const e = new Error(`${errors.length} line${errors.length === 1 ? '' : 's'} could not be parsed — first problem on line ${errors[0].line}: ${errors[0].message}`);
    e.lineErrors = errors.slice(0, 5);
    throw e;
  }
  return out;
}
export function jsonArrayToJsonl(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
  if (!Array.isArray(data)) throw new Error('The JSON must be an array — JSON Lines is one value per line, so an array converts to multiple lines.');
  return data.map((o) => JSON.stringify(o)).join('\n') + '\n';
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'csv-to-json'(root) {
    const inp = textarea({ rows: 10, value: 'name,role,city\nAda,engineer,"London"\nGrace,"Admiral, USN","New York"', placeholder: 'Paste CSV…' });
    const delim = select({ options: [{ v: ',', t: 'Comma ,' }, { v: ';', t: 'Semicolon ;' }, { v: '\t', t: 'Tab' }, { v: '|', t: 'Pipe |' }], value: ',' });
    const header = switchChip({ label: 'First row is a header', checked: true });
    const status = statusLine('Quoted fields, escaped quotes ("") and multi-line values are all handled.');
    const out = resultPanel({ label: 'JSON', download: true, downloadName: 'data.json', downloadMime: 'application/json;charset=utf-8' });
    const zoneWrap = h('div', {});
    const run = () => {
      try {
        const json = csvToJsonString(inp.value, { delimiter: delim.value, headerRow: header.querySelector('input').checked });
        out.set(json);
        const rows = JSON.parse(json).length;
        status.set(`${rows} record${rows === 1 ? '' : 's'} converted ✓`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'CSV input', control: inp }),
      zoneWrap,
      h('div', { class: 'field-row', style: 'align-items:end;margin-top:12px' },
        field({ label: 'Delimiter', control: delim }),
        field({ label: 'Options', control: header })),
      actionsRow(btn({ label: 'Convert to JSON', icon: 'table', onClick: run })),
      status, h('br'), out.panel);
    import('../ui.js').then(({ dropzone }) => {
      zoneWrap.append(dropzone({
        accept: '.csv,text/csv,text/plain', title: '…or drop a .csv file', sub: 'Read locally — never uploaded',
        onFiles: async (files) => {
          try { inp.value = await readFile(files[0], 'text'); run(); }
          catch (e) { status.set(e.message, 'error'); }
        },
      }));
    });
  },

  'json-to-csv'(root) {
    const inp = textarea({ rows: 10, value: '[{"name":"Ada","role":"engineer","city":"London"},{"name":"Grace","role":"Admiral, USN","city":"New York"}]', placeholder: 'Paste a JSON array of objects…' });
    const delim = select({ options: [{ v: ',', t: 'Comma ,' }, { v: ';', t: 'Semicolon ;' }, { v: '\t', t: 'Tab' }], value: ',' });
    const cols = input({ type: 'text', placeholder: 'e.g. name, city (blank = all columns)' });
    const status = statusLine('Values containing delimiters, quotes or newlines are escaped correctly.');
    const out = resultPanel({ label: 'CSV', download: true, downloadName: 'data.csv', downloadMime: 'text/csv;charset=utf-8' });
    const run = () => {
      try {
        const csv = jsonToCsv(inp.value, {
          delimiter: delim.value,
          columns: cols.value.split(',').map((s) => s.trim()).filter(Boolean),
        });
        out.set(csv);
        status.set(`${csv.split('\n').length - 1} data rows written ✓`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'JSON array', control: inp }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Delimiter', control: delim }),
        field({ label: 'Columns', control: cols, hint: 'Optional — order included columns' })),
      actionsRow(btn({ label: 'Convert to CSV', icon: 'table', onClick: run })),
      status, h('br'), out.panel);
  },

  'json-lines-converter'(root) {
    const inp = textarea({ rows: 10, value: '{"name":"Ada","year":1815}\n{"name":"Grace","year":1906}', placeholder: 'Paste JSON or JSON Lines…' });
    const status = statusLine('JSONL is one JSON value per line — the format of choice for logs and streaming data.');
    const out = resultPanel({ label: 'Result', download: true, downloadName: 'converted.txt' });
    const runTo = (dir) => {
      try {
        if (dir === 'to-jsonl') {
          out.set(jsonArrayToJsonl(inp.value), );
          out.panel.querySelector('.result-body pre').style.whiteSpace = 'pre';
          status.set('Array → JSON Lines ✓', 'success');
        } else {
          out.panel.querySelector('.result-body pre').style.whiteSpace = 'pre-wrap';
          const arr = jsonlToJsonArray(inp.value);
          out.set(JSON.stringify(arr, null, 2));
          status.set(`${arr.length} records parsed ✓`, 'success');
        }
      } catch (e) {
        out.placeholder();
        status.set(e.message, 'error');
        if (e.lineErrors) out.set(h('div', {}, e.lineErrors.map((le) => h('p', { class: 'status-line error', text: `Line ${le.line}: ${le.message}` }))));
      }
    };
    root.append(field({ label: 'Input (JSON array or JSON Lines)', control: inp }),
      actionsRow(
        btn({ label: 'Array → JSONL', icon: 'brackets', onClick: () => runTo('to-jsonl') }),
        btn({ label: 'JSONL → Array', variant: 'secondary', icon: 'braces', onClick: () => runTo('to-json') })),
      status, h('br'), out.panel);
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { parseCsv, csvToJson, jsonToCsv, jsonlToJsonArray, jsonArrayToJsonl };
