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
  const dupKeys = [];
  const ws = () => { while (i < n && /[\t\n\r ]/.test(text[i])) i++; };

  function parseValue(keyPath) {
    ws();
    if (i >= n) return err('Unexpected end of input — a value was expected here.', i);
    const c = text[i];
    if (c === '{') return parseObject(keyPath);
    if (c === '[') return parseArray(keyPath);
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
      try { key = JSON.parse(text.slice(s.valueStart, s.valueEnd)); }
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
  if (v.duplicateKeys?.length) console.warn('Duplicate keys:', v.duplicateKeys);
  return JSON.parse(text);
}

export function jsonFormat(text, indent = 2) { return JSON.stringify(jsonParse(text), null, Math.max(0, Math.min(10, indent))); }
export function jsonMinify(text) { return JSON.stringify(jsonParse(text)); }
export function countJsonWhitespace(text) { return (text.match(/\s/g) || []).length; }

/* ═══════════════════════════ Base64 ═══════════════════════════ */
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export function b64encode(text, urlSafe = false) {
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
  while (s.length % 4) s += '=';
  if (s.length % 4 !== 0) throw new Error('This is not valid Base64: its length is not a multiple of 4.');
  let bin;
  try { bin = atob(s); } catch { throw new Error('This is not valid Base64: the padding or character sequence is malformed.'); }
  const bytes = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
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

/* ═══════════════════════════ Timestamps ═══════════════════════════ */
export function parseTimestamp(raw) {
  const s = String(raw).trim();
  if (!/^-?\d+$/.test(s)) throw new Error('A Unix timestamp is a whole number of seconds or milliseconds, like 1735689600 or 1735689600000.');
  let num = Number(s);
  if (!Number.isSafeInteger(num)) throw new Error('That number is too large to be a valid timestamp.');
  if (Math.abs(num) >= 1e12) num = num; // ms
  else num = num * 1000;
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

/* ═══════════════════════════ Regex ═══════════════════════════ */
export function findMatches(pattern, flags, text) {
  let re;
  try { re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g'); }
  catch (e) { return { error: `Invalid regular expression: ${e.message}` }; }
  try {
    const matches = [];
    if (pattern === '') return { matches };
    if (!flags.includes('g')) {
      const m = re.exec(text);
      if (m) matches.push(m);
    } else {
      for (const m of text.matchAll(re)) {
        matches.push(m);
        if (matches.length >= 1000) break;
      }
    }
    return { matches: matches.map((m) => ({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups || null })) };
  } catch (e) { return { error: e.message }; }
}

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
  if (parts.length < 2) throw new Error('A JWT has three dot-separated parts (header.payload.signature). This token has fewer than two.');
  let header, payload;
  try { header = JSON.parse(b64urlToText(parts[0])); } catch { throw new Error('The header (first part) is not valid Base64URL-encoded JSON.'); }
  try { payload = JSON.parse(b64urlToText(parts[1])); } catch { throw new Error('The payload (second part) is not valid Base64URL-encoded JSON.'); }
  const claims = {};
  for (const key of ['iat', 'nbf', 'exp']) {
    if (payload[key] !== undefined && Number.isFinite(Number(payload[key]))) {
      claims[key] = { ts: Number(payload[key]) * 1000, text: new Date(Number(payload[key]) * 1000).toUTCString() };
    }
  }
  return { header, payload, claims, signature: parts[2] || null, algorithm: header.alg || null };
}

/* ═══════════════════════════ HTML formatter ═══════════════════════════ */
const INLINE = new Set(['a','abbr','b','bdi','bdo','br','cite','code','data','dfn','em','i','kbd','mark','q','rp','rt','s','samp','small','span','strong','sub','sup','time','u','var','wbr','img','input','select','option','button','label','del','ins','bdo','picture','source','svg','path','use']);
const RAW = new Set(['script', 'style', 'pre', 'textarea']);

export function formatHtml(html, indentSize = 2, minify = false) {
  if (!html.trim()) throw new Error('Nothing to format — the input is empty.');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  const IND = ' '.repeat(indentSize);
  let hasDoctype = false;
  for (const node of doc.childNodes) {
    if (node.nodeType === 10) { hasDoctype = true; out.push(minify ? '' : '<!DOCTYPE html>'); }
  }
  const serializeAttrs = (el) => [...el.attributes].map((a) => a.value === '' ? ` ${a.name}` : ` ${a.name}="${a.value.replace(/"/g, '&quot;')}"`).join('');

  function walk(node, depth) {
    if (node.nodeType === 3) { // text
      const text = node.textContent;
      if (!text.trim()) { if (minify) return; if (!out.length) return; out.push(''); return; }
      const clean = minify ? text.replace(/\s+/g, ' ') : text.replace(/\s+/g, ' ').trim();
      const pad = minify ? '' : IND.repeat(depth);
      const lines = clean.split('\n');
      for (const l of lines) if (l.trim() || !minify) out.push(pad + l.trim());
      return;
    }
    if (node.nodeType === 8) { if (!minify) out.push(IND.repeat(depth) + `<!--${node.textContent}-->`); return; }
    if (node.nodeType !== 1) return;
    const el = node;
    const tag = el.tagName.toLowerCase();
    const open = `<${tag}${serializeAttrs(el)}>`;
    if (RAW.has(tag)) {
      const content = el.textContent ?? '';
      if (minify) out.push(open + content.trim() + `</${tag}>`);
      else {
        out.push(IND.repeat(depth) + open);
        for (const line of content.replace(/\t/g, '    ').split('\n')) out.push(line.trimEnd() || '');
        out.push(IND.repeat(depth) + `</${tag}>`);
      }
      return;
    }
    const elementOnly = el.childNodes.length === 0;
    const childrenInline = [...el.childNodes].every((c) => c.nodeType === 3 || (c.nodeType === 1 && INLINE.has(c.tagName.toLowerCase())));
    const inlineLen = el.textContent.replace(/\s+/g, ' ').trim().length + tag.length * 2 + serializeAttrs(el).length;
    const inlineText = childrenInline && !elementOnly && (minify || inlineLen <= 100);
    if (elementOnly) { out.push((minify ? '' : IND.repeat(depth)) + open + `</${tag}>`); return; }
    if (inlineText) {
      const inner = minify
        ? el.innerHTML.replace(/\s+/g, ' ').trim()
        : [...el.childNodes].map((c) => c.nodeType === 3 ? c.textContent.replace(/\s+/g, ' ').trim() : c.outerHTML).join(' ').replace(/> </g, '><').trim();
      out.push((minify ? '' : IND.repeat(depth)) + open + inner + `</${tag}>`);
      return;
    }
    if (!minify) out.push(IND.repeat(depth) + open);
    else out.push(open);
    for (const child of el.childNodes) walk(child, minify ? depth : depth + 1);
    if (!minify) out.push(IND.repeat(depth) + `</${tag}>`);
    else out.push(`</${tag}>`);
  }
  const looksLikeDocument = /<html[\s>]/i.test(html) || /<head[\s>]/i.test(html) || /<body[\s>]/i.test(html);
  const sourceNodes = looksLikeDocument ? [...doc.documentElement.childNodes] : [...doc.body.childNodes];
  for (const child of sourceNodes) walk(child, 1);
  const body = (looksLikeDocument && !minify ? '<!DOCTYPE html>\n' : '') + (minify ? out.join('') : out.join('\n'));
  return minify ? body : body.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
export function minifyHtml(html) { return formatHtml(html, 2, true); }

/* ═══════════════════════════ CSS formatter ═══════════════════════════ */
function lexCss(css) {
  const tokens = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      tokens.push({ type: 'comment', value: css.slice(i, stop) });
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && css[j] !== c) { if (css[j] === '\\') j++; j++; }
      tokens.push({ type: 'string', value: css.slice(i, Math.min(j + 1, n)) });
      i = j + 1;
    } else if ('{}();:,'.includes(c)) {
      tokens.push({ type: 'punct', value: c });
      i++;
    } else if (/\s/.test(c)) {
      let j = i;
      while (j < n && /\s/.test(css[j])) j++;
      tokens.push({ type: 'ws', value: css.slice(i, j) });
      i = j;
    } else {
      let j = i;
      while (j < n && !'{}();:,'.includes(css[j]) && !/\s/.test(css[j]) && !(css[j] === '/' && css[j + 1] === '*') && css[j] !== '"' && css[j] !== "'") {
        if (css[j] === '\\') j++;
        j++;
      }
      tokens.push({ type: 'text', value: css.slice(i, j) });
      i = j;
    }
  }
  return tokens;
}

