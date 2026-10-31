// =============================================================================
// iHaveTools — Web & SEO tools: meta-tag-generator, robots-txt-generator,
// sitemap-generator, open-graph-preview, url-parser, keyword-density-checker
// =============================================================================
import { h, field, input, textarea, select, switchChip, btn, actionsRow, resultPanel, statusLine, statsGrid, table, toast, copyText, downloadText, downloadBlob, privacyNote, mountTool } from '../ui.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ═══════════════════════════ YouTube thumbnails ═══════════════════════════ */
export function extractYouTubeId(raw) {
  const s = String(raw || '').trim();
  if (!s) throw new Error('Paste a YouTube video URL or ID first.');
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); }
  catch { throw new Error('That does not look like a valid URL.'); }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const isId = (v) => /^[a-zA-Z0-9_-]{11}$/.test(v || '');
  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    if (isId(id)) return id;
  } else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (isId(u.searchParams.get('v'))) return u.searchParams.get('v');
    const m = /^\/(?:shorts|embed|live|v)\/([a-zA-Z0-9_-]{11})/.exec(u.pathname);
    if (m) return m[1];
  }
  throw new Error('No video ID found. Use a youtube.com/watch, youtu.be, Shorts or embed link — or paste the 11-character video ID.');
}
export const YT_THUMB_SIZES = [
  { key: 'maxresdefault', label: 'Maximum (1280 × 720)', w: 1280 },
  { key: 'sddefault', label: 'SD (640 × 480)', w: 640 },
  { key: 'hqdefault', label: 'HQ (480 × 360)', w: 480 },
  { key: 'mqdefault', label: 'MQ (320 × 180)', w: 320 },
  { key: 'default', label: 'Default (120 × 90)', w: 120 },
];
export const youtubeThumbUrl = (id, key) => `https://i.ytimg.com/vi/${id}/${key}.jpg`;

/* ═══════════════════════════ URL parsing (shared with url-parser) ═══════════════════════════ */
export function parseUrlParts(raw) {
  const s = String(raw).trim();
  if (!s) throw new Error('Paste a URL first.');
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) || s.includes('://');
  let u;
  if (hasScheme) {
    try { u = new URL(s); }
    catch { throw new Error(`“${s}” is not a valid URL. Check the address, like https://example.com/page?q=1`); }
  } else {
    try { u = new URL(`https://${s}`); }
    catch { throw new Error(`“${s}” is not a valid URL. Include the full address, like https://example.com/page?q=1`); }
  }
  const params = [];
  for (const [k, v] of u.searchParams) params.push([k, v]);
  return {
    href: u.href, protocol: u.protocol.replace(':', ''), scheme: u.protocol.replace(':', ''),
    host: u.hostname, hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? '443 (default)' : u.protocol === 'http:' ? '80 (default)' : ''),
    origin: u.origin, path: u.pathname, pathname: u.pathname, query: u.search, search: u.search,
    params, hash: u.hash, fragment: u.hash.replace('#', ''), username: u.username, password: u.password ? '••••' : '',
    tld: (() => { const parts = u.hostname.split('.'); return parts.length > 1 ? parts[parts.length - 1] : ''; })(),
    domain: (() => { const parts = u.hostname.split('.'); return parts.slice(-2).join('.'); })(),
  };
}

