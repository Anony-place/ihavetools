#!/usr/bin/env node
// Generates Open Graph images (1200×630 PNG) into assets/og/:
// one per category, plus one for each of the 20 most popular tools
// (build.mjs uses a tool image when it exists, else its category image).
// Run after changing categories/popularity: `node scripts/og.mjs` (needs sharp).
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { categories, tools, toolsByCategory, categoryById } from '../assets/js/registry.js';

const TOP_TOOL_OG_COUNT = 20; // link-check.mjs mirrors this rule in a test
const topToolsForOg = [...tools]
  .sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id))
  .slice(0, TOP_TOOL_OG_COUNT);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

mkdirSync(join(ROOT, 'assets/og'), { recursive: true });

for (const c of categories) {
  const count = toolsByCategory(c.id).length;
  const name = `${c.name} Tools`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e1b4b"/>
      <stop offset="0.55" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="70" r="230" fill="#ffffff" opacity="0.08"/>
  <circle cx="1130" cy="560" r="170" fill="#ffffff" opacity="0.06"/>
  <circle cx="90" cy="600" r="120" fill="#000000" opacity="0.12"/>
  <g font-family="Arial, Helvetica, sans-serif">
    <text x="80" y="250" font-size="34" font-weight="bold" fill="#c7d2fe" letter-spacing="4">FREE ONLINE TOOLS</text>
    <text x="76" y="345" font-size="84" font-weight="bold" fill="#ffffff">${esc(name)}</text>
    <text x="80" y="415" font-size="36" fill="#e0e7ff">${count} free tools · No sign-up · Runs in your browser</text>
    <g transform="translate(80,478)">
      <rect width="56" height="56" rx="14" fill="#ffffff"/>
      <rect x="14" y="22" width="10" height="22" fill="#4f46e5"/>
      <circle cx="19" cy="13" r="5.5" fill="#4f46e5"/>
      <path d="M31 27l6 6 11-12" fill="none" stroke="#4f46e5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="72" y="40" font-size="38" font-weight="bold" fill="#ffffff">iHaveTools</text>
    </g>
  </g>
</svg>`;
  const out = join(ROOT, `assets/og/category-${c.id}.png`);
  await sharp(Buffer.from(svg)).png({ palette: true, quality: 92, compressionLevel: 9 }).toFile(out);
  console.log(`✓ assets/og/category-${c.id}.png`);
}

const trimText = (s, max) => {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
};

for (const t of topToolsForOg) {
  const cat = categoryById.get(t.categories[0])?.name || '';
  const titleSize = t.name.length > 26 ? 56 : t.name.length > 18 ? 68 : 84;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e1b4b"/>
      <stop offset="0.55" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="70" r="230" fill="#ffffff" opacity="0.08"/>
  <circle cx="1130" cy="560" r="170" fill="#ffffff" opacity="0.06"/>
  <circle cx="90" cy="600" r="120" fill="#000000" opacity="0.12"/>
  <g font-family="Arial, Helvetica, sans-serif">
    <text x="80" y="215" font-size="32" font-weight="bold" fill="#c7d2fe" letter-spacing="4">FREE ONLINE TOOL${cat ? ` · ${esc(cat.toUpperCase())}` : ''}</text>
    <text x="76" y="312" font-size="${titleSize}" font-weight="bold" fill="#ffffff">${esc(t.name)}</text>
    <text x="80" y="385" font-size="34" fill="#e0e7ff">${esc(trimText(t.blurb, 58))}</text>
    <text x="80" y="440" font-size="30" fill="#c7d2fe">Free · No sign-up · Runs in your browser</text>
    <g transform="translate(80,478)">
      <rect width="56" height="56" rx="14" fill="#ffffff"/>
      <rect x="14" y="22" width="10" height="22" fill="#4f46e5"/>
      <circle cx="19" cy="13" r="5.5" fill="#4f46e5"/>
      <path d="M31 27l6 6 11-12" fill="none" stroke="#4f46e5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="72" y="40" font-size="38" font-weight="bold" fill="#ffffff">iHaveTools</text>
    </g>
  </g>
</svg>`;
  const out = join(ROOT, `assets/og/tool-${t.id}.png`);
  await sharp(Buffer.from(svg)).png({ palette: true, quality: 92, compressionLevel: 9 }).toFile(out);
  console.log(`✓ assets/og/tool-${t.id}.png`);
}
console.log('\nOG images done.');
