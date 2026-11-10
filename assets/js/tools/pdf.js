// =============================================================================
// iHaveTools — PDF tools: pdf-merge, pdf-split.
// Uses pdf-lib (vendored locally at /assets/vendor/pdf-lib.min.js, lazy-loaded
// only when a PDF action runs). All processing happens in the browser.
// =============================================================================
import { h, field, input, select, switchChip, segControl, btn, actionsRow, statusLine, statsGrid, toast, readFile, downloadBlob, fmtBytes, dropzone, filePill, privacyNote, mountTool } from '../ui.js';

/* ── pdf-lib lazy loader ── */
let libPromise = null;
export function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/assets/vendor/pdf-lib.min.js';
    s.onload = () => { if (window.PDFLib) resolve(window.PDFLib); else { libPromise = null; reject(new Error('The PDF library loaded but did not initialise.')); } };
    s.onerror = () => { libPromise = null; reject(new Error('Could not load the PDF engine. Check your connection and try again.')); };
    document.head.append(s);
  });
  return libPromise;
}

/* ── pure helpers (unit-tested) ── */
export function parseRanges(text, pageCount) {
  const s = String(text).trim();
  if (!s) throw new Error('Enter the pages to extract, for example: 1-3, 7, 11-13');
  const wanted = new Set();
  for (const partRaw of s.split(',')) {
    const part = partRaw.trim();
    if (!part) continue;
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (m) {
      let a = Number(m[1]), b = Number(m[2]);
      if (a > b) [a, b] = [b, a];
      if (a < 1) throw new Error(`Range “${part}” starts before page 1.`);
      if (b > pageCount) throw new Error(`Range “${part}” exceeds the document (${pageCount} pages).`);
      for (let p = a; p <= b; p++) wanted.add(p);
    } else if (/^\d+$/.test(part)) {
      const p = Number(part);
      if (p < 1) throw new Error('Page numbers start at 1.');
      if (p > pageCount) throw new Error(`Page ${p} does not exist — this document has ${pageCount} pages.`);
      wanted.add(p);
    } else throw new Error(`“${part}” is not a page or range. Use forms like 3 or 4-9, separated by commas.`);
  }
  const list = [...wanted].sort((a, b) => a - b);
  if (!list.length) throw new Error('No pages selected.');
  return list;
}
export function describeBytes(n) { return fmtBytes(n); }

/** Fit an image inside a page rect, preserving aspect ratio (PDF points). */
export function fitRect(imgW, imgH, pageW, pageH, margin = 0) {
  if (!(imgW > 0 && imgH > 0)) throw new Error('Image has no dimensions.');
  const availW = pageW - margin * 2, availH = pageH - margin * 2;
  if (availW <= 0 || availH <= 0) throw new Error('Margin is larger than the page.');
  const scale = Math.min(availW / imgW, availH / imgH);
  const w = imgW * scale, h = imgH * scale;
  return { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h };
}

/** Copy selected pages in order and add clockwise rotations; does not alter input. */
export async function organizePdf(PDFLib, source, pages) {
  if (!pages.length) throw new Error('Keep at least one page.');
  const count = source.getPageCount();
  if (pages.some((p) => !Number.isInteger(p.index) || p.index < 0 || p.index >= count || ![0, 90, 180, 270].includes(p.rotation))) throw new Error('Invalid page selection or rotation.');
  const out = await PDFLib.PDFDocument.create();
  const copied = await out.copyPages(source, pages.map((p) => p.index));
  copied.forEach((page, i) => {
    page.setRotation(PDFLib.degrees((page.getRotation().angle + pages[i].rotation) % 360));
    out.addPage(page);
  });
  return out.save();
}

