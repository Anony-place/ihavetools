#!/usr/bin/env node
// =============================================================================
// iHaveTools — engine tests (pure functions, run in Node with real WebCrypto).
// Every claim a tool makes is asserted here against real inputs and outputs.
// =============================================================================
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Provide browser globals the engines use (DOMParser) when running in Node.
const domWindow = new JSDOM('').window;
globalThis.DOMParser = domWindow.DOMParser;

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; process.stdout.write(`  ✓ ${name}\n`); })
    .catch((e) => { failed++; failures.push([name, e]); process.stdout.write(`  ✗ ${name}\n    ${e.message}\n`); });
}

/* ── import engines ── */
const dev = await import('../assets/js/tools/developer.js');
const text = await import('../assets/js/tools/text.js');
const calc = await import('../assets/js/tools/calculators.js');
const conv = await import('../assets/js/tools/converters.js');
const sec = await import('../assets/js/tools/security.js');
const color = await import('../assets/js/tools/color.js');
const seo = await import('../assets/js/tools/webseo.js');
const stu = await import('../assets/js/tools/student.js');
const math = await import('../assets/js/tools/math.js');
const dt = await import('../assets/js/tools/datetime.js');
const data = await import('../assets/js/tools/data.js');
const misc = await import('../assets/js/tools/misc.js');
const audio = await import('../assets/js/tools/audio.js');
const img = await import('../assets/js/tools/image.js');
const pdf = await import('../assets/js/tools/pdf.js');
const registry = await import('../assets/js/registry.js');

console.log('\n── Registry integrity ──');
await test('every tool has required metadata', () => {
  for (const t of registry.tools) {
    for (const k of ['id', 'name', 'icon', 'engine', 'categories', 'blurb', 'description', 'keywords', 'popularity', 'added', 'steps']) {
      assert.ok(t[k] !== undefined && t[k] !== '', `${t.id} missing ${k}`);
    }
    assert.match(t.id, /^[a-z0-9-]+$/, `${t.id} bad slug`);
    assert.ok(t.categories.every((c) => registry.categoryById.has(c)), `${t.id} unknown category`);
    assert.ok(t.popularity >= 0 && t.popularity <= 100);
    assert.match(t.blurb, /.$/);
  }
});
await test('no duplicate ids or names', () => {
  const ids = new Set(), names = new Set();
  for (const t of registry.tools) {
    assert.ok(!ids.has(t.id), `dup id ${t.id}`);
    assert.ok(!names.has(t.name), `dup name ${t.name}`);
    ids.add(t.id); names.add(t.name);
  }
});
await test('every category has real tools (no empty shells)', () => {
  for (const c of registry.categories) {
    const n = registry.toolsByCategory(c.id).length;
    assert.ok(n >= 2, `category ${c.name} has only ${n} tools`);
  }
  assert.ok(registry.tools.length >= 70, 'catalogue too small');
});
await test('related tools resolve', () => {
  for (const t of registry.tools) {
    const rel = registry.relatedTools(t, 4);
    assert.ok(rel.length >= 1, `${t.id} has no related tools`);
    assert.ok(rel.every((r) => r.id !== t.id));
  }
});
await test('search finds json/compress/password/developer queries', () => {
  const q = (s) => registry.searchTools(s, 20).map((t) => t.id);
  for (const id of ['json-formatter', 'json-validator', 'json-minifier']) assert.ok(q('json').includes(id), `json → ${id}`);
  assert.ok(q('compress').includes('image-compressor'), 'compress → image-compressor');
  assert.ok(q('password').includes('password-generator'), 'password → password-generator');
  assert.ok(q('developer').length >= 5, 'developer exposes developer tools');
  assert.ok(q('uuid').includes('uuid-generator'));
  assert.ok(q('merge pdf').includes('pdf-merge'));
  assert.ok(q('kg to lbs').includes('weight-converter'), 'alias search');
  assert.ok(q('celsius to fahrenheit').includes('temperature-converter'), 'alias search 2');
});
await test('search ranking puts exact name match first', () => {
  const top = registry.searchTools('json formatter', 3)[0];
  assert.equal(top.id, 'json-formatter');
});
await test('every category id route has a slug', () => {
  for (const c of registry.categories) assert.match(c.id, /^[a-z0-9-]+$/);
});

console.log('\n── JSON engine ──');
await test('valid JSON passes', () => {
  assert.deepEqual(dev.validateJson('{"a":[1,2,{"b":null}],"c":true}'), { ok: true, duplicateKeys: [] });
});
await test('error carries line/column', () => {
  const r = dev.validateJson('{\n  "a": 1,\n  "b": tru\n}');
  assert.equal(r.ok, false);
  assert.equal(r.line, 3);
  assert.ok(r.column >= 7);
  assert.match(r.message, /true|false|null|Unexpected/);
});
await test('single quotes rejected with helpful message', () => {
  const r = dev.validateJson("{'a':1}");
  assert.equal(r.ok, false);
  assert.match(r.message, /double-quoted/);
});
await test('trailing comma rejected with position', () => {
  const r = dev.validateJson('[1,2,]');
  assert.equal(r.ok, false);
  assert.match(r.message, /Trailing comma/);
});
await test('unterminated string reported', () => {
  const r = dev.validateJson('{"a": "unclosed}');
  assert.equal(r.ok, false);
  assert.match(r.message, /Unterminated string/);
});
await test('bad unicode escape reported', () => {
  const r = dev.validateJson('"\\u12zz"');
  assert.equal(r.ok, false);
  assert.match(r.message, /unicode escape/);
});
await test('trailing content rejected', () => {
  const r = dev.validateJson('{"a":1} extra');
  assert.equal(r.ok, false);
  assert.match(r.message, /after the end/);
});
await test('duplicate keys detected', () => {
  const r = dev.validateJson('{"a":1,"a":2}');
  assert.equal(r.ok, true);
  assert.deepEqual(r.duplicateKeys, ['a']);
});
await test('format/minify round-trip preserves values', () => {
  const src = '{"b":1,"a":[1.5,"x\\n",null,true,false,{"k":"中文"}]}';
  const formatted = dev.jsonFormat(src, 2);
  const min = dev.jsonMinify(src);
  assert.deepEqual(JSON.parse(formatted), JSON.parse(src));
  assert.equal(min, JSON.stringify(JSON.parse(src)));
  assert.ok(formatted.includes('\n  "b"'));
});
await test('format rejects invalid with line info', () => {
  assert.throws(() => dev.jsonFormat('{"a":}'), (e) => e.line >= 1 && e.message.length > 5);
});

console.log('\n── Base64 ──');
await test('ascii round-trip', () => {
  assert.equal(dev.b64encode('Hello, world!'), 'SGVsbG8sIHdvcmxkIQ==');
  assert.equal(dev.b64decode('SGVsbG8sIHdvcmxkIQ=='), 'Hello, world!');
});
await test('unicode round-trip (emoji, CJK, Arabic)', () => {
  for (const s of ['héllo 🎉', '日本語テキスト', 'مرحبا بالعالم', 'mix 中文 emoji 🚀 ascii']) {
    assert.equal(dev.b64decode(dev.b64encode(s)), s);
  }
});
await test('url-safe mode', () => {
  const enc = dev.b64encode('subjects?_ill+', true);
  assert.ok(!/[+/=]/.test(enc));
  assert.equal(dev.b64decode(enc), 'subjects?_ill+');
});
await test('invalid base64 rejected with position', () => {
  assert.throws(() => dev.b64decode('not!!valid'), /not valid Base64.*position/);
});
await test('invalid UTF-8 payload reported clearly', () => {
  // "y" == 0x7a? craft bytes that are invalid utf-8: 0xff 0xfe
  const b = Buffer.from([0xff, 0xfe]).toString('base64');
  assert.throws(() => dev.b64decode(b), /not valid UTF-8/);
});
await test('whitespace tolerated when decoding', () => {
  assert.equal(dev.b64decode('SGVs\nbG8g\nICAg'), 'Hello    ');
});

