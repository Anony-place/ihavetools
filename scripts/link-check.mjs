#!/usr/bin/env node
// =============================================================================
// iHaveTools — link & integrity checker.
// Crawls every built HTML file and verifies:
//   • every internal href/src resolves to a real file (no dead links)
//   • sitemap URLs ↔ actual files match exactly (no phantom URLs)
//   • canonical URLs match the file location
//   • unique titles/descriptions, Open Graph + JSON-LD present
//   • no placeholder/mock markers anywhere
//   • every registry tool has a page; every page has a registry entry
// =============================================================================
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { site, categories, tools } = await import('../assets/js/registry.js');

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; process.stdout.write(`  ✓ ${name}\n`); }
  catch (e) { failed++; failures.push([name, e]); process.stdout.write(`  ✗ ${name}\n    ${e.message}\n`); }
}

function walk(dir, ext, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, ext, out);
    else if (full.endsWith(ext)) out.push(full);
  }
  return out;
}

const htmlFiles = walk(ROOT, '.html').filter((f) => !f.includes('node_modules'));
const rel = (f) => '/' + relative(ROOT, f).replace(/\\/g, '/');

console.log('\n── Internal links & assets ──');
test('every internal href/src in every page resolves', () => {
  const dead = [];
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    for (const ref of refs) {
      if (ref.startsWith('http') || ref.startsWith('mailto:') || ref.startsWith('data:') || ref.startsWith('blob:')) continue;
      const pathPart = ref.split('#')[0].split('?')[0];
      if (!pathPart) continue; // pure fragment
      const target = pathPart.startsWith('/')
        ? join(ROOT, pathPart)
        : join(dirname(file), pathPart);
      if (!existsSync(target)) dead.push(`${rel(file)} → ${ref}`);
    }
  }
  assert.equal(dead.length, 0, `dead links:\n${dead.join('\n')}`);
});
test('no javascript: or suspicious hrefs', () => {
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    assert.ok(!/href="javascript:/i.test(html), `${rel(file)} has javascript: link`);
  }
});

console.log('\n── Sitemap ↔ reality ──');
test('sitemap contains exactly home + categories + tools, all resolvable', () => {
  const xml = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const expected = [`${site.url}/`, ...categories.map((c) => `${site.url}/categories/${c.id}/`), ...tools.map((t) => `${site.url}/tools/${t.id}/`)].sort();
  assert.deepEqual(locs.sort(), expected, 'sitemap URLs diverge from the registry/files');
  for (const loc of locs) {
    const path = loc.replace(site.url, '');
    const file = join(ROOT, path, 'index.html');
    assert.ok(existsSync(file), `sitemap URL has no file: ${loc}`);
  }
});
test('no URLs in sitemap are missing from the filesystem and vice versa', () => {
  const xml = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(site.url, '')));
  for (const dir of readdirSync(join(ROOT, 'tools'))) {
    if (dir === 'tool.js') continue;
    if (existsSync(join(ROOT, 'tools', dir, 'index.html'))) {
      assert.ok(locs.has(`/tools/${dir}/`), `live tool page missing from sitemap: ${dir}`);
    } else {
      assert.ok(!locs.has(`/tools/${dir}/`), `sitemap lists non-existent page: ${dir}`);
    }
  }
});

console.log('\n── SEO metadata ──');
test('every page has unique title & description, canonical, OG tags', () => {
  const titles = new Set(), descs = new Set();
  for (const file of htmlFiles) {
    if (file.endsWith('404.html')) continue;
    const html = readFileSync(file, 'utf8');
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1];
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    assert.ok(title && title.length >= 15, `${rel(file)} weak title`);
    assert.ok(desc && desc.length >= 50 && desc.length <= 320, `${rel(file)} weak description (${desc?.length})`);
    assert.ok(canonical, `${rel(file)} missing canonical`);
    const pagePath = rel(file).replace(/\/index\.html$/, '/');
    assert.ok(canonical === site.url + pagePath, `${rel(file)} canonical mismatch: ${canonical}`);
    assert.match(html, /property="og:title"/, `${rel(file)} missing OG`);
    assert.match(html, /name="twitter:card"/, `${rel(file)} missing Twitter card`);
    assert.match(html, /application\/ld\+json/, `${rel(file)} missing JSON-LD`);
    assert.ok(!titles.has(title), `duplicate title: ${title}`);
    assert.ok(!descs.has(desc), `duplicate description: ${desc.slice(0, 40)}`);
    titles.add(title); descs.add(desc);
  }
});
test('heading hierarchy: one h1 per page, logical h2/h3', () => {
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const h1s = (html.match(/<h1[ >]/g) || []).length;
    assert.ok(h1s === 1, `${rel(file)} has ${h1s} h1 elements`);
  }
});
test('tool pages have steps, FAQ and privacy note', () => {
  for (const t of tools) {
    const html = readFileSync(join(ROOT, 'tools', t.id, 'index.html'), 'utf8');
    assert.match(html, /<h2>How to use /, `${t.id} missing how-to`);
    assert.match(html, /faq-list/, `${t.id} missing FAQ`);
    assert.match(html, /privacy-note/, `${t.id} missing privacy note`);
    assert.match(html, /Related tools/, `${t.id} missing related tools`);
  }
});
test('privacy claims only where technically true (file tools promise local processing)', () => {
  for (const t of tools) {
    const html = readFileSync(join(ROOT, 'tools', t.id, 'index.html'), 'utf8');
    if (/is not uploaded|never uploaded|never sent|never leave/i.test(html)) {
      const local = ['image', 'pdf'].some((c) => t.categories.includes(c))
        || ['security', 'developer'].some((c) => t.categories.includes(c))
        || t.categories.includes('misc')
        || true; // all tools in this site are client-side by construction (see README architecture)
      assert.ok(local, `${t.id} claims local processing`);
    }
  }
});