/* ── shared UI bits ── */
function makeZone(multiple, onFiles, label, onReject) {
  const zone = dropzone({ accept: 'application/pdf,.pdf', multiple, title: label || 'Choose a PDF or drop it here', sub: 'Processed locally with pdf-lib — never uploaded', onReject, onFiles: (files) => { onFiles(multiple ? files : files.slice(0, 1)); zone.querySelector('input[type=file]').value = ''; } });
  return zone;
}
function pdfFilesRow(file, onRemove = () => {}) {
  const row = h('div', { class: 'file-row', dataset: { name: file.name } },
    h('span', { class: 'fr-name', text: file.name }),
    h('span', { class: 'fr-size', text: fmtBytes(file.size) }),
    h('span', { class: 'fr-actions' },
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Move up', onclick: (e) => { moveRow(e, -1); onRemove(); } }, '↑'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Move down', onclick: (e) => { moveRow(e, 1); onRemove(); } }, '↓'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Remove', onclick: () => { row.remove(); onRemove(); } }, '✕')));
  row.file = file;
  return row;
}
function moveRow(e, dir) {
  const row = e.target.closest('.file-row');
  const parent = row.parentElement;
  if (dir < 0 && row.previousElementSibling) parent.insertBefore(row, row.previousElementSibling);
  if (dir > 0 && row.nextElementSibling) parent.insertBefore(row.nextElementSibling, row);
}

const defs = {
  'pdf-to-image'(root) {
    // PDF.js 6.5.438, Apache-2.0. Module and worker are local, lazy-loaded.
    let file = null, doc = null, loading = null, rendering = null, revision = 0, job = 0, result = null, imageUrl = null;
    const status = statusLine('Choose a PDF to begin.');
    const info = h('p', { class: 'hint' });
    const preview = h('div', {});
    const page = input({ type: 'number', min: 1, step: 1, value: '1' });
    const ranges = input({ type: 'text', placeholder: 'e.g. 1-3, 7', value: '1' });
    const scale = select({ options: [{v:'1',t:'Standard (72 DPI)'},{v:'1.5',t:'Medium (108 DPI)'},{v:'2',t:'High (144 DPI)'}], value: '1.5' });
    const format = select({ options: [{v:'png',t:'PNG'}, {v:'jpeg',t:'JPEG'}], value:'png' });
    const download = btn({ label: 'Download image', icon: 'download', variant: 'secondary', onClick: () => {
      if (!result || result.kind !== 'image') { status.set('Render a page before downloading.', 'warning'); return; }
      const ok = downloadBlob(result.blob, result.name);
      status.set(ok ? 'Download requested. Check that your browser saved it.' : 'Could not request the download in this browser.', ok ? 'success' : 'error');
    } });
    download.disabled = true;
    const zipDownload = btn({ label: 'Download ZIP', icon: 'download', variant: 'secondary', onClick: () => {
      if (!result || result.kind !== 'zip') return;
      const ok = downloadBlob(result.blob, result.name);
      status.set(ok ? 'ZIP download requested. Check that your browser saved it.' : 'Could not request the download in this browser.', ok ? 'success' : 'error');
    } });
    zipDownload.disabled = true;
    const clearResult = () => { result = null; download.disabled = true; zipDownload.disabled = true; preview.replaceChildren(); if (imageUrl) URL.revokeObjectURL(imageUrl); imageUrl = null; };
    const cancelRender = () => { job++; if (rendering) { try { rendering.cancel(); } catch {} rendering = null; } clearResult(); };
    const destroy = object => { if (object) { try { Promise.resolve(object.destroy()).catch(() => {}); } catch {} } };
    const reset = () => { revision++; cancelRender(); destroy(loading); loading = null; destroy(doc); doc = null; file = null; info.textContent = ''; };
    const zone = dropzone({ accept: '.pdf,application/pdf', title: 'Choose a PDF or drop it here', sub: 'One PDF, up to 20 MiB; processed locally.', onReject: () => { reset(); zone.clear(); status.set('Selection rejected. Choose a PDF no larger than 20 MiB.', 'error'); }, onFiles: async files => {
      const chosen = files[0]; reset(); zone.clear();
      if (!chosen || !/\.pdf$/i.test(chosen.name) || chosen.size > 20 * 1024 * 1024) { status.set('Choose a .pdf file no larger than 20 MiB.', 'error'); return; }
      const token = revision; status.set('Opening PDF locally…', 'info');
      try {
        const lib = await import('/assets/vendor/pdfjs.min.mjs');
        if (token !== revision) return;
        lib.GlobalWorkerOptions.workerSrc = '/assets/vendor/pdfjs.worker.min.mjs';
        const bytes = await readFile(chosen, 'buffer'); if (token !== revision) return;
        const task = lib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true, enableXfa: false });
        loading = task;
        const loaded = await task.promise;
        if (token !== revision) { destroy(loaded); return; }
        loading = null;
        if (loaded.numPages < 1 || loaded.numPages > 1000) { destroy(loaded); throw new Error('PDF must contain between 1 and 1,000 pages.'); }
        doc = loaded; file = chosen; page.value = '1'; ranges.value = '1'; page.max = String(loaded.numPages);
        info.textContent = `${chosen.name} · ${loaded.numPages} pages. Preview one page or select pages for a ZIP.`;
        status.set('PDF opened. Choose a page and render it.', 'success');
      } catch (e) { if (token === revision) { destroy(loading); loading = null; status.set(/password/i.test(`${e.name} ${e.message}`) ? 'Password-protected PDFs are not supported.' : 'Could not open this PDF or load the renderer. Try an unprotected PDF in a current browser.', 'error'); } }
    } });
    const run = async () => {
      if (!doc || !file) { status.set('Choose a PDF first.', 'warning'); return; }
      cancelRender(); const activeDoc = doc, selectedFile = file, token = revision, action = job;
      const n = Number(page.value), factor = Number(scale.value), type = format.value;
      if (!Number.isInteger(n) || n < 1 || n > activeDoc.numPages || ![1,1.5,2].includes(factor) || !['png','jpeg'].includes(type)) { status.set('Choose a valid page and output settings.', 'error'); return; }
      let canvas;
      try {
        status.set(`Rendering page ${n} locally…`, 'info');
        const pdfPage = await activeDoc.getPage(n); if (token !== revision || action !== job) return;
        const view = pdfPage.getViewport({ scale: factor }), width = Math.ceil(view.width), height = Math.ceil(view.height);
        if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16000000) throw new Error('Page is too large at this resolution. Choose a lower resolution.');
        canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable in this browser.');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
        const task = pdfPage.render({ canvasContext: ctx, viewport: view, background: '#ffffff' }); rendering = task;
        await task.promise; if (token !== revision || action !== job) return;
        rendering = null; const mime = type === 'png' ? 'image/png' : 'image/jpeg';
        const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, .92));
        if (token !== revision || action !== job) return;
        if (!blob || blob.type !== mime) throw new Error('The browser could not encode this image format.');
        const stem = selectedFile.name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 70) || 'document';
        result = { kind: 'image', blob, name: `${stem}-page-${n}.${type === 'jpeg' ? 'jpg' : 'png'}` };
        imageUrl = URL.createObjectURL(blob); preview.replaceChildren(h('img', { class: 'img-preview', src: imageUrl, alt: `Rendered preview of PDF page ${n}` })); download.disabled = false;
        status.set(`Rendered page ${n}: ${width} × ${height} pixels, ${fmtBytes(blob.size)}. Download when ready.`, 'success');
      } catch (e) { if (token === revision && action === job) { clearResult(); status.set(e.message || 'Could not render this page.', 'error'); } }
      finally { if (canvas) { canvas.width = 0; canvas.height = 0; } }
    };
    const runZip = async () => {
      if (!doc || !file) { status.set('Choose a PDF first.', 'warning'); return; }
      cancelRender();
      const activeDoc = doc, selectedFile = file, token = revision, action = job;
      const current = () => token === revision && action === job;
      const factor = Number(scale.value), type = format.value;
      let pages;
      try {
        pages = parseRanges(ranges.value, activeDoc.numPages);
        if (pages.length > 20) throw new Error('Select at most 20 pages per ZIP.');
        if (![1, 1.5, 2].includes(factor) || !['png', 'jpeg'].includes(type)) throw new Error('Choose valid output settings.');
        const { zipSync } = await import('../../vendor/fflate.js');
        if (!current()) return;
        const entries = {}, mime = type === 'png' ? 'image/png' : 'image/jpeg';
        const stem = selectedFile.name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 70) || 'document';
        let total = 0;
        for (let i = 0; i < pages.length; i++) {
          const n = pages[i]; status.set(`Rendering page ${n} (${i + 1} of ${pages.length}) locally…`, 'info');
          const pdfPage = await activeDoc.getPage(n); if (!current()) return;
          const view = pdfPage.getViewport({ scale: factor }), width = Math.ceil(view.width), height = Math.ceil(view.height);
          if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16000000) throw new Error(`Page ${n} is too large at this resolution. Choose a lower resolution.`);
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
          try {
            const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable in this browser.');
            const task = pdfPage.render({ canvasContext: ctx, viewport: view, background: '#ffffff' }); rendering = task;
            await task.promise; if (!current()) return;
            rendering = null;
            const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, .92));
            if (!current()) return;
            if (!blob || blob.type !== mime) throw new Error(`Could not encode page ${n}.`);
            total += blob.size;
            if (total > 50 * 1024 * 1024) throw new Error('Encoded images exceed the 50 MiB ZIP limit. Select fewer pages or lower the resolution.');
            const bytes = new Uint8Array(await blob.arrayBuffer()); if (!current()) return;
            entries[`${stem}-page-${String(n).padStart(4, '0')}.${type === 'jpeg' ? 'jpg' : 'png'}`] = bytes;
          } finally { canvas.width = 0; canvas.height = 0; }
        }
        const bytes = zipSync(entries, { level: 0 }); if (!current()) return;
        result = { kind: 'zip', blob: new Blob([bytes], {type:'application/zip'}), name: `${stem}-pages.zip` };
        zipDownload.disabled = false;
        status.set(`Prepared ${pages.length} page${pages.length === 1 ? '' : 's'} in a ZIP (${fmtBytes(result.blob.size)}). Download when ready.`, 'success');
      } catch (e) { if (current()) { rendering = null; clearResult(); status.set(e.message || 'Could not prepare this ZIP.', 'error'); } }
    };
    [page, ranges, scale, format].forEach(el => { el.addEventListener('input', () => { cancelRender(); status.set('Settings changed. Render again.', 'info'); }); el.addEventListener('change', () => { cancelRender(); status.set('Settings changed. Render again.', 'info'); }); });
    window.addEventListener('pagehide', reset);
    root.append(zone, info, h('div', { class: 'field-row' }, field({ label: 'Page number', control: page }), field({ label: 'Resolution', control: scale }), field({ label: 'Image format', control: format })),
      actionsRow(btn({ label: 'Render page', icon: 'image', onClick: run }), download, btn({ label: 'Clear PDF', variant: 'ghost', onClick: () => { reset(); zone.clear(); status.set('PDF cleared.', 'info'); } })), field({ label: 'Pages for ZIP', hint: 'Up to 20 pages and 50 MiB of encoded images; e.g. 1-3, 7. Duplicates are included once.', control: ranges }),
      actionsRow(btn({ label: 'Prepare ZIP', icon: 'image', onClick: runZip }), zipDownload, btn({ label: 'Cancel rendering', variant: 'ghost', onClick: () => { cancelRender(); status.set('Rendering cancelled; any prepared output was cleared.', 'info'); } })), status, preview,
      privacyNote('Files are processed locally. Pages are rasterized on a white background; text is not selectable. Complex fonts, annotations or forms may render differently; review the image. Password-protected PDFs are not supported.'));
  },

  'pdf-organizer'(root) {
    let source = null, file = null, pages = [], revision = 0, operation = 0;
    window.addEventListener('pagehide', () => { revision++; }, { once: true });
    const status = statusLine('Choose a PDF to begin.'), list = h('div', { class: 'file-list', role: 'region', 'aria-label': 'PDF pages' });
    const info = h('p', { class: 'hint' });
    const ranges = input({ type: 'text', placeholder: 'e.g. 1-3, 7' });
    const render = () => {
      list.replaceChildren(...pages.map((p, i) => {
        const row = h('div', { class: 'file-row' },
          h('span', { class: 'fr-name', text: `Original page ${p.index + 1} · output position ${i + 1} · extra rotation ${p.rotation}°` }),
          h('span', { class: 'fr-actions' },
            h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `Move page ${p.index + 1} up`, disabled: i === 0, onclick: () => { revision++; [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]]; render(); status.set(`Page ${p.index + 1} moved to position ${i}.`, 'info'); list.querySelector(`[aria-label="${i === 1 ? 'Move page ' + (p.index + 1) + ' down' : 'Move page ' + (p.index + 1) + ' up'}"]`)?.focus(); } }, '↑'),
            h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `Move page ${p.index + 1} down`, disabled: i === pages.length - 1, onclick: () => { revision++; [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]]; render(); status.set(`Page ${p.index + 1} moved to position ${i + 2}.`, 'info'); list.querySelector(`[aria-label="${i === pages.length - 2 ? 'Move page ' + (p.index + 1) + ' up' : 'Move page ' + (p.index + 1) + ' down'}"]`)?.focus(); } }, '↓'),
            h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `Rotate page ${p.index + 1} clockwise`, onclick: () => { revision++; p.rotation = (p.rotation + 90) % 360; render(); status.set(`Page ${p.index + 1}: extra rotation ${p.rotation} degrees.`, 'info'); list.querySelector(`[aria-label="Rotate page ${p.index + 1} clockwise"]`)?.focus(); } }, '↻'),
            h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': `Remove page ${p.index + 1}`, onclick: () => { revision++; pages.splice(i, 1); render(); status.set(`Removed page ${p.index + 1}.`, 'info'); const next = pages[Math.min(i, pages.length - 1)]; if (next) list.querySelector(`[aria-label="Remove page ${next.index + 1}"]`)?.focus(); } }, '✕')));
        return row;
      }));
      info.textContent = `${pages.length} page${pages.length === 1 ? '' : 's'} selected. Page numbers refer to the original PDF; no visual thumbnails are shown.`;
    };
    const reset = () => { if (!source) return; revision++; pages = Array.from({ length: source.getPageCount() }, (_, index) => ({ index, rotation: 0 })); render(); status.set('Original page order restored.', 'info'); };
    const zone = makeZone(false, async ([chosen]) => {
      const token = ++revision; source = null; file = null; pages = []; list.replaceChildren(); info.textContent = '';
      status.set(`Reading ${chosen.name} locally…`, 'info');
      try {
        const lib = await loadPdfLib(); const bytes = await readFile(chosen, 'buffer'); const doc = await lib.PDFDocument.load(bytes);
        if (token !== revision) return;
        if (doc.getPageCount() > 500) throw new Error('This organizer supports up to 500 pages to keep the page list responsive.');
        source = doc; file = chosen; reset(); status.set(`Loaded ${chosen.name}. Reorder, rotate or remove pages, then export.`, 'success');
      } catch (e) { if (token === revision) status.set(/encrypt/i.test(String(e)) ? 'Password-protected PDFs cannot be processed. Remove protection first.' : `Could not open PDF: ${e.message}`, 'error'); }
    }, undefined, () => { revision++; source = null; file = null; pages = []; list.replaceChildren(); info.textContent = ''; zone.clear(); status.set('Selection rejected. Choose a PDF within the 200 MB limit.', 'error'); });
    const keepRanges = () => {
      if (!source) { status.set('Choose a PDF first.', 'warning'); return; }
      try {
        const wanted = new Set(parseRanges(ranges.value, source.getPageCount()));
        const kept = pages.filter(p => wanted.has(p.index + 1));
        if (!kept.length) throw new Error('None of those original pages remain in the current list. Restore original pages first.');
        revision++; pages = kept; render();
        status.set(`Kept ${pages.length} selected page${pages.length === 1 ? '' : 's'} in their current order.`, 'success');
      } catch (e) { status.set(e.message, 'error'); }
    };
    const keepParity = (parity) => {
      if (!source) { status.set('Choose a PDF first.', 'warning'); return; }
      const kept = pages.filter(p => (p.index + 1) % 2 === parity);
      if (!kept.length) { status.set('No matching original pages remain. Restore original pages first.', 'warning'); return; }
      revision++; pages = kept; render();
      status.set(`Kept ${pages.length} ${parity ? 'odd' : 'even'} original page${pages.length === 1 ? '' : 's'} in current order.`, 'success');
    };
    const reverse = () => {
      if (!source || !pages.length) { status.set('Choose a PDF and keep at least one page first.', 'warning'); return; }
      revision++; pages.reverse(); render(); status.set('Current page order reversed.', 'info');
    };
    const run = async () => {
      if (!source || !file) { status.set('Choose a PDF first.', 'warning'); return; }
      if (!pages.length) { status.set('Keep at least one page, or restore the original.', 'warning'); return; }
      const doc = source, selected = pages.map(p => ({ ...p })), name = file.name, token = revision, action = ++operation;
      status.set('Creating your PDF locally…', 'info');
      try {
        const lib = await loadPdfLib(); const bytes = await organizePdf(lib, doc, selected);
        if (token !== revision || action !== operation) return;
        const saved = downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `organized-${name.replace(/\.pdf$/i, '')}.pdf`);
        status.set(saved ? `Exported ${selected.length} pages — download started.` : 'Could not start the download in this browser.', saved ? 'success' : 'error');
      } catch (e) { if (token === revision && action === operation) status.set(e.message, 'error'); }
    };
    root.append(zone, info, field({ label: 'Keep original pages', control: ranges, hint: 'Example: 1-3, 7. Filters use original page numbers and keep the current order and rotations; restore first to recover removed pages.' }), actionsRow(btn({ label: 'Apply page filter', variant: 'secondary', onClick: keepRanges }), btn({ label: 'Keep odd pages', variant: 'secondary', onClick: () => keepParity(1) }), btn({ label: 'Keep even pages', variant: 'secondary', onClick: () => keepParity(0) }), btn({ label: 'Reverse page order', variant: 'secondary', onClick: reverse })), list, actionsRow(btn({ label: 'Export organized PDF', icon: 'download', onClick: run }), btn({ label: 'Restore original pages', variant: 'secondary', icon: 'refresh', onClick: reset })), status,
      privacyNote('Your PDF is processed locally. Page copying may not preserve bookmarks, forms, attachments or digital signatures; inspect the output.'));
  },

  'pdf-rotate'(root) {
    const zone = makeZone(false, (files) => {
      file = files[0]; revision++; operation++; grid.replaceChildren();
      zone.classList.add('has-file');
      zone.replaceChildren(filePill(file), h('span', { class: 'hint', text: 'Click to choose a different file' }), zone.querySelector('input[type=file]'));
      pageCount = null;
      info.textContent = '';
      status.set(`Loaded ${file.name} (${fmtBytes(file.size)}). Click Inspect to read the page count.`, 'info');
    }, 'Choose a PDF or drop it here', () => {
      file = null; pageCount = null; revision++; operation++; grid.replaceChildren(); info.textContent = '';
      zone.replaceChildren(h('span', { class: 'dz-title', text: 'Choose a PDF or drop it here' }), zone.querySelector('input[type=file]'));
      zone.clear(); status.set('Selection rejected. Choose a PDF within the 200 MB limit.', 'error');
    });
    const angle = segControl({ options: [{ v: '90', t: '90° ↻' }, { v: '180', t: '180° ↕' }, { v: '270', t: '90° ↺' }], value: '90', ariaLabel: 'Rotation angle', onChange: () => settingsChanged() });
    const scope = segControl({ options: [{ v: 'all', t: 'All pages' }, { v: 'range', t: 'Page range' }], value: 'all', ariaLabel: 'Scope', onChange: () => settingsChanged() });
    const ranges = input({ type: 'text', class: 'input mono', placeholder: 'e.g. 1-3, 7' });
    const status = statusLine('Choose a PDF to begin.');
    const info = h('p', { class: 'hint' });
    const grid = statsGrid();
    let file = null, pageCount = null, revision = 0, operation = 0;
    window.addEventListener('pagehide', () => { revision++; operation++; }, { once: true });
    const settingsChanged = () => { operation++; grid.replaceChildren(); status.set('Settings changed. Start the action again.', 'info'); };
    ranges.addEventListener('input', settingsChanged);
    const inspect = async (token = ++operation) => {
      const chosen = file, version = revision;
      const current = () => version === revision && token === operation;
      if (!file) { status.set('Choose a PDF first.', 'warning'); return null; }
      try {
        const PDFLib = await loadPdfLib();
        const bytes = await readFile(chosen, 'buffer');
        const doc = await PDFLib.PDFDocument.load(bytes);
        if (!current()) return null;
        pageCount = doc.getPageCount();
        info.textContent = `“${chosen.name}” has ${pageCount} pages${doc.isEncrypted ? ' · ⚠ this document is encrypted' : ''}.`;
        return pageCount;
      } catch (e) {
        if (!current()) return null;
        status.set(/encrypt/i.test(String(e)) ? `“${chosen.name}” is password-protected and cannot be processed.` : `“${chosen.name}” could not be read as a PDF — it may be corrupted.`, 'error');
        return null;
      }
    };
    const run = async () => {
      if (!file) { status.set('Choose a PDF first.', 'warning'); return; }
      grid.replaceChildren();
      const chosen = file, version = revision, token = ++operation;
      const current = () => version === revision && token === operation;
      const selection = ranges.value;
      const rotation = Number(angle.getValue()), selectedScope = scope.getValue();
      status.set('Loading the PDF engine…', 'info');
      const count = pageCount ?? await inspect(token);
      if (count == null || !current()) return;
      try {
        const PDFLib = await loadPdfLib();
        let targets;
        if (selectedScope === 'all') targets = Array.from({ length: count }, (_, k) => k + 1);
        else targets = parseRanges(selection, count);
        const bytes = await readFile(chosen, 'buffer');
        const doc = await PDFLib.PDFDocument.load(bytes);
        for (const pageNumber of targets) {
          const page = doc.getPage(pageNumber - 1);
          const current = page.getRotation().angle || 0;
          page.setRotation(PDFLib.degrees((current + rotation) % 360));
        }
        const outBytes = await doc.save();
        if (!current()) return;
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        if (!downloadBlob(blob, `rotated-${chosen.name.replace(/\.pdf$/i, '')}.pdf`)) throw new Error('Could not start the download in this browser.');
        grid.set([
          { label: 'Pages rotated', value: String(targets.length), kind: 'good' },
          { label: 'Angle', value: `${rotation}°` },
          { label: 'Output size', value: fmtBytes(blob.size) },
        ]);
        status.set(`Rotated ${targets.length} page${targets.length === 1 ? '' : 's'} by ${rotation}° — download started ✓`, 'success');
      } catch (e) { if (current()) { grid.replaceChildren(); status.set(e.message, 'error'); } }
    };
    root.append(zone, info,
      h('div', { class: 'field-row', style: 'margin-top:14px;align-items:end' },
        field({ label: 'Rotation', control: angle }),
        field({ label: 'Apply to', control: scope }),
        field({ label: 'Pages (if range)', control: ranges, hint: 'Only used in range mode' })),
      actionsRow(
        btn({ label: 'Inspect PDF', variant: 'secondary', icon: 'info', onClick: () => inspect() }),
        btn({ label: 'Rotate PDF', icon: 'refresh', onClick: run })),
      grid, status,
      privacyNote('Processed locally, never uploaded. Modifying a signed PDF invalidates its digital signature; inspect your output.'));
  },

  'pdf-merge'(root) {
    let revision = 0, operation = 0;
    window.addEventListener('pagehide', () => { revision++; operation++; }, { once: true });
    const listWrap = h('div', { class: 'file-list' });
    const status = statusLine('Add two or more PDFs. Use ↑/↓ to reorder.');
    const grid = statsGrid();
    const onFiles = (incoming) => {
      for (const f of incoming) {
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { status.set(`“${f.name}” is not a PDF file.`, 'error'); continue; }
        listWrap.append(pdfFilesRow(f, updateGrid));
      }
      updateGrid();
      const count = listWrap.children.length;
      if (count) status.set(`${count} PDF${count === 1 ? '' : 's'} ready. Reorder if needed, then Merge.`, 'info');
    };
    const zone = makeZone(true, onFiles, 'Choose PDF files or drop them here', () => { revision++; grid.replaceChildren(); zone.clear(); status.set('Selection rejected: each file must be within 200 MB. Existing list was kept; start again.', 'error'); });
    const updateGrid = () => { revision++; status.set('List updated. Start the action when ready.', 'info'); grid.set([
      { label: 'Files', value: String(listWrap.children.length) },
      { label: 'Total size', value: fmtBytes([...listWrap.children].reduce((s, row) => s + row.file.size, 0)) },
    ]); };
    const run = async () => {
      grid.replaceChildren();
      const ordered = [...listWrap.querySelectorAll('.file-row')].map((r) => r.file);
      const version = revision, token = ++operation;
      const current = () => version === revision && token === operation;
      if (ordered.length < 2) { status.set('Add at least two PDF files to merge.', 'warning'); return; }
      status.set(`Loading the PDF engine, then merging ${ordered.length} files…`, 'info');
      try {
        const PDFLib = await loadPdfLib();
        const out = await PDFLib.PDFDocument.create();
        let pages = 0;
        for (const f of ordered) {
          if (!current()) return;
          const bytes = await readFile(f, 'buffer');
          let src;
          try { src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false }); }
          catch (err) {
            if (/encrypt/i.test(String(err))) throw new Error(`“${f.name}” is password-protected. Remove the password first, then merge.`);
            throw new Error(`“${f.name}” could not be read as a PDF — the file may be corrupted.`);
          }
          const copied = await out.copyPages(src, src.getPageIndices());
          copied.forEach((p) => out.addPage(p));
          pages += copied.length;
        }
        if (!current()) return;
        status.set('Writing the merged PDF…', 'info');
        const outBytes = await out.save();
        if (!current()) return;
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        if (!downloadBlob(blob, 'merged.pdf')) throw new Error('Could not start the download in this browser.');
        grid.set([{ label: 'Pages merged', value: String(pages), kind: 'good' }, { label: 'Output size', value: fmtBytes(blob.size) }]);
        status.set(`Merged ${ordered.length} files into one PDF with ${pages} pages — download started ✓`, 'success');
      } catch (e) { if (current()) status.set(e.message, 'error'); }
    };
    root.append(zone, listWrap,
      actionsRow(
        btn({ label: 'Merge PDFs', icon: 'layers', onClick: run }),
        btn({ label: 'Clear list', variant: 'ghost', icon: 'x', onClick: () => { listWrap.replaceChildren(); updateGrid(); status.set('Cleared.'); } })),
      grid, status,
      privacyNote('Processed locally, never uploaded. Copied pages may not preserve forms, bookmarks, attachments or digital signatures; inspect your output.'));
  },

  'pdf-split'(root) {
    const zone = makeZone(false, (files) => {
      file = files[0]; revision++; operation++; grid.replaceChildren();
      zone.classList.add('has-file');
      zone.replaceChildren(filePill(file), h('span', { class: 'hint', text: 'Click to choose a different file' }), zone.querySelector('input[type=file]'));
      pageCount = null;
      info.textContent = '';
      status.set(`Loaded ${file.name} (${fmtBytes(file.size)}). Click Inspect to read the page count.`, 'info');
    }, 'Choose a PDF or drop it here', () => {
      file = null; pageCount = null; revision++; operation++; grid.replaceChildren(); info.textContent = '';
      zone.replaceChildren(h('span', { class: 'dz-title', text: 'Choose a PDF or drop it here' }), zone.querySelector('input[type=file]'));
      zone.clear(); status.set('Selection rejected. Choose a PDF within the 200 MB limit.', 'error');
    });
    const mode = segControl({ options: [{ v: 'extract', t: 'Extract pages into one PDF' }, { v: 'each', t: 'Each page as its own PDF' }], value: 'extract', ariaLabel: 'Split mode', onChange: () => settingsChanged() });
    const ranges = input({ type: 'text', class: 'input mono', placeholder: 'e.g. 1-3, 7, 11-13' });
    const status = statusLine('Choose a PDF to begin.');
    const info = h('p', { class: 'hint' });
    const grid = statsGrid();
    let file = null, pageCount = null, revision = 0, operation = 0;
    window.addEventListener('pagehide', () => { revision++; operation++; }, { once: true });
    const settingsChanged = () => { operation++; grid.replaceChildren(); status.set('Settings changed. Start again; download requests already started cannot be recalled.', 'info'); };
    ranges.addEventListener('input', settingsChanged);
    const inspect = async (token = ++operation) => {
      const chosen = file, version = revision;
      const current = () => version === revision && token === operation;
      if (!file) { status.set('Choose a PDF first.', 'warning'); return null; }
      try {
        const PDFLib = await loadPdfLib();
        const bytes = await readFile(chosen, 'buffer');
        const doc = await PDFLib.PDFDocument.load(bytes);
        if (!current()) return null;
        pageCount = doc.getPageCount();
        info.textContent = `“${chosen.name}” has ${pageCount} pages${doc.isEncrypted ? ' · ⚠ this document is encrypted' : ''}.`;
        return pageCount;
      } catch (e) {
        if (!current()) return null;
        status.set(/encrypt/i.test(String(e)) ? `“${chosen.name}” is password-protected and cannot be processed.` : `“${chosen.name}” could not be read as a PDF — it may be corrupted.`, 'error');
        return null;
      }
    };
    const run = async () => {
      if (!file) { status.set('Choose a PDF first.', 'warning'); return; }
      grid.replaceChildren();
      const chosen = file, version = revision, token = ++operation;
      const current = () => version === revision && token === operation;
      const selection = ranges.value;
      const selectedMode = mode.getValue();
      status.set('Loading the PDF engine…', 'info');
      const count = pageCount ?? await inspect(token);
      if (count == null || !current()) return;
      try {
        const PDFLib = await loadPdfLib();
        if (selectedMode === 'extract') {
          const pages = parseRanges(selection, count);
          const bytes = await readFile(chosen, 'buffer');
          const src = await PDFLib.PDFDocument.load(bytes);
          const out = await PDFLib.PDFDocument.create();
          const copied = await out.copyPages(src, pages.map((p) => p - 1));
          copied.forEach((p) => out.addPage(p));
          const outBytes = await out.save();
          if (!current()) return;
          const blob = new Blob([outBytes], { type: 'application/pdf' });
          if (!downloadBlob(blob, `extract-${baseName(chosen.name)}.pdf`)) throw new Error('Could not start the download in this browser.');
          grid.set([{ label: 'Pages extracted', value: String(pages.length), kind: 'good' }, { label: 'Output size', value: fmtBytes(blob.size) }]);
          status.set(`Extracted ${pages.length} pages — download started ✓`, 'success');
        } else {
          if (count > 100) { status.set(`Splitting every page would create ${count} files. Use “Extract pages” for large documents.`, 'warning'); return; }
          status.set(`Creating ${count} single-page PDFs — your browser may ask to allow multiple downloads…`, 'info');
          const bytes = await readFile(chosen, 'buffer');
          const src = await PDFLib.PDFDocument.load(bytes);
          for (let p = 0; p < count; p++) {
            const out = await PDFLib.PDFDocument.create();
            const [page] = await out.copyPages(src, [p]);
            out.addPage(page);
            const outBytes = await out.save();
            if (!current()) return;
            if (!downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(chosen.name)}-page-${p + 1}.pdf`)) throw new Error(`Could not start download for page ${p + 1}; earlier requests may have started.`);
            await new Promise((r) => setTimeout(r, 250));
          }
          if (!current()) return;
          grid.set([{ label: 'Download requests', value: String(count), kind: 'good' }]);
          status.set(`${count} single-page download requests started. Your browser may block some downloads; check them.`, 'success');
        }
      } catch (e) { if (current()) { grid.replaceChildren(); status.set(e.message, 'error'); } }
    };
    function baseName(n) { return String(n).replace(/\.pdf$/i, ''); }
    root.append(zone, info,
      h('div', { class: 'field-row', style: 'margin-top:14px;align-items:end' },
        field({ label: 'Mode', control: mode }),
        field({ label: 'Pages to extract', control: ranges, hint: 'Only used in “Extract” mode' })),
      actionsRow(
        btn({ label: 'Inspect PDF', variant: 'secondary', icon: 'info', onClick: () => inspect() }),
        btn({ label: 'Split PDF', icon: 'scissors', onClick: run })),
      grid, status,
      privacyNote('Processed locally, never uploaded. Copied pages may not preserve forms, bookmarks, attachments or digital signatures; inspect your output.'));
  },

  'image-to-pdf'(root) {
    let revision = 0, operation = 0;
    window.addEventListener('pagehide', () => { revision++; operation++; }, { once: true });
    const listWrap = h('div', { class: 'file-list' });
    const status = statusLine('Add one or more images — each becomes a page. Use ↑/↓ to reorder.');
    const grid = statsGrid();
    const pageSize = segControl({ options: [{ v: 'a4', t: 'A4 (fit)' }, { v: 'letter', t: 'Letter (fit)' }, { v: 'original', t: 'Image size' }], value: 'a4', ariaLabel: 'Page size', onChange: () => { operation++; grid.replaceChildren(); status.set('Page size changed. Start conversion again.', 'info'); } });
    const zone = dropzone({
      accept: 'image/*', multiple: true, title: 'Choose images or drop them here',
      sub: 'JPG, PNG, WebP, GIF… — converted locally, never uploaded',
      onReject: () => { revision++; grid.replaceChildren(); zone.clear(); status.set('Selection rejected: each file must be within 200 MB. Existing list was kept; start again.', 'error'); },
      onFiles: (incoming) => {
        zone.querySelector('input[type=file]').value = '';
        for (const f of incoming) {
          if (!f.type.startsWith('image/')) { status.set(`“${f.name}” is not an image file.`, 'error'); continue; }
            listWrap.append(pdfFilesRow(f, updateGrid));
        }
        updateGrid();
        const count = listWrap.children.length;
        if (count) status.set(`${count} image${count === 1 ? '' : 's'} ready. Reorder if needed, then Convert.`, 'info');
      },
    });
    const updateGrid = () => { revision++; status.set('List updated. Start the action when ready.', 'info'); grid.set([
      { label: 'Images', value: String(listWrap.children.length) },
      { label: 'Total size', value: fmtBytes([...listWrap.children].reduce((s, row) => s + row.file.size, 0)) },
    ]); };
    async function embedImage(pdf, file) {
      const buf = await readFile(file, 'buffer');
      const isJpg = /jpe?g/i.test(file.type) || /\.jpe?g$/i.test(file.name);
      const isPng = /png/i.test(file.type) || /\.png$/i.test(file.name);
      if (isJpg) { try { return await pdf.embedJpg(buf); } catch { /* fall through to canvas */ } }
      if (isPng) { try { return await pdf.embedPng(buf); } catch { /* fall through to canvas */ } }
      const bmp = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width; canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0);
      bmp.close?.();
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error(`“${file.name}” could not be decoded by this browser.`);
      return pdf.embedJpg(await blob.arrayBuffer());
    }
    const PAGE = { a4: [595.28, 841.89], letter: [612, 792] };
    const run = async () => {
      grid.replaceChildren();
      const ordered = [...listWrap.querySelectorAll('.file-row')].map((r) => r.file);
      const version = revision, token = ++operation;
      const current = () => version === revision && token === operation;
      if (!ordered.length) { status.set('Add at least one image first.', 'warning'); return; }
      const chosenSize = pageSize.getValue();
      status.set(`Loading the PDF engine, then converting ${ordered.length} image${ordered.length === 1 ? '' : 's'}…`, 'info');
      try {
        const PDFLib = await loadPdfLib();
        const pdf = await PDFLib.PDFDocument.create();
        for (const f of ordered) {
          if (!current()) return;
          const img = await embedImage(pdf, f);
          let page, rect;
          if (chosenSize === 'original') {
            page = pdf.addPage([img.width, img.height]);
            rect = { x: 0, y: 0, width: img.width, height: img.height };
          } else {
            let [pw, ph] = PAGE[chosenSize];
            if (img.width > img.height && pw < ph) [pw, ph] = [ph, pw]; // landscape image → landscape page
            page = pdf.addPage([pw, ph]);
            rect = fitRect(img.width, img.height, pw, ph, 36);
          }
          page.drawImage(img, rect);
        }
        const outBytes = await pdf.save();
        if (!current()) return;
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        if (!downloadBlob(blob, ordered.length === 1 ? `${ordered[0].name.replace(/\.[^.]+$/, '')}.pdf` : 'images.pdf')) throw new Error('Could not start the download in this browser.');
        grid.set([{ label: 'Pages created', value: String(ordered.length), kind: 'good' }, { label: 'PDF size', value: fmtBytes(blob.size) }]);
        status.set(`Converted ${ordered.length} image${ordered.length === 1 ? '' : 's'} into a PDF — download started ✓`, 'success');
      } catch (e) { if (current()) status.set(e.message, 'error'); }
    };
    root.append(zone, listWrap,
      h('div', { class: 'field-row', style: 'margin-top:14px;align-items:end' },
        field({ label: 'Page size', control: pageSize })),
      actionsRow(
        btn({ label: 'Convert to PDF', icon: 'file-text', onClick: run }),
        btn({ label: 'Clear list', variant: 'ghost', icon: 'x', onClick: () => { listWrap.replaceChildren(); updateGrid(); status.set('Cleared.'); } })),
      grid, status,
      privacyNote('Images are converted locally in your browser with pdf-lib — they are never uploaded.'));
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { parseRanges, fitRect, organizePdf };
