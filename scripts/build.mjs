#!/usr/bin/env node
// =============================================================================
// iHaveTools — static site generator.
// Reads the registry (assets/js/registry.js) and emits:
//   index.html, categories/<slug>/index.html, tools/<slug>/index.html,
//   sitemap.xml, robots.txt, manifest.webmanifest, 404.html
// Run `node scripts/build.mjs` after any registry change, and commit the output.
// =============================================================================
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'; // existsSync is imported with readdirSync near the sprite step below
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site, categories, tools, toolsByCategory, categoryById, relatedTools } from '../assets/js/registry.js';
import { iconRef as icon, icons as iconBodies, brandMark } from '../assets/js/icons.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = site.url.replace(/\/$/, '');
// Production is served from the domain root on Vercel. Absolute
// paths everywhere — the committed HTML, site.js, PDF loader and the
// service worker all already assume this. (Previously this flipped between
// '' and '../../', making every rebuild silently rewrite every URL.)
const ROOT_PREFIX = '/';
export const STATIC_PAGES = ['about', 'privacy-policy', 'terms'];

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
  if (tool.privacyOverride) return tool.privacyOverride;
  const cats = tool.categories;
  if (tool.id === 'youtube-thumbnail-downloader') return 'Thumbnail images load from YouTube’s image CDN, which receives your IP address and the requested video ID.';
  if (tool.engine === 'image' || tool.engine === 'pdf') {
    return tool.id.startsWith('image-metadata')
      ? 'Your image is analysed locally in your browser and is not uploaded.'
      : 'Your file is processed locally in your browser and is not uploaded.';
  }
  if (cats.includes('security') || ['uuid-generator', 'hash-generator', 'random-number-generator'].includes(tool.id)) {
    return 'This tool processes or generates its content locally in your browser.';
  }
  return 'Calculations and text processing happen in your browser. Optional share links can contain inputs; see the Privacy Policy.';
}

function faqsFor(tool) {
  const faqs = tool.faqs?.length ? [...tool.faqs] : [
    { q: `Is ${tool.name} free to use?`, a: 'Yes — it is completely free, with no sign-up, no watermarks and no usage limits.' },
    { q: 'How is my data handled?', a: privacyFor(tool) },
  ];
  // Every tool also gets FAQs built from its own description/aliases, so
  // long-tail questions ("what is X used for?", "is <alias> the same as X?")
  // have unique, honest answers instead of boilerplate alone.
  const push = (q, a) => { if (!faqs.some((f) => f.q === q)) faqs.push({ q, a }); };
  push(`What is ${tool.name} used for?`, tool.description);
  const alias = (tool.aliases || []).find((a) => a.toLowerCase() !== tool.name.toLowerCase());
  if (alias) push(`Is “${alias}” the same as ${tool.name}?`, `Yes — “${alias}” is another name people use for this tool. This page is the free online ${tool.name}: open it and use it right away, with nothing to download or sign up for.`);
  push(`Do I need to install anything to use ${tool.name}?`, `No. ${tool.name} runs in any modern web browser — on a phone, tablet or computer — as soon as the page opens.`);
  return faqs.slice(0, 6);
}

/* Optional hand-written deep content per tool (registry `guide` field):
   [{ h, p: string|string[], list: string[], table: {head, rows} }].
   Rendered as static HTML so crawlers and no-JS readers get the full text —
   this is what turns a thin tool page into a rankable, genuinely useful one. */
function guideHtml(tool) {
  if (!Array.isArray(tool.guide) || !tool.guide.length) return '';
  const blocks = tool.guide.map((b) => {
    const parts = [`<h3>${esc(b.h)}</h3>`];
    const paras = b.p ? (Array.isArray(b.p) ? b.p : [b.p]) : [];
    for (const p of paras) parts.push(`<p>${esc(p)}</p>`);
    if (Array.isArray(b.list) && b.list.length) {
      parts.push(`<ul>${b.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`);
    }
    if (b.table && Array.isArray(b.table.head) && Array.isArray(b.table.rows)) {
      const head = b.table.head.map((c) => `<th scope="col">${esc(c)}</th>`).join('');
      const rows = b.table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
      parts.push(`<div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable table"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`);
    }
    return parts.join('');
  }).join('');
  return `<section><h2>${esc(tool.name)} guide</h2>${blocks}</section>`;
}