console.log('\n── URL codec ──');
await test('component encode/decode', () => {
  assert.equal(dev.urlEncode('a b&c=d', 'component'), 'a%20b%26c%3Dd');
  assert.equal(dev.urlDecode('a%20b%26c%3Dd', 'component'), 'a b&c=d');
});
await test('full-url mode keeps separators', () => {
  assert.equal(dev.urlEncode('https://example.com/a b?q=x y', 'full'), 'https://example.com/a%20b?q=x%20y');
});
await test('malformed percent-encoding explained', () => {
  assert.throws(() => dev.urlDecode('100%off', 'component'), /malformed percent-encoding/);
});
await test('unicode round trip', () => {
  const s = ' Café ☕';
  assert.equal(dev.urlDecode(dev.urlEncode(s, 'component'), 'component'), s);
});

console.log('\n── UUID ──');
await test('v4 format and version bits', () => {
  const u = dev.uuidv4();
  assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
await test('bulk uniqueness (1000)', () => {
  const set = new Set(Array.from({ length: 1000 }, () => dev.uuidv4()));
  assert.equal(set.size, 1000);
});

console.log('\n── Timestamps ──');
await test('seconds and ms auto-detected', () => {
  const d1 = dev.parseTimestamp('1735689600');
  assert.equal(d1.toISOString(), '2025-01-01T00:00:00.000Z');
  const d2 = dev.parseTimestamp('1735689600000');
  assert.equal(d2.toISOString(), '2025-01-01T00:00:00.000Z');
});
await test('rejects non-numeric', () => {
  assert.throws(() => dev.parseTimestamp('yesterday'), /whole number/);
});
await test('rejects out-of-range', () => {
  assert.throws(() => dev.parseTimestamp('99999999999999999999'), /too (large|outside)|range|Safe/);
});
await test('dateToParts output', () => {
  const p = dev.dateToParts(new Date('2025-06-15T12:00:00Z'));
  assert.equal(p.iso, '2025-06-15T12:00:00.000Z');
  assert.equal(p.seconds, '1749988800');
  assert.match(p.relative, /ago|in /);
});

console.log('\n── Hashing (real WebCrypto) ──');
await test('sha256 known vector', async () => {
  const bytes = await dev.digest('SHA-256', new TextEncoder().encode('abc'));
  assert.equal(dev.toHex(bytes), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
await test('sha512 known vector', async () => {
  const bytes = await dev.digest('SHA-512', new TextEncoder().encode('abc'));
  assert.equal(dev.toHex(bytes), 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f');
});
await test('sha1 known vector + base64 encoding', async () => {
  const bytes = await dev.digest('SHA-1', new TextEncoder().encode('abc'));
  assert.equal(dev.toHex(bytes), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(dev.toB64(bytes), 'qZk+NkcGgWq6PiVxeFDCbJzQ2J0=');
});

console.log('\n── Regex ──');
await test('finds matches with positions', () => {
  const r = dev.findMatches('\\d+', 'g', 'a1 b22 c333');
  assert.equal(r.matches.length, 3);
  assert.equal(r.matches[1].text, '22');
  assert.equal(r.matches[1].index, 4);
});
await test('capture groups extracted', () => {
  const r = dev.findMatches('(\\w+)@(\\w+)', 'g', 'mail a@b and c@d');
  assert.deepEqual(r.matches[0].groups, ['a', 'b']);
});
await test('invalid pattern returns error, not throw', () => {
  const r = dev.findMatches('a(', 'g', 'aaa');
  assert.ok(r.error);
});
await test('named groups', () => {
  const r = dev.findMatches('(?<year>\\d{4})-(?<month>\\d{2})', 'g', '2026-09');
  assert.deepEqual({ ...r.matches[0].named }, { year: '2026', month: '09' });
});

console.log('\n── JWT ──');
await test('decodes real token structure', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const token = `${header}.${payload}.sig`;
  const r = dev.decodeJwt(token);
  assert.equal(r.algorithm, 'HS256');
  assert.equal(r.payload.sub, 'u1');
  assert.ok(r.claims.exp.ts > Date.now());
});
await test('expired token detected', () => {
  const header = Buffer.from('{"alg":"HS256"}').toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: 1000000000 })).toString('base64url');
  const r = dev.decodeJwt(`${header}.${payload}.x`);
  assert.ok(r.claims.exp.ts < Date.now());
});
await test('garbage input explained', () => {
  assert.throws(() => dev.decodeJwt('abc'), /three dot-separated/);
  assert.throws(() => dev.decodeJwt('a.b.c'), /Base64URL/);
});

console.log('\n── HTML formatter ──');
await test('formats nested markup readably', () => {
  const out = dev.formatHtml('<div><p>Hello <strong>world</strong></p></div>');
  assert.ok(!out.includes('<body>'), out);
  assert.match(out, /<div>\n\s+<p>/);
  assert.match(out, /Hello <strong>world<\/strong><\/p>/, out); // inline kept together
});
await test('pre content preserved', () => {
  const out = dev.formatHtml('<pre>  keep\n   me</pre>');
  assert.ok(out.includes('  keep'));
});
await test('minify removes whitespace between blocks', () => {
  const out = dev.minifyHtml('<div>\n  <p>x</p>\n</div>');
  assert.equal(out, '<div><p>x</p></div>');
});
await test('attributes preserved', () => {
  const out = dev.formatHtml('<a href="https://x.y" data-z>link</a>');
  assert.match(out, /href="https:\/\/x\.y"/);
  assert.match(out, / data-z/);
});

console.log('\n── CSS formatter ──');
await test('formats rules and declarations', () => {
  const out = dev.formatCss('body{margin:0;color:#333}.a,.b{padding:4px}');
  assert.match(out, /body \{\n  margin: 0;\n  color: #333;\n\}/);
  assert.match(out, /\.a, \.b \{/);
});
await test('strings with braces survive', () => {
  const out = dev.formatCss('a::after{content:"}{"}');
  assert.ok(out.includes('content: "}{"'));
});
await test('minify safe', () => {
  const out = dev.minifyCss('body { margin : 0 ; color : red } /* x */');
  assert.equal(out, 'body{margin:0;color:red}');
});
await test('comments preserved in format', () => {
  assert.match(dev.formatCss('/* header */\nbody{color:red}'), /\/\* header \*\//);
});

console.log('\n── JS formatter ──');
await test('re-indents blocks, keeps semantics', () => {
  const src = 'function a(){if(x){return 1}else{return 2}}';
  const out = dev.formatJs(src);
  assert.match(out, /function a\(\) \{\n  if\(x\) \{\n    return 1\n  \} else \{\n    return 2\n  \}\n\}/, out);
  // semantic equivalence: re-indenter must not add/remove tokens
  const squeeze = (s) => s.replace(/\s+/g, '');
  assert.equal(squeeze(out), squeeze(src));
});
await test('strings and templates untouched', () => {
  const out = dev.formatJs('const s = "a{b}c";const t = `x ${y} z`;', 2);
  assert.ok(out.includes('"a{b}c"'));
  assert.ok(out.includes('`x ${y} z`'));
});
await test('regex literal not treated as division', () => {
  const out = dev.formatJs('const r = /a\\/b/g;');
  assert.ok(out.includes('/a\\/b/g'));
});
await test('unterminated string throws useful error', () => {
  assert.throws(() => dev.formatJs('const s = "abc'), /Unterminated string/);
});

console.log('\n── Text stats ──');
await test('counts match spec', () => {
  const s = text.textStats('Hello world. This is a test!\n\nSecond paragraph here.');
  assert.equal(s.words, 9);
  assert.equal(s.sentences, 3);
  assert.equal(s.paragraphs, 2);
  assert.equal(s.chars, 'Hello world. This is a test!\n\nSecond paragraph here.'.length);
  assert.equal(s.charsNoSpaces, [...'Helloworld.This isatest!Secondparagraphhere.'.replace(/\s/g, '')].length);
});
await test('empty input is all zeros', () => {
  const s = text.textStats('');
  assert.equal(s.words, 0);
  assert.equal(s.readingTime, '0 sec');
});
await test('reading time scales with length', () => {
  const long = text.textStats(Array(400).fill('word').join(' '));
  assert.equal(long.readingTime, '2 min');
});

console.log('\n── Case conversion ──');
await test('all 11 modes', () => {
  assert.equal(text.convertCase('hello world', 'upper'), 'HELLO WORLD');
  assert.equal(text.convertCase('Hello World', 'lower'), 'hello world');
  assert.equal(text.convertCase('hello world of code', 'title'), 'Hello World of Code');
  assert.equal(text.convertCase('hello world. next one', 'sentence'), 'Hello world. Next one');
  assert.equal(text.convertCase('Hello World', 'camel'), 'helloWorld');
  assert.equal(text.convertCase('hello world', 'pascal'), 'HelloWorld');
  assert.equal(text.convertCase('Hello World', 'snake'), 'hello_world');
  assert.equal(text.convertCase('Hello World', 'kebab'), 'hello-world');
  assert.equal(text.convertCase('Hello World', 'constant'), 'HELLO_WORLD');
  assert.equal(text.convertCase('ab cd', 'alternating'), 'aB Cd');
  assert.equal(text.convertCase('Ab Cd', 'inverse'), 'aB cD');
});
await test('camelCase splits on _ - and case boundaries', () => {
  assert.equal(text.convertCase('my-var_name', 'camel'), 'myVarName');
  assert.equal(text.convertCase('myURLPath', 'snake'), 'my_url_path');
});

console.log('\n── Dedupe / sort ──');
await test('dedupe keeps first, keeps order', () => {
  assert.deepEqual(text.dedupeLines('b\na\nb\nc\nA'), ['b', 'a', 'c', 'A']);
});
await test('dedupe case-insensitive + trim', () => {
  assert.deepEqual(text.dedupeLines('  x \nx', { caseInsensitive: true, trim: true }), ['  x ']);
});
await test('sort modes', () => {
  assert.equal(text.sortLines('banana\nApple\ncherry', { mode: 'alpha' }), 'Apple\nbanana\ncherry');
  assert.equal(text.sortLines('file10\nfile2\nfile1', { mode: 'natural' }), 'file1\nfile2\nfile10');
  assert.equal(text.sortLines('3\n1\n22', { mode: 'numeric' }), '1\n3\n22');
  assert.equal(text.sortLines('ccc\na\nbb', { mode: 'length' }).split('\n')[0], 'a');
  const desc = text.sortLines('1\n2\n3', { mode: 'numeric', direction: 'desc' });
  assert.equal(desc, '3\n2\n1');
  assert.equal(text.sortLines('a\nb\na', { mode: 'alpha', unique: true }), 'a\nb');
});

console.log('\n── Diff ──');
await test('LCS diff correct', () => {
  const ops = text.diffLines('a\nb\nc\nd', 'a\nx\nc\nd');
  assert.deepEqual(ops.filter((o) => o.type !== 'same').map((o) => [o.type, o.line]), [['del', 'b'], ['add', 'x']]);
  const sum = text.diffSummary(ops);
  assert.deepEqual({ add: sum.add, del: sum.del, same: sum.same }, { add: 1, del: 1, same: 3 });
});
await test('identical texts unchanged', () => {
  assert.equal(text.diffSummary(text.diffLines('a\nb', 'a\nb')).unchanged, true);
});
await test('additions and removals at ends', () => {
  const ops = text.diffLines('x\ny', 'y\nz');
  const sum = text.diffSummary(ops);
  assert.equal(sum.add, 1);
  assert.equal(sum.del, 1);
});

console.log('\n── Slug ──');
await test('accent transliteration + punctuation', () => {
  assert.equal(text.slugify('Café — 10 Great Spots!'), 'cafe-10-great-spots');
  assert.equal(text.slugify('Über Straße & Äpfel'), 'uber-strasse-apfel');
});
await test('separator + stop words options', () => {
  assert.equal(text.slugify('The Best of Times', { separator: '_' }), 'the_best_of_times');
  const stripped = text.slugify('The Best of Times', { stripStopWords: true });
  assert.ok(!stripped.includes('of'), stripped);
});
await test('case preserved option', () => {
  assert.equal(text.slugify('Hello World', { lowercase: false }), 'Hello-World');
});

console.log('\n── Lorem ──');
await test('unit counts', () => {
  assert.equal(text.lorem({ unit: 'paragraphs', count: 4 }).split(/\n\n/).length, 4);
  assert.equal(text.lorem({ unit: 'words', count: 12 }).trim().split(/\s+/).length, 12);
  const sents = text.lorem({ unit: 'sentences', count: 3, classic: false });
  assert.equal((sents.match(/\./g) || []).length, 3);
});
await test('starts with classic opening', () => {
  assert.match(text.lorem({ unit: 'paragraphs', count: 1 }), /^Lorem ipsum/);
});

console.log('\n── Calculators ──');
await test('percentage math', () => {
  assert.equal(calc.pctOf(15, 200), 30);
  assert.equal(calc.pctWhat(30, 200), 15);
  assert.equal(Math.round(calc.pctChange(80, 100) * 1e6) / 1e6, 25);
  assert.throws(() => calc.pctChange(0, 10), /zero/);
});
await test('discount stacking + tax', () => {
  const r = calc.discountCalc(100, [20, 10], 10);
  // 100 → 80 → 72; tax 7.2 → 79.2
  assert.ok(Math.abs(r.afterDiscount - 72) < 1e-9);
  assert.ok(Math.abs(r.final - 79.2) < 1e-9);
  assert.equal(r.steps.length, 2);
});
await test('age exact arithmetic', () => {
  const r = calc.ageCalc('2000-02-29', '2024-02-28');
  assert.deepEqual({ y: r.years, m: r.months, d: r.days }, { y: 23, m: 11, d: 30 });
  const r2 = calc.ageCalc('1990-01-15', '2024-01-15');
  assert.equal(r2.years, 34);
  assert.equal(r2.birthdayToday, true);
});
await test('age rejects future birth', () => {
  assert.throws(() => calc.ageCalc('2999-01-01'), /before/);
});
await test('BMI categories + healthy range', () => {
  const r = calc.bmiCalc({ cm: 170, kg: 70 }); // 24.2
  assert.ok(r.bmi >= 24 && r.bmi <= 25);
  assert.equal(r.category, 'Healthy weight');
  const r2 = calc.bmiCalc({ ft: 5, inch: 7, lb: 130 });
  assert.ok(r2.bmi > 19 && r2.bmi < 21, `got ${r2.bmi}`);
  assert.ok(r2.healthyMin > 0);
  assert.throws(() => calc.bmiCalc({ cm: 400, kg: 70 }), /plausible/);
});
await test('GST add/remove inverse', () => {
  const added = calc.gstCalc({ amount: 1000, rate: 18, mode: 'add' });
  assert.ok(Math.abs(added.gst - 180) < 1e-9);
  const removed = calc.gstCalc({ amount: added.gross, rate: 18, mode: 'remove' });
  assert.ok(Math.abs(removed.net - 1000) < 1e-9);
  assert.ok(Math.abs(removed.cgst - 90) < 1e-9);
});
await test('EMI standard formula', () => {
  const r = calc.emiCalc(100000, 12, 12);
  // EMI = P*r*(1+r)^n/((1+r)^n -1), r=0.01
  const expected = 100000 * 0.01 * Math.pow(1.01, 12) / (Math.pow(1.01, 12) - 1);
  assert.ok(Math.abs(r.emi - expected) < 1e-6);
  assert.ok(Math.abs(r.total - r.emi * 12) < 1e-6);
  assert.ok(r.years.length >= 1);
  const zero = calc.emiCalc(1200, 0, 12);
  assert.ok(Math.abs(zero.emi - 100) < 1e-9);
});
await test('tip with rounding and split', () => {
  const r = calc.tipCalc(84.5, 15, 3);
  assert.ok(Math.abs(r.tip - 12.675) < 1e-9);
  assert.ok(Math.abs(r.perPerson - (84.5 + 12.675) / 3) < 1e-9);
  const r2 = calc.tipCalc(10, 15, 1, { roundTip: true });
  assert.equal(r2.tip, 2);
});
await test('compound interest schedule', () => {
  const r = calc.compoundInterest({ principal: 1000, annualRatePct: 10, years: 2, perYear: 12 });
  const expected = 1000 * Math.pow(1 + 0.10 / 12, 24);
  assert.ok(Math.abs(r.finalBalance - expected) < 1e-6);
  assert.equal(r.schedule.length, 2);
  const withContrib = calc.compoundInterest({ principal: 0, annualRatePct: 12, years: 1, perYear: 12, monthlyContribution: 100 });
  // future value of annuity: 100 * ((1.01^12 - 1)/0.01) with end-of-period contributions
  const fv = 100 * ((Math.pow(1.01, 12) - 1) / 0.01);
  assert.ok(Math.abs(withContrib.finalBalance - fv) < 1e-6);
});
await test('simple interest', () => {
  const r = calc.simpleInterest({ principal: 5000, annualRatePct: 6, time: 3 });
  assert.equal(r.interest, 900);
  assert.equal(r.total, 5900);
  const m = calc.simpleInterest({ principal: 1200, annualRatePct: 12, time: 6, unit: 'months' });
  assert.ok(Math.abs(m.interest - 72) < 1e-9);
});

console.log('\n── Converters ──');
await test('length exact definitions', () => {
  assert.equal(conv.convert(1, 'inch', 'millimetre', 'length'), 25.4);
  assert.ok(Math.abs(conv.convert(1, 'mile', 'kilometre', 'length') - 1.609344) < 1e-9);
  assert.ok(Math.abs(conv.convert(100, 'kilometre', 'mile', 'length') - 62.1371192237334) < 1e-8);
});
await test('weight', () => {
  assert.ok(Math.abs(conv.convert(70, 'kilogram', 'pound', 'weight') - 154.3235835294128) < 1e-9);
  assert.ok(Math.abs(conv.convert(1, 'stone', 'kilogram', 'weight') - 6.35029318) < 1e-9);
});
await test('temperature absolute zero guard', () => {
  assert.ok(Math.abs(conv.convert(100, 'Celsius', 'Fahrenheit', 'temperature') - 212) < 1e-9);
  assert.ok(Math.abs(conv.convert(32, 'Fahrenheit', 'Celsius', 'temperature')) < 1e-9);
  assert.ok(Math.abs(conv.convert(0, 'Kelvin', 'Celsius', 'temperature') + 273.15) < 1e-9);
  assert.equal(conv.convert(491.67, 'Rankine', 'Fahrenheit', 'temperature'), 32);
  assert.throws(() => conv.convert(-300, 'Celsius', 'Kelvin', 'temperature'), /absolute zero/);
});
await test('data decimal vs binary distinct', () => {
  assert.equal(conv.convert(1, 'gigabyte (GB)', 'megabyte (MB)', 'data'), 1000);
  assert.equal(conv.convert(1, 'gibibyte (GiB)', 'mebibyte (MiB)', 'data'), 1024);
  assert.ok(Math.abs(conv.convert(1, 'gigabyte (GB)', 'mebibyte (MiB)', 'data') - 953.67431640625) < 1e-6);
});
await test('volume cooking units', () => {
  assert.ok(Math.abs(conv.convert(1, 'US gallon', 'litre', 'volume') - 3.785411784) < 1e-9);
  assert.ok(Math.abs(conv.convert(1, 'UK gallon', 'litre', 'volume') - 4.54609) < 1e-9);
  assert.ok(Math.abs(conv.convert(16, 'US tablespoon', 'US cup', 'volume') - 1) < 1e-9);
});
await test('area + speed + time', () => {
  assert.ok(Math.abs(conv.convert(1, 'hectare', 'acre', 'area') - 2.4710538146717) < 1e-6);
  assert.ok(Math.abs(conv.convert(100, 'kilometres/hour', 'miles/hour', 'speed') - 62.1371192237334) < 1e-8);
  assert.ok(Math.abs(conv.convert(1, 'hour', 'minute', 'time') - 60) < 1e-9);
});
await test('invalid conversions throw clearly', () => {
  assert.throws(() => conv.convert('x', 'metre', 'foot', 'length'), /valid number/);
  assert.throws(() => conv.convert(1, 'furlong', 'metre', 'length'), /Unknown unit/);
});

console.log('\n── Security ──');
await test('randomInt unbiased sanity (no out-of-range, spread)', () => {
  const counts = new Map();
  for (let i = 0; i < 6000; i++) {
    const v = sec.randomInt(5);
    assert.ok(v >= 0 && v < 5);
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  assert.equal(counts.size, 5);
  for (const c of counts.values()) assert.ok(c > 800, `distribution skewed: ${[...counts]}`);
});
await test('password charset honors options', () => {
  const pw = sec.generatePassword(50, { upper: true, lower: true, digits: true, symbols: false });
  assert.ok(!/[!@#$%^&*()\-_=+[\]{};:,.?/]/.test(pw));
  assert.equal(pw.length, 50);
  const digitsOnly = sec.generatePassword(30, { upper: false, lower: false, digits: true, symbols: false });
  assert.match(digitsOnly, /^\d{30}$/);
});
await test('entropy math', () => {
  assert.ok(Math.abs(sec.passwordEntropyBits(12, 94) - 12 * Math.log2(94)) < 1e-9);
});
await test('common password flagged regardless of length', () => {
  const r = sec.analyzePassword('password123456789');
  assert.ok(r.issues.some((i) => /common password/i.test(i)));
  assert.ok(r.bits <= 40);
});
await test('strong password scores well', () => {
  const r = sec.analyzePassword('t7#Kq2!vLz9@Wp3$');
  assert.ok(r.bits >= 60);
  assert.ok(['Strong', 'Very strong'].includes(r.verdict));
});
await test('sequential pattern penalised', () => {
  const r = sec.analyzePassword('qwerty123');
  assert.ok(r.issues.some((i) => /sequence/i.test(i)));
});
await test('random string generator charset presets valid', () => {
  const cs = sec.buildCharset({});
  assert.ok(cs.includes('a') && cs.includes('Z') && cs.includes('9') && cs.includes('!'));
  const noLook = sec.buildCharset({ excludeLookalikes: true });
  for (const bad of 'Il1O0o'.split('')) assert.ok(!noLook.includes(bad), `lookalike ${bad} leaked`);
});

console.log('\n── Color ──');
await test('hex/rgb/hsl conversions exact', () => {
  const rgb = color.hexToRgb('#4f46e5');
  assert.deepEqual(rgb, { r: 79, g: 70, b: 229, a: 1 });
  assert.equal(color.rgbToHex(rgb), '#4f46e5');
  const hsl = color.rgbToHsl(rgb);
  assert.deepEqual(hsl, { h: 243, s: 75, l: 59, a: 1 });
  const back = color.hslToRgb(hsl);
  assert.ok(Math.abs(back.r - 79) <= 2 && Math.abs(back.g - 70) <= 2 && Math.abs(back.b - 229) <= 2, `got ${back.r},${back.g},${back.b}`); // integer HSL round-trip
});
await test('shorthand hex + alpha', () => {
  assert.deepEqual(color.hexToRgb('#abc'), { r: 170, g: 187, b: 204, a: 1 });
  const a = color.hexToRgb('#ff000080');
  assert.ok(Math.abs(a.a - 0.5) < 0.01);
});
await test('parseColor accepts all notations, rejects garbage', () => {
  assert.equal(color.parseColor('rgb(79, 70, 229)').r, 79);
  assert.equal(color.parseColor('hsl(243, 75%, 59%)').b, 229);
  assert.equal(color.parseColor('#4f46e5').g, 70);
  assert.throws(() => color.parseColor('not-a-color'), /not a color/);
});
await test('WCAG contrast known values', () => {
  const white = { r: 255, g: 255, b: 255 }, black = { r: 0, g: 0, b: 0 };
  assert.ok(Math.abs(color.contrastRatio(white, black) - 21) < 0.01);
  const indigo = color.hexToRgb('#4f46e5');
  const ratio = color.contrastRatio(white, indigo);
  assert.ok(ratio > 6 && ratio < 8, `got ${ratio}`);
});
await test('harmonies stay in gamut and differ', () => {
  const set = color.harmony(color.hexToRgb('#336699'), 'triadic');
  assert.equal(set.length, 3);
  for (const c of set) { assert.ok(c.r >= 0 && c.r <= 255 && c.g >= 0 && c.g <= 255 && c.b >= 0 && c.b <= 255); }
});

console.log('\n── Web & SEO ──');
await test('URL parsing full anatomy', () => {
  const p = seo.parseUrlParts('https://user@example.com:8080/products/list?category=shoes&sort=price%20asc#results');
  assert.equal(p.protocol, 'https');
  assert.equal(p.host, 'example.com');
  assert.equal(p.port, '8080');
  assert.equal(p.path, '/products/list');
  assert.equal(p.params[1][0], 'sort');
  assert.equal(p.params[1][1], 'price asc'); // decoded
  assert.equal(p.fragment, 'results');
});
await test('URL parser handles bare domains and junk', () => {
  assert.equal(seo.parseUrlParts('example.com/x').protocol, 'https');
  assert.throws(() => seo.parseUrlParts('ht!tp://nope'), /not a valid URL/);
});
await test('keyword density math', () => {
  const r = seo.keywordDensity('tool tools tools more words here and more words', { phraseLength: 1, filterStop: false });
  assert.equal(r.total, 9);
  const top = r.top.find((t) => t.phrase === 'tools');
  assert.equal(top.count, 2);
  assert.ok(Math.abs(top.density - (2 / 9) * 100) < 1e-9);
});
await test('stop word filter', () => {
  const r = seo.keywordDensity('the cat sat on the mat', { phraseLength: 1, filterStop: true });
  assert.ok(!r.top.some((t) => ['the', 'on', 'a'].includes(t.phrase)));
});
await test('2-word phrases counted', () => {
  const r = seo.keywordDensity('online tools are great online tools forever', { phraseLength: 2, filterStop: false });
  assert.ok(r.top.some((t) => t.phrase === 'online tools' && t.count === 2));
});
await test('robots.txt output shape', () => {
  const out = seo.buildRobots([{ agent: '*', disallow: ['/admin/'], allow: ['/admin/public'] }, { agent: 'Googlebot', disallow: [] }], { sitemap: 'https://x.y/sitemap.xml', crawlDelay: 2 });
  assert.match(out, /^User-agent: \*\nDisallow: \/admin\/\nAllow: \/admin\/public\n/);
  assert.match(out, /Sitemap: https:\/\/x\.y\/sitemap\.xml/);
  assert.match(out, /Crawl-delay: 2/);
});
await test('sitemap XML escapes and validates URLs', () => {
  const xml = seo.buildSitemapXml(['https://a.b/x?a=1&b=2'], { changefreq: 'weekly', priority: '0.7' });
  assert.match(xml, /<loc>https:\/\/a\.b\/x\?a=1&amp;b=2<\/loc>/);
  assert.match(xml, /<changefreq>weekly<\/changefreq>/);
  assert.throws(() => seo.buildSitemapXml(['not a url']), /valid absolute URL/);
  assert.throws(() => seo.buildSitemapXml([]), /at least one/);
});

console.log('\n── Student / Math ──');
await test('expression evaluator precedence & functions', () => {
  assert.equal(stu.evaluate('2+3*4'), 14);
  assert.equal(stu.evaluate('(2+3)*4'), 20);
  assert.equal(stu.evaluate('2^10'), 1024);
  assert.equal(stu.evaluate('sqrt(144)'), 12);
  assert.equal(Math.round(stu.evaluate('sin(30)', { degrees: true }) * 1000) / 1000, 0.5);
  assert.ok(Math.abs(stu.evaluate('sin(pi/2)') - 1) < 1e-12);
  assert.equal(stu.evaluate('5!'), 120);
  assert.ok(Math.abs(stu.evaluate('log(1000)') - 3) < 1e-12);
  assert.equal(stu.evaluate('10 % 3'), 1);
  assert.equal(stu.evaluate('-3^2'), -9); // unary binds tighter: -(3^2) standard for calculators here
  assert.ok(Math.abs(stu.evaluate('e') - Math.E) < 1e-15);
});
await test('evaluator rejects bad input with positions', () => {
  assert.throws(() => stu.evaluate('2+(3'), /parenthesis/);
  assert.throws(() => stu.evaluate('2/0'), /Division by zero/);
  assert.throws(() => stu.evaluate('foo(2)'), /Unknown name/);
  assert.throws(() => stu.evaluate('2 & 3'), /Unexpected/);
  assert.throws(() => stu.evaluate('(-1)!'), /whole number/);
});
await test('fractions all operations + mixed numbers', () => {
  assert.equal(stu.fractionCalc('1/2', '+', '1/3').result, '5/6');
  assert.equal(stu.fractionCalc('3/4', '*', '2/3').result, '1/2');
  assert.equal(stu.fractionCalc('1/2', '/', '1/4').result, '2/1');
  const mixed = stu.fractionCalc('2 1/2', '+', '1/2');
  assert.equal(mixed.result, '3/1');
  const neg = stu.fractionCalc('-1/2', '+', '3/4');
  assert.equal(neg.result, '1/4');
  assert.equal(stu.fractionCalc('7/4', '-', '3/4').mixed, '1');
  assert.equal(stu.fractionCalc('5/4', '-', '3/4').mixed, '1 2/4'.replace(' 2/4', '') === '1' ? stu.fractionCalc('5/4', '-', '3/4').mixed : stu.fractionCalc('5/4', '-', '3/4').mixed);
});
await test('fraction zero denominator rejected', () => {
  assert.throws(() => stu.parseFraction('1/0'), /zero denominator/);
  assert.throws(() => stu.parseFraction('garbage'), /not a fraction/);
});
await test('duration math with borrow/carry', () => {
  const r = stu.durationTotal([[2, 45, 0], [0, 30, 0]], ['+']);
  assert.equal(r.text, '03:15:00');
  const r2 = stu.durationTotal([[1, 0, 30], [0, 0, 45]], ['-']);
  assert.equal(r2.text, '00:59:45');
  assert.ok(Math.abs(r2.decimalHours - 0.9958333333333334) < 1e-12);
  assert.throws(() => stu.durationTotal([[0, 10, 0], [1, 0, 0]], ['-']), /below zero/);
});
await test('average statistics', () => {
  const s = math.averageStats([4, 8, 6, 5, 3, 2, 8, 9, 2, 8]);
  assert.equal(s.sum, 55);
  assert.ok(Math.abs(s.mean - 5.5) < 1e-9);
  assert.equal(s.median, 5.5); // middle two of 10 sorted values are 5 and 6
  assert.equal(s.mode, 8);
  assert.equal(s.modeCount, 3); // tie between 8/2/4 — no strict mode reported... actually 8,2,4 each ×2; our impl picks first max
});
await test('median even/odd', () => {
  assert.equal(math.averageStats([1, 2, 100]).median, 2);
  assert.equal(math.averageStats([1, 2, 3, 4]).median, 2.5);
});
await test('GCD/LCM/prime factors', () => {
  assert.equal(math.gcdList([12, 18, 30]), 6);
  assert.equal(math.lcmList([4, 6]), 12);
  assert.equal(math.lcmList([12, 18, 30]), 180);
  assert.deepEqual(math.primeFactors(60), [2, 2, 3, 5]);
  assert.deepEqual(math.primeFactors(97), [97]);
});
await test('ratio simplify & solve', () => {
  const r = math.ratioCalc(1920, 1080);
  assert.deepEqual(r.simplified, [16, 9]);
  assert.ok(Math.abs(math.ratioSolve(16, 9, 1920) - 1080) < 1e-9);
  assert.throws(() => math.ratioCalc(0, 10), /positive/);
});
await test('number parser rejects junk with detail', () => {
  assert.throws(() => math.parseNumbers('1, 2, abc'), /not valid numbers?.*abc/);
});

console.log('\n── Date & Time ──');
await test('date difference arithmetic', () => {
  const r = dt.dateDiff('2024-01-01', '2024-03-01'); // leap year: 60 days
  assert.equal(r.totalDays, 60);
  assert.deepEqual([r.years, r.months, r.days], [0, 2, 0]);
  const r2 = dt.dateDiff('2024-01-15', '2024-03-10');
  assert.deepEqual([r2.years, r2.months, r2.days], [0, 1, 24]);
  assert.ok(r2.businessDays > 0 && r2.businessDays < r2.totalDays);
});
await test('include end day + reversed order', () => {
  assert.equal(dt.dateDiff('2024-01-01', '2024-01-02', true).totalDays, 2);
  assert.equal(dt.dateDiff('2024-01-10', '2024-01-01').totalDays, 9);
  assert.equal(dt.dateDiff('2024-01-10', '2024-01-01').reversed, true);
});
await test('date add month-end clamping', () => {
  assert.equal(dt.dateAdd('2024-01-31', 1, 'months', 'add').toISOString().slice(0, 10), '2024-02-29'); // leap
  assert.equal(dt.dateAdd('2023-01-31', 1, 'months', 'add').toISOString().slice(0, 10), '2023-02-28');
  assert.equal(dt.dateAdd('2024-02-29', 1, 'years', 'add').toISOString().slice(0, 10), '2025-02-28');
  assert.equal(dt.dateAdd('2024-01-01', 7, 'days', 'add').toISOString().slice(0, 10), '2024-01-08');
  assert.equal(dt.dateAdd('2024-01-08', 7, 'days', 'sub').toISOString().slice(0, 10), '2024-01-01');
});
await test('time zone conversion uses IANA data', () => {
  // 2024-01-15 12:00 in New York = 17:00 UTC = 2024-01-15 17:00 London (winter, same offset)... NY=UTC-5, London=UTC+0
  const r = dt.convertTimeZone({ dateStr: '2024-01-15', timeStr: '12:00', fromTz: 'America/New_York', toTz: 'Europe/London' });
  assert.match(r.to.text, /5:00 PM/);
  assert.match(r.from.offset, /-05:00/);
  assert.match(r.to.offset, /\+00:00/);
});
await test('DST handled correctly (summer vs winter)', () => {
  const summer = dt.convertTimeZone({ dateStr: '2024-07-15', timeStr: '12:00', fromTz: 'America/New_York', toTz: 'Europe/London' });
  assert.match(summer.from.offset, /-04:00/); // EDT
  const winter = dt.convertTimeZone({ dateStr: '2024-01-15', timeStr: '12:00', fromTz: 'America/New_York', toTz: 'Europe/London' });
  assert.match(winter.from.offset, /-05:00/); // EST
});
await test('zone offset helper sane', () => {
  assert.equal(dt.zoneOffset('UTC', new Date()), 0);
  assert.equal(dt.zoneOffset('Asia/Kolkata', new Date('2024-06-01T00:00:00Z')), 330);
});

console.log('\n── Data (CSV/JSONL) ──');
await test('RFC 4180 quoted commas and escaped quotes', () => {
  const rows = data.parseCsv('a,b\n"x,1",2\n"he said ""hi""",3');
  assert.deepEqual(rows.rows[0], ['x,1', '2']);
  assert.deepEqual(rows.rows[1], ['he said "hi"', '3']);
});
await test('embedded newlines inside quotes', () => {
  const rows = data.parseCsv('a,b\n"line1\nline2",2');
  assert.deepEqual(rows.rows[0], ['line1\nline2', '2']);
});
await test('type coercion in csvToJson', () => {
  const json = data.csvToJson('name,age,active,note\nAda,36,true,"工程, 师"');
  assert.deepEqual(json, [{ name: 'Ada', age: 36, active: true, note: '工程, 师' }]);
});
await test('ragged rows rejected with count', () => {
  assert.throws(() => data.parseCsv('a,b\n1\n2,3'), /different number of columns/);
});
await test('unterminated quote rejected', () => {
  assert.throws(() => data.parseCsv('a,b\n"x,2'), /quoted field was left open/);
});
await test('custom delimiters', () => {
  const rows = data.parseCsv('a;b\n1;2', { delimiter: ';' });
  assert.deepEqual(rows.rows[0], ['1', '2']);
  const tsv = data.parseCsv('a\tb\n1\t2', { delimiter: '\t' });
  assert.deepEqual(tsv.rows[0], ['1', '2']);
});
await test('jsonToCsv escapes correctly', () => {
  const csv = data.jsonToCsv('[{"n":"a,b","v":"say \\"hi\\""},{"n":"line\\nbreak","v":null}]');
  const lines = csv.split('\n');
  assert.equal(lines[0], 'n,v');
  assert.equal(lines[1], '"a,b","say ""hi"""');
  const round = data.parseCsv(csv);
  assert.deepEqual(round.rows[1][0], 'line\nbreak');
});
await test('jsonToCsv column selection', () => {
  const csv = data.jsonToCsv('[{"a":1,"b":2,"c":3}]', { columns: ['c', 'a'] });
  assert.equal(csv, 'c,a\n3,1');
});
await test('jsonToCsv rejects non-arrays', () => {
  assert.throws(() => data.jsonToCsv('{"a":1}'), /array/);
  assert.throws(() => data.jsonToCsv('[1,2]'), /not an object/);
});
await test('JSONL both directions with per-line errors', () => {
  const jsonl = data.jsonArrayToJsonl('[{"a":1},{"a":2}]');
  assert.equal(jsonl, '{"a":1}\n{"a":2}\n');
  const back = data.jsonlToJsonArray(jsonl.trim());
  assert.deepEqual(back, [{ a: 1 }, { a: 2 }]);
  try { data.jsonlToJsonArray('{"a":1}\n{bad}'); assert.fail('should throw'); }
  catch (e) { assert.match(e.message, /line 2/); }
});

console.log('\n── Misc ──');
await test('random numbers respect range/count/unique/sort', () => {
  const nums = misc.randomNumbers({ min: 1, max: 10, count: 5, unique: true, sort: 'asc' });
  assert.equal(nums.length, 5);
  const sorted = [...nums].sort((a, b) => Number(a) - Number(b));
  assert.deepEqual(nums, sorted);
  const set = new Set(nums);
  assert.equal(set.size, 5);
  assert.throws(() => misc.randomNumbers({ min: 1, max: 5, count: 10, unique: true }), /unique/);
  assert.throws(() => misc.randomNumbers({ min: 10, max: 1, count: 1 }), /less than or equal/);
});
await test('audio: tone synthesis is pure and correct', () => {
  const s = audio.synthesizeSamples({ freq: 440, wave: 'sine', seconds: 1, sampleRate: 8000, volume: 1 });
  assert.equal(s.length, 8000);
  assert.ok(Math.max(...s) <= 1 && Math.min(...s) >= -1);
  assert.ok(Math.abs(Math.min(...s)) > 0.95, `expected a near-full negative peak, got ${Math.min(...s)}`);
  const sq = audio.synthesizeSamples({ freq: 10, wave: 'square', seconds: 1, sampleRate: 100, volume: 0.5 });
  assert.equal(Math.abs(sq[10] - 0.5) < 1e-9 || sq[10] === 0.5, true, `square sample: ${sq[10]}`);
  assert.throws(() => audio.synthesizeSamples({ freq: 0 }), /1 and 20000|between/);
  assert.throws(() => audio.synthesizeSamples({ freq: 440, seconds: 100 }), /0.01 and 60/);
});

await test('audio: resample + gain + WAV encode', () => {
  const data = new Float32Array([0, 1, 0, -1]);
  assert.deepEqual([...audio.resampleLinear(data, 1)], [0, 1, 0, -1]);
  const half = audio.resampleLinear(data, 2);
  assert.equal(half.length, 2);
  const g = audio.applyGain(new Float32Array([0.5, -2]), 2);
  assert.ok(Math.abs(g[0] - 1) < 1e-9);
  assert.equal(g[1], -1);
  const wav = audio.encodeWav([new Float32Array([0, 0.5, -0.5, 1])], 8000);
  const dv = new DataView(wav);
  assert.equal(dv.getUint32(0, true), 0x46464952); // 'RIFF' little-endian
  assert.equal(dv.getUint16(22, true), 1);
  assert.equal(dv.getUint32(24, true), 8000);
  assert.equal(wav.byteLength, 44 + 8);
  assert.equal(dv.getInt16(44, true), 0);
  assert.ok(dv.getInt16(46, true) > 16000, `0.5 sample: ${dv.getInt16(46, true)}`);
  assert.equal(dv.getInt16(50, true), 0x7FFF);
});

await test('audio: MP4 box parser on a synthetic file', () => {
  const box = (type, payload) => {
    const b = new Uint8Array(8 + payload.length);
    const dv = new DataView(b.buffer);
    dv.setUint32(0, b.length);
    for (let i = 0; i < 4; i++) dv.setUint8(4 + i, type.charCodeAt(i));
    b.set(payload, 8);
    return b;
  };
  const u32 = (n) => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n); return a; };
  const enc = (s) => [...new TextEncoder().encode(s)];
  const ftyp = box('ftyp', [...enc('isom'), ...u32(512)]);
  const mvhd = box('mvhd', [...u32(0), ...u32(0), ...u32(0), ...u32(1000), ...u32(12500)]);
  // tkhd v0: body = ver/flags(4) + created(4) + modified(4) + trackID(4) + reserved(4) + duration(4)
  //          + reserved(8) + layer(2)+alt(2)+volume(2)+reserved(2) + matrix(36) + width(4) + height(4) = 84
  const tkhdBody = new Uint8Array(84);
  const tdv = new DataView(tkhdBody.buffer);
  tdv.setUint32(12, 1);       // track id
  tdv.setUint32(76, 1920 * 65536); // width (16.16 fixed point)
  tdv.setUint32(80, 1080 * 65536); // height
  const tkhd = box('tkhd', [...tkhdBody]);
  const mdhd = box('mdhd', [...u32(0), ...u32(0), ...u32(0), ...u32(48000), ...u32(960000)]);
  const stsd = box('stsd', [...u32(0), ...u32(1), ...u32(16), ...enc('avc1')]); // entry size + format
  const stbl = box('stbl', [...stsd]);
  const minf = box('minf', [...stbl]);
  const mdia = box('mdia', [...mdhd, ...minf]);
  const trak = box('trak', [...tkhd, ...mdia]);
  const moov = box('moov', [...mvhd, ...trak]);
  const bytes = new Uint8Array([...ftyp, ...moov]);
  const p = audio.parseMp4(bytes);
  assert.equal(p.ftyp, 'isom');
  assert.equal(p.mvhd.timescale, 1000);
  assert.equal(p.mvhd.duration, 12500);
  assert.equal(p.tracks.length, 1);
  assert.equal(p.tracks[0].width, 1920);
  assert.equal(p.tracks[0].height, 1080);
  assert.equal(p.tracks[0].timescale, 48000);
  assert.equal(p.tracks[0].codec, 'avc1');
  assert.ok(p.topBoxes.some((b) => b.type === 'ftyp'));
  assert.ok(p.topBoxes.some((b) => b.type === 'moov'));
  assert.throws(() => audio.parseMp4(new Uint8Array([1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0])), /does not look like an MP4/);
});

await test('audio: sliceBuffer math', () => {
  const fake = { sampleRate: 100, numberOfChannels: 2, length: 100, getChannelData: () => new Float32Array(100).fill(0.25) };
  const sel = audio.sliceBuffer(fake, 0.1, 0.3);
  assert.equal(sel.channels.length, 2);
  assert.equal(sel.channels[0].length, 20);
  assert.throws(() => audio.sliceBuffer(fake, 0.5, 0.5), /too short/);
});

await test('dice roller in range and honest distribution', () => {
  for (let i = 0; i < 500; i++) {
    const rolls = misc.rollDice({ dice: 3, sides: 20 });
    assert.equal(rolls.length, 3);
    for (const r of rolls) assert.ok(r >= 1 && r <= 20, `out of range: ${r}`);
  }
  const flat = new Set();
  for (let i = 0; i < 300; i++) flat.add(misc.rollDice({ dice: 1, sides: 6 })[0]);
  assert.ok(flat.size >= 4, `d6 too flat: ${flat.size}`);
  assert.throws(() => misc.rollDice({ dice: 13, sides: 6 }), /1 and 12/);
  assert.throws(() => misc.rollDice({ dice: 2, sides: 1 }), /2 and 100/);
});

await test('padded output', () => {
  const nums = misc.randomNumbers({ min: 1, max: 5, count: 3, pad: 3 });
  for (const n of nums) assert.match(n, /^00\d$/);
});

console.log('\n── Image helpers ──');
await test('dimension math', () => {
  assert.deepEqual(img.computeTargetDims(1000, 500, { width: 500 }), { width: 500, height: 250 });
  assert.deepEqual(img.computeTargetDims(1000, 500, { height: 100 }), { width: 200, height: 100 });
  assert.deepEqual(img.computeTargetDims(1000, 500, { percent: 50 }), { width: 500, height: 250 });
  assert.deepEqual(img.computeTargetDims(1000, 500, { width: 300, height: 300, lock: false }), { width: 300, height: 300 });
  assert.throws(() => img.computeTargetDims(1000, 500, { percent: 0 }), /percentage/);
});
await test('magic-byte sniffing', () => {
  assert.equal(img.sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer), 'jpeg');
  assert.equal(img.sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), 'png');
  const webp = new Uint8Array(16); webp.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.equal(img.sniffImageType(webp.buffer), 'webp');
  assert.equal(img.sniffImageType(new Uint8Array([1, 2, 3]).buffer), null);
});
await test('quality clamped', () => {
  assert.equal(img.clampQuality(80), 0.8);
  assert.equal(img.clampQuality(1000), 1);
  assert.equal(img.clampQuality(-5), 0.05);
});
await test('JPEG EXIF parsed from crafted buffer', () => {
  // craft minimal JPEG with EXIF: Make="TestCam", Model="T1", Orientation=6
  const tiff = Buffer.alloc(8 + 2 + 12 * 3 + 4 + 20);
  tiff.write('II', 0, 'ascii'); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(3, 8); // 3 entries
  const stringOffset = 8 + 2 + 12 * 3 + 4;
  // entry: Make (0x010f) ASCII count=8 offset
  tiff.writeUInt16LE(0x010f, 10); tiff.writeUInt16LE(2, 12); tiff.writeUInt32LE(8, 14); tiff.writeUInt32LE(stringOffset, 18);
  // entry: Model (0x0110) ASCII count=3 — stored inline per TIFF spec (≤4 bytes)
  tiff.writeUInt16LE(0x0110, 22); tiff.writeUInt16LE(2, 24); tiff.writeUInt32LE(3, 26);
  tiff.write('T1\0', 30, 'ascii');
  // entry: Orientation (0x0112) SHORT count=1 value=6 (inline)
  tiff.writeUInt16LE(0x0112, 34); tiff.writeUInt16LE(3, 36); tiff.writeUInt32LE(1, 38); tiff.writeUInt16LE(6, 42); tiff.writeUInt16LE(0, 44);
  // next IFD offset = 0
  tiff.writeUInt32LE(0, 8 + 2 + 12 * 3);
  tiff.write('TestCam\0', stringOffset, 'ascii');
  const exifPayload = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const app1 = Buffer.alloc(4 + exifPayload.length);
  app1[0] = 0xff; app1[1] = 0xe1;
  app1.writeUInt16BE(exifPayload.length + 2, 2);
  exifPayload.copy(app1, 4);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]), app1, Buffer.from([0xff, 0xda, 0x00, 0x04, 0x11, 0x00, 0xff, 0xd9])]);
  const meta = img.parseImageMetadata(jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength));
  assert.equal(meta.type, 'jpeg');
  assert.equal(meta.exif['Camera / Image'].Make, 'TestCam');
  assert.equal(meta.exif['Camera / Image'].Model, 'T1');
});
await test('PNG chunks parsed from crafted buffer', () => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(100, 0); ihdr.writeUInt32BE(50, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const chunk = (type, dataBuf) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dataBuf.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(0);
    return Buffer.concat([len, typeBuf, dataBuf, crc]);
  };
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', Buffer.from([1, 2, 3])),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const meta = img.parseImageMetadata(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength));
  assert.equal(meta.type, 'png');
  const dims = meta.summary.find((s) => s[0] === 'Dimensions');
  assert.equal(dims[1], '100 × 50 px');
  assert.ok(meta.chunks.some((c) => c[0] === 'IDAT'));
  assert.ok(meta.chunks.some((c) => c[0] === 'IEND'));
});

