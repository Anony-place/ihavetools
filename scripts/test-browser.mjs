#!/usr/bin/env node
// Optional real-Chromium tests. Run after `npm run build`; set CHROMIUM_PATH to
// an installed Chromium/Chrome executable if Playwright has no bundled browser.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { PDFDocument } from 'pdf-lib';
import { tools } from '../assets/js/registry.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (path !== root && !path.startsWith(root + sep)) throw new Error('invalid path');
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', ...(process.env.CHROMIUM_SINGLE_PROCESS === '1' ? ['--single-process', '--no-zygote'] : [])] });
  console.log(`Chromium ${browser.version()} — ${tools.length} tool routes`);
  const context = await browser.newContext({ viewport: { width: 320, height: 720 }, serviceWorkers: 'block', acceptDownloads: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
  const go = async id => {
    const response = await page.goto(`${base}/tools/${id}/`, { waitUntil: 'load' });
    assert.equal(response.status(), 200, id);
    await page.waitForSelector('#tool-app > *', { timeout: 10000 });
  };
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const tool of tools) {
      await go(tool.id);
      assert.equal(await page.locator('#tool-app .error-banner').count(), 0, `${tool.id} startup error`);
      const viewport = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(viewport.document <= viewport.viewport + 1, `${tool.id} overflows at ${width}px: ${viewport.document}px`);
      const rawIcons = await page.locator('#tool-app button').evaluateAll(buttons => buttons.filter(b => b.textContent.includes('<svg')).length);
      assert.equal(rawIcons, 0, `${tool.id} displays SVG markup as text`);
    }
    console.log(`✓ ${tools.length} mounts and document widths at ${width}px`);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await go('json-formatter');
  await page.locator('#tool-app textarea').fill('{"big":9007199254740993}');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  assert.match(await page.locator('.result-body').innerText(), /9007199254740993/);
  assert.equal(await page.locator('.result-head button[aria-label="Copy"] svg').count(), 1);
  const jsonDownload = page.waitForEvent('download');
  await page.locator('.result-head button[aria-label="Download"]').click();
  assert.match((await readFile(await (await jsonDownload).path())).toString(), /9007199254740993/);
  console.log('✓ JSON format and actual download preserve numeric token');

  await go('scientific-calculator');
  await page.locator('#tool-app input[type=text]').fill('sin(90)');
  await page.locator('#tool-app button').filter({hasText: 'Calculate'}).click();
  assert.match(await page.locator('#tool-app').innerText(), /\b1\b/);
  await go('uuid-generator');
  assert.equal(await page.locator('.file-row').count(), 5);
  assert.equal(await page.locator('.file-row button[aria-label="Copy"] svg').count(), 5);
  await page.locator('#tool-app input[type=number]').fill('1.5');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  assert.match(await page.locator('#tool-app .status-line').innerText(), /whole number/);
  assert.equal(await page.locator('.file-row').count(), 0);
  console.log('✓ scientific default angle and UUID validation');

  await go('qr-code-generator');
  const payload = '  Hello QR  ';
  await page.locator('#tool-app textarea').fill(payload);
  await page.getByRole('button', { name: 'Generate QR code' }).click();
  const qrButton = page.getByRole('button', { name: 'Download PNG' });
  await qrButton.waitFor({ state: 'visible', timeout: 10000 });
  const qrDownload = page.waitForEvent('download');
  await qrButton.click();
  const qrBytes = await readFile(await (await qrDownload).path());
  const { data: pixels, info } = await sharp(qrBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(pixels), info.width, info.height);
  assert.equal(decoded?.data, payload);
  console.log('✓ browser-generated QR PNG decodes to exact payload');

  await go('image-converter');
  const png = await sharp({ create: { width: 8, height: 7, channels: 4, background: '#ff0000' } }).png().toBuffer();
  await page.locator('#tool-app input[type=file]').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: png });
  await page.locator('#tool-app .status-line').getByText(/Loaded/).waitFor();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  const imageBtn = page.getByRole('button', { name: 'Download PNG' });
  await imageBtn.waitFor({ state: 'visible' });
  const imageDownload = page.waitForEvent('download'); await imageBtn.click();
  const image = await readFile(await (await imageDownload).path());
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.width, 8); assert.equal(metadata.height, 7); assert.equal(metadata.format, 'png');
  console.log('✓ actual canvas conversion and PNG download');

  // A decoded JPEG without EXIF must not be described as metadata-free.
  await page.setViewportSize({ width: 320, height: 844 });
  await go('image-metadata-viewer');
  const plainJpeg = await sharp({ create: { width: 8, height: 7, channels: 3, background: '#ff0000' } }).jpeg().toBuffer();
  await page.locator('#tool-app input[type=file]').setInputFiles({ name: 'plain.jpg', mimeType: 'image/jpeg', buffer: plainJpeg });
  await page.locator('#tool-app .status-line').getByText(/Analysed/).waitFor();
  assert.match(await page.locator('#tool-app').innerText(), /does not mean metadata or location is absent/);
  assert.match(await page.locator('#tool-app').innerText(), /does not establish/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'metadata result must fit mobile viewport');
  const metadataAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  assert.deepEqual(metadataAxe.violations.map(v => v.id), [], 'metadata result accessibility');
  console.log('✓ decoded JPEG metadata limitations and mobile result accessibility');
  await page.setViewportSize({ width: 1280, height: 800 });

  await go('pdf-merge');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#tool-app input[type=file]').focus();
  await page.keyboard.press('Enter');
  assert.ok(await chooser, 'file chooser should open with keyboard');
  const one = await PDFDocument.create(); one.addPage([100, 200]); const pdfBytes = Buffer.from(await one.save());
  await page.locator('#tool-app input[type=file]').setInputFiles([{ name: 'a.pdf', mimeType: 'application/pdf', buffer: pdfBytes }, { name: 'b.pdf', mimeType: 'application/pdf', buffer: pdfBytes }]);
  await page.locator('#tool-app .status-line').getByText(/2 PDFs ready/).waitFor();
  const pdfDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Merge PDFs' }).click();
  assert.equal((await PDFDocument.load(await readFile(await (await pdfDownload).path()))).getPageCount(), 2);
  console.log('✓ browser PDF merge download reloads with two pages');

  await go('tone-generator');
  await page.locator('#tool-app input[type=number]').nth(1).fill('0.1');
  const wavDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download WAV' }).click();
  const wav = await readFile(await (await wavDownload).path());
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE'); assert.equal(wav.readUInt32LE(24), 44100);
  console.log('✓ generated WAV downloads with expected header');
  // Sample representative pages in both themes. Automated scans are partial
  // evidence only, not a substitute for keyboard and screen-reader reviews.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['light', 'dark']) {
    const routes = process.env.FULL_A11Y === '1' ? ['', ...tools.map(tool => `tools/${tool.id}/`)] : ['', 'tools/json-formatter/', 'tools/uuid-generator/', 'tools/qr-code-generator/', 'tools/pdf-merge/', 'tools/scientific-calculator/', 'tools/spin-wheel/'];
    for (const route of routes) {
      await page.goto(`${base}/${route}`);
      if (route) await page.waitForSelector('#tool-app > *');
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.deepEqual(results.violations.map(v => `${v.id} (${v.nodes.length})`), [], `${theme} ${route || 'home'} accessibility`);
    }
    console.log(`✓ ${routes.length} WCAG axe scans: ${theme} theme`);
  }
  assert.deepEqual(errors, [], `uncaught browser errors: ${errors.join('\n')}`);
  // Isolate SW tests in a fresh process (also supports single-process test shells).
  await browser.close();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', ...(process.env.CHROMIUM_SINGLE_PROCESS === '1' ? ['--single-process', '--no-zygote'] : [])] });
  // Register manually: the site deliberately skips registration on localhost.
  const offlineContext = await browser.newContext({ serviceWorkers: 'allow' });
  const offlinePage = await offlineContext.newPage();
  await offlinePage.goto(`${base}/`);
  await offlinePage.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker activation timed out')), 10000))]); });
  await offlinePage.reload();
  await offlinePage.goto(`${base}/tools/word-counter/`);
  await offlinePage.waitForSelector('#tool-app > *');
  await offlinePage.goto(`${base}/tools/word-counter/?private=example`);
  const cacheKeys = await offlinePage.evaluate(async () => (await Promise.all((await caches.keys()).map(async k => (await (await caches.open(k)).keys()).map(r => r.url)))).flat());
  assert.ok(!cacheKeys.some(k => k.includes('private=example')), 'query must not be cached');
  await offlineContext.setOffline(true);
  await offlinePage.goto(`${base}/tools/word-counter/`);
  await offlinePage.waitForSelector('#tool-app > *');
  await offlinePage.goto(`${base}/tools/hex-rgb-converter/`);
  assert.match(await offlinePage.locator('body').innerText(), /offline/i);
  console.log('✓ real service worker: visited page offline, unvisited fallback, query excluded');
  console.log('Real browser checks passed. Physical devices, browser diversity and assistive technology are not covered.');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