/** Trim a meta description to the ~155 chars search engines display. */
function metaDesc(text) {
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length <= 158 ? s : s.slice(0, 157).replace(/\s+\S*$/, '') + '…';
}

/* ---------- shared layout ---------- */
const THEME_INIT = `<script>(function(){try{var t=localStorage.getItem('iht-theme');if(!t){t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();</script>`;

/* Static header chrome — rendered at build time so navigation links are in
   the HTML for crawlers and paint without JS (no layout shift). site.js only
   adds behaviour (theme values, toggles) to these elements. */
function headerHtml(home, withSearch = false) {
  const searchHtml = withSearch ? `<a class="icon-btn mobile-search-launch" href="${ROOT_PREFIX}#all-tools" aria-label="Search tools" aria-expanded="false" aria-controls="header-search-box">${icon('search')}</a><div id="header-search-box" class="search-box header-search" role="search"><span class="search-glyph">${icon('search')}</span><label class="sr-only" for="global-search">Search tools</label><input id="global-search" type="search" placeholder="Search ${tools.length} tools… (Ctrl K)" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="search-results"><ul class="search-results" id="search-results" role="listbox" aria-label="Matching tools" hidden></ul><span class="sr-only search-status" role="status" aria-live="polite"></span></div>` : (home ? '' : `<a class="btn btn-secondary btn-sm hide-sm" href="${ROOT_PREFIX}" aria-label="Search all tools" style="gap:7px"><span style="display:inline-flex">${icon('search')}</span>Search</a>`);
  const drop = `<details class="nav-drop"><summary>Categories <span style="display:inline-flex;width:14px">${icon('arrow-down')}</span></summary><div class="dropdown-panel">${categories.map((c) => `<a href="${ROOT_PREFIX}categories/${c.id}/"><span style="display:inline-flex">${icon(c.icon)}</span>${esc(c.name)}<span class="dd-count">${toolsByCategory(c.id).length}</span></a>`).join('')}</div></details>`;
  const popular6 = tools.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 6);
  // Mobile menu links are text-only: 22 fewer icon references per page.
  const mobileList = (items, hrefFn) => `<ul>${items.map((x) => `<li><a href="${hrefFn(x)}">${esc(x.name)}</a></li>`).join('')}</ul>`;
  return `<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="${ROOT_PREFIX}">${brandMark('brand-mark')}iHaveTools</a>
    <nav class="main-nav" aria-label="Primary">${drop}<a href="${ROOT_PREFIX}#all-tools">All tools</a><a href="${ROOT_PREFIX}about/">About</a></nav>
    <div class="header-actions">${searchHtml}<button class="icon-btn theme-toggle" type="button" aria-label="Switch to dark theme">${icon('moon')}</button><button class="nav-toggle" type="button" aria-expanded="false" aria-label="Open menu">${icon('menu')}</button></div>
  </div>
  <nav class="mobile-nav" aria-label="Mobile menu"><h3>Quick links</h3>${mobileList(popular6, (t) => `${ROOT_PREFIX}tools/${t.id}/`)}<h3>Categories</h3>${mobileList(categories, (c) => `${ROOT_PREFIX}categories/${c.id}/`)}</nav>
</header>`;
}