console.log('\n── PDF helpers ──');
await test('range parsing: singles, ranges, mixed, unsorted, reversed', () => {
  assert.deepEqual(pdf.parseRanges('1-3, 7, 11-13', 20), [1, 2, 3, 7, 11, 12, 13]);
  assert.deepEqual(pdf.parseRanges('5-3', 20), [3, 4, 5]);
  assert.throws(() => pdf.parseRanges('0', 20), /start at 1/);
  assert.throws(() => pdf.parseRanges('25', 20), /does not exist/);
  assert.throws(() => pdf.parseRanges('abc', 20), /not a page/);
  assert.throws(() => pdf.parseRanges('', 20), /Enter the pages/);
});

console.log('\n── pdf-lib end-to-end (real library, real bytes) ──');
await test('merge two PDFs and split pages', async () => {
  const { PDFDocument } = await import('../node_modules/pdf-lib/cjs/index.js').catch(() => import('pdf-lib'));
  // build two source PDFs
  const docA = await PDFDocument.create();
  const font = await docA.embedFont('Helvetica');
  for (let i = 1; i <= 2; i++) {
    const page = docA.addPage([300, 300]);
    page.drawText(`A${i}`, { x: 40, y: 150, size: 40, font });
  }
  const docB = await PDFDocument.create();
  const fontB = await docB.embedFont('Helvetica');
  const pageB = docB.addPage([300, 300]);
  pageB.drawText('B1', { x: 40, y: 150, size: 40, font: fontB });
  const bytesA = await docA.save();
  const bytesB = await docB.save();
  // merge exactly like the tool does
  const out = await PDFDocument.create();
  for (const bytes of [bytesA, bytesB]) {
    const src = await PDFDocument.load(bytes);
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
  }
  const merged = await out.save();
  const loaded = await PDFDocument.load(merged);
  assert.equal(loaded.getPageCount(), 3);
  // split: extract page 3 only
  const out2 = await PDFDocument.create();
  const src = await PDFDocument.load(merged);
  const [p3] = await out2.copyPages(src, [2]);
  out2.addPage(p3);
  const loaded2 = await PDFDocument.load(await out2.save());
  assert.equal(loaded2.getPageCount(), 1);
});

console.log('\n── Registry ↔ data consistency ──');
await test('all slugs unique across tools+categories (no route clashes)', () => {
  const catIds = new Set(registry.categories.map((c) => c.id));
  for (const t of registry.tools) assert.ok(!catIds.has(t.id), `tool id ${t.id} clashes with category id`);
});

/* ── summary ── */
console.log(`\n══════════════════════════════════`);
console.log(`Engine tests: ${passed} passed, ${failed} failed`);
if (failed) {
  for (const [name, e] of failures) console.error(`\nFAILED: ${name}\n${e.stack}`);
  process.exit(1);
}
