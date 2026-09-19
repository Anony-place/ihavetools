#!/usr/bin/env node
// Generates PNG brand assets from SVG sources using sharp (devDependency).
// Output is committed to the repo; re-run only when the brand mark changes.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { tools } from '../assets/js/registry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="8" fill="#4f46e5"/>
  <path d="M11 12.6h4.2V23H11z" fill="#fff"/>
  <circle cx="13.1" cy="8.9" r="2.4" fill="#fff"/>
  <path d="m19 14.5 2.4 2.4 4.4-4.8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#4f46e5"/>
  <g transform="translate(96,80) scale(5)">
    <rect width="32" height="32" rx="8" fill="#ffffff"/>
    <path d="M11 12.6h4.2V23H11z" fill="#4f46e5"/>
    <circle cx="13.1" cy="8.9" r="2.4" fill="#4f46e5"/>
    <path d="m19 14.5 2.4 2.4 4.4-4.8" fill="none" stroke="#4f46e5" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="96" y="352" font-family="DejaVu Sans, Arial, sans-serif" font-size="96" font-weight="bold" fill="#ffffff" letter-spacing="-2">iHaveTools</text>
  <text x="96" y="424" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#c7d2fe">Free, fast, useful online tools — all in your browser.</text>
  <text x="96" y="532" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" fill="#a5b4fc">${tools.length} tools · no sign-up · privacy-first</text>
</svg>`;

writeFileSync('/tmp/og.svg', ogSvg);

const jobs = [
  [MARK, 'assets/icons/favicon-32.png', 32],
  [MARK, 'assets/icons/icon-192.png', 192],
  [MARK, 'assets/icons/icon-512.png', 512],
  ['/tmp/og.svg', 'assets/icons/og-image.png', 1200],
];
for (const [svg, out, w] of jobs) {
  const h = out.includes('og-image') ? 630 : w;
  const input = svg.startsWith('<') ? Buffer.from(svg) : svg;
  await sharp(input).resize(w, h).png().toFile(join(ROOT, out));
  console.log(`✓ ${out}`);
}
