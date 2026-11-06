// =============================================================================
// iHaveTools — Developer tools engine + UIs
// Implements: json-formatter, json-validator, json-minifier, base64-encoder,
// url-encoder, uuid-generator, timestamp-converter, hash-generator,
// regex-tester, jwt-decoder, html-formatter, css-formatter, js-formatter
// =============================================================================
import { h, field, input, textarea, select, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, errorBanner, statsGrid, table, copyButton, downloadButton, toast, readFile, fmtBytes, mountTool } from '../ui.js';

/* ═══════════════════════════ JSON engine (RFC 8259) ═══════════════════════════ */
export function validateJson(text) {
  let i = 0;
  const n = text.length;
  let depth = 0;
  const lineCol = (pos) => {
    let line = 1, col = 1;
    for (let k = 0; k < pos && k < n; k++) { if (text[k] === '\n') { line++; col = 1; } else col++; }
    return { line, column: col };
  };
  const err = (msg, pos) => ({ ok: false, message: msg, position: pos, ...lineCol(pos) });
  if (n > 1000000) return err('JSON input exceeds the 1,000,000-character limit.', 0);
  const dupKeys = [];
  const ws = () => { while (i < n && /[\t\n\r ]/.test(text[i])) i++; };

  function parseValue(keyPath) {
    ws();
    if (i >= n) return err('Unexpected end of input — a value was expected here.', i);
    const c = text[i];
    if (c === '{' || c === '[') {
      if (depth >= 256) return err('JSON exceeds the 256-level nesting limit.', i);
      depth++; const result = c === '{' ? parseObject(keyPath) : parseArray(keyPath); depth--; return result;
    }
    if (c === '"') return parseString();
    if (c === '-' || (c >= '0' && c <= '9')) return parseNumber();
    if (text.startsWith('true', i) || text.startsWith('false', i)) { i += text[i] === 't' ? 4 : 5; return { ok: true }; }
    if (text.startsWith('null', i)) { i += 4; return { ok: true }; }
    if (c === "'") return err("Invalid token: JSON uses double quotes for strings, not single quotes.", i);
    if (c === ',') return err('Unexpected comma — a value was expected before this point.', i);
    if (c === '}' || c === ']') return err(`Unexpected "${c}" — a value was expected before this closing bracket.`, i);
    return err(`Unexpected character "${c}".`, i);
  }
  function parseString() {
    const start = i; i++; // opening quote
    for (;;) {
      if (i >= n) return err('Unterminated string — a closing double quote is missing.', start);
      const c = text[i];
      if (c === '"') { i++; return { ok: true, valueStart: start + 1, valueEnd: i - 1 }; }
      if (c === '\\') {
        const e = text[i + 1];
        if (e === undefined) return err('Unterminated escape sequence at end of input.', i);
        if (!"\"\\/bfnrtu".includes(e)) return err(`Invalid escape sequence "\\${e}". Valid: \\" \\\\ \\/ \\b \\f \\n \\r \\t \\uXXXX.`, i);
        if (e === 'u') {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return err(`Invalid unicode escape "\\u${hex || '…'}" — expected exactly 4 hex digits.`, i);
          i += 6;
        } else i += 2;
      } else if (c < ' ') return err('Unescaped control character inside a string.', i);
      else i++;
    }
  }
  function parseNumber() {
    const start = i;
    if (text[i] === '-') i++;
    if (text[i] === '0') i++;
    else if (text[i] >= '1' && text[i] <= '9') { while (i < n && text[i] >= '0' && text[i] <= '9') i++; }
    else return err('Invalid number.', start);
    if (text[i] === '.') { i++; if (!(text[i] >= '0' && text[i] <= '9')) return err('A digit is required after the decimal point.', i); while (i < n && text[i] >= '0' && text[i] <= '9') i++; }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!(text[i] >= '0' && text[i] <= '9')) return err('A digit is required in the exponent.', i);
      while (i < n && text[i] >= '0' && text[i] <= '9') i++;
    }
    return { ok: true };
  }
  function parseObject(path) {
    i++; // {
    const seen = new Set();
    ws();
    if (text[i] === '}') { i++; return { ok: true }; }
    for (;;) {
      ws();
      if (i >= n) return err('Unterminated object — a closing "}" is missing.', i);
      if (text[i] !== '"') return err('Object keys must be double-quoted strings.', i);
      const s = parseString();
      if (!s.ok) return s;
      let key;
      try { key = JSON.parse(text.slice(s.valueStart - 1, s.valueEnd + 1)); }
      catch { key = text.slice(s.valueStart, s.valueEnd); }
      const fullKey = [...path, key].join('.');
      if (seen.has(key)) dupKeys.push(fullKey);
      seen.add(key);
      ws();
      if (text[i] !== ':') return err(`Expected ":" after the key ${JSON.stringify(key)}.`, i);
      i++;
      const v = parseValue([...path, key]);
      if (!v.ok) return v;
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === '}') { i++; return { ok: true }; }
      if (i >= n) return err('Unterminated object — a closing "}" is missing.', i);
      return err(`Expected "," or "}" but found "${text[i]}".`, i);
    }
  }
  function parseArray(path) {
    i++; // [
    ws();
    if (text[i] === ']') { i++; return { ok: true }; }
    let idx = 0;
    for (;;) {
      const v = parseValue([...path, String(idx++)]);
      if (!v.ok) return v;
      ws();
      if (text[i] === ',') { i++; ws(); if (text[i] === ']') return err('Trailing comma before "]" is not allowed in JSON.', i); continue; }
      if (text[i] === ']') { i++; return { ok: true }; }
      if (i >= n) return err('Unterminated array — a closing "]" is missing.', i);
      return err(`Expected "," or "]" but found "${text[i]}".`, i);
    }
  }

  ws();
  const result = parseValue([]);
  if (!result.ok) return result;
  ws();
  if (i < n) return err(`Unexpected content after the end of the JSON document (starts with "${text[i]}").`, i);
  return { ok: true, duplicateKeys: dupKeys };
}

export function jsonParse(text) {
  const v = validateJson(text);
  if (!v.ok) { const e = new Error(v.message); e.line = v.line; e.column = v.column; e.position = v.position; throw e; }
  return parseConversionJson(text);
}

