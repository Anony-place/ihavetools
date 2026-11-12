// =============================================================================
// iHaveTools — Developer tools engine + UIs
// Implements: json-formatter, json-validator, json-minifier, base64-encoder,
// url-encoder, uuid-generator, timestamp-converter, hash-generator,
// regex-tester, jwt-decoder, html-formatter, css-formatter, js-formatter
// =============================================================================
import { h, field, input, textarea, select, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, errorBanner, statsGrid, table, copyButton, downloadButton, privacyNote, toast, readFile, fmtBytes, mountTool, copyText, downloadBlob } from '../ui.js';

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

// Read-only, bounded syntax tree retaining raw scalar tokens and duplicate keys.
// Validation runs first; no JavaScript number conversion or HTML injection.
export function jsonTree(text) {
  if (text.length > 250000) throw new Error('Tree view supports up to 250,000 characters. Format or minify larger input instead.');
  const validation = validateJson(text);
  if (!validation.ok) throw new Error(`Line ${validation.line}, column ${validation.column}: ${validation.message}`);
  let i = 0, count = 0;
  const whitespace = () => { while (i < text.length && /[\t\n\r ]/.test(text[i])) i++; };
  const stringToken = () => { const start = i++; while (i < text.length) { if (text[i] === '\\') { i += 2; continue; } if (text[i++] === '"') break; } return text.slice(start, i); };
  function value(depth) {
    whitespace();
    if (++count > 3000) throw new Error('Tree view supports at most 3,000 values. Format or minify larger input instead.');
    if (depth > 64) throw new Error('Tree view supports up to 64 levels. Format or minify deeper input instead.');
    const start = i, c = text[i];
    if (c === '{' || c === '[') {
      i++; const children = []; whitespace(); const close = c === '{' ? '}' : ']';
      while (text[i] !== close) {
        let key = null;
        if (c === '{') { key = stringToken(); whitespace(); i++; }
        const child = value(depth + 1); children.push({ key, node: child }); whitespace();
        if (text[i] === ',') { i++; whitespace(); } else break;
      }
      i++; return { type: c === '{' ? 'object' : 'array', children, start, end: i };
    }
    if (c === '"') { const raw = stringToken(); return { type: 'value', raw, start, end:i }; }
    while (i < text.length && !/[\t\n\r ,\]\}]/.test(text[i])) i++;
    return { type: 'value', raw: text.slice(start, i), start, end:i };
  }
  return value(0);
}

/** Resolve a plain RFC 6901 pointer without converting or reserializing values. */
export function jsonPointerLookup(text, pointer) {
  if (pointer.length > 10000) throw new Error('Pointer exceeds 10,000 characters.');
  if (pointer && !pointer.startsWith('/')) throw new Error('A JSON Pointer must be empty for the root or start with /. URI fragments and JSONPath are not supported.');
  const segments = pointer === '' ? [] : pointer.slice(1).split('/').map(part => {
    if (/~(?![01])/.test(part)) throw new Error('Invalid pointer escape: use ~0 for ~ and ~1 for /.');
    return part.replace(/~1/g, '/').replace(/~0/g, '~');
  });
  if (text.length > 250000) throw new Error('Lookup supports up to 250,000 characters.');
  let validation;
  try { validation = validateJson(text); } catch { throw new Error('JSON is too deeply nested to inspect safely.'); }
  if (!validation.ok) throw new Error(`Line ${validation.line}, column ${validation.column}: ${validation.message}`);
  if (validation.duplicateKeys.length) throw new Error('Duplicate object keys make lookup ambiguous. Use unique keys.');
  let node = jsonTree(text);
  for (const part of segments) {
    if (node.type === 'object') {
      const match = node.children.find(child => JSON.parse(child.key) === part);
      if (!match) throw new Error('Pointer does not exist in this document.');
      node = match.node;
    } else if (node.type === 'array') {
      if (!/^(0|[1-9]\d*)$/.test(part) || !Number.isSafeInteger(Number(part)) || Number(part) >= node.children.length) throw new Error('Array index must be a valid zero-based index without leading zeroes.');
      node = node.children[Number(part)].node;
    } else throw new Error('Pointer cannot traverse a scalar value.');
  }
  return text.slice(node.start, node.end);
}

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
  return b64encodeBytes(new TextEncoder().encode(text), urlSafe);
}
export function b64encodeBytes(bytes, urlSafe = false) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let k = 0; k < bytes.length; k += CHUNK) bin += String.fromCharCode(...bytes.subarray(k, k + CHUNK));
  let out = btoa(bin);
  if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return out;
}