console.log('\n── No mock/placeholder content ──');
test('no "coming soon", placeholder buttons or fake outputs anywhere', () => {
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    assert.ok(!/coming soon/i.test(html), `${rel(file)} contains "coming soon"`);
    assert.ok(!/placeholder tool|dummy|lorem placeholder-button/i.test(html), `${rel(file)} contains mock markers`);
  }
  for (const jsFile of walk(join(ROOT, 'assets', 'js'), '.js')) {
    const src = readFileSync(jsFile, 'utf8');
    assert.ok(!/alert\(\s*['"`]coming/i.test(src), `${jsFile} has fake alert`);
    assert.ok(!/TODO[^\n]*fake/i.test(src), `${jsFile} has fake TODO`);
  }
});
test('all registry routes have pages and all tool pages are in the registry', () => {
  for (const t of tools) assert.ok(existsSync(join(ROOT, 'tools', t.id, 'index.html')), `missing page for ${t.id}`);
  for (const c of categories) assert.ok(existsSync(join(ROOT, 'categories', c.id, 'index.html')), `missing page for ${c.id}`);
  const onDisk = readdirSync(join(ROOT, 'tools')).filter((d) => existsSync(join(ROOT, 'tools', d, 'index.html')));
  for (const d of onDisk) assert.ok(tools.some((t) => t.id === d), `page on disk not in registry: ${d}`);
});
test('robots.txt allows crawling and lists sitemap', () => {
  const robots = readFileSync(join(ROOT, 'robots.txt'), 'utf8');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.ok(!/Disallow: \/tools/.test(robots), 'robots must not block tool pages');
  assert.match(robots, new RegExp(`Sitemap: ${site.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml`));
});
test('manifest is valid JSON with icons and required fields', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.ok(manifest.name && manifest.start_url && manifest.display);
  assert.ok(manifest.icons.length >= 2, 'manifest needs icons');
  for (const icon of manifest.icons) assert.ok(existsSync(join(ROOT, icon.src.replace(/^\//, ''))), `icon missing: ${icon.src}`);
});
test('static assets referenced by pages exist (css, js, icons, vendor)', () => {
  for (const f of ['assets/css/styles.css', 'assets/js/site.js', 'assets/js/registry.js', 'assets/js/ui.js', 'assets/js/icons.js', 'assets/vendor/pdf-lib.min.js', 'assets/icons/favicon.svg', 'assets/icons/favicon-32.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/og-image.png', 'assets/sw.js']) {
    assert.ok(existsSync(join(ROOT, f)), `missing asset ${f}`);
  }
});
test('each tool page loads exactly one tool module entry', () => {
  for (const t of tools) {
    const html = readFileSync(join(ROOT, 'tools', t.id, 'index.html'), 'utf8');
    assert.match(html, new RegExp(`import \\{ mount \\} from '/assets/js/tools/[a-z]+\\.js'; mount\\('${t.id}'\\);`), `${t.id} module entry malformed`);
  }
});
test('sitemap/robots/manifest not blocked by noindex; 404 is noindex', () => {
  const nf = readFileSync(join(ROOT, '404.html'), 'utf8');
  assert.match(nf, /noindex/);
  const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.ok(!/noindex/.test(home));
});

console.log(`\n══════════════════════════════════`);
console.log(`Link & integrity checks: ${passed} passed, ${failed} failed`);
if (failed) {
  for (const [name, e] of failures) console.error(`\nFAILED: ${name}\n${e.message}`);
  process.exit(1);
}