// Validate syntax, then change only insignificant whitespace. Never parse and
// reserialize values: doing so can change large numbers, escapes and duplicate keys.
function renderJson(text, indent) {
  const validation = validateJson(text);
  if (!validation.ok) { const error = new Error(validation.message); error.line = validation.line; error.column = validation.column; throw error; }
  const pretty = indent > 0, parts = []; let length = 0, level = 0;
  const add = (part) => { length += part.length; if (length > 10000000) throw new Error('Formatted output exceeds the 10,000,000-character limit.'); parts.push(part); };
  const pad = () => pretty ? ' '.repeat(level * indent) : '';
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (/[\t\n\r ]/.test(c)) { i++; continue; }
    if (c === '"') {
      const start = i++;
      while (i < text.length) { if (text[i] === '\\') { i += 2; continue; } if (text[i++] === '"') break; }
      add(text.slice(start, i)); continue;
    }
    if (c === '{' || c === '[') {
      let next = i + 1; while (/[\t\n\r ]/.test(text[next] || '')) next++;
      const closing = c === '{' ? '}' : ']';
      add(c); i++; level++;
      if (pretty && text[next] !== closing) add('\n' + pad());
      continue;
    }
    if (c === '}' || c === ']') {
      let previous = i - 1; while (previous >= 0 && /[\t\n\r ]/.test(text[previous])) previous--;
      level--; if (pretty && text[previous] !== (c === '}' ? '{' : '[')) add('\n' + pad());
      add(c); i++; continue;
    }
    if (c === ',') { add(pretty ? ',\n' + pad() : ','); i++; continue; }
    if (c === ':') { add(pretty ? ': ' : ':'); i++; continue; }
    let end = i + 1; while (end < text.length && !/[\t\n\r ,\]\}]/.test(text[end])) end++;
    add(text.slice(i, end)); i = end;
  }
  return parts.join('');
}
export function jsonFormat(text, indent = 2) {
  const width = Number.isFinite(Number(indent)) ? Math.max(0, Math.min(10, Math.trunc(Number(indent)))) : 2;
  return renderJson(text, width);
}
export function jsonMinify(text) { return renderJson(text, 0); }
export function countJsonWhitespace(text) { return (text.match(/\s/g) || []).length; }

// Reject conversions that JSON.parse/stringify would silently corrupt. Decimal
// numbers still use binary floating-point; callers must disclose rounding.
export function parseConversionJson(text) {
  let validation;
  try { validation = validateJson(text); } catch { throw new Error('JSON is too deeply nested to inspect safely.'); }
  if (!validation.ok) throw new Error(`Invalid JSON: ${validation.message}`);
  if (validation.duplicateKeys.length) throw new Error('Duplicate JSON object keys would overwrite values. Use unique keys.');
  const tokens = /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  for (const match of text.matchAll(tokens)) {
    const token = match[0];
    if (token[0] === '"') continue;
    const n = Number(token);
    if (!Number.isFinite(n) || (Number.isInteger(n) && !Number.isSafeInteger(n))) throw new Error('JSON contains a number outside the safe numeric range. Use a quoted string to preserve it.');
    const significand = token.split(/[eE]/)[0];
    if ((n === 0 && /[1-9]/.test(significand)) || Object.is(n, -0)) throw new Error('JSON contains a number that would become zero or lose its negative-zero sign. Use a quoted string to preserve it.');
  }
  return JSON.parse(text);
}

/* ═══════════════════════════ Base64 ═══════════════════════════ */
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export function b64encode(text, urlSafe = false) {
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); if (c >= 0xd800 && c <= 0xdbff) { if (i + 1 >= text.length || text.charCodeAt(i + 1) < 0xdc00 || text.charCodeAt(i + 1) > 0xdfff) throw new Error('Input contains an unpaired UTF-16 surrogate.'); i++; } else if (c >= 0xdc00 && c <= 0xdfff) throw new Error('Input contains an unpaired UTF-16 surrogate.'); }
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const CHUNK = 0x8000;
  for (let k = 0; k < bytes.length; k += CHUNK) bin += String.fromCharCode(...bytes.subarray(k, k + CHUNK));
  let out = btoa(bin);
  if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return out;
}

export function b64decode(text) {
  let s = text.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!s) throw new Error('Nothing to decode — the input is empty.');
  if (!B64_RE.test(s)) {
    const bad = [...s].findIndex((ch) => !/[A-Za-z0-9+/=]/.test(ch));
    throw new Error(`This is not valid Base64: unexpected character "${s[bad] ?? '?'}" at position ${bad + 1}.`);
  }
  if (s.includes('=') && s.length % 4 !== 0) throw new Error('This is not valid Base64: incomplete padding.');
  while (s.length % 4) s += '=';
  if (s.length % 4 !== 0) throw new Error('This is not valid Base64: its length is not a multiple of 4.');
  let bin;
  try { bin = atob(s); } catch { throw new Error('This is not valid Base64: the padding or character sequence is malformed.'); }
  if (btoa(bin).replace(/=+$/, '') !== s.replace(/=+$/, '')) throw new Error('This is not valid Base64: non-zero padding bits.');
  const bytes = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error('The Base64 decoded to bytes that are not valid UTF-8 text. If this was binary data, use a file tool instead.'); }
}

/* ═══════════════════════════ URL codec ═══════════════════════════ */
export function urlEncode(text, mode = 'component') {
  if (!text) throw new Error('Nothing to encode — the input is empty.');
  return mode === 'component' ? encodeURIComponent(text) : encodeURI(text);
}
export function urlDecode(text, mode = 'component', plusAsSpace = false) {
  if (!text) throw new Error('Nothing to decode — the input is empty.');
  let s = text;
  if (plusAsSpace) s = s.replace(/\+/g, ' ');
  try { return mode === 'component' ? decodeURIComponent(s) : decodeURI(s); }
  catch (e) {
    const m = /%.{2}/.exec(s);
    throw new Error(`This text contains a malformed percent-encoding${m ? ` (near “${m[0]}”)` : ''}. Percent sequences must look like %20 with two hex digits.`);
  }
}

