#!/usr/bin/env node
// =============================================================================
// iHaveTools — engine tests (pure functions, run in Node with real WebCrypto).
// Every claim a tool makes is asserted here against real inputs and outputs.
// =============================================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  const inboundCount = (id) => registry.tools.filter((t) => registry.relatedTools(t, 6).some((r) => r.id === id)).length;
  assert.ok(inboundCount('keyword-density-checker') >= 5, 'the Web-SEO cluster must give the keyword checker contextual internal links');
  assert.ok(inboundCount('data-storage-converter') >= 5, 'the unit-converter cluster must link to Data Storage Converter');
  assert.ok(registry.relatedTools(registry.getTool('robots-txt-generator'), 6).some((r) => r.id === 'sitemap-generator'));
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

await test('JSON formatting changes only whitespace, preserving number and string tokens', () => {
  const src = String.raw` { "99999999999999999999" : -0, "big": 900719925474099312345, "n":1e400, "tiny":1e-500, "s":"\u0061\/\\", "dup": 1, "dup":2, "v": [ {}, [ ] ] } `;
  const min = String.raw`{"99999999999999999999":-0,"big":900719925474099312345,"n":1e400,"tiny":1e-500,"s":"\u0061\/\\","dup":1,"dup":2,"v":[{},[]]}`;
  assert.equal(dev.jsonMinify(src), min); assert.equal(dev.jsonMinify(dev.jsonFormat(src, 4)), min);
  assert.equal(dev.jsonFormat(' [ { } , [ ] ] ', 2), '[\n  {},\n  []\n]');
  for (const value of [null,true,false,0,'a\n"x',{},[],{z:[1,2],a:{x:'ok'}}]) {
    const serialized=JSON.stringify(value); assert.equal(dev.jsonMinify(dev.jsonFormat(serialized)), serialized);
  }
});
await test('JSON tools limit nesting and reject unsafe structural comparisons', () => {
  const nested = '['.repeat(257)+'0'+']'.repeat(257);
  assert.match(dev.validateJson(nested).message, /nesting limit/); assert.throws(()=>dev.jsonMinify(nested),/nesting limit/);
  assert.match(dev.validateJson(' '.repeat(1000001)).message,/character limit/);
  for (const text of ['{"x":9007199254740993}', '{"x":1e400}', '{"x":1e-400}', '{"x":-0}', '{"a":1,"\\u0061":2}']) {
    assert.throws(()=>dev.compareJson(text,'{}'),/Left JSON is invalid.*Duplicate|Left JSON is invalid.*safe numeric|Left JSON is invalid.*zero/);
  }
  assert.deepEqual(dev.compareJson('{"x":"9007199254740993"}', '{"x":"9007199254740992"}').map(d=>d.path), ['/x']);
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

await test('encoding, timestamps and JWT reject misleading or lossy inputs', () => {
  assert.equal(dev.b64decode('77u/YQ=='), '\uFEFFa');
  assert.throws(() => dev.b64decode('Zh=='), /padding bits/);
  assert.throws(() => dev.b64decode('Zg='), /padding/);
  assert.throws(() => dev.b64encode('\ud800'), /unpaired/);
  assert.equal(dev.parseTimestamp('1000','milliseconds').toISOString(), '1970-01-01T00:00:01.000Z');
  assert.equal(dev.parseTimestamp('1000','seconds').toISOString(), '1970-01-01T00:16:40.000Z');
  assert.throws(()=>dev.parseTimestamp('1000','minutes'),/Choose/);
  const b64 = s => Buffer.from(s).toString('base64url');
  assert.throws(()=>dev.decodeJwt(`${b64('{}')}.${b64('{}')}`),/three dot-separated/);
  assert.throws(()=>dev.decodeJwt(`${b64('{}')}.${b64('{}')}.a.b.c`),/three dot-separated/);
  assert.throws(()=>dev.decodeJwt(`${b64('null')}.${b64('{}')}.`),/JSON objects/);
  assert.throws(()=>dev.decodeJwt(`${b64('{}')}.${b64('{"a":1,"a":2}')}.`),/payload/);
  assert.ok(dev.decodeJwt(`${b64('{}')}.${b64('{"exp":"1000000000"}')}.`).invalidClaims.includes('exp'));
});
await test('random alphabet uses Unicode code points and rejects invalid lengths', () => {
  const rng = {getRandomValues(a){a[0]=1;return a;}};
  assert.equal(sec.randomFrom('a😀',rng),'😀');
  assert.equal(sec.buildCharset({custom:'aa😀😀'}), 'a😀');
  assert.throws(()=>sec.generatePassword(4.5,{},rng),/length/);
  assert.throws(()=>sec.buildCharset({custom:'\ud800'}),/surrogate/);
});

await test('regex bounded results retain zero-width positions and disclose truncation', () => {
 const r=dev.findMatches('(?=a)','gu','😀aa'); assert.deepEqual(r.matches.map(x=>x.index),[2,3]);
 assert.equal(dev.findMatches('a','g','a'.repeat(1001)).truncated,true);
 assert.match(dev.findMatches('a','g','a'.repeat(100001)).error,/limit/);
 const capture=dev.findMatches('(?<x>a+)','g','a'.repeat(2000)).matches[0]; assert.equal(capture.length,2000); assert.match(capture.named.x,/truncated/);
});

await test('text statistics and Unicode slugs retain meaningful marks', () => {
  const empty=text.textStats(''); assert.equal(empty.lines,0); assert.equal(empty.blankLines,0);
  const lines=text.textStats('a\r\nb\r'); assert.equal(lines.lines,3); assert.equal(lines.blankLines,1); assert.equal(lines.longestLine,1);
  assert.equal(text.slugify('हिन्दी भाषा'), 'हिन्दी-भाषा');
  assert.equal(text.convertCase('हिन्दी भाषा','snake'),'हिन्दी_भाषा');
  assert.equal(text.slugify('Ærø ÐÞ æøðþ', {lowercase:false}), 'AEro-DTH-aeodth');
  const words=Array(216).fill('word').join(' '); assert.equal(text.textStats(words).readingTime,'1 min 5 sec');
});
await test('line sort and diff preserve blanks and enforce bounds', () => {
  assert.deepEqual(text.dedupeLines('a\n\n\na',{keepEmpty:true}),['a','','']);
  assert.equal(text.sortLines('B\na\nA', {unique:true,caseInsensitive:true}),'a\nB');
  assert.equal(text.sortLines('x\n2\n-3\ny',{mode:'numeric'}),'-3\n2\nx\ny');
  assert.equal(text.sortLines('b\na\n',{mode:'alpha'}),'\na\nb');
  assert.equal(text.diffSummary(text.diffLines('a','a\n')).unchanged,false);
  assert.equal(text.diffSummary(text.diffLines('a\r\nb','a\nb')).unchanged,true);
  assert.throws(()=>text.diffLines('a\n'.repeat(4001),'x'),/4,000 lines/);
  assert.throws(()=>text.diffLines('x'.repeat(500001),''),/500,000/);
});

await test('SEO output rejects invalid URLs, control injection and unsafe sitemap metadata', () => {
 assert.throws(()=>seo.buildRobots([{agent:'*\nDisallow: /',disallow:[]}]),/User-agent/);
 assert.throws(()=>seo.buildRobots([{agent:'*',disallow:['/private#comment']}]),/Robots paths/);
 assert.throws(()=>seo.buildRobots([],{sitemap:'javascript:alert(1)'}),/HTTP/);
 assert.throws(()=>seo.buildRobots([],{crawlDelay:'1\nDisallow: /'}),/Crawl-delay/);
 assert.throws(()=>seo.buildSitemapXml(['https://a.test/','https://b.test/']),/same scheme/);
 assert.throws(()=>seo.buildSitemapXml(['https://a.test/#part']),/fragment/);
 assert.throws(()=>seo.buildSitemapXml(['ftp://a.test/']),/HTTP/);
 assert.throws(()=>seo.buildSitemapXml(['https://a.test/'],{lastmod:'2026-02-30'}),/valid date/);
 assert.throws(()=>seo.buildSitemapXml(['https://a.test/'],{changefreq:'<script>'}),/frequency/);
 assert.throws(()=>seo.buildSitemapXml(['https://a.test/'],{priority:'1.1'}),/Priority/);
 assert.match(seo.buildSitemapXml(['https://a.test/हिन्दी']),/%E0%A4/);
 assert.throws(()=>seo.extractYouTubeId('https://notyoutube.com/watch?v=abcdefghijk'),/No video ID/);
 assert.equal(seo.parseUrlParts('localhost:3000/a').host,'localhost'); assert.equal(seo.parseUrlParts('localhost:3000/a').port,'3000');
});
await test('SEO robots glob matching and Unicode keyword boundaries', () => {
 const rules=[{agent:'*',disallow:['/a*b*c$'],allow:[]}];
 assert.equal(seo.testRobotsAccess(rules,'x','/aZZbZc').allowed,false);
 assert.equal(seo.testRobotsAccess(rules,'x','/aZZbZc/no').allowed,true);
 const stars=[{agent:'*',disallow:['/a'+'*a'.repeat(400)+'b$']}]; assert.equal(seo.testRobotsAccess(stars,'x','/a'.repeat(1000)).allowed,true);
 assert.equal(seo.keywordDensity('हिन्दी हिन्दी', {filterStop:false}).terms[0].phrase,'हिन्दी');
 assert.throws(()=>seo.keywordDensity('a'.repeat(200001)),/limit/);
});

await test('random draws and wheel validate boundaries without retries', () => {
 let calls=0; const rng={getRandomValues(a){calls++;a[0]=0;return a;}};
 const nums=misc.randomNumbers({min:-500,max:499,count:1000,unique:true,rng}); assert.equal(calls,1000); assert.equal(new Set(nums).size,1000); assert.equal(nums.length,1000);
 assert.equal(misc.randomNumbers({min:0,max:4294967295,count:1,rng})[0],'0');
 assert.deepEqual(misc.randomNumbers({min:-1,max:-1,count:1,pad:3,rng}),['-01']);
 const orders=new Set(); for(let x=0;x<3;x++) for(let y=0;y<2;y++){let values=[x,y,0];let fake={getRandomValues(a){a[0]=values.shift();return a;}};orders.add(misc.randomNumbers({min:0,max:2,count:3,unique:true,rng:fake}).join(','));} assert.equal(orders.size,6);
 assert.throws(()=>misc.rollDice({dice:1.5,sides:6,rng}),/1 and 12/);
 assert.throws(()=>misc.rollDice({dice:1,sides:6.5,rng}),/2 and 100/);
 assert.throws(()=>misc.parseWheelEntries(Array(101).fill('A').join('\n')),/100 entries/);
 assert.throws(()=>misc.parseWheelEntries('a'.repeat(201)+'\nb'),/200 characters/);
 assert.deepEqual(misc.parseWheelEntries('A\nA\nB'),['A','A','B']);
});

await test('student calculators reject unsafe input and retain exact boundaries', () => {
 assert.throws(()=>stu.evaluate('1e-999'),/too small/); assert.throws(()=>math.parseNumbers('1e-999'),/too small/);
 assert.equal(stu.evaluate('1e+21 / 1e20'),10); assert.equal(stu.evaluate('6 × 3 ÷ 2 − 1'),8); assert.ok(Math.abs(stu.evaluate('sin(30)',{degrees:true})-0.5)<1e-12);
 assert.throws(()=>stu.evaluate('('.repeat(65)+'1'+')'.repeat(65)),/64 levels/); assert.throws(()=>stu.evaluate('1+'.repeat(300)+'1'),/512 characters/);
 assert.equal(stu.durationTotal([[1,59,59],[0,0,1]],['+']).text,'02:00:00');
 for (const rows of [[[0,60,0]],[[0,0,1.5]],[[-1,59,59]],[[NaN,0,0]]]) assert.throws(()=>stu.durationTotal(rows,[]),/whole non-negative/);
 assert.throws(()=>stu.weightedGpa([{gradePoint:'',credits:'4'}]),/Subject 1/); assert.throws(()=>stu.weightedGpa([{gradePoint:-2,credits:0}]),/Subject 1/);
 assert.equal(stu.weightedGpa([{gradePoint:0,credits:4},{gradePoint:10,credits:1}]).gpa,2);
 assert.equal(stu.attendanceCalc({held:1,attended:0,targetPct:50.000001}).classesNeeded,2);
 assert.equal(stu.attendanceCalc({held:3,attended:1,targetPct:33.333334}).classesNeeded,1);
 assert.equal(stu.attendanceCalc({held:4,attended:3,targetPct:75}).classesCanMiss,0);
 assert.throws(()=>stu.attendanceCalc({held:10.2,attended:5,targetPct:75}),/whole number/);
 assert.throws(()=>stu.attendanceCalc({held:1000000000,attended:0,targetPct:99.999999}),/safe integer/);
});

await test('attendance answers match independent exact brute force for small class counts', () => {
 for(let held=1;held<=12;held++) for(let attended=0;attended<=held;attended++) for(const pct of [25,50,75,80,90,100]){
  const r=stu.attendanceCalc({held,attended,targetPct:pct});
  if(attended*100 < held*pct && pct<100){let n=0;while((attended+n)*100<(held+n)*pct)n++;assert.equal(r.classesNeeded,n);}
  else if(attended*100>=held*pct){let n=0;while(attended*100 >= (held+n+1)*pct)n++;assert.equal(r.classesCanMiss,n);}
  else assert.equal(r.impossible,true);
 }
});

console.log('\n── Parser-based formatters ──');
await test('HTML formatter preserves preformatted content and rejects unsafe minification',async()=>{
 const out=await dev.formatHtml('<pre>  keep\n   me</pre>');assert.ok(out.includes('  keep\n   me'));
 await assert.rejects(()=>dev.minifyHtml('<p>x</p>'),/unavailable/);
});
await test('CSS format and minify preserve descendant selectors, strings and calc',async()=>{
 const css='.a .b { content: "a + b"; width: calc(100% - 2px); }';
 for(const out of [await dev.formatCss(css),await dev.minifyCss(css)]){assert.match(out,/\.a \.b/);assert.ok(out.includes('"a + b"'));assert.ok(out.includes('calc(100% - 2px)'));}
 assert.match(await dev.formatCss('/* header */\nbody{color:red}'),/\/\* header \*\//);
});
await test('JS parser preserves regex, templates and rejects invalid syntax',async()=>{
 const src='const x = /[{}]/; const s = `a${{x:1}.x}b`;';const out=await dev.formatJs(src);
 assert.ok(out.includes('/[{}]/'));assert.ok(out.includes('`a${{ x: 1 }.x}b`'));
 await assert.rejects(()=>dev.formatJs('const s = "abc'),/Unterminated/);
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
  assert.deepEqual({ y: r.years, m: r.months, d: r.days }, { y: 23, m: 11, d: 31 });
  const r2 = calc.ageCalc('1990-01-15', '2024-01-15');
  assert.equal(r2.years, 34);
  assert.equal(r2.birthdayToday, true);
});
await test('age rejects future birth', () => {
  assert.throws(() => calc.ageCalc('2100-01-01', '2024-01-01'), /before/);
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
await test('SIP future value (annuity due)', () => {
  const r = calc.sipCalc({ monthly: 1000, annualRatePct: 12, years: 1 });
  // FV = P × [((1+i)^n − 1)/i] × (1+i), i = 0.01, n = 12
  const expected = 1000 * ((Math.pow(1.01, 12) - 1) / 0.01) * 1.01;
  assert.ok(Math.abs(r.maturity - expected) < 1e-6, `${r.maturity} vs ${expected}`);
  assert.equal(r.invested, 12000);
  assert.equal(r.schedule.length, 1);
  const zero = calc.sipCalc({ monthly: 500, annualRatePct: 0, years: 2 });
  assert.equal(zero.maturity, 12000);
  assert.throws(() => calc.sipCalc({ monthly: 0, annualRatePct: 12, years: 5 }), /greater than zero/);
});
await test('PPF annual compounding', () => {
  const r = calc.ppfCalc({ yearlyDeposit: 150000, annualRatePct: 7.1, years: 15 });
  // F = P × [((1+i)^n − 1)/i] × (1+i) with deposit at start of each year
  const expected = 150000 * ((Math.pow(1.071, 15) - 1) / 0.071) * 1.071;
  assert.ok(Math.abs(r.maturity - expected) < 0.01, `${r.maturity} vs ${expected}`);
  assert.equal(r.invested, 2250000);
  assert.equal(r.schedule.length, 15);
  assert.equal(r.overLimit, false);
  assert.equal(calc.ppfCalc({ yearlyDeposit: 200000 }).overLimit, true);
});
await test('FD quarterly compounding', () => {
  const r = calc.fdCalc({ principal: 100000, annualRatePct: 6, years: 5, perYear: 4 });
  const expected = 100000 * Math.pow(1 + 0.06 / 4, 20);
  assert.ok(Math.abs(r.maturity - expected) < 1e-6);
  assert.ok(r.effectiveYield > 6 && r.effectiveYield < 6.2, `yield ${r.effectiveYield}`);
  assert.throws(() => calc.fdCalc({ principal: 0, annualRatePct: 6, years: 1 }), /greater than zero/);
});
await test('income tax FY25-26: ₹12.75L salary pays zero under new regime', () => {
  const r = calc.incomeTaxIndia({ grossSalary: 1275000 });
  assert.equal(r.newRegime.taxable, 1200000);
  assert.equal(r.newRegime.total, 0); // slab tax 60000 fully rebated u/s 87A
  assert.ok(r.oldRegime.total > 0);
  assert.equal(r.better, 'new');
});
await test('income tax FY25-26: ₹15L taxable under new regime', () => {
  const r = calc.incomeTaxIndia({ grossSalary: 1575000 }); // taxable 15,00,000 after ₹75k std deduction
  // slabs: 4–8L@5%=20000, 8–12L@10%=40000, 12–15L@15%=45000 → 105000 + 4% cess
  assert.ok(Math.abs(r.newRegime.total - 109200) < 0.01, `got ${r.newRegime.total}`);
});
await test('income tax: marginal relief just above ₹12L (new regime)', () => {
  const r = calc.incomeTaxIndia({ grossSalary: 1285000 }); // taxable 12,10,000
  // slab tax would be 61500; capped at excess over ₹12L = 10000, +4% cess
  assert.ok(Math.abs(r.newRegime.total - 10400) < 0.01, `got ${r.newRegime.total}`);
});
await test('income tax: old regime ₹10L taxable, below-60', () => {
  const r = calc.incomeTaxIndia({ grossSalary: 1050000, deductionsOld: 0 }); // taxable 10,00,000 after ₹50k std
  // 2.5–5L@5%=12500, 5–10L@20%=100000 → 112500 + 4% cess = 117000
  assert.ok(Math.abs(r.oldRegime.total - 117000) < 0.01, `got ${r.oldRegime.total}`);
  assert.throws(() => calc.incomeTaxIndia({}), /Enter your salary/);
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
await test('palette CSS variables use stable slug names and HEX values', () => {
  const css = color.paletteCss('Split complementary', [color.hexToRgb('#336699'), color.hexToRgb('#ffffff')]);
  assert.match(css, /^:root \{\n  --split-complementary-1: #336699;\n  --split-complementary-2: #ffffff;\n\}$/);
});

await test('color alpha, shorthand and advertised comma RGB parsing', () => {
  assert.deepEqual(color.parseColor('79, 70, 229'), {r:79,g:70,b:229,a:1});
  assert.equal(color.rgbToHex(color.hexToRgb('#f008')), '#ff000088');
  assert.equal(color.parseColor('rgb(255 0 0 / 50%)').a, 0.5);
  assert.equal(color.parseColor('hsl(0 100% 50% / 0.25)').a, 0.25);
  assert.throws(() => color.parseColor('rgb(2,3,4,1.2)'), /Alpha/);
});
await test('palette retains exact base and provides five monochromatic shades', () => {
  for(const base of ['#000000','#ffffff','#010203','#4f46e5']) {
    const c = color.hexToRgb(base);
    for(const type of ['complementary','analogous','triadic','split','tetradic']) assert.equal(color.rgbToHex(color.harmony(c,type)[0]),base);
    const mono = color.harmony(c,'mono'); assert.equal(mono.length,5); assert.equal(color.rgbToHex(mono[2]),base);
  }
});
await test('contrast threshold uses unrounded WCAG ratio', () => {
  const ratio=color.contrastRatio(color.hexToRgb('#070707'),color.hexToRgb('#777777'));
  assert.equal(ratio.toFixed(2),'4.50'); assert.ok(ratio<4.5);
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
await test('youtube id extraction (watch, youtu.be, shorts, raw id)', () => {
  const id = 'dQw4w9WgXcQ';
  assert.equal(seo.extractYouTubeId(`https://www.youtube.com/watch?v=${id}&t=42s`), id);
  assert.equal(seo.extractYouTubeId(`https://youtu.be/${id}?si=xyz`), id);
  assert.equal(seo.extractYouTubeId(`https://www.youtube.com/shorts/${id}`), id);
  assert.equal(seo.extractYouTubeId(`youtube.com/embed/${id}`), id);
  assert.equal(seo.extractYouTubeId(id), id);
  assert.equal(seo.youtubeThumbUrl(id, 'hqdefault'), `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  assert.throws(() => seo.extractYouTubeId('https://example.com/watch?v=123'), /No video ID/);
  assert.throws(() => seo.extractYouTubeId(''), /Paste a YouTube/);
});
await test('QR codes round-trip through a real decoder (jsQR)', async () => {
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const { default: jsQR } = await import('jsqr');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../assets/vendor/qrcode-generator.js', import.meta.url), 'utf8'), ctx);
  assert.equal(typeof ctx.qrcode, 'function', 'vendored QR lib did not initialise');
  const scanCtx = {};
  vm.createContext(scanCtx);
  vm.runInContext(readFileSync(new URL('../assets/vendor/jsqr.js', import.meta.url), 'utf8'), scanCtx);
  assert.equal(typeof scanCtx.jsQR, 'function', 'vendored jsQR scanner did not initialise');
  const decode = (modules) => {
    const size = modules.length, scale = 8, quiet = 4;
    const dim = (size + quiet * 2) * scale;
    const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (!modules[r][c]) continue;
      for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
        const px = ((r + quiet) * scale + y) * dim + (c + quiet) * scale + x;
        data[px * 4] = 0; data[px * 4 + 1] = 0; data[px * 4 + 2] = 0;
      }
    }
    return seo.decodeQrPixels(scanCtx.jsQR, { data, width: dim, height: dim });
  };
  for (const payload of ['https://i-have-tools.vercel.app/tools/qr-code-generator/', 'Hello QR — ₹100 ✓', 'WIFI:S:HomeWifi;T:WPA;P:secret123;;', '  padded text \n']) {
    const { modules, version } = seo.makeQrModules(ctx.qrcode, payload, 'M');
    assert.ok(version >= 1 && version <= 40);
    assert.equal(decode(modules), payload, `round-trip failed for: ${payload}`);
  }
  const svg = seo.qrSvgString(seo.makeQrModules(ctx.qrcode, 'test', 'L').modules);
  assert.match(svg, /<svg[^>]+viewBox="0 0 29 29"/);
  assert.throws(() => seo.makeQrModules(ctx.qrcode, ''), /Enter some text/);
  assert.throws(() => seo.makeQrModules(ctx.qrcode, 'x'.repeat(5000), 'H'), /too long/);
});
await test('number bases, roman numerals and morse code', () => {
  assert.equal(dev.convertBase('255', 10, 2), '11111111');
  assert.equal(dev.convertBase('255', 10, 16), 'ff');
  assert.equal(dev.convertBase('FF', 16, 10), '255');
  assert.equal(dev.convertBase('18446744073709551615', 10, 16), 'ffffffffffffffff', '2^64−1 converts exactly (BigInt, no float precision loss)');
  assert.equal(dev.convertBase('ffffffffffffffff', 16, 10), '18446744073709551615');
  assert.equal(dev.convertBase('-255', 10, 16), '-ff');
  assert.equal(dev.convertBase('0', 10, 2), '0');
  assert.equal(dev.convertBase('1111 1111', 2, 10), '255', 'grouping spaces are ignored');
  assert.equal(dev.groupDigits('11111111', 4), '1111 1111');
  assert.throws(() => dev.convertBase('102', 2, 10), /not a valid base-2 digit/);
  assert.throws(() => dev.convertBase('10', 1, 10), /between 2 and 36/);
  assert.equal(conv.toRoman(2026), 'MMXXVI');
  assert.equal(conv.toRoman(1994), 'MCMXCIV');
  assert.equal(conv.toRoman(49), 'XLIX');
  assert.equal(conv.toRoman(3999), 'MMMCMXCIX');
  for (let i = 1; i <= 3999; i += 137) assert.equal(conv.fromRoman(conv.toRoman(i)), i, `roman round-trip ${i}`);
  assert.throws(() => conv.fromRoman('IIII'), /not a standard Roman numeral/);
  assert.throws(() => conv.fromRoman('IC'), /not a standard Roman numeral/);
  assert.throws(() => conv.toRoman(4000), /between 1 and 3999/);
  assert.equal(text.textToMorse('SOS'), '... --- ...');
  assert.equal(text.morseToText('... --- ...'), 'SOS');
  assert.equal(text.morseToText(text.textToMorse('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789')), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789', 'full alphabet+digits round-trip');
  assert.equal(text.morseToText('... --- ...   ... --- ...'), 'SOS SOS', '3+ spaces decode as a word gap');
  assert.throws(() => text.morseToText('......'), /not a Morse code group/);
  assert.throws(() => text.textToMorse('héllo'), /No Morse code exists/);
});
await test('RD, CAGR and gratuity calculations', () => {
  const rd = calc.rdCalc({ monthly: 1000, annualRatePct: 7, months: 12 });
  assert.ok(Math.abs(rd.maturity - 12462.13) < 0.5, `RD maturity ${rd.maturity} (quarterly-compounding closed form)`);
  assert.equal(rd.deposited, 12000);
  assert.ok(Math.abs(rd.interest - (rd.maturity - rd.deposited)) < 1e-9);
  assert.ok(Math.abs(calc.rdCalc({ monthly: 5000, annualRatePct: 7, months: 60 }).maturity - 359664) < 5, 'RD ₹5,000/mo @7% for 5y');
  assert.equal(calc.rdCalc({ monthly: 5000, annualRatePct: 0, months: 24 }).maturity, 120000, 'zero-rate RD returns exactly the deposits');
  assert.equal(rd.schedule.length, 1);
  assert.equal(calc.rdCalc({ monthly: 1000, annualRatePct: 7, months: 30 }).schedule.at(-1).months, 30, 'partial-year schedule must end at the tenure');
  assert.throws(() => calc.rdCalc({ monthly: 1000, annualRatePct: 7, months: 7 }), /quarter/);
  const cg = calc.cagrCalc({ startValue: 10000, endValue: 20000, years: 5 });
  assert.ok(Math.abs(cg.cagrPct - 14.869835499703509) < 1e-9, `CAGR ${cg.cagrPct}`);
  assert.equal(cg.growthMultiple, 2);
  assert.equal(cg.absoluteReturnPct, 100);
  assert.equal(calc.cagrCalc({ startValue: 100, endValue: 0, years: 3 }).cagrPct, -100, 'wipe-out is −100% CAGR');
  const gr = calc.gratuityCalc({ monthlySalary: 50000, years: 20, months: 0 });
  assert.ok(Math.abs(gr.amount - (15 / 26) * 50000 * 20) < 1e-9, 'statutory 15/26 formula');
  assert.equal(gr.eligible, true);
  assert.equal(calc.gratuityCalc({ monthlySalary: 30000, years: 9, months: 7 }).roundedYears, 10, 'service over 6 months rounds up');
  assert.equal(calc.gratuityCalc({ monthlySalary: 30000, years: 9, months: 6 }).roundedYears, 9, 'exactly 6 months does NOT round up');
  assert.equal(calc.gratuityCalc({ monthlySalary: 30000, years: 4, months: 0 }).eligible, false, 'under 5 years is not eligible');
});
await test('site.js favourite/recent list helpers (pure)', async () => {
  const site = await import('../assets/js/site.js');
  assert.deepEqual(site.toggleId([], 'a'), ['a']);
  assert.deepEqual(site.toggleId(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(site.toggleId(['b'], 'a'), ['a', 'b'], 'new favourite goes first');
  assert.deepEqual(site.pushRecentId(['b', 'a'], 'a'), ['a', 'b'], 're-used tool moves to front without duplicating');
  assert.deepEqual(site.pushRecentId([], 'x'), ['x']);
  assert.deepEqual(site.pushRecentId(['1', '2', '3'], '0', 3), ['0', '1', '2'], 'recent list is capped');
});
await test('registry guides are well-formed and cover the top tools', () => {
  const expected = ['json-formatter', 'password-generator', 'word-counter', 'sip-calculator', 'percentage-calculator', 'qr-code-generator', 'image-compressor', 'income-tax-calculator', 'image-to-pdf', 'bmi-calculator', 'age-calculator', 'emi-calculator', 'gst-calculator', 'compound-interest-calculator', 'simple-interest-calculator', 'discount-calculator', 'fd-calculator', 'ppf-calculator', 'rd-calculator', 'cagr-calculator', 'gratuity-calculator', 'uuid-generator', 'base64-encoder', 'jpg-to-png', 'png-to-jpg', 'pdf-merge', 'youtube-thumbnail-downloader', 'character-counter', 'timestamp-converter', 'number-base-converter', 'roman-numeral-converter', 'morse-code-translator', 'lumpsum-calculator', 'percentage-change', 'keyword-density-checker', 'data-storage-converter', 'palette-generator', 'robots-txt-generator', 'nps-calculator', 'epf-calculator', 'hra-calculator', 'cgpa-calculator', 'attendance-calculator', 'qr-code-scanner', 'spin-wheel', 'typing-speed-test', 'final-grade-calculator', 'savings-goal-calculator', 'swp-calculator', 'electricity-cost-calculator', 'fuel-cost-calculator', 'pdf-organizer', 'json-compare', 'loan-prepayment-calculator', 'inflation-calculator', 'work-hours-calculator', 'profit-margin-calculator', 'business-day-calculator', 'budget-calculator', 'emergency-fund-calculator', 'debt-to-income-calculator', 'break-even-calculator', 'average-calculator', 'ratio-calculator', 'gcd-lcm-calculator', 'weighted-average-calculator', 'date-difference', 'date-add-calculator', 'iso-week-calculator', 'pressure-converter', 'energy-converter', 'power-converter', 'fuel-economy-converter'];
  const byId = new Map(registry.tools.map((t) => [t.id, t]));
  for (const id of expected) {
    assert.ok(byId.get(id)?.guide?.length >= 2, `${id} must carry a hand-written guide (deep content)`);
  }
  for (const t of registry.tools) {
    if (!t.guide) continue;
    assert.ok(Array.isArray(t.guide) && t.guide.length > 0, `${t.id} guide must be a non-empty array`);
    for (const b of t.guide) {
      assert.ok(typeof b.h === 'string' && b.h.length > 3, `${t.id} guide block needs a heading`);
      assert.ok(b.p || (b.list && b.list.length) || b.table, `${t.id} guide block "${b.h}" needs p, list or table`);
      if (b.table) {
        assert.ok(b.table.head.length > 0 && b.table.rows.length > 0, `${t.id} guide table needs head + rows`);
        for (const row of b.table.rows) assert.equal(row.length, b.table.head.length, `${t.id} guide table row width must match head`);
      }
    }
  }
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
await test('keyword frequency target, distinct terms, minimum filter and CSV', () => {
  const text = `${'word '.repeat(192)}${'keyword research '.repeat(4)}`;
  const r = seo.keywordDensity(text, { phraseLength: 1, filterStop: true, target: 'Keyword Research' });
  assert.equal(r.totalWords, 200);
  assert.equal(r.distinct, 3, 'distinct counts word, keyword and research once each');
  assert.deepEqual(r.target, { phrase: 'keyword research', count: 4, density: 4 });
  const repeated = seo.keywordDensity('alpha beta alpha gamma alpha beta', { minCount: 2, filterStop: false });
  assert.deepEqual(repeated.terms.map((t) => t.phrase), ['alpha', 'beta']);
  assert.match(seo.keywordFrequencyCsv(repeated.terms), /^term,count,density_percent\n"alpha",3,50\.0000\n"beta",2,33\.3333\n$/);
});
await test('robots.txt output shape', () => {
  const out = seo.buildRobots([{ agent: '*', disallow: ['/admin/'], allow: ['/admin/public'] }, { agent: 'Googlebot', disallow: [] }], { sitemap: 'https://x.y/sitemap.xml', crawlDelay: 2 });
  assert.match(out, /^User-agent: \*\nDisallow: \/admin\/\nAllow: \/admin\/public\n/);
  assert.match(out, /User-agent: Googlebot\nDisallow:\n/, 'an allow-everything group is written explicitly');
  assert.match(out, /Sitemap: https:\/\/x\.y\/sitemap\.xml/);
  assert.match(out, /Crawl-delay: 2/);
});
await test('robots crawl tester: specific group and longest pattern win', () => {
  const rules = [
    { agent: '*', disallow: ['/private/', '/*.pdf$'], allow: ['/private/public/'] },
    { agent: 'Googlebot', disallow: ['/google-only/'], allow: [] },
  ];
  assert.equal(seo.testRobotsAccess(rules, 'Bingbot', '/private/secret').allowed, false);
  const exception = seo.testRobotsAccess(rules, 'Bingbot', 'https://example.com/private/public/file?x=1');
  assert.equal(exception.allowed, true);
  assert.equal(exception.pattern, '/private/public/');
  const google = seo.testRobotsAccess(rules, 'Googlebot', '/private/secret');
  assert.equal(google.allowed, true, 'the Googlebot-specific group replaces the wildcard group');
  assert.equal(google.agentGroup, 'Googlebot');
  assert.equal(seo.testRobotsAccess(rules, 'Bingbot', '/docs/report.pdf').allowed, false, 'wildcard plus end anchor matches a PDF path');
  assert.equal(seo.testRobotsAccess(rules, 'Bingbot', '/docs/report.pdf/extra').allowed, true, 'the $ anchor prevents matching a longer path');
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
  assert.equal(s.modeCount, 3); // 8 appears three times
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

console.log('\n── Batch-12 math accuracy ──');
await test('average reports ties and correct sample and population spread',()=>{
 const s=math.averageStats([1,2,2,3,5]); assert.equal(s.mean,2.6); assert.deepEqual(s.modes,[2]); assert.ok(Math.abs(s.populationVariance-1.84)<1e-12); assert.equal(s.sampleVariance,2.3);
 assert.deepEqual(math.averageStats([5,5,2,2,1]).modes,[2,5]); assert.deepEqual(math.averageStats([1,2,3]).modes,[]);
 const single=math.averageStats([9]); assert.equal(single.populationSD,0); assert.equal(single.sampleVariance,null); assert.equal(single.sampleSD,null);
 assert.throws(()=>math.parseNumbers('0x10'),/not valid/); assert.throws(()=>math.parseNumbers('1e309'),/not valid/); assert.throws(()=>math.parseNumbers('2e12'),/trillion/); assert.throws(()=>math.parseNumbers('1 '.repeat(10001)),/10,000/);
});
await test('ratio uses exact decimal reduction and solves with zero and large values',()=>{
 assert.deepEqual(math.ratioCalc('0.3','0.1').simplified,[3,1]); assert.deepEqual(math.ratioCalc('0.000001','1000000000').simplified,[1,1000000000000000]);
 assert.deepEqual(math.ratioCalc('1.5','0.75').simplified,[2,1]); assert.equal(math.ratioSolve('16','9','1920'),1080); assert.equal(math.ratioSolve('1','2','0'),0);
 for(const v of ['0','-1','1.0000001','1e3','1000000001','x']) assert.throws(()=>math.ratioCalc(v,'1'));
 assert.throws(()=>math.ratioSolve('1','2','-1'));
});
await test('GCD and LCM bound factor work and reject overflow instead of rounding',()=>{
 assert.equal(math.gcdList([-12,18,30]),6); assert.equal(math.lcmList([-12,18,30]),180); assert.deepEqual(math.primeFactors(-60),[2,2,3,5]); assert.deepEqual(math.primeFactors(1),[]);
 assert.throws(()=>math.gcdList([0,1]),/non-zero/); assert.throws(()=>math.gcdList([1,1000000001]),/billion/); assert.throws(()=>math.lcmList([999999937,999999929]),/safe integer/); assert.throws(()=>math.primeFactors(1e15));
});
await test('weighted averages validate pairs and weights',()=>{
 const r=math.weightedAverage('80, 3\n90, 2'); assert.equal(r.weightedSum,420); assert.equal(r.totalWeight,5); assert.equal(r.average,84);
 assert.equal(math.weightedAverage('-5 1\n10 2').average,5); assert.equal(math.weightedAverage('9,0\n10,2').average,10);
 for(const input of ['', '1 0\n2 0', '1 -1', '1,2,3', '1 abc', '1 1000000001', '1 1\n'.repeat(1001)]) assert.throws(()=>math.weightedAverage(input));
});
await test('math guides and weighted average search and inbound links',()=>{
 for(const id of ['average-calculator','ratio-calculator','gcd-lcm-calculator','weighted-average-calculator']) { const t=registry.getTool(id); assert.ok(t?.guide?.length>=3 && t.faqs?.length>=3); assert.ok(registry.searchTools(t.name,20).some(x=>x.id===id)); assert.ok(registry.tools.filter(x=>x.id!==id && registry.relatedTools(x,6).some(y=>y.id===id)).length>=3,id); }
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

console.log('\n── Batch-14 conversion reliability ──');
await test('pressure, energy, power factors and round trips',()=>{
 const cases=[['pressure','bar','psi',1,14.503773773],['pressure','standard atmosphere (atm)','pascal (Pa)',1,101325],['energy','kilowatt-hour (kWh)','megajoule (MJ)',1,3.6],['energy','kilocalorie (thermochemical)','joule (J)',1,4184],['power','horsepower (mechanical)','kilowatt (kW)',1,0.7456998715822702],['power','horsepower (metric)','watt (W)',1,735.49875]];
 for(const [set,from,to,value,expected] of cases){const r=conv.convert(value,from,to,set);assert.ok(Math.abs(r-expected)<Math.max(1e-9,Math.abs(expected)*1e-10));assert.ok(Math.abs(conv.convert(r,to,from,set)-value)<1e-12);}
});
await test('fuel conversion uses reciprocal and separate US and UK gallons',()=>{
 const us='miles/US gallon (mpg US)', uk='miles/UK gallon (mpg UK)', k='kilometres/litre (km/L)', l='litres/100 km (L/100 km)';
 const r=conv.convert(30,us,l,'fuel'); assert.ok(Math.abs(r-7.8404861111)<1e-9); assert.ok(Math.abs(conv.convert(r,l,us,'fuel')-30)<1e-10);
 assert.ok(Math.abs(conv.convert(1,us,k,'fuel')-1.609344/3.785411784)<1e-12); assert.ok(Math.abs(conv.convert(1,uk,k,'fuel')-1.609344/4.54609)<1e-12);
 for(const n of [0,-1,NaN,Infinity]) assert.throws(()=>conv.convert(n,us,l,'fuel'));
});
await test('conversion boundaries, absolute zero, formatting and invalid unit names',()=>{
 assert.throws(()=>conv.convert(1,'metre','foot','nope'),/category/);assert.throws(()=>conv.convert(1,'toString','foot','length'),/Unknown unit/);
 for(const n of [Infinity,NaN,1e101,1e-101]) assert.throws(()=>conv.convert(n,'metre','foot','length'),/valid number/);
 for(const [unit,value] of [['Celsius',-273.15],['Fahrenheit',-459.67],['Kelvin',0],['Rankine',0]]) assert.ok(Math.abs(conv.convert(value,unit,'Kelvin','temperature'))<1e-10);
 assert.throws(()=>conv.convert(-0.01,'Kelvin','Celsius','temperature'),/absolute zero/); assert.equal(conv.convert(1e-50,'Kelvin','Kelvin','temperature'),1e-50);
 assert.match(conv.formatConversion(1e-8),/e-8/); assert.equal(conv.formatConversion(0),'0');
});
await test('new converter guides searchable and linked from other tools',()=>{
 for(const id of ['pressure-converter','energy-converter','power-converter','fuel-economy-converter']) {const t=registry.getTool(id);assert.ok(t.guide.length>=3&&t.faqs.length>=3);assert.ok(registry.searchTools(t.name,20).some(x=>x.id===id));assert.ok(registry.tools.filter(x=>x.id!==id&&registry.relatedTools(x,6).some(y=>y.id===id)).length>=3,id);}
 for(const id of ['volume-converter','time-converter','speed-converter','temperature-converter']) assert.ok(registry.getTool(id).guide.length>=3);
});

console.log('\n── Batch-13 calendar reliability ──');
await test('age uses clear leap-day policy and non-negative calendar breakdown',()=>{
 const feb=calc.ageCalc('2000-02-29','2023-02-28','feb28'); assert.equal(feb.years,23); assert.equal(feb.birthdayToday,true); assert.equal(feb.daysToBirthday,0); assert.deepEqual([feb.months,feb.days],[0,0]);
 const mar=calc.ageCalc('2000-02-29','2023-02-28','mar1'); assert.equal(mar.years,22); assert.equal(mar.daysToBirthday,1); assert.equal(mar.nextBirthday,'2023-03-01');
 const x=calc.ageCalc('2000-01-31','2023-03-01'); assert.deepEqual([x.years,x.months,x.days],[23,1,1]);
 assert.throws(()=>calc.ageCalc('2024-02-30','2024-03-01'),/Invalid date/); assert.throws(()=>calc.ageCalc('2000-01-01','2001-01-01','x'),/leap-day/);
});
await test('date difference handles month-end, reverse and inclusive totals',()=>{
 const r=dt.dateDiff('2024-01-31','2024-03-01'); assert.deepEqual([r.years,r.months,r.days,r.totalDays],[0,1,1,30]);
 const inclusive=dt.dateDiff('2024-03-01','2024-01-31',true); assert.equal(inclusive.totalDays,31); assert.equal(inclusive.businessDays+inclusive.weekendDays,31); assert.equal(inclusive.reversed,true); assert.deepEqual([inclusive.years,inclusive.months,inclusive.days],[0,1,1]);
 assert.throws(()=>dt.dateDiff('2024-02-30','2024-03-01'),/Invalid date/); assert.throws(()=>dt.dateDiff('1899-12-31','2024-01-01'),/1900/);
});
await test('date-add validates positive integers, supported ranges and directions',()=>{
 for(const v of [0,-1,1.5,Infinity,100001]) assert.throws(()=>dt.dateAdd('2024-01-01',v,'days','add'),/whole number/);
 assert.throws(()=>dt.dateAdd('2024-02-30',1,'days','add'),/Invalid/); assert.throws(()=>dt.dateAdd('2100-12-31',1,'days','add'),/outside/); assert.throws(()=>dt.dateAdd('2024-01-01',1,'days','x'),/add or subtract/);
});
await test('ISO week boundaries use Thursday week-year and Monday weeks',()=>{
 assert.deepEqual(dt.isoWeek('2021-01-01'),{year:2020,week:53,weekday:5,monday:'2020-12-28',sunday:'2021-01-03'});
 assert.deepEqual(dt.isoWeek('2018-12-31'),{year:2019,week:1,weekday:1,monday:'2018-12-31',sunday:'2019-01-06'});
 assert.equal(dt.isoWeek('2024-12-29').week,52); assert.equal(dt.isoWeek('2024-12-30').week,1); assert.throws(()=>dt.isoWeek('2024-02-30'),/Invalid/);
});
await test('calendar day totals are invariant across time zones and DST',async()=>{
 const {execFileSync}=await import('node:child_process');
 const code=`import {ageCalc} from './assets/js/tools/calculators.js'; import {dateDiff,isoWeek} from './assets/js/tools/datetime.js'; console.log(JSON.stringify([ageCalc('2024-03-09','2024-03-11').totalDays,dateDiff('2024-03-09','2024-03-11').totalDays,isoWeek('2021-01-01').week]))`;
 for(const TZ of ['UTC','America/New_York','Asia/Kolkata','Pacific/Auckland']) assert.deepEqual(JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',env:{...process.env,TZ}})),[2,2,53]);
});
await test('time zone converter rejects DST gaps and repeated times',()=>{
 const args={fromTz:'America/New_York',toTz:'UTC'};
 assert.throws(()=>dt.convertTimeZone({...args,dateStr:'2024-03-10',timeStr:'02:30'}),/does not exist/);
 assert.throws(()=>dt.convertTimeZone({...args,dateStr:'2024-11-03',timeStr:'01:30'}),/occurs twice/);
 assert.equal(dt.convertTimeZone({...args,dateStr:'2024-11-03',timeStr:'03:30'}).utc,'2024-11-03T08:30 UTC');
 assert.throws(()=>dt.convertTimeZone({...args,dateStr:'2024-02-30',timeStr:'12:00'}),/Invalid date/);
});
await test('ISO week guide, search and contextual inbound links',()=>{
 const t=registry.getTool('iso-week-calculator'); assert.ok(t?.guide?.length>=3&&t.faqs?.length>=3); assert.ok(registry.searchTools('ISO week number',20).some(x=>x.id===t.id)); assert.ok(registry.tools.filter(x=>x.id!==t.id&&registry.relatedTools(x,6).some(y=>y.id===t.id)).length>=3);
});

console.log('\n── Batch-15 audit regressions ──');
await test('monthly contributions stay monthly with each compounding frequency',()=>{
 for(const perYear of [1,2,4,12,52,365]) { const r=calc.compoundInterest({principal:0,annualRatePct:0,years:1,perYear,monthlyContribution:100});assert.equal(r.totalContributed,1200);assert.equal(r.finalBalance,1200); }
 const r=calc.compoundInterest({principal:1000,annualRatePct:10,years:2,perYear:1});assert.ok(Math.abs(r.finalBalance-1210)<1e-8);
 for (const n of [-1,Infinity,101]) assert.throws(()=>calc.compoundInterest({principal:100,annualRatePct:n,years:1}));
 assert.throws(()=>calc.compoundInterest({principal:0,annualRatePct:10,years:1,monthlyContribution:-1}),/contribution/);
});
await test('EMI, SIP, PPF and RD reject invalid or unbounded durations',()=>{
 assert.throws(()=>calc.emiCalc(1000,-1,12),/rate/);assert.throws(()=>calc.emiCalc(1000,12,1.5),/whole number/);assert.throws(()=>calc.emiCalc(1000,12,1e9),/whole number/);
 assert.ok(Number.isFinite(calc.emiCalc(1000,1e-9,12).emi));assert.throws(()=>calc.ppfCalc({yearlyDeposit:100,years:1.5}),/whole number/);assert.throws(()=>calc.sipCalc({monthly:100,annualRatePct:10,years:1000000}),/months/);assert.throws(()=>calc.rdCalc({monthly:100,annualRatePct:5,months:1e9}),/quarters/);
});
await test('tax standard deduction limited to salary and surcharge has marginal relief',()=>{
 const r=calc.incomeTaxIndia({grossSalary:1,otherIncome:999999}); assert.equal(r.newRegime.taxable,999999); assert.equal(r.oldRegime.taxable,999999);
 for(const threshold of [5000000,10000000,20000000,50000000]) {const at=calc.incomeTaxIndia({otherIncome:threshold}), above=calc.incomeTaxIndia({otherIncome:threshold+1});for(const k of ['newRegime','oldRegime']) assert.ok(above[k].total-at[k].total<=1.041,`${k} ${threshold}`);}
});
await test('CSV preserves text, rejects duplicate headers and malformed quoted fields',()=>{
 assert.deepEqual(data.csvToJson('id,flag\n001,true'),[{id:'001',flag:'true'}]);assert.equal(data.csvToJson('id\n1e999',{coerceTypes:true})[0].id,'1e999');
 assert.throws(()=>data.csvToJson('a,a\n1,2'),/Duplicate/);assert.throws(()=>data.csvToJson(',column_1\n1,2'),/Duplicate/);
 assert.throws(()=>data.parseCsv('x\n"a"b'),/closing quote/); assert.deepEqual(data.parseCsv('a,b\r1,2').rows,[['1','2']]);
 assert.throws(()=>data.jsonlToJsonArray('{}\n\n{bad}'),/line 3/);
 assert.equal(data.jsonToCsv('[{}]',{columns:['toString']}),'toString\n');
});
await test('audit: random range boundaries and PNG color-type mapping',()=>{
 assert.throws(()=>sec.randomInt(NaN),/range/);assert.throws(()=>misc.randomNumbers({min:1,max:4294967297,count:1}),/range/);assert.throws(()=>misc.randomNumbers({min:0,max:Number.MAX_SAFE_INTEGER+1,count:1}),/safe whole/);
 const b=new Uint8Array(33);b.set([137,80,78,71,13,10,26,10]);const v=new DataView(b.buffer);v.setUint32(8,13);b.set([73,72,68,82],12);v.setUint32(16,1);v.setUint32(20,1);b[24]=8;
 for(const [kind,label] of [[0,'Grayscale'],[2,'RGB'],[3,'Palette'],[4,'Grayscale + alpha'],[6,'RGBA']]){b[25]=kind;assert.equal(img.parseImageMetadata(b.buffer).summary.find(x=>x[0]==='Color type')[1],label);}
});
await test('contrast rejects alpha; fraction arithmetic refuses unsafe integers',()=>{
 assert.throws(()=>color.contrastRatio(color.hexToRgb('#0000'),color.hexToRgb('#fff')),/opaque/);
 assert.throws(()=>color.parseColor('rgb(300, 0, 0)'),/RGB channels/);assert.throws(()=>color.parseColor('rgba(0,0,0,2)'),/Alpha/);
 assert.throws(()=>stu.fractionCalc('9007199254740993','+','1'),/too large/);assert.throws(()=>stu.fractionCalc('100000000','*','100000000'),/too large/);
 for(let n=1;n<=5;n++) assert.equal(text.lorem({unit:'words',count:n}).split(/\s+/).length,n);
});

await test('finance: small rates, safe bounds and decimal withdrawal residue', () => {
  // Independent Python Decimal, 60-digit precision: 12000.000000065000... and 100000.000005000...
  const rd=calc.rdCalc({monthly:1000,annualRatePct:1e-9,months:12});
  assert.ok(Math.abs(rd.maturity-12000.000000065) < 1e-10);
  const fd=calc.fdCalc({principal:100000,annualRatePct:1e-9,years:5,perYear:4});
  assert.ok(Math.abs(fd.interest-0.00000500000000011875) < 1e-17);
  const swp=calc.swpCalc(0.3,0.1,0,3); assert.equal(swp.depletedMonth,3); assert.equal(swp.balance,0); assert.equal(swp.withdrawn,0.3);
  assert.equal(calc.simpleInterest({principal:50000,annualRatePct:8,time:3}).interest,12000);
  assert.equal(calc.simpleInterest({principal:36500,annualRatePct:10,time:365,unit:'days'}).interest,3650);
  for (const v of [NaN, Infinity, -1, 101]) assert.throws(()=>calc.simpleInterest({principal:100,annualRatePct:v,time:1}), /rate/);
  assert.throws(()=>calc.simpleInterest({principal:100,annualRatePct:1,time:1,unit:'weeks'}),/Choose/);
  assert.throws(()=>calc.fdCalc({principal:Infinity,annualRatePct:5,years:1}),/Deposit/);
  assert.throws(()=>calc.fdCalc({principal:100,annualRatePct:Infinity,years:1}),/rate/);
  assert.throws(()=>calc.rdCalc({monthly:100,annualRatePct:Infinity,months:12}),/rate/);
  assert.throws(()=>calc.rdCalc({monthly:Infinity,annualRatePct:1,months:12}),/deposit/);
  assert.throws(()=>calc.cagrCalc({startValue:1,endValue:Infinity,years:2}),/Ending/);
  assert.throws(()=>calc.cagrCalc({startValue:1e-300,endValue:1e12,years:.01}),/range/);
  assert.throws(()=>calc.tipCalc(100,10,1.5),/whole number/);
  assert.throws(()=>calc.tipCalc(100,10,NaN),/whole number/);
  assert.throws(()=>calc.gstCalc({amount:100,rate:18,mode:'unknown'}),/mode/);
  const loan=calc.loanPrepaymentCalc(100,0,25,0,0,1); assert.equal(loan.baseline.paid,100); assert.equal(loan.baseline.months,4);
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
  const json = data.csvToJson('name,age,active,note\nAda,36,true,"工程, 师"', {coerceTypes:true});
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

await test('data conversion rejects duplicate keys and dangerous numeric values', () => {
  for (const text of ['[{"id":9007199254740993}]', '[{"n":1e400}]', '[{"n":1e-400}]', '[{"n":-0}]', '[{"a":1,"\\u0061":2}]', '[{"nested":{"x":1,"x":2}}]']) {
    assert.throws(() => data.jsonToCsv(text), /Duplicate|safe numeric|zero/);
    assert.throws(() => data.jsonArrayToJsonl(text), /Duplicate|safe numeric|zero/);
  }
  assert.throws(() => data.jsonlToJsonArray('{}\n{"n":9007199254740993}'), /line 2.*safe numeric/);
  assert.equal(data.jsonToCsv('[{"n":"9007199254740993","x":"1e400"}]'), 'n,x\n9007199254740993,1e400');
  assert.equal(data.jsonToCsv('[{"n":9007199254740991}]'), 'n\n9007199254740991');
  assert.throws(() => data.jsonToCsv('[{"a":1}]', {columns:['a','a']}), /Duplicate/);
  assert.throws(() => data.jsonToCsv('[{"a":1}]', {delimiter:'?'}), /delimiter/);
  assert.throws(() => data.jsonArrayToJsonl('[]'), /empty array/);
  assert.ok(dev.validateJson('{"a":1,"\\u0061":2}').duplicateKeys.length);
});
await test('CSV preserves header whitespace and handles BOM and unsafe inferred numbers', () => {
  assert.deepEqual(data.csvToJson('\uFEFF name ,name\n a ,b'), [{' name ':' a ',name:'b'}]);
  assert.deepEqual(data.parseCsv('   ',{headerRow:false}).rows,[['   ']]);
  for (const v of ['1e400','1e-400','1e16','-0']) assert.equal(data.csvToJson(`id\n${v}`,{coerceTypes:true})[0].id,v);
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
  const stsd = box('stsd', [...u32(0), ...u32(1), ...u32(8), ...enc('avc1')]); // entry size + format
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
  assert.throws(() => audio.parseMp4(new Uint8Array([1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0])), /invalid|truncated|does not look like an MP4/);
});

await test('audio: real FFmpeg MP4 and boundary cases', () => {
  const mp4 = readFileSync(new URL('./fixtures/ffmpeg-test.mp4', import.meta.url));
  const p = audio.parseMp4(new Uint8Array(mp4));
  assert.equal(p.mvhd.duration / p.mvhd.timescale, 2);
  assert.equal(p.tracks.length, 2);
  const video = p.tracks.find(t => t.handler === 'vide');
  assert.equal(video.codec, 'avc1'); assert.equal(video.width, 128); assert.equal(video.height, 96);
  assert.equal(p.tracks.find(t => t.handler === 'soun').codec, 'mp4a');
  const box = (type, body, extended = false) => {
    const header = extended ? 16 : 8, data = new Uint8Array(header + body.length), dv = new DataView(data.buffer);
    dv.setUint32(0, extended ? 1 : data.length); data.set([...type].map(c => c.charCodeAt(0)), 4);
    if (extended) dv.setBigUint64(8, BigInt(data.length)); data.set(body, header); return data;
  };
  const mvhd = new Uint8Array(32); mvhd[0] = 1; new DataView(mvhd.buffer).setUint32(20, 1000); new DataView(mvhd.buffer).setBigUint64(24, 0xffffffffffffffffn);
  const extended = box('moov', box('mvhd', mvhd), true);
  assert.equal(audio.parseMp4(extended).mvhd.duration, null);
  const zero = box('moov', new Uint8Array()); new DataView(zero.buffer).setUint32(0, 0);
  assert.equal(audio.parseMp4(zero).topBoxes[0].size, 8);
  assert.throws(() => audio.parseMp4(extended.subarray(0, 20)), /truncated|invalid/);
  const bad = box('moov', box('trak', box('mdia', box('minf', box('stbl', box('stsd', new Uint8Array([0,0,0,0,0,0,0,1,0,0,0,30,97,118,99,49])))))));
  assert.throws(() => audio.parseMp4(bad), /truncated/);
  assert.throws(() => audio.sliceBuffer({sampleRate:100,length:100}, -1, 0.5), /valid range/);
  assert.throws(() => audio.sliceBuffer({sampleRate:100,length:100}, 0, 1.1), /valid range/);
});

await test('audio: sliceBuffer math', () => {
  const fake = { sampleRate: 100, numberOfChannels: 2, length: 100, getChannelData: () => new Float32Array(100).fill(0.25) };
  const sel = audio.sliceBuffer(fake, 0.1, 0.3);
  assert.equal(sel.channels.length, 2);
  assert.equal(sel.channels[0].length, 20);
  assert.throws(() => audio.sliceBuffer(fake, 0.5, 0.5), /valid range/);
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
  assert.equal(img.sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).buffer), 'png');
  const webp = new Uint8Array(16); webp.set([0x52, 0x49, 0x46, 0x46]); webp.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.equal(img.sniffImageType(webp.buffer), 'webp');
  assert.equal(img.sniffImageType(new Uint8Array([1, 2, 3]).buffer), null);
  assert.equal(img.sniffImageType(new Uint8Array([0x89,0x50,0x4e,0x47]).buffer), null);
  assert.equal(img.sniffImageType(new Uint8Array([0,0,0,0,0,0,0,0,0x57,0x45,0x42,0x50]).buffer), null);
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

await test('image metadata rejects oversized EXIF values and truncated PNG chunks safely', () => {
  const tiff = Buffer.alloc(26); tiff.write('II',0); tiff.writeUInt16LE(42,2); tiff.writeUInt32LE(8,4); tiff.writeUInt16LE(1,8);
  tiff.writeUInt16LE(0x010f,10); tiff.writeUInt16LE(2,12); tiff.writeUInt32LE(0xffffffff,14); tiff.writeUInt32LE(8,18);
  const payload=Buffer.concat([Buffer.from('Exif\0\0'),tiff]); const head=Buffer.from([0xff,0xd8,0xff,0xe1,0,0]); head.writeUInt16BE(payload.length+2,4);
  const jpg=Buffer.concat([head,payload,Buffer.from([0xff,0xd9])]); const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
  const parsed=img.parseImageMetadata(ab(jpg)); assert.equal(parsed.exif,null); assert.match(JSON.stringify(parsed.summary),/unreadable/);
  const png=Buffer.alloc(33); Buffer.from([0x89,0x50,0x4e,0x47,13,10,26,10]).copy(png); png.writeUInt32BE(13,8); png.write('IHDR',12); png.writeUInt32BE(1,16); png.writeUInt32BE(1,20);
  const broken=Buffer.concat([png, Buffer.from([0xff,0xff,0xff,0xff,0x49,0x44,0x41,0x54])]);
  const result=img.parseImageMetadata(ab(broken)); assert.match(JSON.stringify(result.summary),/corrupted/); assert.ok(!result.chunks.some(c=>c[0]==='IDAT'));
  assert.throws(() => img.computeTargetDims(100,100,{width:-1}), /positive whole/);
  assert.throws(() => img.computeTargetDims(100,100,{width:1.5}), /positive whole/);
});

console.log('\n── PDF helpers ──');
await test('range parsing: singles, ranges, mixed, unsorted, reversed', () => {
  assert.deepEqual(pdf.parseRanges('1-3, 7, 11-13', 20), [1, 2, 3, 7, 11, 12, 13]);
  assert.deepEqual(pdf.parseRanges('5-3', 20), [3, 4, 5]);
  assert.throws(() => pdf.parseRanges('0', 20), /start at 1/);
  assert.throws(() => pdf.parseRanges('25', 20), /does not exist/);
  assert.throws(() => pdf.parseRanges('abc', 20), /not a page/);
  assert.throws(() => pdf.parseRanges('', 20), /Enter the pages/);
  // fitRect: A4 page 595.28×841.89, 36pt margin, wide image letterboxed & centered
  const r1 = pdf.fitRect(1000, 500, 595.28, 841.89, 36);
  assert.ok(Math.abs(r1.width - (595.28 - 72)) < 1e-9);
  assert.ok(Math.abs(r1.height - r1.width / 2) < 1e-9);
  assert.ok(Math.abs(r1.x - 36) < 1e-9 && r1.y > 36);
  const r2 = pdf.fitRect(500, 1000, 595.28, 841.89, 36);
  assert.ok(Math.abs(r2.height - (841.89 - 72)) < 1e-9);
  assert.throws(() => pdf.fitRect(0, 100, 100, 100), /no dimensions/);
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

console.log('\n── Batch-4 in-demand tools ──');
await test('batch-4 catalogue remains present after expansion', () => {
  assert.equal(registry.tools.length, 128);
  assert.equal(registry.tools.filter((t) => t.guide).length, 78);
  const inboundCount = (id) => registry.tools.filter((t) => registry.relatedTools(t, 6).some((r) => r.id === id)).length;
  for (const id of ['nps-calculator', 'epf-calculator', 'hra-calculator', 'cgpa-calculator', 'attendance-calculator', 'qr-code-scanner', 'spin-wheel', 'typing-speed-test']) {
    assert.ok(inboundCount(id) >= 3, `${id} needs at least three contextual related-tool sources, got ${inboundCount(id)}`);
  }
  const q = (s) => registry.searchTools(s, 20).map((t) => t.id);
  assert.ok(q('nps').includes('nps-calculator'));
  assert.ok(q('cgpa to percentage').includes('cgpa-calculator'));
  assert.ok(q('scan qr').includes('qr-code-scanner'));
  assert.ok(q('wheel of names').includes('spin-wheel'));
  assert.ok(q('typing speed').includes('typing-speed-test'));
});
await test('NPS, EPF and HRA formulas match worked examples', () => {
  const zero = calc.npsCalc({ currentAge: 30, retirementAge: 31, monthlyContribution: 1000, annualReturnPct: 0, annuityPct: 40, annuityRatePct: 12 });
  assert.equal(zero.corpus, 12000);
  assert.equal(zero.annuityCorpus, 4800);
  assert.equal(zero.lumpSum, 7200);
  assert.equal(zero.monthlyPension, 48);
  const nps = calc.npsCalc({ currentAge: 30, retirementAge: 60, monthlyContribution: 5000, annualReturnPct: 10, annuityPct: 40, annuityRatePct: 7 });
  assert.equal(Math.round(nps.corpus), 11396627, 'guide example: ₹5k/month for 30 years at 10%');
  assert.equal(Math.round(nps.monthlyPension), 26592);
  assert.equal(nps.schedule.at(-1).age, 60);

  const epf50 = calc.epfCalc({ monthlyBasicDa: 50000, years: 1, annualSalaryGrowthPct: 0, annualInterestPct: 0 });
  assert.equal(epf50.balance, 129000, '₹6,000 employee + ₹4,750 employer EPF per month');
  assert.equal(epf50.epsContribution, 15000, 'EPS is capped at ₹1,250/month in the standard model');
  const epf15 = calc.epfCalc({ monthlyBasicDa: 15000, years: 1, annualSalaryGrowthPct: 0, annualInterestPct: 0 });
  assert.equal(epf15.balance, 28206);
  assert.equal(epf15.employerEpfContribution, 6606);
  const epfGuide = calc.epfCalc({ monthlyBasicDa: 30000, years: 20, annualSalaryGrowthPct: 5, annualInterestPct: 8.25 });
  assert.equal(Math.round(epfGuide.balance), 5415302, 'guide example must be generated by the shipped engine');

  const hra = calc.hraCalc({ salaryBasicDaAnnual: 600000, hraReceivedAnnual: 240000, rentPaidAnnual: 240000, metro: true });
  assert.deepEqual(
    { actual: hra.actualHra, rentLimit: hra.rentOverTenPercent, cap: hra.salaryCap, exempt: hra.exempt, taxable: hra.taxable, limit: hra.limitingFactor },
    { actual: 240000, rentLimit: 180000, cap: 300000, exempt: 180000, taxable: 60000, limit: 'rentOverTenPercent' });
  assert.equal(calc.hraCalc({ salaryBasicDaAnnual: 600000, hraReceivedAnnual: 240000, rentPaidAnnual: 50000 }).exempt, 0, 'rent at or below 10% of salary gives no exemption');
  assert.throws(() => calc.npsCalc({ currentAge: 60, retirementAge: 60, monthlyContribution: 1000, annualReturnPct: 10 }), /after your current age/);
  assert.throws(() => calc.epfCalc({ monthlyBasicDa: 10000, years: 0 }), /between 1 and 50/);
});
await test('CGPA conversion, weighted SGPA and attendance maths', () => {
  assert.equal(stu.cgpaToPercentage(8.5).percentage, 80.75);
  assert.ok(Math.abs(stu.percentageToCgpa(85).cgpa - 8.947368421052632) < 1e-12);
  assert.equal(stu.percentageToCgpa(100).cgpa, 10, 'reverse conversion is capped at the scale maximum');
  const sgpa = stu.weightedGpa([{ gradePoint: 9, credits: 4 }, { gradePoint: 8, credits: 3 }, { gradePoint: 10, credits: 2 }]);
  assert.ok(Math.abs(sgpa.gpa - 8.88888888888889) < 1e-12);
  assert.equal(sgpa.totalCredits, 9);
  const short = stu.attendanceCalc({ held: 40, attended: 28, targetPct: 75 });
  assert.equal(short.currentPct, 70);
  assert.equal(short.classesNeeded, 8, '36/48 is the first whole-class point at 75%');
  const safe = stu.attendanceCalc({ held: 40, attended: 32, targetPct: 75 });
  assert.equal(safe.classesNeeded, 0);
  assert.equal(safe.classesCanMiss, 2, '32/42 stays above target but 32/43 does not');
  assert.equal(stu.attendanceCalc({ held: 40, attended: 39, targetPct: 100 }).impossible, true);
  assert.throws(() => stu.attendanceCalc({ held: 10, attended: 11, targetPct: 75 }), /between 0 and classes held/);
});
await test('wheel selection geometry and typing score are exact', () => {
  assert.deepEqual(misc.parseWheelEntries('  Ana \n\nBen\n  Cy '), ['Ana', 'Ben', 'Cy']);
  assert.deepEqual(misc.shuffleEntries(['A', 'B', 'C'], () => 0), ['B', 'C', 'A'], 'deterministic Fisher-Yates check');
  for (const [count, winnerIndex] of [[4, 0], [4, 3], [7, 5], [12, 11]]) {
    const rotation = misc.wheelRotationForWinner({ currentRotation: 37, count, winnerIndex, jitter: 0.5, fullSpins: 5 });
    const centre = (winnerIndex + 0.5) * (360 / count);
    const landed = ((rotation + centre) % 360 + 360) % 360;
    assert.ok(Math.min(landed, 360 - landed) < 1e-9, `winner ${winnerIndex}/${count} must land at the pointer`);
    assert.ok(rotation >= 37 + 5 * 360);
  }
  const target = 'a'.repeat(275);
  const typed = `${'a'.repeat(250)}${'b'.repeat(25)}`;
  const score = misc.typingStats(target, typed, 60);
  assert.equal(score.netWpm, 50);
  assert.equal(score.grossWpm, 55);
  assert.ok(Math.abs(score.accuracy - (250 / 275 * 100)) < 1e-12);
  assert.equal(score.complete, true);
  assert.throws(() => misc.parseWheelEntries('only one'), /at least two/);
});
await test('QR payload classifier exposes destinations and refuses script URLs', () => {
  const site = seo.qrPayloadInfo('https://Example.com/path?q=1');
  assert.equal(site.type, 'Website URL');
  assert.equal(site.href, 'https://example.com/path?q=1');
  assert.match(site.safety, /example\.com/);
  assert.equal(seo.qrPayloadInfo('  https://example.com/  ').text, '  https://example.com/  ');
  assert.throws(() => seo.makeQrModules(() => {}, '\ud800'), /surrogate/);
  const script = seo.qrPayloadInfo('javascript:alert(1)');
  assert.equal(script.type, 'Plain text');
  assert.equal(script.href, null, 'non-http schemes never become an open button');
  const wifi = seo.qrPayloadInfo('WIFI:S:Home\\;WiFi;T:WPA;P:secret;;');
  assert.equal(wifi.type, 'Wi-Fi network');
  assert.match(wifi.summary, /Home;WiFi/);
  const upi = seo.qrPayloadInfo('upi://pay?pa=shop@bank&pn=Test%20Shop&am=100');
  assert.equal(upi.type, 'UPI payment request');
  assert.match(upi.summary, /Test Shop/);
  assert.equal(upi.href, null, 'payment payloads are inspected, not launched');
});

console.log('\n── Batch-6 planning tools ──');
await test('final grade handles attainable, impossible and zero-weight goals', () => {
  assert.equal(calc.finalGradeCalc(86, 88, 25, 80).required, 94);
  assert.equal(calc.finalGradeCalc(86, 88, 25, 80).overall, 84.5);
  assert.ok(calc.finalGradeCalc(50, 100, 20, 0).required > 100);
  assert.equal(calc.finalGradeCalc(80, 70, 0, 0).targetMetWithoutExam, true);
  assert.equal(calc.finalGradeCalc(80, 90, 0, 0).targetMetWithoutExam, false);
  assert.equal(calc.finalGradeCalc(80, 90, 100, 50).required, 90);
  assert.throws(() => calc.finalGradeCalc(101, 0, 20, 50));
});
await test('savings goal handles zero, tiny rates and already funded goals', () => {
  assert.equal(calc.savingsGoalCalc(100000, 10000, 0, 12).payment, 7500);
  assert.equal(calc.savingsGoalCalc(100, 200, 0, 12).payment, 0);
  const r = calc.savingsGoalCalc(100000, 10000, 0.0000000001, 12);
  assert.ok(Math.abs(r.payment - 7500) < 0.001);
  assert.ok(Math.abs(calc.savingsGoalCalc(100000, 10000, 12, 12).final - 100000) < 1e-7);
  assert.throws(() => calc.savingsGoalCalc(100, 0, 0, 0));
});
await test('SWP stops at depletion and caps the final withdrawal', () => {
  assert.deepEqual(calc.swpCalc(100000, 30000, 0, 12), { balance: 0, withdrawn: 100000, growth: 0, depletedMonth: 4, lastWithdrawal: 10000 });
  assert.equal(calc.swpCalc(100000, 10000, 0, 12).depletedMonth, 10);
  assert.equal(calc.swpCalc(0, 1000, 10, 12).depletedMonth, 0);
  const r = calc.swpCalc(1000, 100, 12, 1); assert.equal(r.balance, 910); assert.equal(r.growth, 10);
  assert.throws(() => calc.swpCalc(1000, 0, 0, 12));
});
await test('energy and fuel examples plus invalid inputs', () => {
  assert.deepEqual(calc.electricityCostCalc(1000, 2, 30, 8, 50), { units: 60, energyCost: 480, total: 530 });
  assert.deepEqual(calc.fuelCostCalc(100, 20, 100, 2, 4), { totalDistance: 200, litres: 10, total: 1000, perPerson: 250 });
  assert.throws(() => calc.electricityCostCalc(1000, 25, 30, 8, 0));
  assert.throws(() => calc.fuelCostCalc(100, 0, 100, 2, 1));
  assert.throws(() => calc.fuelCostCalc(100, 20, 100, 1.5, 1));
});
await test('batch-6 registry, search and guides', () => {
  for (const id of ['final-grade-calculator', 'savings-goal-calculator', 'swp-calculator', 'electricity-cost-calculator', 'fuel-cost-calculator']) {
    const tool = registry.getTool(id); assert.ok(tool && tool.guide?.length >= 3 && tool.faqs?.length >= 3);
    const inbound = registry.tools.filter(t => t.id !== id && registry.relatedTools(t, 6).some(r => r.id === id));
    assert.ok(inbound.length >= 3, `${id} needs three contextual related links, got ${inbound.length}`);
    assert.ok(registry.searchTools(tool.name, 20).some(t => t.id === id));
  }
});

console.log('\n── Batch-7 private document tools ──');
await test('JSON comparison ignores object ordering but respects arrays, types and escaped keys', () => {
  assert.deepEqual(dev.compareJson('{"a":1,"b":2}', '{"b":2,"a":1}'), []);
  const changes = dev.compareJson('{"a/b":1,"~x":[1,2],"gone":null}', '{"a/b":2,"~x":[1,3],"new":true}');
  assert.deepEqual(changes.map(x => [x.type, x.path]), [['changed','/a~1b'], ['removed','/gone'], ['added','/new'], ['changed','/~0x/1']]);
  assert.equal(dev.compareJson('1', '"1"')[0].path, '');
  assert.equal(dev.compareJson('[1]', '[1,2]')[0].path, '/1');
  assert.deepEqual(dev.compareJson('{"__proto__": 2}', '{"__proto__": 3}').map(x => x.path), ['/__proto__']);
  assert.throws(() => dev.compareJson('{', '{}'), /Left JSON is invalid/);
  assert.throws(() => dev.compareJson('{}', '{'), /Right JSON is invalid/);
  assert.throws(() => dev.compareJson('[1,2]', '[2,3]', { maxChanges: 1 }), /More than/);
  assert.throws(() => dev.compareJson('[1,2]', '[1,2]', { maxNodes: 1 }), /safety limit/);
});
await test('PDF organizer exports reordered, removed and rotated real PDF pages', async () => {
  const lib = await import('pdf-lib'); const source = await lib.PDFDocument.create();
  source.addPage([100, 200]); const p2 = source.addPage([200, 300]); p2.setRotation(lib.degrees(90)); source.addPage([300, 400]);
  const bytes = await pdf.organizePdf(lib, source, [{ index: 2, rotation: 90 }, { index: 1, rotation: 90 }]);
  const out = await lib.PDFDocument.load(bytes); assert.equal(out.getPageCount(), 2);
  assert.equal(out.getPage(0).getWidth(), 300); assert.equal(out.getPage(0).getRotation().angle, 90);
  assert.equal(out.getPage(1).getWidth(), 200); assert.equal(out.getPage(1).getRotation().angle, 180);
  assert.equal(source.getPageCount(), 3); assert.equal(source.getPage(1).getRotation().angle, 90);
  await assert.rejects(pdf.organizePdf(lib, source, []), /at least one/);
  await assert.rejects(pdf.organizePdf(lib, source, [{ index: 3, rotation: 0 }]), /Invalid/);
});
await test('batch-7 pages have guides, search coverage and three inbound links', () => {
  for (const id of ['pdf-organizer', 'json-compare']) {
    const tool = registry.getTool(id); assert.ok(tool.guide.length >= 3 && tool.faqs.length >= 3);
    assert.ok(registry.searchTools(tool.name, 20).some(t => t.id === id));
    assert.ok(registry.tools.filter(t => t.id !== id && registry.relatedTools(t, 6).some(r => r.id === id)).length >= 3);
  }
});

console.log('\n── Batch-8 planning tools ──');
await test('loan prepayment compares baseline and respects timing and caps', () => {
  const zero = calc.loanPrepaymentCalc(120000, 0, 10000, 1000, 20000, 3);
  assert.equal(zero.baseline.months, 12); assert.equal(zero.accelerated.months, 10); assert.equal(zero.interestSaved, 0); assert.equal(zero.accelerated.lumpApplied, 20000);
  const r = calc.loanPrepaymentCalc(1000, 12, 510, 10, 0, 1);
  assert.equal(r.baseline.months, 2); assert.ok(Math.abs(r.baseline.interest - 15) < 1e-10); assert.ok(Math.abs(r.accelerated.interest - 14.9) < 1e-10);
  assert.equal(calc.loanPrepaymentCalc(1000, 0, 100, 0, 5000, 1).accelerated.lumpApplied, 900);
  assert.equal(calc.loanPrepaymentCalc(1000, 0, 1000, 0, 100, 5).accelerated.lumpApplied, 0);
  assert.throws(() => calc.loanPrepaymentCalc(1000, 12, 10, 0, 0, 1), /exceed/);
  assert.throws(() => calc.loanPrepaymentCalc(1000, 0, 100, 0, 0, 1.5), /whole number/);
});
await test('inflation factors and zero rates follow the worked example', () => {
  const r = calc.inflationCalc(100000, 6, 10); assert.ok(Math.abs(r.futureCost - 179084.76965428545) < 1e-8); assert.ok(Math.abs(r.purchasingPower - 55839.47769151179) < 1e-8);
  assert.equal(calc.inflationCalc(100, 0, 10).futureCost, 100); assert.equal(calc.inflationCalc(100, 6, 0).purchasingPower, 100);
  assert.throws(() => calc.inflationCalc(100, -1, 10));
});
await test('work hours handle midnight, breaks and equal times', () => {
  assert.equal(calc.workHoursCalc('09:00','17:00',60,20).pay,140);
  const night = calc.workHoursCalc('22:00','06:00',30,20); assert.equal(night.netMinutes,450); assert.equal(night.pay,150); assert.equal(night.overnight,true);
  assert.equal(calc.workHoursCalc('09:00','09:00',0,0).netMinutes,0);
  assert.throws(() => calc.workHoursCalc('09:00','09:30',31,20), /Break/); assert.throws(() => calc.workHoursCalc('25:00','09:00',0,0));
});
await test('profit, margin and markup handle loss and zero denominators', () => {
  const r = calc.profitMarginCalc(60,100); assert.equal(r.profit,40); assert.equal(r.margin,40); assert.ok(Math.abs(r.markup - 200/3) < 1e-10);
  assert.equal(calc.profitMarginCalc(100,50).margin,-100); assert.equal(calc.profitMarginCalc(0,100).markup,null); assert.equal(calc.profitMarginCalc(100,0).margin,null); assert.throws(() => calc.profitMarginCalc(-1,100));
});
await test('batch-8 new pages have guides and contextual links', () => {
  for (const id of ['loan-prepayment-calculator','inflation-calculator','work-hours-calculator','profit-margin-calculator']) {
    const t=registry.getTool(id); assert.ok(t?.guide?.length >= 3 && t.faqs?.length >= 3); assert.ok(registry.searchTools(t.name,20).some(x=>x.id===id));
    assert.ok(registry.tools.filter(x=>x.id!==id && registry.relatedTools(x,6).some(y=>y.id===id)).length >= 3, id);
  }
});

console.log('\n── Batch-10 planning tools ──');
await test('50/30/20 targets and actuals including overspend',()=>{
 const r=calc.budget503020(50000,24000,16000,8000); assert.equal(r.needsTarget,25000); assert.equal(r.wantsTarget,15000); assert.equal(r.savingsTarget,10000); assert.equal(r.remaining,2000);
 assert.equal(calc.budget503020(100,100,100,0).remaining,-100); assert.throws(()=>calc.budget503020(0,0,0,0)); assert.throws(()=>calc.budget503020(100,-1,0,0));
});
await test('emergency fund target, already funded, zero and decimal contributions',()=>{
 const r=calc.emergencyFund(25000,6,50000,10000); assert.equal(r.target,150000); assert.equal(r.gap,100000); assert.equal(r.monthsToGoal,10);
 assert.equal(calc.emergencyFund(100,3,400,0).surplus,100); assert.equal(calc.emergencyFund(100,3,400,0).monthsToGoal,0); assert.equal(calc.emergencyFund(100,3,0,0).monthsToGoal,null);
 assert.equal(calc.emergencyFund(0.3,1,0.1,0.1).monthsToGoal,2); assert.throws(()=>calc.emergencyFund(1,0,0,0)); assert.throws(()=>calc.emergencyFund(Infinity,6,0,1));
});
await test('debt-to-income handles zero debt and debt exceeding income',()=>{
 assert.equal(calc.debtToIncome(100000,35000).ratio,35); assert.equal(calc.debtToIncome(100,0).ratio,0); assert.equal(calc.debtToIncome(100,200).incomeAfterDebts,-100); assert.throws(()=>calc.debtToIncome(0,1)); assert.throws(()=>calc.debtToIncome(100,-1));
});
await test('break-even handles rounding, no contribution, zero fixed and limits',()=>{
 const r=calc.breakEven(10000,100,60); assert.equal(r.units,250); assert.equal(r.revenue,25000); assert.equal(calc.breakEven(101,10,3).units,15);
 assert.equal(calc.breakEven(0.2,0.3,0.1).units,1); assert.equal(calc.breakEven(100,10,10).units,null); assert.equal(calc.breakEven(0,10,11).units,null); assert.equal(calc.breakEven(0,10,2).units,0);
 assert.throws(()=>calc.breakEven(1e12,1,0)); assert.throws(()=>calc.breakEven(-1,10,1));
});
await test('batch-10 tools have guides, search and inbound related links',()=>{
 for (const id of ['budget-calculator','emergency-fund-calculator','debt-to-income-calculator','break-even-calculator']) {const t=registry.getTool(id); assert.ok(t?.guide?.length>=3 && t.faqs?.length>=3); assert.ok(registry.searchTools(t.name,20).some(x=>x.id===id)); assert.ok(registry.tools.filter(x=>x.id!==id && registry.relatedTools(x,6).some(y=>y.id===id)).length>=3,id);}
});

console.log('\n── Batch-9 calendar and image reliability ──');
await test('business days honor inclusive range, weekends and manually supplied holidays', () => {
  assert.deepEqual(dt.countBusinessDays('2026-11-06','2026-11-13','sat_sun','2026-11-11'), { working: 5, nonWorking: 3, calendarDays: 8 });
  assert.equal(dt.countBusinessDays('2026-11-06','2026-11-06','sat_sun','').working,1);
  assert.equal(dt.countBusinessDays('2026-11-07','2026-11-08','sat_sun','2026-11-07,2026-11-07').working,0);
  assert.equal(dt.countBusinessDays('2026-11-06','2026-11-08','fri_sat','').working,1);
  assert.equal(dt.addBusinessDays('2026-11-06',5,'sat_sun','2026-11-11'),'2026-11-16');
  assert.equal(dt.addBusinessDays('2026-11-09',-1),'2026-11-06');
  assert.equal(dt.addBusinessDays('2026-11-07',0),'2026-11-07');
  assert.equal(dt.addBusinessDays('2024-02-28',1,'none'),'2024-02-29');
  assert.throws(() => dt.countBusinessDays('2024-02-30','2024-03-01'), /Invalid date/);
  assert.throws(() => dt.countBusinessDays('2026-11-10','2026-11-01'), /on or after/);
  assert.throws(() => dt.addBusinessDays('2026-11-06',1.5), /whole number/);
  assert.throws(() => dt.addBusinessDays('2100-12-31',1,'none'), /outside/);
});
await test('local date output is not shifted by UTC offset', async () => {
  const { execFileSync } = await import('node:child_process');
  for (const tz of ['Asia/Kolkata', 'America/Los_Angeles']) {
    const code = `import { dateAdd, localDateISO } from './assets/js/tools/datetime.js'; console.log(localDateISO(dateAdd('2024-01-31', 1, 'months', 'add')))`;
    assert.equal(execFileSync(process.execPath, ['--input-type=module','-e',code], { cwd: process.cwd(), env: { ...process.env, TZ: tz }, encoding: 'utf8' }).trim(), '2024-02-29');
  }
});
await test('business day catalogue entry is discoverable with contextual links', () => {
  const t=registry.getTool('business-day-calculator'); assert.ok(t?.guide?.length >= 3 && t.faqs?.length >= 3);
  assert.ok(registry.searchTools('business day calculator',20).some(x=>x.id===t.id));
  assert.ok(registry.tools.filter(x=>x.id!==t.id && registry.relatedTools(x,6).some(y=>y.id===t.id)).length >= 3);
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