function layout({ bodyClass, title, description, canonical, jsonLd = [], content, moduleEntry = null, modulePreloads = [], ogType = 'website', ogImage = '/assets/icons/og-image.png', noindex = false }) {
  const ld = jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  const preloads = [...new Set([`${ROOT_PREFIX}assets/js/site.js`, `${ROOT_PREFIX}assets/js/icons.js`, ...modulePreloads])]
    .map((href) => `<link rel="modulepreload" href="${href}">`).join('\n');
  const page = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="google-site-verification" content="MsDOM6JlqwnItZo1uJAFNYWAEkaDQPOJvzyfIIE9Vbg">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="${site.themeColor}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${site.themeColorDark}" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${ROOT_PREFIX}assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${ROOT_PREFIX}assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${ROOT_PREFIX}assets/icons/icon-192.png">
<link rel="manifest" href="${ROOT_PREFIX}manifest.webmanifest">
<meta property="og:site_name" content="${site.name}">
<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${pageUrl(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${site.name} — free online tools">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${pageUrl(ogImage)}">
${THEME_INIT}
<link rel="stylesheet" href="${ROOT_PREFIX}assets/css/styles.css">
${preloads}
${ld}
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#main">Skip to content</a>
${headerHtml(bodyClass === 'page-home', bodyClass !== 'page-home' && bodyClass !== 'page-404')}
<main id="main">
${content}
</main>
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="${ROOT_PREFIX}">${brandMark('brand-mark')}iHaveTools</a>
        <p>${esc(site.tagline)} ${tools.length} tools. No sign-up. Your data stays in your browser.</p>
      </div>
      <div><h3>Popular tools</h3><ul>${tools.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 6).map((t) => `<li><a href="${ROOT_PREFIX}tools/${t.id}/">${esc(t.name)}</a></li>`).join('')}</ul></div>
      <div><h3>Top categories</h3><ul>${categories.slice(0, 6).map((c) => `<li><a href="${ROOT_PREFIX}categories/${c.id}/">${esc(c.name)}</a></li>`).join('')}</ul></div>
      <div><h3>More categories</h3><ul>${categories.slice(6).map((c) => `<li><a href="${ROOT_PREFIX}categories/${c.id}/">${esc(c.name)}</a></li>`).join('')}</ul></div>
    </div>
    <div class="footer-bottom">
      <span>© <span id="footer-year">2026</span> iHaveTools. All tools are free and run client-side.</span>
      <span><a href="${ROOT_PREFIX}about/">About</a> · <a href="${ROOT_PREFIX}privacy-policy/">Privacy Policy</a> · <a href="${ROOT_PREFIX}terms/">Terms</a></span>
      <span>Built for speed, privacy and everyday usefulness. <button class="install-app" type="button" hidden>Install app</button></span>
    </div>
  </div>
</footer>
<script type="module" src="${ROOT_PREFIX}assets/js/site.js"></script>
${moduleEntry ? `<script type="module">import { mount } from '${moduleEntry.module}'; mount('${moduleEntry.id}');</script>` : ''}
<script type="speculationrules">{"prefetch":[{"source":"document","where":{"href_matches":"/*"},"eagerness":"moderate"}]}</script>
</body>
</html>
`;
  return page;
}

/* ---------- components ---------- */
function toolCard(t) {
  const cat = categoryById.get(t.categories[0]);
  return `<div class="tool-card-shell"><a class="tool-card" href="${ROOT_PREFIX}tools/${t.id}/">
  <span class="tool-icon">${icon(t.icon)}</span>
  <h3>${esc(t.name)}</h3>
  <p>${esc(t.blurb)}</p>
  <span class="card-meta"><span>${esc(cat?.name || '')}</span><span class="go">Open →</span></span>
</a><button type="button" class="fav-toggle" data-fav-toggle="${t.id}" aria-pressed="false" aria-label="Save ${esc(t.name)} to favourites" title="Save to favourites">${icon('star')}</button></div>`;
}
function categoryCard(c) {
  const count = toolsByCategory(c.id).length;
  return `<a class="category-card" href="${ROOT_PREFIX}categories/${c.id}/">
  <span class="tool-icon">${icon(c.icon)}</span>
  <h3>${esc(c.name)}</h3>
  <p>${esc(c.description)}</p>
  <span class="cat-count">${count} tool${count === 1 ? '' : 's'}</span>
</a>`;
}
const breadcrumb = (items) => `<nav class="breadcrumb container" aria-label="Breadcrumb"><ol>
<li><a href="${ROOT_PREFIX}">Home</a></li>${items.map(([label, href]) => `<li>${href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`}</li>`).join('')}
</ol></nav>`;

/* ---------- homepage ---------- */
function buildHome() {
  const allFeatured = tools.filter((t) => t.featured).sort((a, b) => b.popularity - a.popularity);
  const popular = tools.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 12);
  // Featured should surface *different* tools from Popular, not repeat them.
  const featuredFresh = allFeatured.filter((t) => !popular.slice(0, 8).includes(t));
  const featured = featuredFresh.length >= 4 ? featuredFresh : allFeatured;
  const recent = tools.slice().sort((a, b) => (a.added < b.added ? 1 : -1)).slice(0, 6);
  const atoz = tools.slice().sort((a, b) => a.name.localeCompare(b.name));

  const content = `
<section class="hero">
  <div class="container">
    <h1>Free Online Tools for Everyday Work</h1>
    <p class="lede">Find the right tool for your next task. ${tools.length} free tools, ready in your browser.</p>
    <div class="search-box" role="search">
      <span class="search-glyph">${icon('search')}</span>
      <label class="sr-only" for="global-search">Search tools</label>
      <input id="global-search" type="search" placeholder="Search tools, e.g. PDF or JSON…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="search-results">
      <kbd aria-hidden="true">/</kbd>
      <ul class="search-results" id="search-results" role="listbox" aria-label="Matching tools" hidden></ul>
      <span class="sr-only search-status" role="status" aria-live="polite"></span>
    </div>
    <nav class="quick-links" aria-label="Quick access to tools">
      <span>Try a tool</span><a href="/tools/pdf-merge/">Merge PDF</a><a href="/tools/image-compressor/">Compress image</a><a href="/tools/json-formatter/">Format JSON</a><a href="/tools/emi-calculator/">Calculate EMI</a>
    </nav>
    <div class="hero-badges"><span class="badge">${icon('check')} ${tools.length} free tools</span><span class="badge">${icon('shield-check')} Runs in your browser</span><span class="badge">${icon('zap')} No sign-up</span></div>
  </div>
</section>

<section class="section" id="recent-section" hidden>
  <div class="container">
    <div class="section-head">
      <div><h2>Recently used</h2><p class="section-sub">Pick up where you left off — remembered only in this browser.</p></div>
    </div>
    <div class="card-grid" id="recent-grid"></div>
  </div>
</section>

<section class="section tint" id="favourites-section" hidden>
  <div class="container">
    <div class="section-head">
      <div><h2>Your favourites</h2><p class="section-sub">Star any tool to pin it here. Saved on this device only — no account needed.</p></div>
    </div>
    <div class="card-grid" id="favourites-grid"></div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head">
      <div><h2>Explore tools</h2><p class="section-sub">A selection of useful tools to get you started.</p></div>
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
      ${atoz.map((t) => `<li><a href="${ROOT_PREFIX}tools/${t.id}/">${icon(t.icon)}<span>${esc(t.name)}</span><span class="cat-tag">${esc(categoryById.get(t.categories[0])?.name || '')}</span></a></li>`).join('')}
    </ul>
  </div>
</section>

<section class="section tint" id="about">
  <div class="container">
    <div class="privacy-strip">
      <div class="strip-item">${icon('shield-check')}<div><h3>Private by design</h3><p>Most tools process inputs on your device. Share links can expose values; YouTube thumbnails and code run in the HTML preview can contact external services. See our Privacy Policy.</p></div></div>
      <div class="strip-item">${icon('zap')}<div><h3>Fast and dependency-free</h3><p>No frameworks, no trackers on tool pages, no waiting. Pages are static and open instantly, even on slow connections.</p></div></div>
      <div class="strip-item">${icon('check-circle')}<div><h3>Honest tools only</h3><p>Every tool listed here genuinely works — no half-finished stubs, no fake buttons, no empty categories.</p></div></div>
    </div>
  </div>
</section>`;

  write('index.html', layout({
    bodyClass: 'page-home',
    title: `${site.name} — Free Online Tools for Everyday Work`,
    description: `${tools.length} free online tools: calculators, converters, text and image utilities, developer helpers and more. Fast, private, no sign-up — tools run in your browser.`,
    canonical: pageUrl('/'),
    jsonLd: [{
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization', '@id': `${pageUrl('/')}#org`,
          name: site.name, url: pageUrl('/'), description: site.description,
          logo: pageUrl('/assets/icons/icon-512.png'),
        },
        {
          '@type': 'WebSite', '@id': `${pageUrl('/')}#site`,
          name: site.name, url: pageUrl('/'), description: site.description, inLanguage: 'en',
          publisher: { '@id': `${pageUrl('/')}#org` },
          potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${pageUrl('/')}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
        },
      ],
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
    <div class="section-head"><div><h2>Other categories</h2></div><a class="section-link" href="${ROOT_PREFIX}#all-tools">All tools A–Z →</a></div>
    <div class="card-grid cols-3">${others.map(categoryCard).join('')}</div>
  </div>
</section>`;
  write(`categories/${c.id}/index.html`, layout({
    bodyClass: 'page-category',
    title: `${c.name} Tools — Free Online, No Sign-Up | ${site.name}`,
    description: metaDesc(`Free ${c.name.toLowerCase()} tools online (${list.length}) — ${c.description} No sign-up; tools run in your browser.`),
    canonical: pageUrl(`/categories/${c.id}/`),
    ogImage: `/assets/og/category-${c.id}.png`,
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${c.name} Tools`, description: c.description, url: pageUrl(`/categories/${c.id}/`), inLanguage: 'en', isPartOf: { '@id': `${pageUrl('/')}#site` } },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: `${c.name} tools`, itemListElement: list.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: pageUrl(`/tools/${t.id}/`) })) },
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
  const related = relatedTools(t, 6);
  const aliasList = (t.aliases || []).filter((a) => a.toLowerCase() !== t.name.toLowerCase()).slice(0, 3);
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
    <div class="page-head-actions">
      <button type="button" class="btn btn-secondary btn-sm" data-fav-toggle="${t.id}" aria-pressed="false" title="Save to favourites"><span style="display:inline-flex">${icon('star')}</span> <span data-fav-label>Add to favourites</span></button>
      <button type="button" class="btn btn-secondary btn-sm" data-copy-link title="Copy a clean link to this page without inputs"><span style="display:inline-flex">${icon('link')}</span> <span data-copy-label>Copy page link</span></button>
    </div>
  </header>
</div>
<div class="container tool-wrap">
  <div class="tool-panel">
    <div id="tool-app" data-tool-id="${t.id}"></div>
  </div>
</div>
<section class="section tool-docs" style="padding-top:8px">
  <div class="container" style="max-width:860px">
    <section><h2>How to use ${esc(t.name)}</h2><ol class="howto">${t.steps.split('|').map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>
    ${guideHtml(t)}
    <section><h2>Why use the iHaveTools ${esc(t.name)}?</h2>
      <ul>
        <li><strong>Private by design</strong> — ${esc(privacy)}</li>
        <li><strong>Free to use</strong> — no sign-up or automatic branding. Individual tools have file and device limits.</li>
        <li><strong>Works everywhere</strong> — any modern browser on a phone, tablet or computer, ready the moment the page opens.</li>
      </ul>
      ${aliasList.length ? `<p>People also search for this tool as ${aliasList.map((a) => `“${esc(a)}”`).join(', ')} — it is the same free online tool. ${esc(t.name)} is part of our <a href="/categories/${cat.id}/">${esc(cat.name)} tools</a> collection.</p>` : `<p>${esc(t.name)} is part of our <a href="/categories/${cat.id}/">${esc(cat.name)} tools</a> collection — ${tools.length} free browser-based tools in total.</p>`}
    </section>
    <section><h2>Frequently asked questions</h2><div class="faq-list">${faqs.map((f) => `<details><summary>${esc(f.q)}</summary><p class="faq-a">${esc(f.a)}</p></details>`).join('')}</div></section>
    ${related.length ? `<section><h2>Related tools</h2><div class="card-grid cols-3">${related.map(toolCard).join('')}</div><p style="margin-top:16px"><a class="section-link" href="/categories/${cat.id}/">Browse all ${toolsByCategory(cat.id).length} ${esc(cat.name)} tools →</a></p></section>` : ''}
  </div>
</section>`;
  write(`tools/${t.id}/index.html`, layout({
    bodyClass: 'page-tool',
    title: `${t.name} — Free & Online | ${site.name}`,
    description: metaDesc(`${t.name} online — ${t.description} Free, no sign-up; runs in your browser.`),
    canonical: pageUrl(`/tools/${t.id}/`),
    // Top tools carry their own OG image (scripts/og.mjs); the rest share their category's.
    ogImage: existsSync(join(ROOT, 'assets/og', `tool-${t.id}.png`)) ? `/assets/og/tool-${t.id}.png` : `/assets/og/category-${cat.id}.png`,
    ogType: 'website',
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'WebApplication',
        name: t.name, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (web browser)',
        browserRequirements: 'Requires JavaScript', inLanguage: 'en', isAccessibleForFree: true,
        url: pageUrl(`/tools/${t.id}/`), description: t.description,
        datePublished: t.added, ...(t.modified ? { dateModified: t.modified } : {}),
        publisher: { '@type': 'Organization', name: site.name, url: pageUrl('/') },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@context': 'https://schema.org', '@type': 'HowTo',
        name: `How to use ${t.name}`, description: t.blurb,
        step: t.steps.split('|').map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
      },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: pageUrl('/') },
        { '@type': 'ListItem', position: 2, name: cat.name, item: pageUrl(`/categories/${cat.id}/`) },
        { '@type': 'ListItem', position: 3, name: t.name, item: pageUrl(`/tools/${t.id}/`) },
      ] },
    ],
    content,
    moduleEntry: { module: `${ROOT_PREFIX}assets/js/tools/${groupName}.js`, id: t.id },
    modulePreloads: [`${ROOT_PREFIX}assets/js/ui.js`, `${ROOT_PREFIX}assets/js/tools/${groupName}.js`],
  }));
}

/* ---------- static trust pages (about / privacy / terms) ---------- */
function buildStaticPages() {
  const wrap = (title, lede, body) => `
${breadcrumb([[title]])}
<div class="container">
  <header class="page-head">
    <h1>${esc(title)}</h1>
    <p class="lede">${esc(lede)}</p>
  </header>
</div>
<section class="section" style="padding-top:8px">
  <div class="container" style="max-width:860px">
${body}
  </div>
</section>`;
  const pages = [
    {
      id: 'about', title: 'About iHaveTools', desc: metaDesc(`About iHaveTools — ${tools.length} free online tools that run entirely in your browser. No sign-up, no uploads, no limits. How it works and why it is private.`),
      lede: `${tools.length} free tools. No sign-up, no uploads, no limits — tools run in your browser.`,
      body: `
    <section><h2>What is iHaveTools?</h2>
    <p>iHaveTools is a collection of ${tools.length} free online tools for everyday work: calculators, converters, text and image utilities, PDF tools and developer helpers. Every tool works instantly in your web browser — there is no account to create, nothing to install and nothing to pay.</p></section>
    <section><h2>How it works — and why your data stays private</h2>
    <p>Unlike most tool sites, iHaveTools has no server that processes your work. When you compress an image, merge a PDF or format JSON here, the computation happens on your own device using built-in browser technology (Canvas, Web Audio, Web Crypto and pdf-lib). Selected files and text are processed locally by these tools. Some optional links contain entered calculator values, the YouTube thumbnail tool contacts YouTube’s CDN, and code in the HTML preview can contact external services. Previously visited tools can work offline when their required files have been cached; some features require browser or device support.</p></section>
    <section><h2>Our principles</h2>
    <ul>
      <li><strong>Private by design</strong> — processing is primarily local; sharing and external services have exceptions. See the <a href="/privacy-policy/">Privacy Policy</a>.</li>
      <li><strong>Free and unlimited</strong> — no sign-up walls, watermarks or daily limits.</li>
      <li><strong>Fast</strong> — static pages, no frameworks, no trackers in your way.</li>
      <li><strong>Honest</strong> — every tool listed on this site genuinely works; there are no empty placeholder pages.</li>
    </ul></section>
    <section><h2>Browse the tools</h2>
    <ul>${categories.map((c) => `<li><a href="/categories/${c.id}/">${esc(c.name)} tools</a> (${toolsByCategory(c.id).length}) — ${esc(c.description)}</li>`).join('')}</ul></section>
    <section><h2>Contact &amp; feedback</h2>
    <p>Found a bug, or want a tool we do not have yet? The project is open source — open an issue on <a href="https://github.com/Anony-place/ihavetools/issues" rel="noopener">GitHub</a>. The full source code is available in the same repository, so anyone can inspect how the tools work.</p></section>`,
    },
    {
      id: 'privacy-policy', title: 'Privacy Policy', desc: metaDesc('iHaveTools Privacy Policy — local processing, optional share links, YouTube thumbnails, browser storage and hosting logs.'),
      lede: 'Most processing is local. Optional shared links, YouTube thumbnails, browser storage and hosting requests have privacy implications explained below.',
      body: `
    <section><h2>What data the tools process</h2>
    <p>Tools run in your browser. Files you select for PDF, image, audio and video processing and text entered into text tools are processed locally rather than uploaded for processing. Browser extensions, operating-system software, screen captures, downloads and services you choose to use separately are outside our control.</p>
    <p>The YouTube thumbnail downloader requests images from YouTube’s CDN (i.ytimg.com). That service receives the requested video ID and normal request information such as your IP address, under its own policies. Opening external links or QR-code actions also contacts their destinations. Code run in the HTML preview can load external resources or send data to other services; only run trusted code and avoid secrets.</p></section>
    <section><h2>Optional calculator links</h2>
    <p>Calculator inputs are not automatically added to the address bar. If you choose “Copy link with inputs”, the resulting link contains your values in its URL fragment. Fragments are not sent in normal HTTP requests, but anyone with the link can read them; they may also remain in browser history, bookmarks, clipboard or sharing apps. Avoid sharing sensitive information. “Copy page link” excludes inputs.</p>
    <p>Older links may contain values in the query string. Opening one sends those values to the host and intermediaries as part of the request and may record them in logs or history. The tool removes known input parameters from the address bar after loading, but cannot erase earlier records or prevent the initial request.</p></section>
    <section><h2>Accounts and personal data</h2>
    <p>There are no user accounts, no sign-up forms and no newsletters. We do not collect names, email addresses or payment details.</p></section>
    <section><h2>Cookies, local storage and caching</h2>
    <p>The site itself sets no cookies. The browser may store the following <em>on your own device</em>:</p>
    <ul>
      <li><strong>Theme preference</strong> — if you switch between light and dark mode, your choice is saved in <code>localStorage</code> so the site remembers it. It never leaves your device.</li>
      <li><strong>Favourites and recently used</strong> — tool IDs are saved in <code>localStorage</code> to display your lists on this device.</li>
      <li><strong>Offline cache</strong> — a service worker caches the site's pages and static files for offline access. Only previously visited pages and resources are available offline; query-string URLs are not saved. It never stores files or text you process with a tool.</li>
    </ul>
    <p>You can clear site data at any time from your browser's site-data settings.</p></section>
    <section><h2>Analytics and advertising</h2>
    <p>iHaveTools currently runs <strong>no analytics and no advertising trackers</strong>. If privacy-respecting, aggregate analytics or ads are ever added to keep the site free, this policy will be updated first and the change will be visible here with a new date.</p></section>
    <section><h2>Hosting logs</h2>
    <p>The static hosting provider, Vercel, and network intermediaries may log request information such as IP address, URL path, query string, browser and request time under their own policies. We do not control all provider logging or retention. Do not put sensitive information in a query string.</p></section>
    <section><h2>External links</h2>
    <p>Pages may link to external sites (for example, our public code repository). Their privacy practices are their own; this policy covers only iHaveTools.</p></section>
    <section><h2>Changes and questions</h2>
    <p>If this policy changes, the new version will be published on this page with an updated date. Questions are welcome via <a href="https://github.com/Anony-place/ihavetools/issues" rel="noopener">GitHub issues</a>. See also our <a href="/terms/">Terms of Use</a>.</p></section>`,
    },
    {
      id: 'terms', title: 'Terms of Use', desc: metaDesc('iHaveTools Terms of Use — the tools are free to use for personal and commercial work, provided as-is. Results from calculators are informational, not professional advice.'),
      lede: 'The tools are free to use, for personal and commercial work. They are provided as-is — please read the short print.',
      body: `
    <section><h2>Using the tools</h2>
    <p>You may use every tool on iHaveTools free of charge, for personal and commercial purposes, without creating an account. Because processing happens in your browser, you keep full rights to — and full responsibility for — everything you create or convert with the tools.</p></section>
    <section><h2>Results are informational</h2>
    <p>Calculators and converters produce results from the values you enter using standard formulas. Results (including health-related figures such as BMI, and money-related figures such as EMIs, interest or tax estimates) are <strong>informational only and are not medical, financial, legal or professional advice</strong>. Always verify important results independently before acting on them.</p></section>
    <section><h2>No warranty</h2>
    <p>The tools are provided “as is”, without warranties of any kind. While every tool is tested, we cannot guarantee that results are error-free or that the site will always be available. To the extent permitted by law, iHaveTools is not liable for losses arising from the use of, or inability to use, the site. Always keep your own backup copies of important files before converting or editing them.</p></section>
    <section><h2>Acceptable use</h2>
    <p>Please do not use the site to break the law or to infringe anyone's rights (for example, processing material you have no right to copy), and do not attempt to disrupt the site or its hosting.</p></section>
    <section><h2>Open source</h2>
    <p>The site's source code is published under the MIT License in our public repository. Third-party components (such as pdf-lib) retain their own licences. The iHaveTools name and branding are not part of the code licence.</p></section>
    <section><h2>Changes</h2>
    <p>These terms may be updated; the current version will always be on this page with its date. Continuing to use the site after a change means you accept the updated terms. See also the <a href="/privacy-policy/">Privacy Policy</a>.</p></section>`,
    },
  ];
  for (const p of pages) {
    write(`${p.id}/index.html`, layout({
      bodyClass: 'page-static',
      title: `${p.title} | ${site.name}`,
      description: p.desc,
      canonical: pageUrl(`/${p.id}/`),
      jsonLd: [
        { '@context': 'https://schema.org', '@type': 'WebPage', name: p.title, description: p.desc, url: pageUrl(`/${p.id}/`), inLanguage: 'en', isPartOf: { '@id': `${pageUrl('/')}#site` } },
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: pageUrl('/') },
          { '@type': 'ListItem', position: 2, name: p.title, item: pageUrl(`/${p.id}/`) },
        ] },
      ],
      content: wrap(p.title, p.lede, p.body),
    }));
  }
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
    <input id="global-search" type="search" placeholder="Search tools…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="search-results">
    <ul class="search-results" id="search-results" role="listbox" aria-label="Matching tools" hidden></ul>
    <span class="sr-only search-status" role="status" aria-live="polite"></span>
  </div>
  <p style="margin-top:22px"><a class="btn btn-primary" href="${ROOT_PREFIX}">Browse all tools</a></p>
