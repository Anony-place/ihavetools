// =============================================================================
// iHaveTools — Data tools: csv-to-json, json-to-csv, json-lines-converter
// Includes an RFC 4180-compliant CSV parser (quotes, escaped quotes,
// embedded commas/newlines) — no naive splitting.
// =============================================================================
import { parseConversionJson } from './developer.js';
import { h, field, input, textarea, select, switchChip, btn, actionsRow, resultPanel, statusLine, statsGrid, table, toast, readFile, dropzone, downloadBlob, mountTool } from '../ui.js';

// Bounds apply to pasted input as well as uploaded text. They are deliberately
// independent of file size because small sparse inputs can expand dramatically.
const MAX_TEXT = 1_000_000, MAX_ROWS = 10_000, MAX_COLUMNS = 256, MAX_CELLS = 250_000, MAX_OUTPUT = 10_000_000;

/* ═══════════════════════════ RFC 4180 CSV parser ═══════════════════════════ */
export function parseCsv(text, { delimiter = ',', headerRow = true } = {}) {
  if (text.length > MAX_TEXT) throw new Error('CSV input exceeds 1,000,000 characters.');
  if (text.startsWith('\uFEFF')) text = text.slice(1); // UTF-8 BOM, not a header character
  const rows = [];
  let row = [];
  let fieldBuf = '';
  let inQuotes = false, closedQuote = false;
  let i = 0, cells = 0;
  const n = text.length;
  const endField = () => {
    if (row.length >= MAX_COLUMNS || ++cells > MAX_CELLS) throw new Error('CSV exceeds the limit of 256 columns or 250,000 cells.');
    row.push(fieldBuf); fieldBuf = ''; closedQuote = false;
  };
  const endRow = () => {
    if (rows.length >= MAX_ROWS) throw new Error('CSV exceeds the limit of 10,000 rows, including the header.');
    endField(); rows.push(row); row = [];
  };
  if (!text.length) throw new Error('Paste some CSV text first.');
  if (![';', ',', '\t', '|'].includes(delimiter)) throw new Error('Choose a valid delimiter.');
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { fieldBuf += '"'; i += 2; continue; }
        inQuotes = false; closedQuote = true; i++; continue;
      }
      fieldBuf += c; i++; continue;
    }
    if (closedQuote && c !== delimiter && c !== '\r' && c !== '\n') throw new Error(`Unexpected character after closing quote at position ${i + 1}.`);
    if (c === '"') {
      if (fieldBuf === '' && !closedQuote) { inQuotes = true; i++; continue; }
      throw new Error(`Unexpected double quote at position ${i + 1} — quotes are only valid at the start of a field.`);
    }
    if (c === delimiter) { endField(); i++; continue; }
    if (c === '\r' || c === '\n') { endRow(); if (c === '\r' && text[i + 1] === '\n') i++; i++; continue; }
    fieldBuf += c; i++;
  }
  if (inQuotes) throw new Error('A quoted field was left open — check for a missing closing double quote.');
  if (fieldBuf !== '' || row.length || closedQuote) endRow();
  if (!rows.length) throw new Error('No rows found in the CSV input.');
  const width = rows.reduce((max,r) => Math.max(max,r.length), 0);
  const ragged = rows.filter((r) => r.length !== width).length;
  if (ragged) throw new Error(`${ragged} row${ragged === 1 ? ' has' : 's have'} a different number of columns than the widest row (${width}). Check for missing delimiters.`);
  if (!headerRow) return { headers: rows[0].map((_, k) => `column_${k + 1}`), rows };
  const headers = rows[0].map((hd, k) => hd === '' ? `column_${k + 1}` : hd);
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate column headers would overwrite data. Give every column a unique header.');
  return { headers, rows: rows.slice(1) };
}