export function formatCss(css, indentSize = 2) {
  if (!css.trim()) throw new Error('Nothing to format — the input is empty.');
  const tokens = lexCss(css).filter((t) => t.type !== 'ws');
  const IND = ' '.repeat(indentSize);
  const out = [];
  let depth = 0;
  let pending = '';   // accumulated selector/declaration text
  let pendingIsDecl = false;
  const emitPending = () => {
    let text = pending.trim();
    pending = '';
    if (!text) return;
    if (text !== '}' && pendingIsDecl && !text.endsWith(';')) text += ';';
    if (text.startsWith('/*')) { out.push(IND.repeat(depth) + text); return; }
    if (pendingIsDecl) {
      // split declarations on top-level ; handled by caller; text may hold "prop: value"
      out.push(IND.repeat(depth) + text);
    } else {
      out.push(IND.repeat(depth) + text);
    }
  };
  const collapseWs = (s) => s.replace(/\s+/g, ' ').replace(/\s*([:;,()])\s*/g, (m, p) => (p === ',' ? ', ' : p)).trim();

  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.type === 'comment') {
      if (pending.trim()) { emitPending(); }
      out.push(IND.repeat(depth) + t.value);
      continue;
    }
    if (t.type === 'punct') {
      if (t.value === '{') {
        const sel = collapseWs(pending);
        pending = '';
        out.push(IND.repeat(depth) + sel + ' {');
        depth++;
        pendingIsDecl = true;
      } else if (t.value === '}') {
        if (pending.trim()) emitPending();
        pendingIsDecl = false;
        depth = Math.max(0, depth - 1);
        out.push(IND.repeat(depth) + '}');
      } else if (t.value === ';') {
        pendingIsDecl = true;
        emitPending();
      } else if (t.value === ':') {
        pending += ':';
        if (depth > 0) pendingIsDecl = true;
      } else if (t.value === ',') {
        pending += ', ';
      }
      continue;
    }
    // text/string: accumulate with smart spacing
    if (pending.endsWith(':')) pending += ' ';
    pending += t.value;
  }
  emitPending();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function minifyCss(css) {
  if (!css.trim()) throw new Error('Nothing to minify — the input is empty.');
  const tokens = lexCss(css);
  let out = '';
  const collapse = (s) => s.replace(/\s+/g, ' ');
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.type === 'ws') { out += ' '; continue; }
    if (t.type === 'comment') { if (t.value.startsWith('/*!')) out += t.value; continue; }
    if (t.type === 'punct') { out += t.value; continue; }
    out += collapse(t.value);
  }
  return out
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+!important/gi, '!important')
    .trim();
}

