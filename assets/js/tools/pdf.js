// =============================================================================
// iHaveTools — PDF tools: pdf-merge, pdf-split.
// Uses pdf-lib (vendored locally at /assets/vendor/pdf-lib.min.js, lazy-loaded
// only when a PDF action runs). All processing happens in the browser.
// =============================================================================
import { h, field, input, switchChip, segControl, btn, actionsRow, statusLine, statsGrid, toast, readFile, downloadBlob, fmtBytes, dropzone, filePill, privacyNote, mountTool } from '../ui.js';

/* ── pdf-lib lazy loader ── */
let libPromise = null;
export function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/assets/vendor/pdf-lib.min.js';
    s.onload = () => window.PDFLib ? resolve(window.PDFLib) : reject(new Error('The PDF library loaded but did not initialise.'));
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

/* ── shared UI bits ── */
function makeZone(multiple, onFiles, label) {
  const zone = dropzone({ accept: 'application/pdf,.pdf', multiple, title: label || 'Choose a PDF or drop it here', sub: 'Processed locally with pdf-lib — never uploaded' });
  zone.querySelector('input[type=file]').addEventListener('change', (e) => {
    const files = multiple ? [...e.target.files] : [e.target.files[0]].filter(Boolean);
    if (files.length) onFiles(files);
  });
  return zone;
}
function pdfFilesRow(file) {
  return h('div', { class: 'file-row', dataset: { name: file.name } },
    h('span', { class: 'fr-name', text: file.name }),
    h('span', { class: 'fr-size', text: fmtBytes(file.size) }),
    h('span', { class: 'fr-actions' },
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Move up', onclick: (e) => moveRow(e, -1) }, '↑'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Move down', onclick: (e) => moveRow(e, 1) }, '↓'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-label': 'Remove', onclick: (e) => e.target.closest('.file-row').remove() }, '✕')));
}
function moveRow(e, dir) {
  const row = e.target.closest('.file-row');
  const parent = row.parentElement;
  if (dir < 0 && row.previousElementSibling) parent.insertBefore(row, row.previousElementSibling);
  if (dir > 0 && row.nextElementSibling) parent.insertBefore(row.nextElementSibling, row);
}

const defs = {
  'pdf-rotate'(root) {
    const zone = makeZone(false, (files) => {
      file = files[0];
      zone.classList.add('has-file');
      zone.replaceChildren(filePill(file), h('span', { class: 'hint', text: 'Click to choose a different file' }), zone.querySelector('input[type=file]'));
      pageCount = null;
      info.textContent = '';
      status.set(`Loaded ${file.name} (${fmtBytes(file.size)}). Click Inspect to read the page count.`, 'info');
    }, 'Choose a PDF or drop it here');
    const angle = segControl({ options: [{ v: '90', t: '90° ↻' }, { v: '180', t: '180° ↕' }, { v: '270', t: '90° ↺' }], value: '90', ariaLabel: 'Rotation angle' });
    const scope = segControl({ options: [{ v: 'all', t: 'All pages' }, { v: 'range', t: 'Page range' }], value: 'all', ariaLabel: 'Scope' });
    const ranges = input({ type: 'text', class: 'input mono', placeholder: 'e.g. 1-3, 7' });
    const status = statusLine('Choose a PDF to begin.');
    const info = h('p', { class: 'hint' });
    const grid = statsGrid();
    let file = null, pageCount = null;
    const inspect = async () => {
      if (!file) { status.set('Choose a PDF first.', 'warning'); return null; }
      try {
        const PDFLib = await loadPdfLib();
        const bytes = await readFile(file, 'buffer');
        const doc = await PDFLib.PDFDocument.load(bytes);
        pageCount = doc.getPageCount();
        info.textContent = `“${file.name}” has ${pageCount} pages${doc.isEncrypted ? ' · ⚠ this document is encrypted' : ''}.`;
        return pageCount;
      } catch (e) {
        status.set(/encrypt/i.test(String(e)) ? `“${file.name}” is password-protected and cannot be processed.` : `“${file.name}” could not be read as a PDF — it may be corrupted.`, 'error');
        return null;
      }
    };
    const run = async () => {
      if (!file) { status.set('Choose a PDF first.', 'warning'); return; }
      status.set('Loading the PDF engine…', 'info');
      const count = pageCount ?? await inspect();
      if (count == null) return;
      try {
        const PDFLib = await loadPdfLib();
        const degrees = PDFLib.degrees(Number(angle.getValue()));
        let targets;
        if (scope.getValue() === 'all') targets = Array.from({ length: count }, (_, k) => k + 1);
        else targets = parseRanges(ranges.value, count);
        const bytes = await readFile(file, 'buffer');
        const doc = await PDFLib.PDFDocument.load(bytes);
        for (const pageNumber of targets) {
          const page = doc.getPage(pageNumber - 1);
          const current = page.getRotation().angle || 0;
          page.setRotation(PDFLib.degrees((current + Number(angle.getValue())) % 360));
        }
        const outBytes = await doc.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        downloadBlob(blob, `rotated-${file.name.replace(/\.pdf$/i, '')}.pdf`);
        grid.set([
          { label: 'Pages rotated', value: String(targets.length), kind: 'good' },
          { label: 'Angle', value: `${angle.getValue()}°` },
          { label: 'Output size', value: fmtBytes(blob.size) },
        ]);
        status.set(`Rotated ${targets.length} page${targets.length === 1 ? '' : 's'} by ${angle.getValue()}° — download started ✓`, 'success');
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(zone, info,
      h('div', { class: 'field-row', style: 'margin-top:14px;align-items:end' },
        field({ label: 'Rotation', control: angle }),
        field({ label: 'Apply to', control: scope }),
        field({ label: 'Pages (if range)', control: ranges, hint: 'Only used in range mode' })),
      actionsRow(
        btn({ label: 'Inspect PDF', variant: 'secondary', icon: 'info', onClick: inspect }),
        btn({ label: 'Rotate PDF', icon: 'refresh', onClick: run })),
      grid, status,
      privacyNote('Your PDF is rotated locally in your browser with pdf-lib and is not uploaded.'));
  },

  'pdf-merge'(root) {
    const listWrap = h('div', { class: 'file-list' });
    const status = statusLine('Add two or more PDFs. Drag order matters — use ↑/↓ to reorder.');
    const grid = statsGrid();
    let files = [];
    const onFiles = (incoming) => {
      for (const f of incoming) {
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { status.set(`“${f.name}” is not a PDF file.`, 'error'); continue; }
        files.push(f);
        listWrap.append(pdfFilesRow(f));
      }
      updateGrid();
      status.set(`${files.length} PDF${files.length === 1 ? '' : 's'} ready. Reorder if needed, then Merge.`, 'info');
    };
    const zone = makeZone(true, onFiles, 'Choose PDF files or drop them here');
    const updateGrid = () => grid.set([
      { label: 'Files', value: String(listWrap.children.length) },
      { label: 'Total size', value: fmtBytes(files.reduce((s, f) => s + f.size, 0)) },
    ]);
    const run = async () => {
      const ordered = [...listWrap.querySelectorAll('.file-row')].map((r) => files.find((f) => f.name === r.dataset.name)).filter(Boolean);
      if (ordered.length < 2) { status.set('Add at least two PDF files to merge.', 'warning'); return; }
      status.set(`Loading the PDF engine, then merging ${ordered.length} files…`, 'info');
      try {
        const PDFLib = await loadPdfLib();
        const out = await PDFLib.PDFDocument.create();
        let pages = 0;
        for (const f of ordered) {
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
        status.set('Writing the merged PDF…', 'info');
        const outBytes = await out.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        downloadBlob(blob, 'merged.pdf');
        grid.set([{ label: 'Pages merged', value: String(pages), kind: 'good' }, { label: 'Output size', value: fmtBytes(blob.size) }]);
        status.set(`Merged ${ordered.length} files into one PDF with ${pages} pages — download started ✓`, 'success');
      } catch (e) { status.set(e.message, 'error'); }
    };
    root.append(zone, listWrap,
      actionsRow(
        btn({ label: 'Merge PDFs', icon: 'layers', onClick: run }),
        btn({ label: 'Clear list', variant: 'ghost', icon: 'x', onClick: () => { listWrap.replaceChildren(); files = []; updateGrid(); status.set('Cleared.'); } })),
      grid, status,
      privacyNote('PDFs are merged in your browser with pdf-lib. The files are never uploaded to any server.'));
  },

  'pdf-split'(root) {
    const zone = makeZone(false, (files) => {
      file = files[0];
      zone.classList.add('has-file');
      zone.replaceChildren(filePill(file), h('span', { class: 'hint', text: 'Click to choose a different file' }), zone.querySelector('input[type=file]'));
      pageCount = null;
      info.textContent = '';
      status.set(`Loaded ${file.name} (${fmtBytes(file.size)}). Click Inspect to read the page count.`, 'info');
    }, 'Choose a PDF or drop it here');
    const mode = segControl({ options: [{ v: 'extract', t: 'Extract pages into one PDF' }, { v: 'each', t: 'Each page as its own PDF' }], value: 'extract', ariaLabel: 'Split mode' });
    const ranges = input({ type: 'text', class: 'input mono', placeholder: 'e.g. 1-3, 7, 11-13' });
    const status = statusLine('Choose a PDF to begin.');
    const info = h('p', { class: 'hint' });
    const grid = statsGrid();
    let file = null, pageCount = null;
    const inspect = async () => {
      if (!file) { status.set('Choose a PDF first.', 'warning'); return null; }
      try {
        const PDFLib = await loadPdfLib();
        const bytes = await readFile(file, 'buffer');
        const doc = await PDFLib.PDFDocument.load(bytes);
        pageCount = doc.getPageCount();
        info.textContent = `“${file.name}” has ${pageCount} pages${doc.isEncrypted ? ' · ⚠ this document is encrypted' : ''}.`;
        return pageCount;
      } catch (e) {
        status.set(/encrypt/i.test(String(e)) ? `“${file.name}” is password-protected and cannot be processed.` : `“${file.name}” could not be read as a PDF — it may be corrupted.`, 'error');
        return null;
      }
    };
    const run = async () => {
      if (!file) { status.set('Choose a PDF first.', 'warning'); return; }
      status.set('Loading the PDF engine…', 'info');
      const count = pageCount ?? await inspect();
      if (count == null) return;
      try {
        const PDFLib = await loadPdfLib();
        if (mode.getValue() === 'extract') {
          const pages = parseRanges(ranges.value, count);
          const bytes = await readFile(file, 'buffer');
          const src = await PDFLib.PDFDocument.load(bytes);
          const out = await PDFLib.PDFDocument.create();
          const copied = await out.copyPages(src, pages.map((p) => p - 1));
          copied.forEach((p) => out.addPage(p));
          const outBytes = await out.save();
          const blob = new Blob([outBytes], { type: 'application/pdf' });
          downloadBlob(blob, `extract-${baseName(file.name)}.pdf`);
          grid.set([{ label: 'Pages extracted', value: String(pages.length), kind: 'good' }, { label: 'Output size', value: fmtBytes(blob.size) }]);
          status.set(`Extracted ${pages.length} pages — download started ✓`, 'success');
        } else {
          if (count > 100) { status.set(`Splitting every page would create ${count} files. Use “Extract pages” for large documents.`, 'warning'); return; }
          status.set(`Creating ${count} single-page PDFs — your browser may ask to allow multiple downloads…`, 'info');
          const bytes = await readFile(file, 'buffer');
          const src = await PDFLib.PDFDocument.load(bytes);
          for (let p = 0; p < count; p++) {
            const out = await PDFLib.PDFDocument.create();
            const [page] = await out.copyPages(src, [p]);
            out.addPage(page);
            const outBytes = await out.save();
            downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName(file.name)}-page-${p + 1}.pdf`);
            await new Promise((r) => setTimeout(r, 250));
          }
          grid.set([{ label: 'Files created', value: String(count), kind: 'good' }]);
          status.set(`${count} single-page PDFs downloaded ✓`, 'success');
        }
      } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    function baseName(n) { return String(n).replace(/\.pdf$/i, ''); }
    root.append(zone, info,
      h('div', { class: 'field-row', style: 'margin-top:14px;align-items:end' },
        field({ label: 'Mode', control: mode }),
        field({ label: 'Pages to extract', control: ranges, hint: 'Only used in “Extract” mode' })),
      actionsRow(
        btn({ label: 'Inspect PDF', variant: 'secondary', icon: 'info', onClick: inspect }),
        btn({ label: 'Split PDF', icon: 'scissors', onClick: run })),
      grid, status,
      privacyNote('Your PDF is processed locally in your browser with pdf-lib and is not uploaded.'));
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { parseRanges };