export function csvToJson(text, opts = {}) {
  const { headers, rows } = parseCsv(text, opts);
  // Estimate pretty JSON size before multiplying long header names across rows.
  const keySizes = headers.map(h => JSON.stringify(h).length);
  let estimate = 2;
  for (const row of rows) {
    estimate += 8;
    for (let i = 0; i < headers.length; i++) {
      estimate += keySizes[i] + JSON.stringify(opts.coerceTypes ? coerce(row[i]) : row[i]).length + 10;
      if (estimate > MAX_OUTPUT) throw new Error('Converted JSON would exceed the 10,000,000 character output limit.');
    }
  }
  return rows.map((r) => Object.fromEntries(headers.map((hd, k) => [hd, opts.coerceTypes ? coerce(r[k] ?? '') : (r[k] ?? '')])));
}
function coerce(v) {
  if (v === '') return '';
  const t = v.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t) && t.length < 16) {
    const n = Number(t), significand = t.split(/[eE]/)[0];
    if (Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n)) && !(n === 0 && /[1-9]/.test(significand)) && !Object.is(n, -0)) return n;
  }
  return v;
}
export function csvToJsonString(text, opts = {}) { return JSON.stringify(csvToJson(text, opts), null, 2); }

/* ═══════════════════════════ JSON → CSV ═══════════════════════════ */
// Comma mode is the original convenience syntax. JSON mode preserves exact
// keys including commas, surrounding spaces and the empty string.
export function parseCsvColumns(text, mode = 'simple') {
  if (text.length > 100000) throw new Error('Column list exceeds 100,000 characters.');
  if (!['simple', 'json'].includes(mode)) throw new Error('Choose a valid column-list format.');
  if (!text.trim()) return null;
  let columns;
  if (mode === 'simple') columns = text.split(',').map(s => s.trim()).filter(Boolean);
  else {
    try { columns = JSON.parse(text); }
    catch { throw new Error('Columns must be a JSON array of strings, such as ["name, full"," id "].'); }
    if (!Array.isArray(columns) || columns.some(c => typeof c !== 'string')) throw new Error('Columns must be a JSON array of strings.');
  }
  if (columns.length > MAX_COLUMNS) throw new Error('Choose at most 256 columns.');
  if (new Set(columns).size !== columns.length) throw new Error('Duplicate selected columns would repeat data. Choose unique columns.');
  return columns.length ? columns : null;
}