/* ═══════════════════════════ UUID ═══════════════════════════ */
export function uuidv4(rng) {
  const c = rng || (globalThis.crypto);
  if (!c?.getRandomValues) throw new Error('Your browser does not provide a cryptographic random source (crypto.getRandomValues). Please use a modern browser.');
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/* ═══════════════════════════ Number bases ═══════════════════════════
   BigInt throughout, so values far beyond Number.MAX_SAFE_INTEGER
   (64-bit hashes, memory addresses) convert exactly. */
const BASE_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
export function convertBase(value, fromBase, toBase) {
  for (const b of [fromBase, toBase]) {
    if (!Number.isInteger(b) || b < 2 || b > 36) throw new Error('Bases must be whole numbers between 2 and 36.');
  }
  const s = String(value).trim().toLowerCase().replace(/[\s_]/g, '');
  if (!s) throw new Error('Enter a number to convert.');
  const neg = s.startsWith('-');
  const digits = neg ? s.slice(1) : s;
  if (!digits) throw new Error('Enter a number to convert.');
  let n = 0n;
  const fb = BigInt(fromBase);
  for (const ch of digits) {
    const d = BASE_DIGITS.indexOf(ch);
    if (d === -1 || d >= fromBase) throw new Error(`“${ch}” is not a valid base-${fromBase} digit.`);
    n = n * fb + BigInt(d);
  }
  if (n === 0n) return '0';
  const tb = BigInt(toBase);
  let out = '';
  while (n > 0n) { out = BASE_DIGITS[Number(n % tb)] + out; n /= tb; }
  return (neg ? '-' : '') + out;
}
/** Group digits for readability: groupDigits('11111111', 4) → '1111 1111'. */
export function groupDigits(str, size = 4) {
  const neg = str.startsWith('-');
  const d = neg ? str.slice(1) : str;
  const parts = [];
  for (let i = d.length; i > 0; i -= size) parts.unshift(d.slice(Math.max(0, i - size), i));
  return (neg ? '-' : '') + parts.join(' ');
}

/* ═══════════════════════════ Timestamps ═══════════════════════════ */
export function parseTimestamp(raw, unit = 'auto') {
  const s = String(raw).trim();
  if (!/^-?\d+$/.test(s)) throw new Error('A Unix timestamp is a whole number of seconds or milliseconds, like 1735689600 or 1735689600000.');
  let num = Number(s);
  if (!Number.isSafeInteger(num)) throw new Error('That number is too large to be a valid timestamp.');
  if (!['auto','seconds','milliseconds'].includes(unit)) throw new Error('Choose seconds, milliseconds or auto-detect.');
  if (unit === 'seconds' || (unit === 'auto' && Math.abs(num) < 1e12)) num *= 1000;
  const d = new Date(num);
  if (Number.isNaN(d.getTime()) || Math.abs(num) > 8.64e15) throw new Error('That number is outside the range JavaScript dates support (year ~275760).');
  return d;
}
export function dateToParts(d) {
  const iso = d.toISOString();
  return {
    iso,
    utc: iso.replace('T', ' ').replace('Z', ' UTC'),
    local: d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }),
    seconds: String(Math.floor(d.getTime() / 1000)),
    ms: String(d.getTime()),
    relative: relTime(d),
  };
}
export function relTime(d) {
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const units = [['year', 31536e6], ['month', 2592e6], ['day', 864e5], ['hour', 36e5], ['minute', 6e4], ['second', 1e3]];
  for (const [name, ms] of units) {
    if (abs >= ms || name === 'second') {
      const v = Math.round(abs / ms);
      const later = diff > 0;
      if (name === 'day' && v === 1) return later ? 'tomorrow' : 'yesterday';
      return later ? `in ${v} ${name}${v === 1 ? '' : 's'}` : `${v} ${name}${v === 1 ? '' : 's'} ago`;
    }
  }
}

/* ═══════════════════════════ Hashing (Web Crypto) ═══════════════════════════ */
export const HASH_ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
export async function digest(algo, buffer) {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is not available in this context. Note: crypto.subtle requires a secure (HTTPS or localhost) context.');
  const hash = await globalThis.crypto.subtle.digest(algo, buffer);
  return new Uint8Array(hash);
}
export function toHex(bytes) { return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''); }
export function toB64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

import { findMatches } from '../regex-engine.js';
export { findMatches };

/* ═══════════════════════════ JWT ═══════════════════════════ */
function b64urlToText(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const bytes = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export function decodeJwt(token) {
  const t = token.trim();
  if (!t) throw new Error('Paste a JWT to decode.');
  const parts = t.split('.');
  if (parts.length !== 3) throw new Error('A JWT has three dot-separated parts (header.payload.signature). Encrypted five-part tokens are not supported.');
  if (!/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]*$/.test(parts[2])) throw new Error('JWT parts must use the unpadded Base64URL alphabet.');
  let header, payload;
  try { header = parseConversionJson(b64urlToText(parts[0])); } catch { throw new Error('The header (first part) is not valid Base64URL-encoded JSON.'); }
  try { payload = parseConversionJson(b64urlToText(parts[1])); } catch { throw new Error('The payload (second part) is not valid Base64URL-encoded JSON.'); }
  if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('JWT header and payload must be JSON objects.');
  const claims = {}, invalidClaims = [];
  for (const key of ['iat', 'nbf', 'exp']) {
    if (payload[key] !== undefined) {
      const ts = payload[key] * 1000;
      if (typeof payload[key] !== 'number' || !Number.isFinite(ts) || !Number.isFinite(new Date(ts).getTime())) invalidClaims.push(key);
      else claims[key] = { ts, text: new Date(ts).toUTCString() };
    }
  }
  return { header, payload, claims, invalidClaims, signature: parts[2] || null, algorithm: header.alg || null };
}

/* Parser-based formatting is loaded only when a user requests it. */
async function prettierFormat(source, parser, indent = 2) {
  if (!source.trim()) throw new Error('Nothing to format — the input is empty.');
  if (source.length > 1000000) throw new Error('Input is too large; format at most 1 million characters.');
  const prettier = await import('../../vendor/prettier/standalone.js');
  let plugins;
  if (parser === 'babel') plugins = await Promise.all([import('../../vendor/prettier/babel.js'), import('../../vendor/prettier/estree.js')]);
  else plugins = [await import(parser === 'css' ? '../../vendor/prettier/postcss.js' : '../../vendor/prettier/html.js')];
  return prettier.format(source, { parser, plugins, tabWidth: indent, htmlWhitespaceSensitivity: 'strict' });
}
export const formatHtml = (source, indent = 2) => prettierFormat(source, 'html', indent);
export async function minifyHtml() { throw new Error('HTML minification is unavailable because whitespace can change page behavior. Use formatting instead.'); }
export const formatCss = (source, indent = 2) => prettierFormat(source, 'css', indent);
export async function minifyCss(source) {
  if (!source.trim()) throw new Error('Nothing to minify — the input is empty.');
  if (source.length > 1000000) throw new Error('Input is too large; use at most 1 million characters.');
  const css = await import('../../vendor/css-tree.js');
  const ast = css.parse(source, { onParseError(error) { throw error; } });
  return css.generate(ast);
}
export const formatJs = (source, indent = 2) => prettierFormat(source, 'babel', indent);

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
/** Structural JSON comparison. Object key order is ignored; arrays compare by index.
 * JSON Pointer paths use RFC 6901 escaping and the root pointer is the empty string. */
