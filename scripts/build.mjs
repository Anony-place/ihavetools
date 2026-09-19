#!/usr/bin/env node
// =============================================================================
// iHaveTools — static site generator.
// Reads the registry (assets/js/registry.js) and emits:
//   index.html, categories/<slug>/index.html, tools/<slug>/index.html,
//   sitemap.xml, robots.txt, manifest.webmanifest, 404.html
// Run `node scripts/build.mjs` after any registry change, and commit the output.
// =============================================================================
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site, categories, tools, toolsByCategory, categoryById } from '../assets/js/registry.js';
import { icon } from '../assets/js/icons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = site.url.replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);

/* ---------- helpers ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pageUrl = (path) => `${URL_BASE}${path}`;

function write(relPath, content) {
  const abs = join(ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  console.log(`✓ ${relPath}`);
}

function privacyFor(tool) {
  const cats = tool.categories;
  if (cats.includes('image') || cats.includes('pdf')) {
    return tool.id.startsWith('image-metadata')
      ? 'Your image is analysed locally in your browser and is not uploaded.'
      : 'Your file is processed locally in your browser and is not uploaded.';
  }
  if (cats.includes('security') || ['uuid-generator', 'hash-generator', 'random-number-generator'].includes(tool.id)) {
    return 'Everything is generated or computed locally in your browser with its cryptographic APIs. Nothing is sent anywhere.';
  }
  return 'This tool runs entirely in your browser. Your data is never uploaded or stored.';
}

function faqsFor(tool) {
  if (tool.faqs?.length) return tool.faqs;
  const faqs = [
    { q: `Is ${tool.name} free to use?`, a: 'Yes — it is completely free, with no sign-up, no watermarks and no usage limits.' },
    { q: 'Does my data leave my device?', a: privacyFor(tool).replace(/^Everything is generated or computed/, 'No — everything is generated or computed').replace(/^This tool runs/, 'No — this tool runs').replace(/^Your file is processed/, 'No — your file is processed').replace(/^Your image is analysed/, 'No — your image is analysed') },
  ];
  return faqs;
}

/* ---------- shared layout ---------- */
const THEME_INIT = `<script>(function(){try{var t=localStorage.getItem('iht-theme');if(!t){t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();</script>`;

function layout({ bodyClass, title, description, canonical, jsonLd = [], content, moduleEntry = null, ogType = 'website', noindex = false }) {
  const ld = jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="${site.themeColor}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${site.themeColorDark}" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/icons/icon-192.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:site_name" content="${site.name}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${pageUrl('/assets/icons/og-image.png')}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${pageUrl('/assets/icons/og-image.png')}">
${THEME_INIT}
<link rel="stylesheet" href="/assets/css/styles.css">
${ld}
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/"><span class="brand-mark"></span>iHaveTools</a>
    <nav class="main-nav" aria-label="Primary"></nav>
    <div class="header-actions"></div>
  </div>
  <nav class="mobile-nav" aria-label="Mobile menu"></nav>
</header>
<main id="main">
${content}
</main>
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="/"><span class="brand-mark"></span>iHaveTools</a>
        <p>${esc(site.tagline)} ${tools.length} tools. No sign-up. Your data stays in your browser.</p>
      </div>
      <div><h3>Popular tools</h3><ul>${tools.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 6).map((t) => `<li><a href="/tools/${t.id}/">${esc(t.name)}</a></li>`).join('')}</ul></div>
      <div><h3>Top categories</h3><ul>${categories.slice(0, 6).map((c) => `<li><a href="/categories/${c.id}/">${esc(c.name)}</a></li>`).join('')}</ul></div>
      <div><h3>More categories</h3><ul>${categories.slice(6).map((c) => `<li><a href="/categories/${c.id}/">${esc(c.name)}</a></li>`).join('')}</ul></div>
    </div>
    <div class="footer-bottom">
      <span>© <span id="footer-year">2026</span> iHaveTools. All tools are free and run client-side.</span>
      <span>Built for speed, privacy and everyday usefulness.</span>
    </div>
  </div>