/* ═══════════════════════════ Keyword density ═══════════════════════════ */
const STOPWORDS = new Set('a,an,and,are,as,at,be,been,but,by,can,could,did,do,does,for,from,had,has,have,he,her,his,how,i,if,in,into,is,it,its,just,like,may,might,must,not,of,on,or,our,shall,she,should,since,so,some,than,that,the,their,them,then,there,these,they,this,those,to,too,us,was,we,were,what,when,where,which,while,who,whom,why,will,with,would,you,your,yours'.split(','));
export function keywordDensity(text, { phraseLength = 1, filterStop = true } = {}) {
  const words = (text.toLowerCase().match(/\p{L}[\p{L}'’-]*/gu) || []);
  if (!words.length) return { total: 0, top: [] };
  const build = () => {
    const counts = new Map();
    for (let i = 0; i + phraseLength <= words.length; i++) {
      const gram = words.slice(i, i + phraseLength);
      if (filterStop && gram.some((g) => STOPWORDS.has(g))) continue;
      const key = gram.join(' ');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  };
  const counts = build();
  const total = phraseLength === 1 ? words.length : Math.max(1, words.length - phraseLength + 1);
  const top = [...counts.entries()].filter(([k, c]) => c >= 2 || phraseLength > 1).sort((a, b) => b[1] - a[1]).slice(0, 25)
    .map(([k, c]) => ({ phrase: k, count: c, density: (c / total) * 100 }));
  return { total, top };
}

/* ═══════════════════════════ Robots.txt builder ═══════════════════════════ */
export function buildRobots(rules, { sitemap = '', crawlDelay = null } = {}) {
  const lines = [];
  for (const rule of rules) {
    lines.push(`User-agent: ${rule.agent || '*'}`);
    for (const d of rule.disallow || []) lines.push(`Disallow: ${d}`);
    for (const a of rule.allow || []) lines.push(`Allow: ${a}`);
    if (crawlDelay != null && crawlDelay !== '' && rule.agent !== 'Googlebot') lines.push(`Crawl-delay: ${crawlDelay}`);
    lines.push('');
  }
  if (!rules.length) lines.push('User-agent: *', 'Disallow:', '');
  if (sitemap) lines.push(`Sitemap: ${sitemap}`);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ═══════════════════════════ Sitemap XML builder ═══════════════════════════ */
export function buildSitemapXml(urls, { changefreq = '', priority = '', lastmod = '' } = {}) {
  if (!urls.length) throw new Error('Add at least one URL.');
  const today = new Date().toISOString().slice(0, 10);
  const entries = urls.map((raw) => {
    const u = String(raw).trim();
    if (!u) return null;
    try { new URL(u); } catch { throw new Error(`“${u}” is not a valid absolute URL — sitemap entries must include https://.`); }
    return `  <url>\n    <loc>${esc(u)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}${changefreq ? `\n    <changefreq>${changefreq}</changefreq>` : ''}${priority !== '' ? `\n    <priority>${priority}</priority>` : ''}\n  </url>`;
  }).filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'meta-tag-generator'(root) {
    const title = input({ type: 'text', placeholder: 'Page title (aim for ≤60 characters)', maxlength: '120' });
    const desc = textarea({ rows: 3, mono: false, placeholder: 'Meta description (aim for ≤160 characters)…' });
    const url = input({ type: 'url', placeholder: 'https://example.com/page' });
    const image = input({ type: 'url', placeholder: 'https://example.com/og-image.png (1200×630 recommended)' });
    const siteName = input({ type: 'text', placeholder: 'Site name, e.g. Example Inc.' });
    const twitter = select({ options: [{ v: 'summary_large_image', t: 'Summary with large image' }, { v: 'summary', t: 'Summary (small image)' }] });
    const robots = select({ options: [{ v: 'index, follow', t: 'index, follow (default)' }, { v: 'noindex, follow', t: 'noindex, follow' }, { v: 'index, nofollow', t: 'index, nofollow' }, { v: 'noindex, nofollow', t: 'noindex, nofollow' }] });
    const status = statusLine('');
    const out = resultPanel({ label: 'Meta tags', download: true, downloadName: 'meta-tags.html', downloadMime: 'text/html;charset=utf-8' });
    const build = () => {
      const t = title.value.trim(), d = desc.value.trim(), u = url.value.trim(), img = image.value.trim(), sn = siteName.value.trim();
      const L = [];
      L.push(`<title>${esc(t || 'Page title')}</title>`);
      L.push(`<meta name="description" content="${esc(d)}">`);
      L.push(`<meta name="robots" content="${robots.value}">`);
      if (u) L.push(`<link rel="canonical" href="${esc(u)}">`);
      L.push('');
      L.push(`<!-- Open Graph (Facebook, LinkedIn, WhatsApp…) -->`);
      L.push(`<meta property="og:type" content="website">`);
      L.push(`<meta property="og:title" content="${esc(t)}">`);
      L.push(`<meta property="og:description" content="${esc(d)}">`);
      if (u) L.push(`<meta property="og:url" content="${esc(u)}">`);
      if (sn) L.push(`<meta property="og:site_name" content="${esc(sn)}">`);
      if (img) L.push(`<meta property="og:image" content="${esc(img)}">`);
      L.push('');
      L.push(`<!-- Twitter / X -->`);
      L.push(`<meta name="twitter:card" content="${twitter.value}">`);
      L.push(`<meta name="twitter:title" content="${esc(t)}">`);
      L.push(`<meta name="twitter:description" content="${esc(d)}">`);
      if (img) L.push(`<meta name="twitter:image" content="${esc(img)}">`);
      out.set(L.join('\n'));
      const notes = [];
      if (t.length > 60) notes.push('title exceeds 60 characters — it may be truncated in search results');
      if (d.length > 160) notes.push('description exceeds 160 characters — it may be truncated');
      if (d && d.length < 70) notes.push('description is short — aim for 70–160 characters');
      status.set(notes.length ? `Generated ✓ — but ${notes.join(' and ')}.` : 'Generated ✓ — lengths look good.', notes.length ? 'warning' : 'success');
    };
    [title, desc, url, image, siteName, twitter, robots].forEach((el) => el.addEventListener('input', build));
    root.append(
      field({ label: 'Page title', control: title }),
      field({ label: 'Meta description', control: desc }),
      h('div', { class: 'field-row' }, field({ label: 'Canonical URL', control: url }), field({ label: 'Site name', control: siteName })),
      field({ label: 'Social image URL', control: image }),
      h('div', { class: 'field-row' }, field({ label: 'Twitter card', control: twitter }), field({ label: 'Robots', control: robots })),
      actionsRow(btn({ label: 'Generate tags', icon: 'code', onClick: build })),
      status, h('br'), out.panel);
    build();
  },

  'robots-txt-generator'(root) {
    const rows = h('div', { class: 'file-list' });
    const sitemap = input({ type: 'url', placeholder: 'https://example.com/sitemap.xml' });
    const delay = input({ type: 'number', min: 0, placeholder: 'seconds (optional)' });
    const out = resultPanel({ label: 'robots.txt', download: true, downloadName: 'robots.txt' });
    const status = statusLine('');
    let rules = [{ agent: '*', disallow: [], allow: [] }];
    const render = () => {
      rows.replaceChildren(...rules.map((r, i) => h('div', { class: 'file-row', style: 'flex-wrap:wrap' },
        h('code', { class: 'mono', text: `UA: ${r.agent}` }),
        h('span', { class: 'hint', text: `Disallow: ${r.disallow.length || 'none'} · Allow: ${r.allow.length || 'none'}` }),
        h('span', { class: 'fr-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { rules.splice(i, 1); if (!rules.length) rules = [{ agent: '*', disallow: [], allow: [] }]; render(); build(); } }, 'Remove')))));
    };
    const build = () => {
      try {
        const text = buildRobots(rules, { sitemap: sitemap.value.trim(), crawlDelay: delay.value });
        out.set(text);
        status.set('Generated ✓ — place this file at the root of your domain.', 'success');
      } catch (e) { status.set(e.message, 'error'); }
    };
    const addRule = () => {
      const agent = input({ type: 'text', placeholder: 'User-agent, e.g. * or Googlebot' });
      const dis = input({ type: 'text', placeholder: '/private/  (comma-separate multiple)' });
      const allow = input({ type: 'text', placeholder: '/public/  (optional)' });
      const form = h('div', {},
        h('div', { class: 'field-row' }, field({ label: 'User-agent', control: agent }), field({ label: 'Disallow paths', control: dis }), field({ label: 'Allow paths', control: allow })),
        actionsRow(
          btn({ label: 'Add rule', icon: 'check', onClick: () => {
            const d = dis.value.split(',').map((s) => s.trim()).filter(Boolean);
            const a = allow.value.split(',').map((s) => s.trim()).filter(Boolean);
            rules.push({ agent: agent.value.trim() || '*', disallow: d, allow: a });
            render(); build(); formWrap.replaceChildren();
          } }),
          btn({ label: 'Cancel', variant: 'ghost', onClick: () => formWrap.replaceChildren() })));
      formWrap.replaceChildren(form);
    };
    const formWrap = h('div', {});
    root.append(
      actionsRow(
        btn({ label: 'Add rule', icon: 'robot', onClick: addRule }),
        btn({ label: 'Allow everything', variant: 'secondary', onClick: () => { rules = [{ agent: '*', disallow: [], allow: [] }]; render(); build(); } }),
        btn({ label: 'Block everything', variant: 'secondary', onClick: () => { rules = [{ agent: '*', disallow: ['/'], allow: [] }]; render(); build(); } })),
      rows, formWrap,
      h('div', { class: 'field-row', style: 'margin-top:14px' }, field({ label: 'Sitemap URL', control: sitemap }), field({ label: 'Crawl-delay', control: delay, hint: 'Not supported by Google' })),
      actionsRow(btn({ label: 'Generate', icon: 'settings', onClick: build })),
      status, h('br'), out.panel);
    render(); build();
  },

  'sitemap-generator'(root) {
    const inp = textarea({ rows: 10, placeholder: 'https://example.com/\nhttps://example.com/about\nhttps://example.com/blog/post-1' });
    const lastmod = input({ type: 'date' });
    const freq = select({ options: [{ v: '', t: '— none —' }, ...['always','hourly','daily','weekly','monthly','yearly','never'].map((f) => ({ v: f, t: f }))] });
    const prio = select({ options: [{ v: '', t: '— none —' }, ...['0.0','0.1','0.2','0.3','0.4','0.5','0.6','0.7','0.8','0.9','1.0'].map((p) => ({ v: p, t: p }))] });
    const status = statusLine('');
    const out = resultPanel({ label: 'sitemap.xml', download: true, downloadName: 'sitemap.xml', downloadMime: 'application/xml;charset=utf-8' });
    const run = () => {
      const urls = inp.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      try {
        const xml = buildSitemapXml(urls, { changefreq: freq.value, priority: prio.value, lastmod: lastmod.value });
        out.set(xml);
        status.set(`${urls.length} URL${urls.length === 1 ? '' : 's'} in the sitemap ✓`, 'success');
      } catch (e) { out.placeholder(); status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'URLs (one per line)', control: inp }),
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'lastmod', control: lastmod }),
        field({ label: 'changefreq', control: freq }),
        field({ label: 'priority', control: prio })),
      actionsRow(btn({ label: 'Generate sitemap', icon: 'sitemap', onClick: run }),
        btn({ label: 'Clear', variant: 'ghost', icon: 'x', onClick: () => { inp.value = ''; out.placeholder(); status.set('Cleared.'); } })),
      status, h('br'), out.panel);
  },

  'open-graph-preview'(root) {
    const title = input({ type: 'text', value: 'How We Built a Faster Checkout', placeholder: 'Page title' });
    const desc = input({ type: 'text', value: 'Cutting checkout time from 40 seconds to 12 — here is everything we learned.', placeholder: 'Description' });
    const site = input({ type: 'text', value: 'example.com', placeholder: 'example.com' });
    const url = input({ type: 'url', value: 'https://example.com/blog/faster-checkout', placeholder: 'https://…' });
    const status = statusLine('The preview shows the layout platforms use. Actual rendering varies slightly by platform.');
    const card = h('div', { class: 'preview-frame', style: 'margin-bottom:8px' });
    const out = resultPanel({ label: 'Open Graph tags' });
    const render = () => {
      const t = title.value || 'Your page title';
      const d = desc.value || 'Your page description will appear here.';
      const s = site.value || 'example.com';
      card.replaceChildren(
        h('div', { style: 'padding:14px' },
          h('div', { style: 'height:150px;border-radius:8px;background:linear-gradient(135deg,var(--primary-soft),var(--surface-2));display:grid;place-items:center;color:var(--text-3);font-size:.85rem;margin-bottom:10px', text: 'og:image (1200×630) renders here' }),
          h('div', { style: 'font-size:.78rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em', text: s }),
          h('div', { style: 'font-weight:700;font-size:1.02rem;margin:2px 0', text: t }),
          h('div', { style: 'font-size:.85rem;color:var(--text-2)', text: d })));
      out.set(`<meta property="og:type" content="article">\n<meta property="og:title" content="${esc(title.value)}">\n<meta property="og:description" content="${esc(desc.value)}">\n<meta property="og:site_name" content="${esc(site.value)}">\n<meta property="og:url" content="${esc(url.value)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${esc(title.value)}">\n<meta name="twitter:description" content="${esc(desc.value)}">`);
    };
    [title, desc, site, url].forEach((el) => el.addEventListener('input', render));
    root.append(
      field({ label: 'Title', control: title }),
      field({ label: 'Description', control: desc }),
      h('div', { class: 'field-row' }, field({ label: 'Site name', control: site }), field({ label: 'URL', control: url })),
      actionsRow(btn({ label: 'Copy tags', variant: 'secondary', icon: 'copy', onClick: async () => { (await copyText(out.text)) ? toast('OG tags copied', 'success') : toast('Copy failed', 'error'); } })),
      h('h3', { text: 'Share card preview', style: 'margin:8px 0 10px' }), card, status, h('br'), out.panel);
    render();
  },

  'url-parser'(root) {
    const inp = input({ type: 'text', class: 'input mono', value: 'https://user@example.com:8080/products/list?category=shoes&sort=price%20asc&page=2#results', placeholder: 'https://example.com/path?query=1#hash' });
    const status = statusLine('');
    const out = h('div', { class: 'tool-docs' });
    const run = () => {
      out.replaceChildren();
      try {
        const p = parseUrlParts(inp.value);
        const kv = (pairs) => h('dl', { class: 'kv-grid' }, pairs.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { class: 'mono', text: String(v) || '—' })]));
        out.append(
          h('section', { class: 'result-panel' }, h('div', { class: 'result-head' }, h('span', { class: 'result-label', text: 'Components' })), h('div', { class: 'result-body' },
            kv([['Protocol', p.protocol], ['Host', p.host], ['Port', p.port], ['Path', p.path], ['Query', p.query || '—'], ['Fragment', p.fragment ? `#${p.fragment}` : '—'], ['Origin', p.origin], ['Domain', p.domain], ['TLD', p.tld], ['Username', p.username || '—']]))),
          h('section', {},
            h('h3', { text: `Query parameters (${p.params.length})`, style: 'margin:20px 0 10px' }),
            p.params.length
              ? table({ headers: ['#', 'Name', 'Value (decoded)'], rows: p.params.map(([k, v], i) => [String(i + 1), k, v]) })
              : h('p', { class: 'hint', text: 'This URL has no query parameters.' })));
        status.set('Parsed ✓', 'success');
      } catch (e) { status.set(e.message, 'error'); }
    };
    root.append(field({ label: 'URL to parse', control: inp }),
      actionsRow(btn({ label: 'Parse URL', icon: 'link', onClick: run })), status, h('br'), out);
    run();
  },

  'keyword-density-checker'(root) {
    const inp = textarea({ rows: 10, mono: false, placeholder: 'Paste your content here…' });
    const len = select({ options: [{ v: '1', t: 'Single words' }, { v: '2', t: '2-word phrases' }, { v: '3', t: '3-word phrases' }], value: '1' });
    const stop = switchChip({ label: 'Filter stop words', checked: true });
    const grid = statsGrid();
    const status = statusLine('');
    const out = h('div', {});
    const run = () => {
      const text = inp.value;
      if (!text.trim()) { status.set('Paste some content first.', 'warning'); return; }
      const r = keywordDensity(text, { phraseLength: Number(len.value), filterStop: stop.querySelector('input').checked });
      grid.set([
        { label: 'Total words', value: r.total.toLocaleString(), kind: 'good' },
        { label: 'Distinct terms', value: r.top.length ? '≥' + r.top.length : '0' },
        { label: 'Top density', value: r.top.length ? `${r.top[0].density.toFixed(1)}%` : '—' },
      ]);
      out.replaceChildren(
        h('h3', { text: 'Most frequent', style: 'margin:18px 0 10px' }),
        r.top.length
          ? table({ headers: ['Term', 'Count', 'Density'], rows: r.top.map((t) => [t.phrase, String(t.count), `${t.density.toFixed(2)}%`]) })
          : h('p', { class: 'hint', text: 'No repeated terms found (terms appearing once are hidden). Try pasting more text.' }));
      status.set(`Analysed ${r.total.toLocaleString()} words ✓`, 'success');
    };
    root.append(field({ label: 'Content', control: inp }),
      h('div', { class: 'field-row', style: 'align-items:end' }, field({ label: 'Phrase length', control: len }), field({ label: 'Options', control: stop })),
      actionsRow(btn({ label: 'Analyse', icon: 'chart', onClick: run })), grid, out, status);
  },

  'youtube-thumbnail-downloader'(root) {
    const inp = input({ type: 'text', class: 'input mono', placeholder: 'https://www.youtube.com/watch?v=… or a video ID' });
    const status = statusLine('Paste any YouTube link — watch, youtu.be, Shorts or embed.');
    const out = h('div', {});
    const download = async (url, filename) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        downloadBlob(blob, filename);
        toast('Download started', 'success');
      } catch { window.open(url, '_blank', 'noopener'); }
    };
    const run = () => {
      out.replaceChildren();
      let id;
      try { id = extractYouTubeId(inp.value); }
      catch (e) { status.set(e.message, 'error'); return; }
      let shown = 0;
      for (const s of YT_THUMB_SIZES) {
        const url = youtubeThumbUrl(id, s.key);
        const card = h('div', { style: 'margin-top:18px' },
          h('h3', { text: s.label, style: 'margin:0 0 8px' }),
          h('img', {
            class: 'img-preview', src: url, alt: `YouTube thumbnail ${s.label}`, loading: 'lazy',
            onload: (e) => {
              // YouTube serves a 120×90 placeholder when a size doesn't exist.
              if (s.w > 120 && e.target.naturalWidth <= 120) { card.remove(); return; }
              shown += 1;
              status.set(`Video ID ${id} — ${shown} thumbnail size${shown === 1 ? '' : 's'} available ✓`, 'success');
            },
            onerror: () => card.remove(),
          }),
          h('div', { style: 'margin-top:8px;display:flex;gap:8px;flex-wrap:wrap' },
            h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => download(url, `youtube-${id}-${s.key}.jpg`) }, 'Download JPG'),
            h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => copyText(url).then(() => toast('Thumbnail URL copied', 'success')) }, 'Copy URL')));
        out.append(card);
      }
      status.set(`Loading thumbnails for video ${id}…`, 'info');
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    root.append(field({ label: 'YouTube video URL or ID', control: inp }),
      actionsRow(btn({ label: 'Get thumbnails', icon: 'film', onClick: run })), status, out,
      privacyNote('Thumbnails load straight from YouTube’s public image CDN (i.ytimg.com) to your browser — nothing is uploaded or stored by iHaveTools. Respect the creator’s copyright when re-using a thumbnail.'));
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { parseUrlParts, keywordDensity, buildRobots, buildSitemapXml, extractYouTubeId, youtubeThumbUrl, YT_THUMB_SIZES };