export function jsonToCsv(jsonText, { delimiter = ',', columns = null, includeHeader = true } = {}) {
  if (![';', ',', '\t', '|'].includes(delimiter)) throw new Error('Choose a valid delimiter.');
  const data = parseConversionJson(jsonText);
  if (!Array.isArray(data)) throw new Error('The JSON must be an array of objects — wrap single objects in an array.');
  if (!data.length) throw new Error('The array is empty — there is nothing to convert.');
  if (data.length > MAX_ROWS) throw new Error('JSON array exceeds the limit of 10,000 rows.');
  const objs = data.map((row, i) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Row ${i + 1} is not an object. Flatten nested structures first.`);
    return row;
  });
  let headers = columns && columns.length ? columns : [...new Set(objs.flatMap((o) => Object.keys(o)))];
  if (headers.length > MAX_COLUMNS || headers.length * objs.length > MAX_CELLS) throw new Error('CSV output exceeds the limit of 256 columns or 250,000 cells.');
  if (!headers.length) throw new Error('No columns found — the objects have no keys.');
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate selected columns would repeat data. Choose unique columns.');
  const cell = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (s.includes('"') || s.includes(delimiter) || /[\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  // Quote a single empty field so a one-column empty record is not confused
  // with a missing/trailing line, especially when the header is omitted.
  const line = values => values.map(cell).join(delimiter) || '""';
  const lines = [];
  if (includeHeader) lines.push(line(headers));
  for (const o of objs) lines.push(line(headers.map((hd) => Object.hasOwn(o, hd) ? o[hd] : undefined)));
  return lines.join('\n');
}

/* ═══════════════════════════ JSON Lines ═══════════════════════════ */
export function jsonlToJsonArray(text) {
  if (text.length > MAX_TEXT) throw new Error('JSON Lines input exceeds 1,000,000 characters.');
  const lines = text.split(/\r?\n/);
  if (lines.length > MAX_ROWS + 1 || (lines.length === MAX_ROWS + 1 && lines.at(-1) !== '')) throw new Error('JSON Lines input exceeds 10,000 lines.');
  if (!lines.some(l => l.trim())) throw new Error('Paste some JSON Lines first.');
  const out = [];
  const errors = [];
  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    try { out.push(parseConversionJson(line)); }
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
  const data = parseConversionJson(text);
  if (!Array.isArray(data)) throw new Error('The JSON must be an array — JSON Lines is one value per line, so an array converts to multiple lines.');
  if (!data.length) throw new Error('An empty array has no JSON Lines records to output.');
  if (data.length > MAX_ROWS) throw new Error('JSON array exceeds 10,000 records.');
  return data.map((o) => JSON.stringify(o)).join('\n') + '\n';
}

// Bound formatted output before JSON.stringify allocates indentation. Inputs have
// already passed depth and size checks; this prevents many deep JSONL records
// from expanding into an unexpectedly huge pretty-printed result.
export function prettyJsonBounded(value) {
  const stack = [{ value, depth: 0 }];
  let estimate = 2;
  while (stack.length) {
    const item = stack.pop(), v = item.value;
    estimate += item.depth * 2 + 8;
    if (v && typeof v === 'object') {
      if (Array.isArray(v)) {
        for (const entry of v) stack.push({ value: entry, depth: item.depth + 1 });
      } else {
        for (const [key, entry] of Object.entries(v)) {
          estimate += JSON.stringify(key).length + 4;
          stack.push({ value: entry, depth: item.depth + 1 });
        }
      }
    } else estimate += JSON.stringify(v).length;
    if (estimate > MAX_OUTPUT) throw new Error('Formatted JSON would exceed the 10,000,000 character output limit.');
  }
  return JSON.stringify(value, null, 2);
}

// Import is intentionally separate from conversion: JSONL has two directions.
// A revision invalidates pending reads when users edit, change options or leave.
function localDataImport({ inp, out, status, revision, accept, title, extensions }) {
  const zone = dropzone({ accept, title, sub: 'UTF-8 text only, up to 4 MiB and 1,000,000 characters. Read locally.',
    onReject: () => { revision.value++; zone.clear(); out.placeholder(); status.set('Selection rejected. Existing input was kept; choose a file up to 4 MiB.', 'error'); },
    onFiles: async files => {
      zone.clear(); const token = ++revision.value; out.placeholder();
      try {
        const file = files[0];
        if (!file || !extensions.test(file.name)) throw new Error('Choose a supported text file.');
        if (file.size > 4 * 1024 * 1024) throw new Error('File exceeds 4 MiB.');
        status.set('Reading file locally…', 'info');
        const bytes = await readFile(file, 'buffer');
        if (token !== revision.value) return;
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('File is not valid UTF-8 text.'); }
        if (text.length > MAX_TEXT) throw new Error('File exceeds 1,000,000 characters.');
        inp.value = text; status.set('File loaded locally. Choose a conversion action.', 'success');
      } catch (e) { if (token === revision.value) { out.placeholder(); status.set(`${e.message} Existing input was kept.`, 'error'); } }
    } });
  return zone;
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'csv-to-json'(root) {
    const inp = textarea({ rows: 10, value: 'name,role,city\nAda,engineer,"London"\nGrace,"Admiral, USN","New York"', placeholder: 'Paste CSV…' });
    const delim = select({ options: [{ v: ',', t: 'Comma ,' }, { v: ';', t: 'Semicolon ;' }, { v: '\t', t: 'Tab' }, { v: '|', t: 'Pipe |' }], value: ',' });
    const header = switchChip({ label: 'First row is a header', checked: true });
    const coerceTypes = switchChip({ label: 'Infer basic types (may change values)', checked: false });
    const status = statusLine('Quoted fields, escaped quotes ("") and multi-line values are all handled.');
    const out = resultPanel({ label: 'JSON', download: true, downloadName: 'data.json', downloadMime: 'application/json;charset=utf-8' });
    const zoneWrap = h('div', {});
    let revision = 0;
    window.addEventListener('pagehide', () => { revision++; });
    const invalidate = () => { revision++; out.placeholder(); status.set('Input or options changed. Convert again.', 'info'); };
    [inp, delim, header, coerceTypes].forEach(el => { el.addEventListener('input', invalidate); el.addEventListener('change', invalidate); });
    const run = () => {
      revision++;
      try {
        const json = csvToJsonString(inp.value, { delimiter: delim.value, headerRow: header.querySelector('input').checked, coerceTypes: coerceTypes.querySelector('input').checked });
        out.set(json);
        const rows = JSON.parse(json).length;
        status.set(`${rows} record${rows === 1 ? '' : 's'} converted ✓`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'CSV input', control: inp }),
      zoneWrap,
      h('div', { class: 'field-row', style: 'align-items:end;margin-top:12px' },
        field({ label: 'Delimiter', control: delim }),
        field({ label: 'Options', control: header }),
        field({ label: 'Value types', control: coerceTypes, hint: 'Default preserves all CSV values as text, including leading zeroes.' })),
      actionsRow(btn({ label: 'Convert to JSON', icon: 'table', onClick: run })),
      status, h('p', { class: 'hint', text: 'Blank headers get generated names. Header whitespace is preserved; a leading UTF-8 BOM is removed. Type inference can round decimals and change text. CSV text is limited to 1,000,000 characters, 10,000 rows, 256 columns and 250,000 cells; uploads to 10 MiB.' }), h('br'), out.panel);
    import('../ui.js').then(({ dropzone }) => {
      const zone = dropzone({
        accept: '.csv,text/csv,text/plain', title: '…or drop a .csv file', sub: 'Read locally — never uploaded',
        onReject: () => { revision++; zone.clear(); out.placeholder(); status.set('Selection rejected. Existing CSV input was kept; choose a file no larger than 10 MiB.', 'error'); },
        onFiles: async (files) => {
          zone.clear();
          const token = ++revision; out.placeholder();
          try {
            if (files[0].size > 10 * 1024 * 1024) throw new Error('Choose a CSV file no larger than 10 MiB.');
            status.set('Reading CSV locally…', 'info');
            const text = await readFile(files[0], 'text');
            if (token !== revision) return;
            inp.value = text; run();
          } catch (e) { if (token === revision) { out.placeholder(); status.set(`${e.message} Existing CSV input was kept.`, 'error'); } }
        },
      });
      zoneWrap.append(zone);
    });
  },

  'json-to-csv'(root) {
    const inp = textarea({ rows: 10, value: '[{"name":"Ada","role":"engineer","city":"London"},{"name":"Grace","role":"Admiral, USN","city":"New York"}]', placeholder: 'Paste a JSON array of objects…' });
    const delim = select({ options: [{ v: ',', t: 'Comma ,' }, { v: ';', t: 'Semicolon ;' }, { v: '\t', t: 'Tab' }, { v: '|', t: 'Pipe |' }], value: ',' });
    const cols = input({ type: 'text', placeholder: 'e.g. name, city (blank = all columns)' });
    const colMode = select({ options: [{v:'simple', t:'Comma-separated names'}, {v:'json', t:'JSON array (exact names)'}], value:'simple' });
    const header = switchChip({ label: 'Include header row', checked: true });
    const status = statusLine('CSV quoting does not prevent spreadsheet formula execution. Treat untrusted cells as text when opening in spreadsheet software.');
    const out = resultPanel({ label: 'CSV', download: true, downloadName: 'data.csv', downloadMime: 'text/csv;charset=utf-8' });
    const revision = { value: 0 };
    window.addEventListener('pagehide', () => { revision.value++; }, { once:true });
    const invalidate = () => { revision.value++; out.placeholder(); status.set('Input or options changed. Convert again.', 'info'); };
    [inp, delim, cols, colMode, header].forEach(el => { el.addEventListener('input', invalidate); el.addEventListener('change', invalidate); });
    const run = () => {
      revision.value++;
      try {
        const csv = jsonToCsv(inp.value, {
          delimiter: delim.value,
          includeHeader: header.querySelector('input').checked,
          columns: parseCsvColumns(cols.value, colMode.value),
        });
        out.set(csv);
        status.set('CSV created. Quoting does not prevent spreadsheet formula execution; treat untrusted values as text.', 'info');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    const zone = localDataImport({ inp, out, status, revision, accept: '.json,application/json,text/plain', title: 'Choose a JSON file or drop it here', extensions: /\.json$/i });
    root.append(field({ label: 'JSON array', control: inp }), zone,
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Delimiter', control: delim }),
        field({ label: 'Column format', control: colMode }), field({ label: 'Columns', control: cols, hint: 'Blank selects all. For exact keys with commas or spaces, select JSON array and enter e.g. ["name, full"," id "].' }), field({ label: 'Header', control: header })),
      actionsRow(btn({ label: 'Convert to CSV', icon: 'table', onClick: run })),
      status, h('p', { class: 'hint', text: 'Missing, null and empty-string values all become empty cells; nested values become JSON text. Decimal numbers may round; use strings for exact values. Quoting does not prevent spreadsheet formulas. Limit: 1,000,000 input characters, 10,000 rows, 256 columns, 250,000 cells; file import up to 4 MiB.' }), h('br'), out.panel);
  },

  'json-lines-converter'(root) {
    const inp = textarea({ rows: 10, value: '{"name":"Ada","year":1815}\n{"name":"Grace","year":1906}', placeholder: 'Paste JSON or JSON Lines…' });
    const status = statusLine('JSONL is one JSON value per line — the format of choice for logs and streaming data.');
    const out = resultPanel({ label: 'Result' });
    const revision = { value: 0 }; let resultKind = null;
    window.addEventListener('pagehide', () => { revision.value++; }, { once:true });
    const download = btn({ label: 'Download result', icon: 'download', variant: 'secondary', onClick: () => {
      if (!resultKind || !out.text) return;
      const ok = downloadBlob(new Blob([out.text], {type: resultKind === 'json' ? 'application/json;charset=utf-8' : 'application/x-ndjson;charset=utf-8'}), resultKind === 'json' ? 'converted.json' : 'converted.jsonl');
      status.set(ok ? 'Download requested; check your browser downloads.' : 'Could not start the download.', ok ? 'success' : 'error');
    } });
    download.disabled = true;
    const resetResult = () => { resultKind = null; download.disabled = true; out.placeholder(); };
    inp.addEventListener('input', () => { revision.value++; resetResult(); status.set('Input changed. Convert again.', 'info'); });
    const zone = localDataImport({ inp, out: { placeholder: resetResult }, status, revision, accept: '.json,.jsonl,.ndjson,.txt,application/json,text/plain', title: 'Choose a JSON or JSON Lines file', extensions: /\.(json|jsonl|ndjson|txt)$/i });
    const runTo = (dir) => {
      revision.value++; resetResult();
      try {
        if (dir === 'to-jsonl') {
          out.set(jsonArrayToJsonl(inp.value)); resultKind = 'jsonl'; download.disabled = false;
          out.panel.querySelector('.result-body pre').style.whiteSpace = 'pre';
          status.set('Array → JSON Lines ✓', 'success');
        } else {
          out.panel.querySelector('.result-body pre').style.whiteSpace = 'pre-wrap';
          const arr = jsonlToJsonArray(inp.value);
          out.set(prettyJsonBounded(arr)); resultKind = 'json'; download.disabled = false;
          status.set(`${arr.length} records parsed ✓`, 'success');
        }
      } catch (e) {
        resetResult();
        status.set(e.message, 'error');
        // Do not put errors in the downloadable result panel.
      }
    };
    root.append(field({ label: 'Input (JSON array or JSON Lines)', control: inp }), zone,
      actionsRow(
        btn({ label: 'Array → JSONL', icon: 'brackets', onClick: () => runTo('to-jsonl') }),
        btn({ label: 'JSONL → Array', variant: 'secondary', icon: 'braces', onClick: () => runTo('to-json') }), download),
      status, h('p', { class: 'hint', text: 'Duplicate object keys and unsafe integers are rejected. Decimal numbers use binary floating-point and may round; use strings for exact values. Limit: 1,000,000 input characters, 10,000 lines or records and 10,000,000 formatted output characters; file import up to 4 MiB.' }), h('br'), out.panel);
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { parseCsv, csvToJson, jsonToCsv, jsonlToJsonArray, jsonArrayToJsonl };