</footer>
<script type="module" src="/assets/js/site.js"></script>
${moduleEntry ? `<script type="module">import { mount } from '${moduleEntry.module}'; mount('${moduleEntry.id}');</script>` : ''}
</body>
</html>
`;
}

/* ---------- components ---------- */
function toolCard(t) {
  const cat = categoryById.get(t.categories[0]);
  return `<a class="tool-card" href="/tools/${t.id}/">
  <span class="tool-icon">${icon(t.icon)}</span>
  <h3>${esc(t.name)}</h3>
  <p>${esc(t.blurb)}</p>
  <span class="card-meta"><span>${esc(cat?.name || '')}</span><span class="go">Open →</span></span>
</a>`;
}
function categoryCard(c) {
  const count = toolsByCategory(c.id).length;
  return `<a class="category-card" href="/categories/${c.id}/">
  <span class="tool-icon">${icon(c.icon)}</span>
  <h3>${esc(c.name)}</h3>
  <p>${esc(c.description)}</p>
  <span class="cat-count">${count} tool${count === 1 ? '' : 's'}</span>
</a>`;
}
const breadcrumb = (items) => `<nav class="breadcrumb container" aria-label="Breadcrumb"><ol>
<li><a href="/">Home</a></li>${items.map(([label, href]) => `<li>${href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`}</li>`).join('')}
</ol></nav>`;

/* ---------- homepage ---------- */
function buildHome() {
  const featured = tools.filter((t) => t.featured).sort((a, b) => b.popularity - a.popularity);
  const popular = tools.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 12);
  const recent = tools.slice().sort((a, b) => (a.added < b.added ? 1 : -1)).slice(0, 6);
  const atoz = tools.slice().sort((a, b) => a.name.localeCompare(b.name));

  const content = `
<section class="hero">
  <div class="container">
    <div class="hero-badges">
      <span class="badge">${icon('check')} ${tools.length} free tools</span>
      <span class="badge">${icon('shield-check')} Runs in your browser</span>
      <span class="badge">${icon('zap')} No sign-up, no limits</span>
    </div>
    <h1>Every tool you need.<br>Nothing you don't.</h1>
    <p class="lede">Free, fast, privacy-first online tools for developers, students and everyday work. Search once, use instantly.</p>
    <div class="search-box">
      <span class="search-glyph">${icon('search')}</span>
      <label class="sr-only" for="global-search">Search tools</label>
      <input id="global-search" type="search" placeholder="Search ${tools.length} tools — try “json”, “compress” or “password”…" autocomplete="off" aria-expanded="false" aria-controls="search-results">
      <kbd>/</kbd>
      <ul class="search-results" id="search-results" hidden></ul>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head">
      <div><h2>Popular tools</h2><p class="section-sub">The tools people reach for most.</p></div>
      <a class="section-link" href="#all-tools">All ${tools.length} tools ↓</a>
    </div>
    <div class="card-grid">${popular.slice(0, 8).map(toolCard).join('')}</div>
  </div>
</section>

<section class="section tint" id="categories">
  <div class="container">
    <div class="section-head">
      <div><h2>Browse by category</h2><p class="section-sub">${categories.length} categories, every one fully stocked with working tools.</p></div>
    </div>
    <div class="card-grid cols-3">${categories.map(categoryCard).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head">
      <div><h2>Featured tools</h2><p class="section-sub">Hand-picked starting points.</p></div>
    </div>
    <div class="card-grid">${featured.slice(0, 8).map(toolCard).join('')}</div>
  </div>
</section>

<section class="section tint">
  <div class="container">
    <div class="section-head">
      <div><h2>Recently added</h2><p class="section-sub">Fresh tools, same quality bar.</p></div>
    </div>
    <div class="card-grid">${recent.map(toolCard).join('')}</div>
  </div>
</section>

<section class="section" id="all-tools">
  <div class="container">
    <div class="section-head">
      <div><h2>All tools A–Z</h2><p class="section-sub">Every tool on iHaveTools — all ${tools.length} of them work.</p></div>
      <span class="section-sub">${tools.length} tools</span>
    </div>
    <ul class="atoz">
      ${atoz.map((t) => `<li><a href="/tools/${t.id}/">${icon(t.icon)}<span>${esc(t.name)}</span><span class="cat-tag">${esc(categoryById.get(t.categories[0])?.name || '')}</span></a></li>`).join('')}
    </ul>
  </div>
</section>

<section class="section tint" id="about">
  <div class="container">
    <div class="privacy-strip">
      <div class="strip-item">${icon('shield-check')}<div><h3>Private by design</h3><p>Text, files and data are processed on your device. Nothing is uploaded — so tools stay fast and your information stays yours.</p></div></div>
      <div class="strip-item">${icon('zap')}<div><h3>Fast and dependency-free</h3><p>No frameworks, no trackers on tool pages, no waiting. Pages are static and open instantly, even on slow connections.</p></div></div>
      <div class="strip-item">${icon('check-circle')}<div><h3>Honest tools only</h3><p>Every tool listed here genuinely works — no half-finished stubs, no fake buttons, no empty categories.</p></div></div>
    </div>
  </div>
</section>`;

  write('index.html', layout({
    bodyClass: 'page-home',
    title: `${site.name} — Free Online Tools for Everyday Work`,
    description: `${tools.length} free online tools: calculators, converters, text and image utilities, developer helpers and more. Fast, private, no sign-up — everything runs in your browser.`,
    canonical: pageUrl('/'),
    jsonLd: [{
      '@context': 'https://schema.org', '@type': 'WebSite',
      name: site.name, url: pageUrl('/'), description: site.description,
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${pageUrl('/')}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
    }],
    content,
  }));
}