export function b64decodeBytes(text) {
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
  return bytes;
}
export function b64decode(text) {
  const bytes = b64decodeBytes(text);
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

// Each line is an independent input; empty lines and final newline are retained.
export function urlConvertLines(text, direction, mode, plusAsSpace = false) {
  if (text.length > 1000000) throw new Error('Input exceeds 1,000,000 UTF-16 code units.');
  if (!['encode','decode'].includes(direction) || !['component','full'].includes(mode)) throw new Error('Choose a valid URL operation.');
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 50000) throw new Error('Input exceeds 50,000 lines.');
  return lines.map((line, i) => {
    if (!line) return '';
    try { return direction === 'encode' ? urlEncode(line, mode) : urlDecode(line, mode, plusAsSpace); }
    catch (e) { throw new Error(`Line ${i + 1}: ${e.message || 'Could not convert.'}`); }
  }).join('\n');
}
export function compareHexDigest(expected, actualHex, algorithm) {
  const lengths = {'SHA-1':40, 'SHA-256':64, 'SHA-384':96, 'SHA-512':128};
  const n = lengths[algorithm];
  if (!n || !/^[0-9a-f]+$/i.test(expected) || expected.length !== n) throw new Error(`Expected digest must be ${n || 'the correct number of'} hexadecimal characters for ${algorithm}.`);
  return expected.toLowerCase() === actualHex.toLowerCase();
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
export function parseWallDateTime(value, zone = 'local') {
  if (!['local','utc'].includes(zone)) throw new Error('Choose UTC or local time.');
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  if (!m || Number(m[1]) < 1 || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6] || 0) > 59) throw new Error('Enter a valid date and time (up to milliseconds).');
  const normalized = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}.${(m[7] || '').padEnd(3,'0')}`;
  const d = new Date(normalized + (zone === 'utc' ? 'Z' : ''));
  if (!Number.isFinite(d.getTime())) throw new Error('Enter a valid date and time.');
  const p = zone === 'utc' ? [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds()] : [d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds()];
  const want = [Number(m[1]),Number(m[2]),Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]||0),Number((m[7]||'').padEnd(3,'0'))];
  if (p.some((v,i)=>v!==want[i])) throw new Error('This calendar date or local time does not exist.');
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

// Reports are bounded previews for people, not JSON Patch or complete values.
export function jsonCompareReport(changes) {
  const counts = { added: 0, removed: 0, changed: 0 };
  const preview = value => {
    const text = JSON.stringify(value);
    return text.length > 240 ? `${text.slice(0, 240)}… [value truncated]` : text;
  };
  const pathLabel = path => {
    const quoted = JSON.stringify(path);
    return quoted.length > 2048 ? `${quoted.slice(0, 2048)}… [path truncated]` : quoted;
  };
  const lines = changes.flatMap(change => {
    counts[change.type]++;
    return [`${change.type.toUpperCase()} pointer ${pathLabel(change.path)}${change.path === '' ? ' (root)' : ''}`,
      ...(change.type !== 'added' ? [`  Before: ${preview(change.left)}`] : []),
      ...(change.type !== 'removed' ? [`  After: ${preview(change.right)}`] : [])];
  });
  return ['JSON structural comparison report — review only, not a JSON Patch',
    `Added: ${counts.added}; removed: ${counts.removed}; changed: ${counts.changed}`,
    'Object key order ignored; arrays compared by index. Decimal numbers may round.',
    'Long values and paths are truncated. Report may contain sensitive data.', '',
    ...(lines.length ? lines : ['No structural differences.'])].join('\n');
}

const defs = {
  'html-live-preview'(root) {
    const starter = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My page</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; background: #f3f4ff; }
    button { padding: .7rem 1rem; border: 0; border-radius: .5rem; background: #4f46e5; color: white; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Hello, world!</h1>
  <p>Edit this HTML, CSS and JavaScript to see changes live.</p>
  <button id="hello">Click me</button>
  <script>document.getElementById('hello').addEventListener('click', () => { document.querySelector('p').textContent = 'JavaScript works!'; });<\/script>
</body>
</html>`;
    const code = textarea({ rows: 18, value: starter, placeholder: 'Write a complete HTML document…' });
    code.setAttribute('aria-label', 'HTML code'); code.spellcheck = false;
    const live = switchChip({ label: 'Live preview', checked: true });
    const liveInput = live.querySelector('input');
    const indentMode = switchChip({ label: 'Tab inserts spaces', checked: false });
    const frame = h('iframe', { title: 'Live HTML preview', sandbox: 'allow-scripts', referrerpolicy: 'no-referrer', class: 'html-preview-frame' });
    const status = statusLine('Preview ready. Your code is not saved by this tool.');
    let timer = null, last = '', channel = null, id = '';
    try { const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes); id = [...bytes].map(v => v.toString(16).padStart(2, '0')).join(''); } catch { /* Full-window sync unavailable without randomness. */ }
    const connect = () => {
      if (!id || !window.BroadcastChannel) return;
      try { channel = new window.BroadcastChannel(`iht-html-preview-${id}`); channel.onmessage = e => { if (e.data?.type === 'ready') channel?.postMessage({ type: 'preview', html: last }); }; }
      catch { channel = null; }
    };
    connect();
    const open = h('a', { class: 'btn btn-secondary html-preview-open', href: `/assets/html-preview.html#${id}`, target: '_blank', rel: 'noopener noreferrer' }, 'Open full-window preview ↗');
    if (!channel) { open.hidden = true; status.set('Live preview works here, but full-window sync needs BroadcastChannel and secure randomness in a supported browser.', 'warning'); }
    const send = html => { frame.srcdoc = html; last = html; channel?.postMessage({ type: 'preview', html }); };
    const run = () => {
      clearTimeout(timer); timer = null;
      if (code.value.length > 200000) { send(''); status.set('Code exceeds the 200,000-character preview limit. Shorten it before running.', 'error'); return; }
      send(code.value); status.set('Preview updated. Code is not saved; external resources may receive requests.', 'info');
    };
    code.addEventListener('keydown', event => {
      if (!indentMode.querySelector('input').checked || event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      event.preventDefault();
      const start = code.selectionStart, end = code.selectionEnd;
      code.setRangeText('  ', start, end, 'end');
      code.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    code.addEventListener('input', () => {
      clearTimeout(timer);
      if (liveInput.checked) { status.set('Updating preview…', 'info'); timer = setTimeout(run, 400); }
      else status.set('Live preview paused. Press Run preview to apply changes.', 'info');
    });
    liveInput.addEventListener('change', () => { clearTimeout(timer); if (liveInput.checked) run(); else status.set('Live preview paused. Press Run preview to apply changes.', 'info'); });
    window.addEventListener('pagehide', () => { clearTimeout(timer); channel?.close(); channel = null; });
    window.addEventListener('pageshow', e => { if (e.persisted) { connect(); if (channel) { open.hidden = false; channel.postMessage({ type: 'preview', html: last }); } } });
    if (!channel) root.append(h('p', { class: 'hint', text: 'Full-window sync is unavailable in this browser. The embedded preview still works.' }));
    root.append(
      h('p', { class: 'hint', text: 'Write HTML with CSS in <style> and JavaScript in <script>. Only run trusted code: it can make network requests. Work is not saved.' }),
      h('div', { class: 'html-playground' },
        h('div', { class: 'html-playground-editor' }, field({ label: 'HTML code', control: code })),
        h('div', { class: 'html-playground-preview' }, h('h3', { text: 'Live preview' }), frame)),
      h('div', { class: 'switch-row', style: 'margin-top:12px' }, live, indentMode),
      h('p', { class: 'hint', text: 'Tab moves focus by default. Enable “Tab inserts spaces” to insert two spaces; Shift+Tab still moves focus.' }),
      actionsRow(btn({ label: 'Run preview', icon: 'eye', onClick: run }),
        btn({ label: 'Stop preview', variant: 'secondary', onClick: () => { clearTimeout(timer); liveInput.checked = false; send(''); status.set('Preview stopped. Press Run preview to restart.', 'info'); } }),
        open,
        copyButton(() => code.value, { label: 'Copy HTML' }),
        downloadButton(() => code.value, 'index.html', { label: 'Download HTML', mime: 'text/html;charset=utf-8' }),
        btn({ label: 'Reset example', variant: 'ghost', onClick: () => { if (code.value !== starter && !window.confirm('Replace your current code with the example?')) return; code.value = starter; liveInput.checked = true; run(); } })),
      status,
      privacyNote('Scripts run in a restricted iframe, but can request external resources. The sandbox blocks some browser APIs, forms, popups and top navigation; it cannot guarantee protection from hostile code or infinite loops. Do not paste secrets.'));
    send(starter);
  },

  'json-pointer-lookup'(root) {
    const code = textarea({ rows: 12, value:'{\n  "items": [{"name": "Ada", "id": 9007199254740993}]\n}', placeholder:'Paste JSON…' });
    const pointer = input({ type:'text', value:'/items/0/id', placeholder:'Empty for root; e.g. /items/0/name' });
    const file = input({ type:'file', accept:'.json,application/json' });
    const status = statusLine('Enter a plain JSON Pointer and look up the value.');
    const out = resultPanel({ label:'Selected JSON value', download:true, downloadName:'selected.json', downloadMime:'application/json;charset=utf-8' });
    let revision = 0;
    window.addEventListener('pagehide', () => { revision++; }, { once:true });
    code.addEventListener('input', () => { revision++; out.placeholder(); status.set('JSON changed. Look up again.', 'info'); });
    pointer.addEventListener('input', () => { out.placeholder(); status.set('Pointer changed. Look up again.', 'info'); });
    file.addEventListener('change', async () => {
      const selected = file.files?.[0]; file.value = ''; if (!selected) return;
      const token = ++revision; out.placeholder();
      try {
        if (!/\.json$/i.test(selected.name) || selected.size > 1048576) throw new Error('Choose a .json file up to 1 MiB.');
        status.set('Reading JSON locally…', 'info');
        const bytes = await readFile(selected, 'buffer'); if (token !== revision) return;
        let text; try { text = new TextDecoder('utf-8', {fatal:true}).decode(bytes); } catch { throw new Error('File is not valid UTF-8.'); }
        if (text.length > 250000) throw new Error('File exceeds 250,000 characters.');
        code.value = text; out.placeholder(); status.set('JSON loaded locally. Look up to validate it.', 'success');
      } catch (e) { if (token === revision) status.set(`${e.message} Existing JSON was kept.`, 'error'); }
    });
    const run = () => {
      revision++; out.placeholder();
      try { const raw = jsonPointerLookup(code.value, pointer.value); out.set(raw); status.set('Value found. Original JSON tokens and inner whitespace are preserved.', 'success'); }
      catch (e) { status.set(e.message, 'error'); }
    };
    root.append(field({label:'JSON document',control:code}), field({label:'Load local JSON file',control:file, hint:'UTF-8 .json, up to 1 MiB and 250,000 characters. Existing text is kept on failure.'}),
      field({label:'JSON Pointer',control:pointer,hint:'Empty pointer selects the root; / selects an empty object key. Escape ~ as ~0 and / as ~1.'}),
      actionsRow(btn({label:'Look up value',icon:'search',onClick:run}), btn({label:'Clear',variant:'ghost',icon:'x',onClick:() => {revision++; code.value='';pointer.value='';file.value='';out.placeholder();status.set('Cleared.');}})),
      status, out.panel, h('p',{class:'hint',text:'Plain JSON Pointer only; not JSONPath or a URI fragment. Duplicate keys are rejected. Limit: 250,000 input characters, 3,000 values, 64 tree levels and 10,000 pointer characters. Files stay in your browser.'}));
  },

  'json-compare'(root) {
    const left = textarea({ rows: 10, value: '{\n  "name": "Ana",\n  "active": true,\n  "tags": ["a", "b"]\n}', placeholder: 'Paste original JSON…' });
    const right = textarea({ rows: 10, value: '{\n  "tags": ["a", "c"],\n  "name": "Ana",\n  "role": "editor"\n}', placeholder: 'Paste revised JSON…' });
    const status = statusLine('Compare two JSON values. Object key order is ignored; array order matters.');
    const out = resultPanel({ label: 'Structural differences', copy: false });
    const revisions = [0, 0]; let report = '';
    const copy = btn({label:'Copy report', variant:'secondary', onClick:async () => { const text = report; if (!text) return; const ok = await copyText(text); if (report === text) status.set(ok ? 'Report copied.' : 'Copy failed. Try downloading the report.', ok ? 'success' : 'error'); }});
    const download = btn({label:'Download report', variant:'secondary', icon:'download', onClick:() => { if (!report) return; const ok = downloadBlob(new Blob([report], {type:'text/plain;charset=utf-8'}), 'json-comparison-report.txt'); status.set(ok ? 'Report download requested. Check your browser downloads.' : 'Could not start the download.', ok ? 'success' : 'error'); }});
    copy.disabled = download.disabled = true;
    const clearReport = () => { report = ''; out.placeholder(); copy.disabled = download.disabled = true; };
    window.addEventListener('pagehide', () => { revisions[0]++; revisions[1]++; }, {once:true});
    const invalidate = () => { clearReport(); status.set('Input changed. Compare again.', 'info'); };
    [left, right].forEach((el, i) => el.addEventListener('input', () => { revisions[i]++; invalidate(); }));
    const makeFileInput = (editor, i) => {
      const picker = input({ type: 'file', accept: '.json,application/json' });
      picker.addEventListener('change', async () => {
        const selected = picker.files?.[0]; picker.value = '';
        if (!selected) return;
        const token = ++revisions[i]; clearReport();
        if (!/\.json$/i.test(selected.name) || selected.size > 4000000) {
          status.set('Choose a .json file up to 4,000,000 bytes. Existing input was kept.', 'error'); return;
        }
        status.set(`Reading ${i ? 'revised' : 'original'} JSON locally…`, 'info');
        try {
          const bytes = await readFile(selected, 'buffer');
          if (token !== revisions[i]) return;
          let text; try { text = new TextDecoder('utf-8', {fatal:true}).decode(bytes); } catch { throw new Error('File is not valid UTF-8.'); }
          if (text.length > 1000000) { status.set('File exceeds the 1,000,000-character limit. Existing input was kept.', 'error'); return; }
          editor.value = text; out.placeholder(); status.set('JSON loaded locally as UTF-8. Compare to validate it.', 'info');
        } catch (e) { if (token === revisions[i]) status.set(`${e.message || 'Could not read that file.'} Existing input was kept.`, 'error'); }
      });
      return picker;
    };
    const leftFile = makeFileInput(left, 0), rightFile = makeFileInput(right, 1);
    const formatSide = (editor, i) => {
      revisions[i]++; clearReport();
      try {
        const formatted = jsonFormat(editor.value, 2);
        if (formatted.length > 1000000) throw new Error('Formatted JSON exceeds the 1,000,000-character comparison limit.');
        editor.value = formatted; status.set(`${i ? 'Revised' : 'Original'} JSON formatted without changing tokens. Compare again.`, 'success');
      } catch (e) { status.set(`Could not format ${i ? 'revised' : 'original'} JSON: ${e.message} Existing input was kept.`, 'error'); }
    };
    const run = () => {
      revisions[0]++; revisions[1]++; clearReport();
      try {
        const differences = compareJson(left.value, right.value);
        report = jsonCompareReport(differences);
        out.set(report); copy.disabled = download.disabled = false;
        status.set(differences.length ? `${differences.length} difference${differences.length === 1 ? '' : 's'} found. Review the report below.` : 'The parsed JSON values match.', 'success');
      } catch (e) { clearReport(); status.set(e.message, 'error'); }
    };
    root.append(h('div', { class: 'field-row' }, field({ label: 'Original JSON', control: left }), field({ label: 'Revised JSON', control: right })),
      h('div', {class:'field-row'}, field({label:'Load original JSON file', control:leftFile, hint:'Local UTF-8 .json, up to 4,000,000 bytes and 1,000,000 characters.'}), field({label:'Load revised JSON file', control:rightFile, hint:'Loading replaces only this side; compare to validate.'})),
      actionsRow(btn({ label: 'Compare JSON', icon: 'diff', onClick: run }), btn({label:'Format original', variant:'secondary', onClick:() => formatSide(left, 0)}), btn({label:'Format revised', variant:'secondary', onClick:() => formatSide(right, 1)}), btn({label:'Swap sides', variant:'secondary', onClick:() => { revisions[0]++; revisions[1]++; [left.value, right.value] = [right.value, left.value]; clearReport(); status.set('Inputs swapped. Compare again.', 'info'); }}), btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { revisions[0]++; revisions[1]++; left.value = ''; right.value = ''; leftFile.value = ''; rightFile.value = ''; clearReport(); status.set('Cleared.'); } }), copy, download),
      status, out.panel,
      h('p', { class: 'hint', text: 'Duplicate keys, unsafe integers, overflow, underflow and negative zero are rejected. Decimal numbers may round in JavaScript; use strings for exact comparisons. The review report is not a patch; long paths and values are shortened and may contain sensitive data. Inputs stay in your browser.' }));
  },

  'json-formatter'(root) {
    const inp = textarea({ value: '{\n  "hello": "world",\n  "items": [1, 2, 3],\n  "nested": {"works": true}\n}', rows: 12, placeholder: 'Paste JSON here…' });
    const indent = select({ id: 'indent', options: [{ v: 2, t: '2 spaces' }, { v: 4, t: '4 spaces' }, { v: 1, t: '1 space' }, { v: 3, t: '3 spaces' }], value: '2' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Formatted JSON', download: true, downloadName: 'formatted.json', downloadMime: 'application/json;charset=utf-8' });
    const tree = h('div', { class: 'json-tree' });
    const invalidate = () => { tree.replaceChildren(); out.placeholder(); status.set('Input or indentation changed. Run again.', 'info'); };
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
    const showTree = () => {
      tree.replaceChildren();
      try {
        const data = jsonTree(inp.value);
        const render = (node, label, depth = 0) => {
          const prefix = label == null ? 'Root' : label;
          if (node.type === 'value') {
            const text = `${prefix}: ${node.raw}`;
            return { el: h('div', { class: 'json-tree-value', text }), text, children: [] };
          }
          const text = `${prefix}: ${node.type} (${node.children.length})`;
          const details = h('details', { open: depth === 0 }, h('summary', { text }));
          const childrenEl = h('div', { class: 'json-tree-children' });
          const children = node.children.map((entry, index) => render(entry.node, entry.key ?? `[${index}]`, depth + 1));
          children.forEach(child => childrenEl.append(child.el)); details.append(childrenEl);
          return { el: details, text, children };
        };
        const rootNode = render(data, null);
        const search = input({ type: 'search', placeholder: 'Find keys or values…', maxlength: 200 });
        const matches = h('p', { class: 'hint', role: 'status', 'aria-live': 'polite' });
        let previousStates = null;
        const filter = () => {
          const query = search.value.toLocaleLowerCase(), active = !!query; let count = 0;
          if (active && !previousStates) {
            previousStates = new Map();
            const save = node => { if (node.el.tagName === 'DETAILS') previousStates.set(node.el, node.el.open); node.children.forEach(save); }; save(rootNode);
          }
          const visit = node => {
            let descendant = false;
            for (const child of node.children) if (visit(child)) descendant = true;
            const matched = active && node.text.toLocaleLowerCase().includes(query);
            if (matched) count++;
            node.el.hidden = active && !matched && !descendant;
            if (active && node.el.tagName === 'DETAILS' && descendant) node.el.open = true;
            return matched || descendant;
          };
          visit(rootNode);
          if (!active && previousStates) { for (const [el, open] of previousStates) el.open = open; previousStates = null; }
          matches.textContent = active ? `${count} matching ${count === 1 ? 'item' : 'items'}. Search checks displayed keys and raw values.` : '';
        };
        search.addEventListener('input', filter);
        tree.append(h('h3', { text: 'JSON tree (read-only)' }), h('p', { class: 'hint', text: 'Expand items to inspect original values. Numbers and duplicate keys are preserved; editing happens in the input above.' }), field({ label: 'Search JSON tree', control: search }), matches, rootNode.el);
        status.set('Tree ready. Expand items to inspect.', 'success');
      } catch (e) { status.set(e.message, 'error'); }
    };
    root.append(
      field({ label: 'JSON input', control: inp }),
      actionsRow(
        btn({ label: 'Format', icon: 'braces', onClick: () => run('format') }),
        btn({ label: 'Minify', variant: 'secondary', icon: 'minimize', onClick: () => run('minify') }),
        btn({ label: 'View tree', variant: 'secondary', onClick: showTree }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; tree.replaceChildren(); out.placeholder(); status.set('Cleared.'); inp.focus(); } }),
        h('span', { style: 'display:inline-flex;align-items:center;gap:8px;margin-left:auto' }, h('label', { for: 'indent', class: 'hint', text: 'Indent' }), indent),
      ),
      status, tree, h('br'), out.panel,
    );
    inp.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run('format'); });
  },

  'json-validator'(root) {
    const inp = textarea({ rows: 12, placeholder: 'Paste JSON to validate…' });
    const file = input({type:'file', accept:'.json,application/json'});
    const status = statusLine('Ready.');
    const detail = h('div', {});
    let timer, revision = 0;
    const invalidate = () => { clearTimeout(timer); detail.replaceChildren(); };
    window.addEventListener('pagehide', () => { revision++; clearTimeout(timer); }, {once:true});
    const run = () => {
      clearTimeout(timer);
      const src = inp.value;
      detail.replaceChildren();
      if (!src.trim()) { status.set('Paste some JSON first.', 'warning'); return; }
      const v = validateJson(src);
      if (v.ok) {
        if (v.duplicateKeys?.length) {
          status.set(`Valid JSON ✓ (with duplicate object keys: ${v.duplicateKeys.slice(0, 4).join(', ')}${v.duplicateKeys.length > 4 ? '…' : ''}). Other parsers may overwrite values.`, 'warning');
        } else status.set('Valid JSON ✓ — the document parses cleanly.', 'success');
      } else {
        status.set(`${/limit/.test(v.message) ? 'Unable to validate' : 'Invalid JSON'} — line ${v.line}, column ${v.column}`, 'error');
        detail.append(errorBanner(v.message, `Line ${v.line}, column ${v.column}. Fix this spot and validate again.`));
        if (!/limit/.test(v.message)) detail.append(btn({label:'Go to error', variant:'secondary', onClick:() => { inp.focus(); inp.setSelectionRange(v.position, v.position); }}));
      }
    };
    file.addEventListener('change', async () => {
      const selected = file.files?.[0]; file.value = ''; if (!selected) return;
      const token = ++revision; invalidate();
      try {
        if (!/\.json$/i.test(selected.name) || selected.size > 4000000) throw new Error('Choose a .json file up to 4,000,000 bytes.');
        status.set('Reading JSON locally…', 'info');
        const bytes = await readFile(selected, 'buffer'); if (token !== revision) return;
        let text; try { text = new TextDecoder('utf-8', {fatal:true}).decode(bytes); } catch { throw new Error('File is not valid UTF-8.'); }
        if (text.length > 1000000) throw new Error('File exceeds the 1,000,000-character limit.');
        inp.value = text; run();
      } catch (e) { if (token === revision) status.set(`${e.message || 'Could not read that file.'} Existing input was kept.`, 'error'); }
    });
    root.append(field({ label: 'JSON to validate', control: inp }),
      field({label:'Load local JSON file', control:file, hint:'UTF-8 .json, up to 4,000,000 bytes and 1,000,000 characters. Existing text is kept on failure.'}),
      actionsRow(btn({ label: 'Validate', icon: 'check-circle', onClick: () => { revision++; run(); } }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { revision++; invalidate(); inp.value = ''; file.value = ''; status.set('Cleared.'); inp.focus(); } })),
      status, detail, privacyNote('Files are read and validated in your browser. Syntax validation does not validate a JSON Schema.'));
    inp.addEventListener('input', () => { revision++; invalidate(); status.set('Input changed. Checking shortly…', 'info'); timer = setTimeout(run, 400); });
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
        if (src.length > 1000000) throw new Error('Text exceeds 1,000,000 UTF-16 code units.');
        const result = mode === 'encode' ? b64encode(src, urlSafe.querySelector('input').checked) : b64decode(src);
        out.set(result);
        status.set(`${mode === 'encode' ? 'Encoded' : 'Decoded'} ✓ (${result.length.toLocaleString()} characters).`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    inp.addEventListener('input', () => { out.placeholder(); status.set('Input changed. Run the conversion again.', 'info'); });
    urlSafe.addEventListener('change', () => { out.placeholder(); status.set('Settings changed. Run the conversion again.', 'info'); });
    const file = input({type:'file'});
    const fileMode = select({options:[{v:'encode',t:'Encode binary file to Base64 text'}, {v:'decode',t:'Decode Base64 text file to binary'}],value:'encode'});
    const fileStatus = statusLine('Choose a file to begin.');
    let revision = 0, prepared = null;
    const download = btn({label:'Download prepared file',variant:'secondary',icon:'download',disabled:true,onClick:()=>{
      if (!prepared) return;
      const ok=downloadBlob(prepared.blob,prepared.name);
      fileStatus.set(ok?'Download requested. Check your browser downloads.':'Could not start download.',ok?'success':'error');
    }});
    const invalidateFile = () => {revision++; prepared=null; download.disabled=true; fileStatus.set('File or settings changed. Prepare again.','info');};
    file.addEventListener('change',invalidateFile);
    fileMode.addEventListener('change',invalidateFile);
    urlSafe.addEventListener('change',invalidateFile);
    window.addEventListener('pagehide',()=>{revision++;prepared=null;},{once:true});
    const prepare = async () => {
      const token=++revision; prepared=null; download.disabled=true;
      const selected=file.files?.[0];
      if (!selected) {fileStatus.set('Choose a file first.','warning');return;}
      const mode=fileMode.value, safe=urlSafe.querySelector('input').checked;
      const maxFile=mode==='decode'?3145728:2097152;
      if (!selected.size || selected.size > maxFile) {fileStatus.set(`Choose a non-empty file up to ${mode==='decode'?'3':'2'} MiB.`, 'error');return;}
      try {
        fileStatus.set('Reading file locally…','info');
        const bytes = new Uint8Array(await readFile(selected,'buffer')); if(token!==revision)return;
        if (mode==='encode') {
          const result=b64encodeBytes(bytes,safe);
          prepared={blob:new Blob([result],{type:'text/plain;charset=utf-8'}),name:'encoded-base64.txt'};
        } else if (mode==='decode') {
          let encoded; try { encoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes); } catch {throw new Error('Base64 file must be valid UTF-8 text.');}
          const result=b64decodeBytes(encoded);
          if(result.length > 2097152) throw new Error('Decoded file exceeds 2 MiB.');
          prepared={blob:new Blob([result],{type:'application/octet-stream'}),name:'decoded-file.bin'};
        } else throw new Error('Choose a valid file operation.');
        download.disabled=false; fileStatus.set('File prepared locally. Review before downloading.','success');
      } catch(e) {if(token===revision) fileStatus.set(e.message || 'Could not read file.','error');}
    };
    root.append(field({ label: 'Input', control: inp }),
      actionsRow(
        btn({ label: 'Encode → Base64', icon: 'arrow-right', onClick: () => run('encode') }),
        btn({ label: 'Decode ← Base64', variant: 'secondary', icon: 'arrow-left', onClick: () => run('decode') }),
        urlSafe,
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } }),
      ),
      h('p',{class:'hint',text:'Text limit: 1,000,000 UTF-16 code units. Text is UTF-8; Base64 is encoding, not encryption.'}),
      status, h('br'), out.panel,
      h('h3',{text:'Binary file conversion'}),
      field({label:'File operation',control:fileMode}), field({label:'Choose file',control:file,hint:'Binary input: up to 2 MiB. Base64 text input: up to 3 MiB and 2 MiB decoded; one UTF-8 payload.'}),
      h('p',{class:'hint',text:'URL-safe output applies to encoding. Whitespace is ignored when decoding; data URLs and separate per-line payloads are not supported. Decoded files use a generic .bin extension. Do not run untrusted decoded files.'}),
      actionsRow(btn({label:'Prepare file',icon:'file',onClick:prepare}),download,btn({label:'Clear file',variant:'ghost',icon:'x',onClick:()=>{file.value='';invalidateFile();fileStatus.set('File cleared.','info');}})),
      fileStatus, privacyNote('Text and files are processed locally in your browser.'));
  },

  'url-encoder'(root) {
    const inp = textarea({ rows: 8, placeholder: 'Paste text or a URL…' });
    const mode = segControl({ options: [{ v: 'component', t: 'Component' }, { v: 'full', t: 'Full URL' }], value: 'component', ariaLabel: 'Encoding scope' });
    const plus = switchChip({ label: 'Treat + as space when decoding' });
    const perLine = switchChip({label:'Convert each line separately'});
    const status = statusLine('Component mode uses encodeURIComponent; full-URL mode uses encodeURI.');
    const out = resultPanel({ label: 'Output', download:true, downloadName:'url-conversion.txt' });
    const run = (dir) => {
      try {
        if (inp.value.length > 1000000) throw new Error('Input exceeds 1,000,000 UTF-16 code units.');
        if (!inp.value) throw new Error('Enter input first.');
        const result = perLine.querySelector('input').checked
          ? urlConvertLines(inp.value,dir,mode.getValue(),plus.querySelector('input').checked)
          : dir === 'encode' ? urlEncode(inp.value, mode.getValue()) : urlDecode(inp.value, mode.getValue(), plus.querySelector('input').checked);
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
        field({ label: 'Options', control: h('div',{class:'switch-row'},plus,perLine) })),
      h('p',{class:'hint',text:"Limit: 1,000,000 UTF-16 code units; per-line mode allows up to 50,000 lines, preserves blank lines and emits LF. Component mode leaves ! ' ( ) * unescaped; full-URL mode preserves reserved separators. Neither mode validates a URL or generates form-encoded output."}),
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
      try {
        const n = Number(count.value);
        if (!count.value.trim() || !Number.isInteger(n) || n < 1 || n > 500) throw new Error('Count must be a whole number between 1 and 500.');
        current = Array.from({ length: n }, () => {
          let u = uuidv4();
          if (noDash.querySelector('input').checked) u = u.replace(/-/g, '');
          if (upper.querySelector('input').checked) u = u.toUpperCase();
          return u;
        });
        render();
        status.set(`${n} UUID${n === 1 ? '' : 's'} generated with crypto.getRandomValues ✓`, 'success');
      } catch (e) { current = []; render(); status.set(e.message, 'error'); }
    };
    const invalidate = () => { current = []; render(); status.set('Settings changed. Generate new UUIDs.', 'info'); };
    root.addEventListener('input', invalidate); root.addEventListener('change', invalidate);
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
    const dateIn = input({ type: 'datetime-local', step:'0.001' });
    const wallZone = select({options:[{v:'local',t:'Browser local time'},{v:'utc',t:'UTC'}],value:'local'});
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
        field({ label: '…or pick a date', control: dateIn, hint:'Seconds and milliseconds are optional.' }),
        field({ label: 'Date input timezone', control: wallZone }),
        h('div', {class:'field'}, btn({ label: 'Convert to timestamp', variant: 'secondary', icon: 'calendar', onClick: () => {
          try {
            if (!dateIn.value) throw new Error('Pick a date first.');
            const date = parseWallDateTime(dateIn.value, wallZone.value);
            showDate(date); status.set(wallZone.value === 'utc' ? 'Interpreted as UTC.' : 'Interpreted in your browser local timezone; repeated daylight-saving times are ambiguous.', 'info');
          } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
        } }))),
      h('p',{class:'hint',text:'Unix seconds are rounded down to a whole second, including negative timestamps. Milliseconds retain the exact instant. Local repeated daylight-saving times are ambiguous; choose UTC for an unambiguous instant.'}),
      status, h('br'), out.panel);
  },

  'hash-generator'(root) {
    const algo = select({ id: 'algo', options: HASH_ALGOS.map((a) => ({ v: a, t: a.replace('SHA-', 'SHA-') })), value: 'SHA-256' });
    const enc = select({ id: 'enc', options: [{ v: 'hex', t: 'Hexadecimal' }, { v: 'base64', t: 'Base64' }], value: 'hex' });
    const inp = textarea({ rows: 7, placeholder: 'Type or paste text to hash…' });
    const expected = input({type:'text',class:'input mono',placeholder:'Optional hexadecimal digest'});
    const compareStatus = statusLine('');
    let currentDigest = null;
    const compare = () => {
      if (!expected.value.trim()) {compareStatus.set('', 'info'); return;}
      if (!currentDigest) {compareStatus.set('Hash text or a file before comparing.', 'info'); return;}
      try {const match=compareHexDigest(expected.value.trim(),currentDigest.hex,currentDigest.algorithm); compareStatus.set(match?'Digest matches the expected value.':'Digest does not match the expected value.',match?'success':'warning');}
      catch(e) {compareStatus.set(e.message,'error');}
    };
    expected.addEventListener('input',compare);
    const zone = h('div');
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Digest', copy: true });
    let revision = 0;
    const invalidate = () => { revision++; currentDigest=null; out.placeholder(); compare(); status.set('Input or settings changed. Hash again.', 'info'); };
    [inp, algo, enc].forEach(el => { el.addEventListener('input', invalidate); el.addEventListener('change', invalidate); });
    const compute = async (buffer, sourceDesc, token = ++revision) => {
      const a = algo.value, encoding = enc.value;
      currentDigest=null; compare(); out.placeholder(); status.set(`Computing ${a}…`, 'info');
      try {
        const bytes = await digest(a, buffer);
        if (token !== revision) return;
        currentDigest={hex:toHex(bytes),algorithm:a};
        out.set(encoding === 'hex' ? currentDigest.hex : toB64(bytes));
        compare(); status.set(`${a} of ${sourceDesc} ✓`, 'success');
      } catch (e) { if (token === revision) { out.placeholder(); status.set(e.message, 'error'); } }
    };
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Algorithm', control: algo }),
        field({ label: 'Output', control: enc })),
      field({ label: 'Text input', control: inp }),
      actionsRow(
        btn({ label: 'Hash text', icon: 'hash', onClick: () => { if(inp.value.length > 1000000) {invalidate(); status.set('Text exceeds 1,000,000 UTF-16 code units.','error'); return;} compute(new TextEncoder().encode(inp.value), 'text'); } }),
      ),
      status, h('br'), out.panel,
      field({label:'Expected hexadecimal digest (optional)',control:expected,hint:'Compare the complete hex digest for the selected algorithm; case is ignored.'}), compareStatus,
      h('p',{class:'hint',text:'A match only shows the bytes have the same digest; it does not prove the source is authentic. Obtain the expected checksum from a trusted, authenticated source. SHA-1 is legacy and unsuitable for security-sensitive integrity checks.'}),
      h('div', { style: 'margin-top:18px' },
        h('h3', { text: '…or hash a file' }),
        h('div', { class: 'field' }, h('span', { class: 'hint', text: 'Useful for verifying downloads. Files up to 100 MiB are read locally into memory.' })),
        zone));
    window.addEventListener('pagehide',()=>{revision++;currentDigest=null;},{once:true});
    zone.append(h('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' },
      h('label', { class: 'btn btn-secondary', style: 'cursor:pointer' }, 'Choose file',
        h('input', { type: 'file', style: 'display:none', onchange: (e) => {
          const f = e.target.files[0];
          if (!f) return;
          const token = ++revision; currentDigest=null; compare(); out.placeholder();
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
    const highlight = h('div', { class: 'result-body', tabindex: '0', role: 'region', 'aria-label': 'Match highlights', style: 'max-height:220px' });
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
          h('div', { class: 'result-body', tabindex: '0', role: 'region', 'aria-label': 'Result details' }, fmt(obj)));
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