export function compareJson(leftText, rightText, { maxNodes = 100000, maxChanges = 1000 } = {}) {
  if (leftText.length > 1000000 || rightText.length > 1000000) throw new Error('Each JSON input must be at most 1,000,000 characters.');
  let left, right;
  try { left = parseConversionJson(leftText); } catch (e) { throw new Error(`Left JSON is invalid: ${e.message}`); }
  try { right = parseConversionJson(rightText); } catch (e) { throw new Error(`Right JSON is invalid: ${e.message}`); }
  const kind = (v) => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  const segment = (s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1');
  const changes = [], stack = [{ left, right, path: '' }]; let nodes = 0;
  while (stack.length) {
    if (++nodes > maxNodes) throw new Error('Comparison exceeds the 100,000-node safety limit. Compare smaller documents.');
    const { left: a, right: b, path, added, removed } = stack.pop();
    if (added || removed) changes.push({ type: added ? 'added' : 'removed', path, ...(added ? { right: b } : { left: a }) });
    else if (kind(a) !== kind(b) || (kind(a) !== 'object' && kind(a) !== 'array' && a !== b)) changes.push({ type: 'changed', path, left: a, right: b });
    else if (kind(a) === 'object' || kind(a) === 'array') {
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i], hasA = Object.hasOwn(a, key), hasB = Object.hasOwn(b, key);
        stack.push({ left: a[key], right: b[key], path: `${path}/${segment(key)}`, added: !hasA, removed: !hasB });
      }
    }
    if (changes.length > maxChanges) throw new Error(`More than ${maxChanges} differences; compare smaller documents.`);
  }
  return changes;
}