/* ═══════════════════════════ JavaScript formatter ═══════════════════════════ */
function lexJs(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  const prevSignificant = () => { for (let k = tokens.length - 1; k >= 0; k--) { if (tokens[k].type !== 'nl') return tokens[k]; } return null; };
  const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '/', '%', '<', '>', '^', '~', '=>']);
  const REGEX_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
  while (i < n) {
    const c = src[i];
    if (c === '\n') { tokens.push({ type: 'nl' }); i++; continue; }
    if (/\s/.test(c)) { let j = i; while (j < n && /\s/.test(src[j]) && src[j] !== '\n') j++; tokens.push({ type: 'ws' }); i = j; continue; }
    if (c === '/' && src[i + 1] === '/') { const end = src.indexOf('\n', i); const stop = end === -1 ? n : end; tokens.push({ type: 'comment', value: src.slice(i, stop) }); i = stop; continue; }
    if (c === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i + 2); const stop = end === -1 ? n : end + 2; tokens.push({ type: 'comment', value: src.slice(i, stop) }); i = stop; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; if (src[j] === '\n') break; j++; }
      if (src[j] !== c) throw new Error('Unterminated string literal — a closing quote is missing before the end of a line.');
      tokens.push({ type: 'string', value: src.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (c === '`') {
      let j = i + 1, depthStack = [];
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') { depthStack.push(true); j += 2; continue; }
        if (src[j] === '}' && depthStack.length) { depthStack.pop(); j++; continue; }
        if (src[j] === '`' && !depthStack.length) break;
        j++;
      }
      if (j >= n) throw new Error('Unterminated template literal — a closing backtick is missing.');
      tokens.push({ type: 'template', value: src.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (c === '/') {
      const prev = prevSignificant();
      const looksLikeRegex = !prev
        || (prev.type === 'punct' && !['))', ')', ']', '}', '++', '--'].includes(prev.value) && REGEX_PRECEDERS.has(prev.value[0]))
        || (prev.type === 'word' && REGEX_KEYWORDS.has(prev.value));
      if (looksLikeRegex) {
        let j = i + 1, inClass = false;
        while (j < n) {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '[') inClass = true;
          else if (src[j] === ']') inClass = false;
          else if (src[j] === '/' && !inClass) break;
          else if (src[j] === '\n') throw new Error('Unterminated regular expression literal.');
          j++;
        }
        if (j >= n) throw new Error('Unterminated regular expression literal.');
        let k = j + 1;
        while (k < n && /[a-z]/.test(src[k])) k++;
        tokens.push({ type: 'regex', value: src.slice(i, k) });
        i = k;
        continue;
      }
      // fall through as punct
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < n && /[0-9a-fA-FxXoObBn._]/.test(src[j])) j++;
      if (/[eE]$/.test(src.slice(i, j)) === false) tokens.push({ type: 'number', value: src.slice(i, j) });
      else tokens.push({ type: 'number', value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      tokens.push({ type: 'word', value: src.slice(i, j) });
      i = j;
      continue;
    }
    // punct (multi-char ops)
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    if (['===', '!==', '**=', '<<=', '>>=', '...', '&&=', '||=', '??='].includes(three)) { tokens.push({ type: 'punct', value: three }); i += 3; continue; }
    if (['=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '**', '<<', '>>', '&=', '|=', '^=', '})', ').'].includes(two)) { tokens.push({ type: 'punct', value: two }); i += 2; continue; }
    tokens.push({ type: 'punct', value: c });
    i++;
  }
  return tokens;
}

export function formatJs(src, indentSize = 2) {
  if (!src.trim()) throw new Error('Nothing to format — the input is empty.');
  const tokens = lexJs(src);
  const IND = ' '.repeat(indentSize);
  // Rebuild lines: a new line is emitted where the source had one, or after ; { and before }
  const lines = [];
  let line = '';
  let depth = 0;
  let pendingIndent = '';
  const flush = () => {
    const t = line.replace(/\s+$/, '');
    lines.push(t ? pendingIndent + t : '');
    line = '';
    pendingIndent = IND.repeat(depth);
  };
  let prevType = null;
  for (const t of tokens) {
    if (t.type === 'nl') { flush(); prevType = 'nl'; continue; }
    if (t.type === 'ws') { if (line && !line.endsWith(' ') && prevType !== 'nl') line += ' '; continue; }
    if (t.type === 'punct') {
      if (t.value === '{') { line = line.replace(/\s*$/, '') + ' {'; depth++; flush(); prevType = 'punct'; continue; }
      if (t.value === '}') {
        flush();
        depth = Math.max(0, depth - 1);
        pendingIndent = IND.repeat(depth);
        line = '}';
        // peek: `} else`, `} catch`, `},`, `};` keep on same line — handled by following tokens appending
        prevType = 'punct';
        continue;
      }
      if (t.value === ';') { line += ';'; flush(); prevType = 'punct'; continue; }
      line += t.value;
      prevType = 'punct';
      continue;
    }
    if (t.type === 'comment' && t.value.startsWith('//')) { if (line.trim()) flush(); lines.push(pendingIndent + t.value); prevType = 'comment'; continue; }
    const needsSpace = (prevType === 'word' && t.type === 'word')
      || (/[})\]]$/.test(line) && t.type === 'word')
      || (t.type === 'template' && /[\w)$]/.test(line.slice(-1)));
    if (needsSpace && !line.endsWith(' ')) line += ' ';
    line += t.value;
    prevType = t.type;
  }
  flush();
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'json-formatter'(root) {
    const inp = textarea({ value: '{\n  "hello": "world",\n  "items": [1, 2, 3],\n  "nested": {"works": true}\n}', rows: 12, placeholder: 'Paste JSON here…' });
    const indent = select({ id: 'indent', options: [{ v: 2, t: '2 spaces' }, { v: 4, t: '4 spaces' }, { v: 1, t: '1 space' }, { v: 3, t: '3 spaces' }], value: '2' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Formatted JSON', download: true, downloadName: 'formatted.json', downloadMime: 'application/json;charset=utf-8' });
    const run = (mode) => {
      const src = inp.value;
      if (!src.trim()) { status.set('Paste some JSON first.', 'warning'); out.placeholder('Paste JSON above, then click Format or Minify.'); return; }
      try {
        const result = mode === 'minify' ? jsonMinify(src) : jsonFormat(src, Number(indent.value));
        out.set(result);
        const before = new Blob([src]).size, after = new Blob([result]).size;
        status.set(`Valid JSON ✓ — ${fmtBytes(before)} → ${fmtBytes(after)}.`, 'success');
      } catch (e) {
        out.placeholder();
        status.set(`Line ${e.line}, column ${e.column}: ${e.message}`, 'error');
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
        status.set(`Invalid JSON — line ${v.line}, column ${v.column}`, 'error');
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
    root.append(field({ label: 'JSON input', control: inp }),
      actionsRow(btn({ label: 'Minify', icon: 'minimize', onClick: () => {
        if (!inp.value.trim()) { status.set('Paste some JSON first.', 'warning'); return; }
        try {
          const result = jsonMinify(inp.value);
          out.set(result);
          const before = new Blob([inp.value]).size, after = new Blob([result]).size;
          const saved = before ? Math.round((1 - after / before) * 100) : 0;
          status.set(`Done — ${fmtBytes(before)} → ${fmtBytes(after)} (${saved}% smaller).`, 'success');
        } catch (e) { out.placeholder(); status.set(`Line ${e.line}, column ${e.column}: ${e.message}`, 'error'); }
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
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Conversion', copy: true });
    const showDate = (d) => {
      const p = dateToParts(d);
      out.set(`ISO 8601 (UTC): ${p.iso}\nUTC:            ${p.utc}\nLocal:          ${p.local}\nUnix seconds:      ${p.seconds}\nUnix milliseconds: ${p.ms}\nRelative:       ${p.relative}`);
      status.set('Converted ✓', 'success');
    };
    root.append(
      field({ label: 'Unix timestamp', control: ts, hint: 'Seconds or milliseconds — auto-detected' }),
      actionsRow(btn({ label: 'Convert to date', icon: 'clock', onClick: () => {
        try { showDate(parseTimestamp(ts.value)); }
        catch (e) { out.placeholder(); status.set(e.message, 'error'); }
      } }),
        btn({ label: 'Now', variant: 'secondary', onClick: () => { ts.value = String(Math.floor(Date.now() / 1000)); showDate(new Date()); } })),
      h('div', { class: 'field-row', style: 'align-items:end; margin-top:6px' },
        field({ label: '…or pick a date', control: dateIn }),
        field({ label: ' ', control: btn({ label: 'Convert to timestamp', variant: 'secondary', icon: 'calendar', onClick: () => {
          if (!dateIn.value) { status.set('Pick a date first.', 'warning'); return; }
          showDate(new Date(dateIn.value));
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
    const compute = async (buffer, sourceDesc) => {
      try {
        const a = algo.value;
        const bytes = await digest(a, buffer);
        const hex = toHex(bytes);
        out.set(enc.value === 'hex' ? hex : toB64(bytes));
        status.set(`${a} of ${sourceDesc} ✓`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
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
        h('div', { class: 'field' }, h('span', { class: 'hint', text: 'Useful for verifying downloads. The file is read locally.' })),
        zone));
    zone.append(h('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' },
      h('label', { class: 'btn btn-secondary', style: 'cursor:pointer' }, h('span', { html: require_icon('file'), style: 'display:inline-flex' }), 'Choose file',
        h('input', { type: 'file', style: 'display:none', onchange: (e) => {
          const f = e.target.files[0];
          if (!f) return;
          status.set(`Reading ${f.name} (${fmtBytes(f.size)})…`, 'info');
          readFile(f, 'buffer').then((buf) => compute(buf, f.name)).catch((err) => status.set(err.message, 'error'));
        } }))));
  },

  'regex-tester'(root) {
    const pattern = input({ type: 'text', value: '\\b\\w+@\\w+\\.\\w+\\b', class: 'input mono', placeholder: 'Regular expression, e.g. \\d+' });
    const flags = ['g', 'i', 'm', 's', 'u'].map((f) => switchChip({ label: f, name: f }));
    const test = textarea({ rows: 7, mono: false, value: 'Contact us at hello@example.com or support@ihavetools.example.', placeholder: 'Test string…' });
    const status = statusLine('Matches update as you type.');
    const highlight = h('div', { class: 'result-body', style: 'max-height:220px' });
    const matchesTable = h('div', {});
    const render = () => {
      matchesTable.replaceChildren();
      const fl = flags.filter((c) => c.querySelector('input').checked).map((c) => c.textContent.trim()).join('');
      const r = findMatches(pattern.value, fl, test.value);
      if (r.error) { status.set(r.error, 'error'); highlight.replaceChildren(h('pre', { class: 'placeholder', text: 'Fix the pattern to see matches.' })); return; }
      const ms = r.matches;
      // highlight
      highlight.replaceChildren();
      if (!ms.length) {
        highlight.append(h('pre', { class: 'placeholder', text: 'No matches in the test string.' }));
        status.set('No matches.', 'info');
        return;
      }
      let pos = 0;
      const frag = h('pre', {});
      for (const m of ms.slice(0, 200)) {
        if (m.index > pos) frag.append(document.createTextNode(test.value.slice(pos, m.index)));
        frag.append(h('mark', { text: m.text, style: 'background:var(--primary-soft);color:var(--primary);border-radius:3px;padding:0 2px' }));
        pos = m.index + (m.text.length || 1);
        if (!m.text.length) pos = m.index + 1;
      }
      frag.append(document.createTextNode(test.value.slice(pos)));
      highlight.replaceChildren(frag);
      const rows = ms.slice(0, 100).map((m, i) => [
        String(i + 1),
        m.text.length > 80 ? m.text.slice(0, 80) + '…' : m.text,
        String(m.index),
        m.groups?.length ? m.groups.map((g, gi) => `$${gi + 1}=${g === undefined ? '—' : JSON.stringify(g)}`).join('  ') : '—',
      ]);
      matchesTable.append(h('h3', { text: `Matches (${ms.length}${ms.length >= 1000 ? '+, capped' : ''})`, style: 'margin:18px 0 10px' }),
        rows.length ? table({ headers: ['#', 'Match', 'Position', 'Groups'], rows }) : h('p', { class: 'hint', text: 'No matches.' }));
      status.set(`${ms.length} match${ms.length === 1 ? '' : 'es'} found.`, 'success');
    };
    root.append(
      field({ label: 'Pattern', control: pattern }),
      h('div', { class: 'field' }, h('span', { class: 'field-legend', text: 'Flags' }), h('div', { class: 'switch-row' }, flags)),
      field({ label: 'Test string', control: test }),
      status,
      h('div', { class: 'result-panel', style: 'margin-top:10px' }, highlight),
      matchesTable);
    const debounced = (() => { let t; return () => { clearTimeout(t); t = setTimeout(render, 200); }; })();
    [pattern, test].forEach((el) => el.addEventListener('input', debounced));
    flags.forEach((c) => c.querySelector('input').addEventListener('change', render));
    render();
  },

  'jwt-decoder'(root) {
    const inp = textarea({ rows: 6, placeholder: 'Paste a JWT — it looks like eyJhbGciOi…' });
    const status = statusLine('Ready.');
    const detail = h('div', { class: 'tool-docs', style: 'gap:14px' });
    const run = () => {
      detail.replaceChildren();
      try {
        const { header, payload, claims, signature, algorithm } = decodeJwt(inp.value);
        const fmt = (obj) => h('pre', { text: JSON.stringify(obj, null, 2) });
        const panel = (label, node) => h('section', { class: 'result-panel' },
          h('div', { class: 'result-head' }, h('span', { class: 'result-label', text: label }), h('span', { class: 'spacer' }), copyButton(() => JSON.stringify(node ?? {}, null, 2))),
          h('div', { class: 'result-body' }, node));
        detail.append(
          panel('Header', fmt(header)),
          panel('Payload', fmt(payload)));
        const expInfo = claims.exp
          ? (claims.exp.ts > Date.now()
            ? h('p', { class: 'status-line success', text: `Token expires: ${claims.exp.text} (valid for ${relTime(new Date(claims.exp.ts))}).` })
            : h('p', { class: 'status-line error', text: `Token EXPIRED: ${claims.exp.text} (${relTime(new Date(claims.exp.ts))}).` }))
          : h('p', { class: 'status-line info', text: 'No exp (expiry) claim found.' });
        detail.append(h('div', {},
          expInfo,
          h('p', { class: 'status-line info', text: `Algorithm: ${algorithm || 'not specified'}. Signature: ${signature ? 'present (not verified — decoding only).' : 'missing (unsigned token).'}` })),
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
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Formatted HTML', download: true, downloadName: 'formatted.html', downloadMime: 'text/html;charset=utf-8' });
    const run = (mode) => {
      try {
        const result = mode === 'minify' ? minifyHtml(inp.value) : formatHtml(inp.value, Number(indent.value));
        out.set(result);
        status.set(`${mode === 'minify' ? 'Minified' : 'Formatted'} ✓ — ${fmtBytes(new Blob([result]).size)}.`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'HTML input', control: inp }),
      actionsRow(
        btn({ label: 'Format', icon: 'code', onClick: () => run('format') }),
        btn({ label: 'Minify', variant: 'secondary', icon: 'minimize', onClick: () => run('minify') }),
        h('span', { style: 'margin-left:auto;display:inline-flex;gap:8px;align-items:center' }, h('label', { for: 'htmlindent', class: 'hint', text: 'Indent' }), indent),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'css-formatter'(root) {
    const inp = textarea({ rows: 12, value: ':root{--x:1}body{margin:0;font-family:sans-serif}.card{padding:16px;border:1px solid #eee;border-radius:8px}', placeholder: 'Paste CSS…' });
    const status = statusLine('Ready.');
    const out = resultPanel({ label: 'Result', download: true, downloadName: 'styles.css', downloadMime: 'text/css;charset=utf-8' });
    const run = (mode) => {
      try {
        const result = mode === 'minify' ? minifyCss(inp.value) : formatCss(inp.value, 2);
        out.set(result);
        status.set(`${mode === 'minify' ? 'Minified' : 'Formatted'} ✓ — ${fmtBytes(new Blob([result]).size)}.`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'CSS input', control: inp }),
      actionsRow(
        btn({ label: 'Format', icon: 'code', onClick: () => run('format') }),
        btn({ label: 'Minify', variant: 'secondary', icon: 'minimize', onClick: () => run('minify') }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'js-formatter'(root) {
    const inp = textarea({ rows: 12, value: 'function add(a,b){if(!a||!b){return 0}\nreturn a+b}// demo', placeholder: 'Paste JavaScript…' });
    const indent = select({ id: 'jsindent', options: [{ v: 2, t: '2 spaces' }, { v: 4, t: '4 spaces' }], value: '2' });
    const status = statusLine('Re-indents code; strings, templates, comments and regex literals are preserved exactly.');
    const out = resultPanel({ label: 'Formatted JavaScript', download: true, downloadName: 'formatted.js', downloadMime: 'text/javascript;charset=utf-8' });
    const run = () => {
      try {
        const result = formatJs(inp.value, Number(indent.value));
        out.set(result);
        status.set('Formatted ✓ — review before saving: exotic syntax may need manual touch-up.', 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'JavaScript input', control: inp }),
      actionsRow(
        btn({ label: 'Format', icon: 'code', onClick: run }),
        h('span', { style: 'margin-left:auto;display:inline-flex;gap:8px;align-items:center' }, h('label', { for: 'jsindent', class: 'hint', text: 'Indent' }), indent),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },
};

export function mount(id) { mountTool(id, defs); }

export const __test = {
  validateJson, jsonFormat, jsonMinify, b64encode, b64decode, urlEncode, urlDecode, uuidv4,
  parseTimestamp, dateToParts, digest, toHex, toB64, findMatches, decodeJwt,
  formatHtml, minifyHtml, formatCss, minifyCss, formatJs,
};