/* ---------- category pages ---------- */
function buildCategory(c) {
  const list = toolsByCategory(c.id);
  const others = categories.filter((x) => x.id !== c.id).slice(0, 8);
  const content = `
${breadcrumb([[c.name]])}
<div class="container">
  <header class="page-head">
    <span class="kicker">${icon(c.icon)} ${list.length} tool${list.length === 1 ? '' : 's'}</span>
    <h1>${esc(c.name)}</h1>
    <p class="lede">${esc(c.description)}</p>
  </header>
</div>
<section class="section" style="padding-top:22px">
  <div class="container">
    <div class="card-grid cols-3">${list.map(toolCard).join('')}</div>
  </div>
</section>
<section class="section tint">
  <div class="container">
    <div class="section-head"><div><h2>Other categories</h2></div><a class="section-link" href="/#all-tools">All tools A–Z →</a></div>
    <div class="card-grid cols-3">${others.map(categoryCard).join('')}</div>
  </div>
</section>`;
  write(`categories/${c.id}/index.html`, layout({
    bodyClass: 'page-category',
    title: `${c.name} Tools — Free, Browser-Based | ${site.name}`,
    description: `${list.length} free ${c.name.toLowerCase()} tools that run in your browser. ${c.description}`,
    canonical: pageUrl(`/categories/${c.id}/`),
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${c.name} Tools`, description: c.description, url: pageUrl(`/categories/${c.id}/`) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: pageUrl('/') },
        { '@type': 'ListItem', position: 2, name: c.name, item: pageUrl(`/categories/${c.id}/`) },
      ] },
    ],
    content,
  }));
}

/* ---------- tool pages ---------- */
function buildTool(t) {
  const cat = categoryById.get(t.categories[0]);
  const related = tools
    .filter((x) => x.id !== t.id && x.categories.some((c) => t.categories.includes(c)))
    .sort((a, b) => b.popularity - a.popularity).slice(0, 4);
  const faqs = faqsFor(t);
  const privacy = privacyFor(t);
  const groupName = { developer: 'developer', text: 'text', calculators: 'calculators', converters: 'converters', security: 'security', image: 'image', color: 'color', webseo: 'webseo', student: 'student', math: 'math', datetime: 'datetime', data: 'data', misc: 'misc', pdf: 'pdf', audio: 'audio' }[t.engine] || t.categories[0];
  const content = `
${breadcrumb([[cat.name, `/categories/${cat.id}/`], [t.name]])}
<div class="container">
  <header class="page-head">
    <span class="kicker">${icon(t.icon)} ${esc(cat.name)}</span>
    <h1>${esc(t.name)}</h1>
    <p class="lede">${esc(t.description)}</p>
    <span class="privacy-note">${icon('shield-check')} ${esc(privacy)}</span>
  </header>
</div>
<div class="container tool-wrap">
  <div class="tool-panel">
    <div id="tool-app"></div>
  </div>
</div>
<section class="section tool-docs" style="padding-top:8px">
  <div class="container" style="max-width:860px">
    <section><h2>How to use ${esc(t.name)}</h2><ol class="howto">${t.steps.split('|').map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>
    <section><h2>Frequently asked questions</h2><div class="faq-list">${faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p class="faq-a">${esc(f.a)}</p></details>`).join('')}</div></section>
    ${related.length ? `<section><h2>Related tools</h2><div class="card-grid cols-3">${related.map(toolCard).join('')}</div></section>` : ''}
  </div>
</section>`;
  write(`tools/${t.id}/index.html`, layout({
    bodyClass: 'page-tool',
    title: `${t.name} — Free & Online | ${site.name}`,
    description: t.blurb.length > 150 ? t.blurb.slice(0, 147) + '…' : t.description,
    canonical: pageUrl(`/tools/${t.id}/`),
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        name: t.name, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (web browser)',
        url: pageUrl(`/tools/${t.id}/`), description: t.description, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: pageUrl('/') },
        { '@type': 'ListItem', position: 2, name: cat.name, item: pageUrl(`/categories/${cat.id}/`) },
        { '@type': 'ListItem', position: 3, name: t.name, item: pageUrl(`/tools/${t.id}/`) },
      ] },
    ],
    content,
    moduleEntry: { module: `/assets/js/tools/${groupName}.js`, id: t.id },
  }));
}

/* ---------- 404 ---------- */
function build404() {
  write('404.html', layout({
    noindex: true,
    bodyClass: 'page-404',
    title: `Page not found — ${site.name}`,
    description: 'This page does not exist. Search all iHaveTools tools instead.',
    canonical: pageUrl('/404.html'),
    content: `<div class="container notfound">
  <p class="code">404</p>
  <h1>That page doesn't exist.</h1>
  <p class="lede" style="color:var(--text-2)">The link may be outdated — every tool that exists is on the homepage, and they all work.</p>
  <div class="search-box" style="max-width:480px">
    <span class="search-glyph">${icon('search')}</span>
    <label class="sr-only" for="global-search">Search tools</label>
    <input id="global-search" type="search" placeholder="Search tools…">
    <ul class="search-results" hidden></ul>
  </div>
  <p style="margin-top:22px"><a class="btn btn-primary" href="/">Browse all tools</a></p>
</div>`,
  }));
}

/* ---------- sitemap / robots / manifest ---------- */
function buildMeta() {
  const urls = ['/', ...categories.map((c) => `/categories/${c.id}/`), ...tools.map((t) => `/tools/${t.id}/`)];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url>\n    <loc>${pageUrl(u)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u === '/' ? 'daily' : 'weekly'}</changefreq>\n    <priority>${u === '/' ? '1.0' : u.startsWith('/categories') ? '0.8' : '0.7'}</priority>\n  </url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${pageUrl('/sitemap.xml')}\n`);
  write('manifest.webmanifest', JSON.stringify({
    name: site.name,
    short_name: site.name,
    description: site.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: site.themeColor,
    icons: [
      { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/assets/icons/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: tools.filter((t) => t.featured).slice(0, 4).map((t) => ({ name: t.name, url: `/tools/${t.id}/`, icons: [{ src: '/assets/icons/icon-192.png', sizes: '192x192' }] })),
  }, null, 2) + '\n');
}

/* ---------- run ---------- */
rmSync(join(ROOT, 'categories'), { recursive: true, force: true });
const toolDirs = new Set(tools.map((t) => t.id));
// remove stale tool directories not present in the registry
import { readdirSync, existsSync } from 'node:fs';
const toolsRoot = join(ROOT, 'tools');
if (existsSync(toolsRoot)) {
  for (const dir of readdirSync(toolsRoot)) {
    if (!toolDirs.has(dir)) {
      rmSync(join(toolsRoot, dir), { recursive: true, force: true });
      console.log(`✗ removed stale tools/${dir}`);
    }
  }
}
buildHome();
categories.forEach(buildCategory);
tools.forEach(buildTool);
build404();
buildMeta();
console.log(`\nBuild complete: ${tools.length} tools, ${categories.length} categories.`);