const defs = {
  'json-compare'(root) {
    const left = textarea({ rows: 10, value: '{\n  "name": "Ana",\n  "active": true,\n  "tags": ["a", "b"]\n}', placeholder: 'Paste original JSON…' });
    const right = textarea({ rows: 10, value: '{\n  "tags": ["a", "c"],\n  "name": "Ana",\n  "role": "editor"\n}', placeholder: 'Paste revised JSON…' });
    const status = statusLine('Compare two JSON values. Object key order is ignored; array order matters.');
    const out = resultPanel({ label: 'Structural differences', copy: false });
    [left, right].forEach(el => el.addEventListener('input', () => { out.placeholder(); status.set('Input changed. Compare again.', 'info'); }));
    const preview = (v) => { const text = JSON.stringify(v, (_key, value) => typeof value === 'number' && !Number.isFinite(value) ? String(value) : value); return text.length > 240 ? `${text.slice(0, 240)}…` : text; };
    const run = () => {
      try {
        const differences = compareJson(left.value, right.value);
        if (!differences.length) { out.set('No structural differences.'); status.set('The parsed JSON values match.', 'success'); return; }
        const view = h('div', {});
        differences.forEach((d) => view.append(h('div', { class: 'diff-line' },
          h('strong', { text: `${d.type.toUpperCase()} ${d.path || '(root)'}` }),
          d.type !== 'added' ? h('pre', { text: `Before: ${preview(d.left)}` }) : null,
          d.type !== 'removed' ? h('pre', { text: `After: ${preview(d.right)}` }) : null)));
        out.set(view); status.set(`${differences.length} difference${differences.length === 1 ? '' : 's'} found. Paths are JSON Pointers; long values are shortened.`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Original JSON', control: left }), field({ label: 'Revised JSON', control: right })),
      actionsRow(btn({ label: 'Compare JSON', icon: 'diff', onClick: run }), btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { left.value = ''; right.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, out.panel,
      h('p', { class: 'hint', text: 'Duplicate keys, unsafe integers, overflow, underflow and negative zero are rejected. Decimal numbers may round in JavaScript; use strings for exact comparisons. Inputs stay in your browser.' }));
  },

  'json-formatter'(root) {
    const inp = textarea({ value: '{\n  "hello": "world",\n  "items": [1, 2, 3],\n  "nested": {"works": true}\n}', rows: 12, placeholder: 'Paste JSON here…' });
    const indent = select({ id: 'indent', options: [{ v: 2, t: '2 spaces' }, { v: 4, t: '4 spaces' }, { v: 1, t: '1 space' }, { v: 3, t: '3 spaces' }], value: '2' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Formatted JSON', download: true, downloadName: 'formatted.json', downloadMime: 'application/json;charset=utf-8' });
    const invalidate = () => { out.placeholder(); status.set('Input or indentation changed. Run again.', 'info'); };
    inp.addEventListener('input', invalidate); indent.addEventListener('change', invalidate);
    const run = (mode) => {
      const src = inp.value;
      if (!src.trim()) { status.set('Paste some JSON first.', 'warning'); out.placeholder('Paste JSON above, then click Format or Minify.'); return; }
      try {
        const result = mode === 'minify' ? jsonMinify(src) : jsonFormat(src, Number(indent.value));
        out.set(result);
        const before = new Blob([src]).size, after = new Blob([result]).size;
        const duplicates = validateJson(src).duplicateKeys;
        status.set(duplicates.length ? `Formatted with duplicate keys preserved. Other parsers may overwrite them. ${fmtBytes(before)} → ${fmtBytes(after)}.` : `Valid JSON ✓ — ${fmtBytes(before)} → ${fmtBytes(after)}.`, duplicates.length ? 'warning' : 'success');
      } catch (e) {
        out.placeholder();
        status.set(e.line != null ? `Line ${e.line}, column ${e.column}: ${e.message}` : e.message, 'error');
      }
    };
    root.append(
      field({ label: 'JSON input', control: inp }),
      actionsRow(
        btn({ label: 'Format', icon: 'braces', onClick: () => run('format') }),
        btn({ label: 'Minify', variant: 'secondary', icon: 'minimize', onClick: () => run('minify') }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); inp.focus(); } }),
        h('span', { style: 'display:inline-flex;align-items:center;gap:8px;margin-left:auto' }, h('label', { for: 'indent', class: 'hint', text: 'Indent' }), indent),
      ),
      status, h('br'), out.panel,
    );
    inp.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run('format'); });
  },

  'json-validator'(root) {
    const inp = textarea({ rows: 12, placeholder: 'Paste JSON to validate…' });
    const status = statusLine('Ready.');
    const detail = h('div', {});
    const run = () => {
      const src = inp.value;
      detail.replaceChildren();
      if (!src.trim()) { status.set('Paste some JSON first.', 'warning'); return; }
      const v = validateJson(src);
      if (v.ok) {
        if (v.duplicateKeys?.length) {
          status.set(`Valid JSON ✓ (with duplicate object keys: ${v.duplicateKeys.slice(0, 4).join(', ')}${v.duplicateKeys.length > 4 ? '…' : ''})`, 'warning');
        } else status.set('Valid JSON ✓ — the document parses cleanly.', 'success');
      } else {
        status.set(`${/limit/.test(v.message) ? 'Unable to validate' : 'Invalid JSON'} — line ${v.line}, column ${v.column}`, 'error');
        detail.append(errorBanner(v.message, `Line ${v.line}, column ${v.column}. Fix this spot and validate again.`));
      }
    };
    root.append(field({ label: 'JSON to validate', control: inp }),
      actionsRow(btn({ label: 'Validate', icon: 'check-circle', onClick: run }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; detail.replaceChildren(); status.set('Cleared.'); } })),
      status, detail);
    let t;
    inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 400); });
  },

  'json-minifier'(root) {
    const inp = textarea({ rows: 12, placeholder: 'Paste JSON to minify…' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Minified JSON', download: true, downloadName: 'minified.json', downloadMime: 'application/json;charset=utf-8' });
    inp.addEventListener('input', () => { out.placeholder(); status.set('Input changed. Minify again.', 'info'); });
    root.append(field({ label: 'JSON input', control: inp }),
      actionsRow(btn({ label: 'Minify', icon: 'minimize', onClick: () => {
        if (!inp.value.trim()) { out.placeholder(); status.set('Paste some JSON first.', 'warning'); return; }
        try {
          const result = jsonMinify(inp.value);
          out.set(result);
          const before = new Blob([inp.value]).size, after = new Blob([result]).size;
          const saved = before ? Math.round((1 - after / before) * 100) : 0;
          const duplicates = validateJson(inp.value).duplicateKeys;
          status.set(duplicates.length ? `Minified with duplicate keys preserved. Other parsers may overwrite them. ${fmtBytes(before)} → ${fmtBytes(after)}.` : `Done — ${fmtBytes(before)} → ${fmtBytes(after)} (${saved}% smaller).`, duplicates.length ? 'warning' : 'success');
        } catch (e) { out.placeholder(); status.set(e.line != null ? `Line ${e.line}, column ${e.column}: ${e.message}` : e.message, 'error'); }
      } }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'base64-encoder'(root) {
    const inp = textarea({ rows: 8, placeholder: 'Paste text (to encode) or Base64 (to decode)…' });
    const urlSafe = switchChip({ label: 'URL-safe output', name: 'urlsafe' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Output', copy: true, download: true, downloadName: 'base64.txt' });
    const run = (mode) => {
      try {
        const src = inp.value;
        if (!src.trim()) { status.set('Paste something first.', 'warning'); out.placeholder(); return; }
        const result = mode === 'encode' ? b64encode(src, urlSafe.querySelector('input').checked) : b64decode(src);
        out.set(result);
        status.set(`${mode === 'encode' ? 'Encoded' : 'Decoded'} ✓ (${result.length.toLocaleString()} characters).`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.addEventListener('input', () => { out.placeholder(); status.set('Input changed. Run the conversion again.', 'info'); });
    root.addEventListener('change', () => { out.placeholder(); status.set('Settings changed. Run the conversion again.', 'info'); });
    root.append(field({ label: 'Input', control: inp }),
      actionsRow(
        btn({ label: 'Encode → Base64', icon: 'arrow-right', onClick: () => run('encode') }),
        btn({ label: 'Decode ← Base64', variant: 'secondary', icon: 'arrow-left', onClick: () => run('decode') }),
        urlSafe,
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } }),
      ),
      status, h('br'), out.panel);
  },

  'url-encoder'(root) {
    const inp = textarea({ rows: 8, placeholder: 'Paste text or a URL…' });
    const mode = segControl({ options: [{ v: 'component', t: 'Component' }, { v: 'full', t: 'Full URL' }], value: 'component', ariaLabel: 'Encoding scope' });
    const plus = switchChip({ label: 'Treat + as space when decoding' });
    const status = statusLine('Component mode escapes every reserved character (for query values). Full-URL mode keeps /, ?, & intact.');
    const out = resultPanel({ label: 'Output' });
    const run = (dir) => {
      try {
        const result = dir === 'encode'
          ? urlEncode(inp.value, mode.getValue())
          : urlDecode(inp.value, mode.getValue(), plus.querySelector('input').checked);
        out.set(result);
        status.set(`${dir === 'encode' ? 'Encoded' : 'Decoded'} ✓`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    mode.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { out.placeholder(); status.set('Scope changed. Run the conversion again.', 'info'); }));
    root.addEventListener('input', () => { out.placeholder(); status.set('Input changed. Run the conversion again.', 'info'); });
    root.addEventListener('change', () => { out.placeholder(); status.set('Settings changed. Run the conversion again.', 'info'); });
    root.append(field({ label: 'Input', control: inp }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Scope', control: mode }),
        field({ label: ' ', control: plus })),
      actionsRow(
        btn({ label: 'Encode', icon: 'arrow-right', onClick: () => run('encode') }),
        btn({ label: 'Decode', variant: 'secondary', icon: 'arrow-left', onClick: () => run('decode') }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'uuid-generator'(root) {
    const count = input({ type: 'number', min: 1, max: 500, step: 1, value: '5' });
    const upper = switchChip({ label: 'Uppercase' });
    const noDash = switchChip({ label: 'Remove dashes' });
    const status = statusLine('Ready.');
    const listWrap = h('div', { class: 'file-list' });
    let current = [];
    const render = () => {
      listWrap.replaceChildren(...current.map((u) => {
        const code = h('code', { class: 'mono', text: u, style: 'overflow-wrap:anywhere;flex:1' });
        return h('div', { class: 'file-row' }, code, h('span', { class: 'fr-actions' }, copyButton(() => u, { label: '' })));
      }));
    };
    const gen = () => {
      const n = Math.max(1, Math.min(500, Math.floor(Number(count.value) || 1)));
      count.value = String(n);
      try {
        current = Array.from({ length: n }, () => {
          let u = uuidv4();
          if (noDash.querySelector('input').checked) u = u.replace(/-/g, '');
          if (upper.querySelector('input').checked) u = u.toUpperCase();
          return u;
        });
        render();
        status.set(`${n} UUID${n === 1 ? '' : 's'} generated with crypto.getRandomValues ✓`, 'success');
      } catch (e) { status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'How many', control: count, hint: '1–500' }),
        field({ label: 'Format', control: h('div', { class: 'switch-row' }, upper, noDash) })),
      actionsRow(
        btn({ label: 'Generate', icon: 'fingerprint', onClick: gen }),
        btn({ label: 'Copy all', variant: 'secondary', icon: 'copy', onClick: async () => { if (!current.length) { toast('Generate some UUIDs first', 'error'); return; } const { copyText } = await import('../ui.js'); (await copyText(current.join('\n'))) ? toast('All UUIDs copied', 'success') : toast('Copy failed', 'error'); } }),
      ),
      status, listWrap);
    gen();
  },

  'timestamp-converter'(root) {
    const ts = input({ type: 'text', inputmode: 'numeric', placeholder: 'e.g. 1735689600' });
    const dateIn = input({ type: 'datetime-local' });
    const unit = select({ options: [{v:'auto',t:'Auto-detect'}, {v:'seconds',t:'Seconds'}, {v:'milliseconds',t:'Milliseconds'}], value:'auto' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Conversion', copy: true });
    const showDate = (d) => {
      const p = dateToParts(d);
      out.set(`ISO 8601 (UTC): ${p.iso}\nUTC:            ${p.utc}\nLocal:          ${p.local}\nUnix seconds:      ${p.seconds}\nUnix milliseconds: ${p.ms}\nRelative:       ${p.relative}`);
      status.set('Converted ✓', 'success');
    };
    root.addEventListener('input', () => { out.placeholder(); status.set('Input changed. Run the conversion again.', 'info'); });
    root.addEventListener('change', () => { out.placeholder(); status.set('Settings changed. Run the conversion again.', 'info'); });
    root.append(
      field({ label: 'Unix timestamp', control: ts }),
      field({ label: 'Timestamp unit', control: unit, hint: 'Auto uses milliseconds for absolute values ≥ 1 trillion; choose a unit explicitly for ambiguous dates.' }),
      actionsRow(btn({ label: 'Convert to date', icon: 'clock', onClick: () => {
        try { showDate(parseTimestamp(ts.value, unit.value)); }
        catch (e) { out.placeholder(); status.set(e.message, 'error'); }
      } }),
        btn({ label: 'Now', variant: 'secondary', onClick: () => { const now = new Date(); unit.value = 'milliseconds'; ts.value = String(now.getTime()); showDate(now); } })),
      h('div', { class: 'field-row', style: 'align-items:end; margin-top:6px' },
        field({ label: '…or pick a date', control: dateIn }),
        field({ label: ' ', control: btn({ label: 'Convert to timestamp', variant: 'secondary', icon: 'calendar', onClick: () => {
          try {
            if (!dateIn.value) throw new Error('Pick a date first.');
            const date = new Date(dateIn.value);
            if (!Number.isFinite(date.getTime())) throw new Error('This date cannot be interpreted by your browser.');
            const local = `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            if (!dateIn.value.startsWith(local)) throw new Error('This local time does not exist in your timezone. Choose another time.');
            showDate(date); status.set('Interpreted in your browser local timezone; repeated daylight-saving times are ambiguous.', 'info');
          } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
        } }) })),
      status, h('br'), out.panel);
  },

  'hash-generator'(root) {
    const algo = select({ id: 'algo', options: HASH_ALGOS.map((a) => ({ v: a, t: a.replace('SHA-', 'SHA-') })), value: 'SHA-256' });
    const enc = select({ id: 'enc', options: [{ v: 'hex', t: 'Hexadecimal' }, { v: 'base64', t: 'Base64' }], value: 'hex' });
    const inp = textarea({ rows: 7, placeholder: 'Type or paste text to hash…' });
    const zone = h('div');
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Digest', copy: true });
    let revision = 0;
    const invalidate = () => { revision++; out.placeholder(); status.set('Input or settings changed. Hash again.', 'info'); };
    [inp, algo, enc].forEach(el => { el.addEventListener('input', invalidate); el.addEventListener('change', invalidate); });
    const compute = async (buffer, sourceDesc, token = ++revision) => {
      const a = algo.value, encoding = enc.value;
      out.placeholder(); status.set(`Computing ${a}…`, 'info');
      try {
        const bytes = await digest(a, buffer);
        if (token !== revision) return;
        out.set(encoding === 'hex' ? toHex(bytes) : toB64(bytes));
        status.set(`${a} of ${sourceDesc} ✓`, 'success');
      } catch (e) { if (token === revision) { out.placeholder(); status.set(e.message, 'error'); } }
    };
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Algorithm', control: algo }),
        field({ label: 'Output', control: enc })),
      field({ label: 'Text input', control: inp }),
      actionsRow(
        btn({ label: 'Hash text', icon: 'hash', onClick: () => compute(new TextEncoder().encode(inp.value), 'text') }),
      ),
      status, h('br'), out.panel,
      h('div', { style: 'margin-top:18px' },
        h('h3', { text: '…or hash a file' }),
        h('div', { class: 'field' }, h('span', { class: 'hint', text: 'Useful for verifying downloads. Files up to 100 MiB are read locally into memory.' })),
        zone));
    zone.append(h('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' },
      h('label', { class: 'btn btn-secondary', style: 'cursor:pointer' }, 'Choose file',
        h('input', { type: 'file', style: 'display:none', onchange: (e) => {
          const f = e.target.files[0];
          if (!f) return;
          const token = ++revision; out.placeholder();
          if (f.size > 100 * 1024 * 1024) { status.set('Choose a file no larger than 100 MiB.', 'error'); return; }
          status.set(`Reading ${f.name} (${fmtBytes(f.size)})…`, 'info');
          readFile(f, 'buffer').then((buf) => { if (token === revision) compute(buf, f.name, token); }).catch((err) => { if (token === revision) { out.placeholder(); status.set(err.message, 'error'); } });
        } }))));
  },

  'regex-tester'(root) {
    const pattern = input({ type: 'text', value: '\\b\\w+@\\w+\\.\\w+\\b', class: 'input mono', placeholder: 'Regular expression, e.g. \\d+' });
    const flags = ['g', 'i', 'm', 's', 'u'].map((f) => switchChip({ label: f, name: f }));
    const test = textarea({ rows: 7, mono: false, value: 'Contact us at hello@example.com or support@ihavetools.example.', placeholder: 'Test string…' });
    const status = statusLine('Matches update as you type.');
    const highlight = h('div', { class: 'result-body', style: 'max-height:220px' });
    const matchesTable = h('div', {});
    let worker = null, deadline = null, debounce = null, revision = 0;
    const clear = () => {
      revision++; clearTimeout(debounce); clearTimeout(deadline);
      if (worker) worker.terminate(); worker = null;
      matchesTable.replaceChildren(); highlight.replaceChildren();
    };
    const run = () => {
      const token = revision, text = test.value, source = pattern.value;
      const fl = flags.filter(c => c.querySelector('input').checked).map(c => c.textContent.trim()).join('');
      if (source.length > 2000 || text.length > 100000) { status.set('Pattern limit is 2,000 characters; test string limit is 100,000 UTF-16 code units.', 'error'); return; }
      if (typeof Worker === 'undefined') { status.set('Web Workers are unavailable; regex evaluation is disabled to prevent freezing this page.', 'error'); return; }
      try {
        const job = new Worker(new URL('../regex-worker.js', import.meta.url), { type: 'module' }); worker = job;
        status.set('Checking pattern locally…', 'info');
        deadline = setTimeout(() => { if (token !== revision) return; job.terminate(); worker = null; status.set('Pattern timed out. Simplify it or shorten the test string.', 'error'); }, 1000);
        job.onerror = () => { if (token !== revision || worker !== job) return; clearTimeout(deadline); job.terminate(); worker = null; status.set('Regex worker could not start. Check browser support and try again.', 'error'); };
        job.onmessage = ({data: r}) => {
          if (token !== revision || worker !== job) return;
          clearTimeout(deadline); job.terminate(); worker = null;
          if (r.error) { status.set(r.error, 'error'); return; }
          const ms = r.matches;
          if (!ms.length) { highlight.append(h('pre', { class: 'placeholder', text: 'No matches in the test string.' })); status.set(r.truncated ? 'Output limit reached before a match could be displayed.' : 'No matches.', 'info'); return; }
          let pos = 0; const frag = h('pre', {});
          for (const m of ms.slice(0, 200)) {
            if (m.index > pos) frag.append(document.createTextNode(text.slice(pos, m.index)));
            // Zero-width matches must not consume or drop a character.
            frag.append(h('mark', { text: text.slice(m.index, m.index + m.length), style: 'background:var(--primary-soft);color:var(--primary);border-radius:3px;padding:0 2px' }));
            pos = m.index + m.length;
          }
          frag.append(document.createTextNode(text.slice(pos))); highlight.replaceChildren(frag);
          const show = value => value === undefined ? '—' : JSON.stringify(value);
          const rows = ms.slice(0, 100).map((m, i) => [String(i + 1), m.text.length > 80 ? m.text.slice(0, 80) + '…' : m.text, String(m.index),
            [...m.groups.map((g, gi) => `$${gi + 1}=${show(g)}`), ...Object.entries(m.named || {}).map(([name, value]) => `${name}=${show(value)}`)].join('  ') || '—']);
          matchesTable.append(h('h3', { text: `Matches (${ms.length}${r.truncated ? ', capped' : ''})`, style: 'margin:18px 0 10px' }), table({ headers: ['#', 'Match', 'Position (UTF-16) ', 'Groups'], rows }));
          status.set(`${ms.length} match${ms.length === 1 ? '' : 'es'} found${r.truncated ? ' (results capped)' : ''}. Showing up to 100 rows and 200 highlights; long captures are shortened.`, 'success');
        };
        job.postMessage({pattern: source, flags: fl, text});
      } catch { clearTimeout(deadline); if (worker) worker.terminate(); worker = null; status.set('Regex worker could not start. Check browser support and try again.', 'error'); }
    };
    const schedule = () => { clear(); status.set('Input changed; checking shortly…', 'info'); debounce = setTimeout(run, 200); };
    root.append(field({ label: 'Pattern', control: pattern }),
      h('div', { class: 'field' }, h('span', { class: 'field-legend', text: 'Flags' }), h('div', { class: 'switch-row' }, flags)),
      field({ label: 'Test string', control: test }),
      h('p', { class: 'hint', text: 'Runs locally in a worker with a 1-second limit. Positions count UTF-16 code units; matching may time out on slow devices.' }),
      status, h('div', { class: 'result-panel', style: 'margin-top:10px' }, highlight), matchesTable);
    [pattern, test].forEach(el => el.addEventListener('input', schedule));
    flags.forEach(c => c.querySelector('input').addEventListener('change', schedule));
    run();
  },

  'jwt-decoder'(root) {
    const inp = textarea({ rows: 6, placeholder: 'Paste a JWT — it looks like eyJhbGciOi…' });
    const status = statusLine('Ready.');
    const detail = h('div', { class: 'tool-docs', style: 'gap:14px' });
    inp.addEventListener('input', () => { detail.replaceChildren(); status.set('Input changed. Decode again.', 'info'); });
    const run = () => {
      detail.replaceChildren();
      try {
        const { header, payload, claims, invalidClaims, signature, algorithm } = decodeJwt(inp.value);
        const fmt = (obj) => h('pre', { text: JSON.stringify(obj, null, 2) });
        const panel = (label, obj) => h('section', { class: 'result-panel' },
          h('div', { class: 'result-head' }, h('span', { class: 'result-label', text: label }), h('span', { class: 'spacer' }), copyButton(() => JSON.stringify(obj, null, 2))),
          h('div', { class: 'result-body' }, fmt(obj)));
        detail.append(
          panel('Header', header),
          panel('Payload', payload));
        const expInfo = claims.exp
          ? (claims.exp.ts > Date.now()
            ? h('p', { class: 'status-line success', text: `Unverified claim expires: ${claims.exp.text} (${relTime(new Date(claims.exp.ts))}).` })
            : h('p', { class: 'status-line error', text: `Unverified expiry claim is in the past: ${claims.exp.text} (${relTime(new Date(claims.exp.ts))}).` }))
          : h('p', { class: 'status-line info', text: invalidClaims.includes('exp') ? 'The expiry claim is not a valid numeric date.' : 'No exp (expiry) claim found.' });
        detail.append(h('div', {},
          expInfo,
          h('p', { class: 'status-line info', text: `Algorithm: ${algorithm || 'not specified'}. Signature: ${signature ? 'present (not verified — decoding only).' : 'empty (not verified).'}` })),
          h('p', { class: 'hint', text: 'Decoding only verifies structure, not authenticity. Signature verification requires the secret or public key and should happen on a server.' }));
        status.set('Decoded ✓', 'success');
      } catch (e) { status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'JWT token', control: inp }),
      actionsRow(btn({ label: 'Decode', icon: 'key', onClick: run }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; detail.replaceChildren(); status.set('Cleared.'); } })),
      status, detail);
  },

  'html-formatter'(root) {
    const inp = textarea({ rows: 12, value: '<!DOCTYPE html><html><head><title>Demo</title></head><body><div class="card"><h1>Hello</h1><p>Messy <strong>HTML</strong> to tidy up.</p></div></body></html>', placeholder: 'Paste HTML…' });
    const indent = select({ id: 'htmlindent', options: [{ v: 2, t: '2 spaces' }, { v: 4, t: '4 spaces' }], value: '2' });
    const status = statusLine('HTML minification is unavailable because whitespace may affect page behavior. Review formatted output.');
    const out = resultPanel({ label: 'Formatted HTML', download: true, downloadName: 'formatted.html', downloadMime: 'text/html;charset=utf-8' });
    let revision = 0; inp.addEventListener('input', () => { revision++; out.placeholder(); });
    const run = async () => {
      const token = ++revision;
      try {
        const result = await formatHtml(inp.value, Number(indent.value));
        if (token !== revision) return;
        out.set(result);
        status.set(`Formatted ✓ — ${fmtBytes(new Blob([result]).size)}. Review and test the result before use.`, 'success');
      } catch (e) { if (token === revision) { out.placeholder(); status.set(e.message, 'error'); } }
    };
    root.append(field({ label: 'HTML input', control: inp }),
      actionsRow(
        btn({ label: 'Format', icon: 'code', onClick: run }),
        h('span', { style: 'margin-left:auto;display:inline-flex;gap:8px;align-items:center' }, h('label', { for: 'htmlindent', class: 'hint', text: 'Indent' }), indent),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { revision++; inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'css-formatter'(root) {
    const inp = textarea({ rows: 12, value: ':root{--x:1}body{margin:0;font-family:sans-serif}.card{padding:16px;border:1px solid #eee;border-radius:8px}', placeholder: 'Paste CSS…' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Result', download: true, downloadName: 'styles.css', downloadMime: 'text/css;charset=utf-8' });
    let revision = 0; inp.addEventListener('input', () => { revision++; out.placeholder(); });
    const run = async (mode) => {
      const token = ++revision;
      try {
        const result = mode === 'minify' ? await minifyCss(inp.value) : await formatCss(inp.value, 2);
        if (token !== revision) return;
        out.set(result);
        status.set(`${mode === 'minify' ? 'Minified' : 'Formatted'} ✓ — ${fmtBytes(new Blob([result]).size)}. Review and test the result before use.`, 'success');
      } catch (e) { if (token === revision) { out.placeholder(); status.set(e.message, 'error'); } }
    };
    root.append(field({ label: 'CSS input', control: inp }),
      actionsRow(
        btn({ label: 'Format', icon: 'code', onClick: () => run('format') }),
        btn({ label: 'Minify', variant: 'secondary', icon: 'minimize', onClick: () => run('minify') }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { revision++; inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'js-formatter'(root) {
    const inp = textarea({ rows: 12, value: 'function add(a,b){if(!a||!b){return 0}\nreturn a+b}// demo', placeholder: 'Paste JavaScript…' });
    const indent = select({ id: 'jsindent', options: [{ v: 2, t: '2 spaces' }, { v: 4, t: '4 spaces' }], value: '2' });
    const status = statusLine('Parser-based formatting; review and test the output before use.');
    const out = resultPanel({ label: 'Formatted JavaScript', download: true, downloadName: 'formatted.js', downloadMime: 'text/javascript;charset=utf-8' });
    let revision = 0; inp.addEventListener('input', () => { revision++; out.placeholder(); });
    const run = async () => {
      const token = ++revision;
      try {
        const result = await formatJs(inp.value, Number(indent.value));
        if (token !== revision) return;
        out.set(result);
        status.set('Formatted ✓ — review before saving: exotic syntax may need manual touch-up.', 'success');
      } catch (e) { if (token === revision) { out.placeholder(); status.set(e.message, 'error'); } }
    };
    root.append(field({ label: 'JavaScript input', control: inp }),
      actionsRow(
        btn({ label: 'Format', icon: 'code', onClick: run }),
        h('span', { style: 'margin-left:auto;display:inline-flex;gap:8px;align-items:center' }, h('label', { for: 'jsindent', class: 'hint', text: 'Indent' }), indent),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { revision++; inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'number-base-converter'(root) {
    const val = input({ type: 'text', placeholder: 'e.g. 255, FF or 11111111', value: '255' });
    const from = select({ options: [{ v: '2', t: 'Binary (base 2)' }, { v: '8', t: 'Octal (base 8)' }, { v: '10', t: 'Decimal (base 10)' }, { v: '16', t: 'Hexadecimal (base 16)' }], value: '10' });
    const status = statusLine('');
    const outWrap = h('div', {});
    const run = () => {
      const fb = Number(from.value);
      try {
        const bin = convertBase(val.value, fb, 2);
        const rows = [
          ['Binary (2)', groupDigits(bin, 4)],
          ['Octal (8)', convertBase(val.value, fb, 8)],
          ['Decimal (10)', convertBase(val.value, fb, 10)],
          ['Hexadecimal (16)', convertBase(val.value, fb, 16).toUpperCase()],
        ];
        outWrap.replaceChildren(table({ headers: ['Base', 'Value'], rows }));
        const bits = bin.replace('-', '').replace(/^0+/, '').length || 1;
        status.set(`Converted ✓ — needs ${bits} bit${bits === 1 ? '' : 's'} in binary. Exact big-integer math, no precision loss.`, 'success');
      } catch (e) { outWrap.replaceChildren(); status.set(e.message, 'error'); }
    };
    val.addEventListener('input', run);
    from.addEventListener('change', run);
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Number', control: val, hint: 'Spaces and underscores are ignored; leading − allowed' }),
        field({ label: 'From base', control: from })),
      actionsRow(btn({ label: 'Convert', icon: 'binary', onClick: run })),
      status, outWrap);
    run();
  },
};

export function mount(id) { mountTool(id, defs); }

export const __test = {
  validateJson, jsonFormat, jsonMinify, compareJson, b64encode, b64decode, urlEncode, urlDecode, uuidv4,
  parseTimestamp, dateToParts, digest, toHex, toB64, findMatches, decodeJwt,
  formatHtml, minifyHtml, formatCss, minifyCss, formatJs, convertBase, groupDigits,
};