</div>`,
  }));
}

/* ---------- sitemap / robots / manifest / search index / llms.txt ---------- */
function buildMeta() {
  // Only emit a lastmod when an actual content modification date is maintained.
  // Creation dates and build time are not reliable modification dates.
  const entries = [
    { u: '/' },
    ...categories.map((c) => ({ u: `/categories/${c.id}/` })),
    ...tools.map((t) => ({ u: `/tools/${t.id}/`, d: t.modified })),
    ...STATIC_PAGES.map((id) => ({ u: `/${id}/` })),
  ];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({ u, d }) => `  <url>\n    <loc>${pageUrl(u)}</loc>${d ? `\n    <lastmod>${d}</lastmod>` : ''}\n  </url>`).join('\n')}\n</urlset>\n`);
  // Slim, lazily-loaded search index — the browser no longer needs the
  // full 71 KB registry (descriptions/steps/FAQs) just to power search.
  const searchIndex = tools.map((t) => ({
    id: t.id, name: t.name, icon: t.icon,
    c: categoryById.get(t.categories[0])?.name || '',
    k: [...(t.keywords || []), ...(t.aliases || [])].join(' '),
    p: t.popularity,
  }));
  write('assets/js/search-index.js', `// GENERATED by scripts/build.mjs from registry.js — do not edit by hand.\nexport const SEARCH_INDEX = ${JSON.stringify(searchIndex)};\n`);
  // External SVG sprite: every icon path once, cached across all pages
  // (long-cache header on /assets/icons/** in firebase.json).
  write('assets/icons/sprite.svg', `<svg xmlns="http://www.w3.org/2000/svg">${Object.entries(iconBodies).map(([n, b]) => `<symbol id="i-${n}" viewBox="0 0 24 24">${b}</symbol>`).join('')}</svg>\n`);
  // llms.txt — a clean map of the site for AI search/answer engines.
  write('llms.txt', `# ${site.name}\n\n> ${site.description} ${tools.length} tools, free, no sign-up. Most processing is local; optional calculator links contain inputs, YouTube thumbnails load from its CDN, and user code in the HTML preview may contact external services. See the Privacy Policy.\n\n## Categories\n${categories.map((c) => `- [${c.name} tools](${pageUrl(`/categories/${c.id}/`)}): ${c.description}`).join('\n')}\n\n## Tools\n${tools.map((t) => `- [${t.name}](${pageUrl(`/tools/${t.id}/`)}): ${t.blurb}`).join('\n')}\n\n## About this site\n- [About](${pageUrl('/about/')})\n- [Privacy Policy](${pageUrl('/privacy-policy/')})\n- [Terms of Use](${pageUrl('/terms/')})\n`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${pageUrl('/sitemap.xml')}\n`);
  write('manifest.webmanifest', JSON.stringify({
    name: site.name,
    short_name: site.name,
    description: site.description,
    start_url: `${ROOT_PREFIX}`,
    scope: `${ROOT_PREFIX}`,
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: site.themeColor,
    icons: [
      { src: `${ROOT_PREFIX}assets/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${ROOT_PREFIX}assets/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${ROOT_PREFIX}assets/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: `${ROOT_PREFIX}assets/icons/favicon.svg`, sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: tools.filter((t) => t.featured).slice(0, 4).map((t) => ({ name: t.name, url: `${ROOT_PREFIX}tools/${t.id}/`, icons: [{ src: `${ROOT_PREFIX}assets/icons/icon-192.png`, sizes: '192x192' }] })),
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
buildStaticPages();
build404();
buildMeta();
console.log(`\nBuild complete: ${tools.length} tools, ${categories.length} categories.`);
