// =============================================================================
// iHaveTools — Image tools: image-compressor, image-resizer, image-converter,
// image-cropper, image-metadata-viewer. All processing uses the browser's
// canvas engine locally; files never leave the device.
// =============================================================================
import { h, field, input, select, switchChip, segControl, btn, actionsRow, resultPanel, statusLine, statsGrid, table, toast, readFile, downloadBlob, fmtBytes, dropzone, filePill, privacyNote, mountTool } from '../ui.js';

/* ═══════════════════════════ Pure helpers (unit-tested) ═══════════════════════════ */
export const MIME_BY_FMT = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export const EXT_BY_FMT = { jpeg: 'jpg', png: 'png', webp: 'webp' };

export function computeTargetDims(w, h0, { width = null, height = null, percent = null, lock = true } = {}) {
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h0) || w < 1 || h0 < 1) throw new Error('The image dimensions could not be read.');
  for (const n of [width, height]) if (n != null && (!Number.isSafeInteger(n) || n < 1)) throw new Error('Width and height must be positive whole numbers.');
  if (percent != null) {
    if (!(percent >= 1 && percent <= 1000)) throw new Error('Scale percentage must be between 1 and 1000.');
    return { width: Math.max(1, Math.round(w * percent / 100)), height: Math.max(1, Math.round(h0 * percent / 100)) };
  }
  if (width && height) return { width, height };
  if (width) return lock ? { width, height: Math.max(1, Math.round(h0 * (width / w))) } : { width, height: h0 };
  if (height) return lock ? { width: Math.max(1, Math.round(w * (height / h0))), height } : { width: w, height };
  return { width: w, height: h0 };
}
export function clampQuality(q) {
  const n = Number(q);
  if (!Number.isFinite(n)) return 0.8;
  return Math.max(0.05, Math.min(1, n / 100));
}
export function sniffImageType(buffer) {
  const b = new Uint8Array(buffer.slice ? buffer.slice(0, 16) : buffer, 0, Math.min(16, buffer.byteLength ?? 16));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if ([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v,i)=>b[i]===v)) return 'png';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  return null;
}
export function baseName(name) { return String(name).replace(/\.[^.]+$/, '') || 'image'; }

/* ═══════════════════════════ EXIF / metadata parsing (real implementation) ═══════════════════════════ */
export function parseImageMetadata(buffer) {
  const type = sniffImageType(buffer);
  if (type === 'jpeg') return { type, ...parseJpeg(buffer) };
  if (type === 'png') return { type, ...parsePng(buffer) };
  return { type, summary: [], exif: null, chunks: null };
}
const TAGS_IFD0 = { 0x010f: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x0131: 'Software', 0x0132: 'DateTime', 0x013b: 'Artist', 0x8298: 'Copyright', 0x8827: 'ISO' };
const TAGS_EXIF = { 0x829a: 'ExposureTime', 0x829d: 'FNumber', 0x8827: 'ISOSpeedRatings', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized', 0x920a: 'FocalLength', 0xa405: 'FocalLengthIn35mm', 0xa432: 'LensSpecification', 0xa434: 'LensModel', 0xa001: 'ColorSpace', 0xa002: 'PixelXDimension', 0xa003: 'PixelYDimension' };
const TAGS_GPS = { 0x0001: 'GPSLatitudeRef', 0x0002: 'GPSLatitude', 0x0003: 'GPSLongitudeRef', 0x0004: 'GPSLongitude', 0x0006: 'GPSAltitude', 0x0005: 'GPSAltitudeRef' };
const ORIENTATIONS = { 1: 'Normal', 2: 'Mirrored horizontal', 3: 'Rotated 180°', 4: 'Mirrored vertical', 5: 'Mirrored horizontal + rotated 90° CW', 6: 'Rotated 90° CW', 7: 'Mirrored horizontal + rotated 90° CCW', 8: 'Rotated 90° CCW' };

function parseJpeg(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let exifStart = -1, exifEnd = -1, scanComplete = false;
  // Inspect marker segments before the first scan; JPEG fill bytes are legal.
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i++] !== 0xff) break;
    while (i < bytes.length && bytes[i] === 0xff) i++;
    if (i >= bytes.length) break;
    const marker = bytes[i++];
    if (marker === 0xda || marker === 0xd9) { scanComplete = true; break; }
    if (marker === 0x00 || marker === 0xd8) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (i + 2 > bytes.length) break;
    const size = view.getUint16(i);
    if (size < 2 || i + size > bytes.length) break;
    if (marker === 0xe1 && size >= 8 && bytes[i + 2] === 0x45 && bytes[i + 3] === 0x78 && bytes[i + 4] === 0x69 && bytes[i + 5] === 0x66 && bytes[i + 6] === 0 && bytes[i + 7] === 0) {
      exifStart = i + 8; exifEnd = i + size;
      break;
    }
    i += size;
  }
  const out = { exif: null, chunks: null };
  if (exifStart === -1) {
    out.summary = [['Format', 'JPEG'], ['EXIF before first scan', scanComplete ? 'Not found' : 'Could not inspect completely']];
    return out;
  }
  try {
    const bounds = (off, len) => { if (!Number.isSafeInteger(off) || !Number.isSafeInteger(len) || off < exifStart || len < 0 || off + len > exifEnd) throw new Error('Invalid EXIF bounds'); };
    bounds(exifStart, 8);
    const byteOrder = view.getUint16(exifStart);
    if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) throw new Error('Invalid TIFF byte order');
    const little = byteOrder === 0x4949;
    const u16 = (off) => { bounds(off, 2); return view.getUint16(off, little); };
    const u32 = (off) => { bounds(off, 4); return view.getUint32(off, little); };
    if (u16(exifStart + 2) !== 42) throw new Error('Invalid TIFF header');
    const ifd = (start, tagMap, label) => {
      const entries = {};
      const count = u16(start);
      bounds(start + 2, count * 12);
      for (let k = 0; k < count; k++) {
        const e = start + 2 + k * 12;
        const tag = u16(e);
        const typ = u16(e + 2);
        const num = u32(e + 4);
        const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 10: 8 };
        if (!tagMap[tag] || !sizes[typ]) continue;
        if (num > 4096) throw new Error('EXIF value too large');
        const total = sizes[typ] * num;
        const valOff = total <= 4 ? e + 8 : exifStart + u32(e + 8);
        bounds(valOff, total);
        let value;
        if (typ === 1) value = num === 1 ? bytes[valOff] : Array.from(bytes.subarray(valOff, valOff + num));
        else if (typ === 2) value = new TextDecoder('ascii', { fatal: false }).decode(new Uint8Array(buffer, valOff, num)).replace(/\0.*$/, '').trim();
        else if (typ === 3) value = num === 1 ? u16(valOff) : Array.from({ length: num }, (_, q) => u16(valOff + q * 2));
        else if (typ === 4) value = num === 1 ? u32(valOff) : Array.from({ length: num }, (_, q) => u32(valOff + q * 4));
        else if (typ === 5 || typ === 10) value = Array.from({ length: num }, (_, q) => {
          const offset = valOff + q * 8;
          const numerator = typ === 5 ? u32(offset) : view.getInt32(offset, little);
          const denominator = typ === 5 ? u32(offset + 4) : view.getInt32(offset + 4, little);
          if (!denominator) throw new Error('Invalid EXIF rational');
          return numerator / denominator;
        });
        else value = null; // undefined/unknown types skipped
        if (value != null && tagMap[tag]) entries[tagMap[tag]] = Array.isArray(value) && value.length === 1 ? value[0] : value;
      }
      return entries;
    };
    const ifd0Off = exifStart + u32(exifStart + 4);
    const ifd0 = ifd(ifd0Off, TAGS_IFD0, 'IFD0');
    let exifEntries = {}, gps = {};
    const sub = (tag, map) => {
      const count = u16(ifd0Off);
      bounds(ifd0Off + 2, count * 12);
      for (let k = 0; k < count; k++) {
        const e = ifd0Off + 2 + k * 12;
        if (u16(e) === tag) {
          if (u16(e + 2) !== 4 || u32(e + 4) !== 1) throw new Error('Invalid EXIF directory pointer');
          return ifd(exifStart + u32(e + 8), map, 'sub');
        }
      }
      return {};
    };
    exifEntries = sub(0x8769, TAGS_EXIF);
    gps = sub(0x8825, TAGS_GPS);
    if (ifd0.Orientation in ORIENTATIONS) ifd0.Orientation = ORIENTATIONS[ifd0.Orientation];
    const summary = [['Format', 'JPEG (JFIF/EXIF)'], ['Has EXIF block', 'Yes']];
    out.summary = summary;
    out.exif = { 'Camera / Image': ifd0, 'Capture details': exifEntries, ...(Object.keys(gps).length ? { GPS: gps } : {}) };
    out.hasExif = true;
  } catch { out.exif = null; out.summary = [['Format', 'JPEG'], ['Has EXIF block', 'Yes (unreadable)']]; }
  return out;
}

function parsePng(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const chunks = [];
  const summary = [['Format', 'PNG']];
  let pos = 8;
  try {
    if (bytes.length < 33 || view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') throw new Error('Invalid PNG header');
    const w = view.getUint32(16), h = view.getUint32(20);
    const bitDepth = bytes[24];
    const colorType = ({ 0: 'Grayscale', 2: 'RGB', 3: 'Palette', 4: 'Grayscale + alpha', 6: 'RGBA' })[bytes[25]] || 'Unknown';
    summary.push(['Dimensions', `${w} × ${h} px`], ['Bit depth', bitDepth], ['Color type', colorType], ['Interlaced', bytes[28] ? 'Yes (Adam7)' : 'No']);
    while (pos + 8 <= bytes.length) {
      if (chunks.length >= 10000) throw new Error('Too many PNG chunks');
      const len = view.getUint32(pos);
      const name = String.fromCharCode(...bytes.slice(pos + 4, pos + 8));
      if (len > bytes.length - pos - 12) throw new Error('Truncated PNG chunk');
      chunks.push([name, `${len.toLocaleString()} B`, CHUNK_INFO[name] || '']);
      if (name === 'IEND') break;
      pos += 12 + len;
    }
    if (!chunks.some(([name]) => name === 'IEND')) throw new Error('Missing PNG end chunk');
  } catch { summary.push(['Note', 'PNG structure could not be fully read — the file may be corrupted.']); }
  return { summary, chunks: chunks.map(([n, s, d]) => [n, s, d]), exif: null };
}
const CHUNK_INFO = {
  IHDR: 'Image header (size, bit depth, color type)', PLTE: 'Color palette', IDAT: 'Image data', IEND: 'Image end',
  tEXt: 'Text metadata', zTXt: 'Compressed text metadata', iTXt: 'International text metadata', tIME: 'Last modification time',
  gAMA: 'Gamma', cHRM: 'Chromaticities', sRGB: 'sRGB rendering intent', iCCP: 'ICC color profile', pHYs: 'Physical pixel dimensions',
  bKGD: 'Background color', hIST: 'Palette histogram', tRNS: 'Transparency info', eXIf: 'EXIF data',
};

/* ═══════════════════════════ Canvas plumbing ═══════════════════════════ */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`“${file.name}” could not be decoded. The file may be corrupted or in an unsupported format.`)); };
    img.src = url;
  });
}
async function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => { if (!blob) reject(new Error('Your browser could not encode this image. Try a different output format.')); else if (blob.type !== mime) reject(new Error('Your browser does not support encoding this format. Try another format.')); else resolve(blob); }, mime, quality);
  });
}
function checkDecodable(file, allowed = ['jpeg', 'png', 'webp', 'gif', 'bmp']) {
  if (file.size > 100 * 1024 * 1024) return Promise.reject(new Error('Choose an image no larger than 100 MiB.'));
  return readFile(file.slice(0, 16), 'buffer').then((buf) => {
    const t = sniffImageType(buf);
    if (!t || !allowed.includes(t)) throw new Error(`“${file.name}” does not look like a supported image${t ? ` (detected: ${t})` : ''}. Supported: JPG, PNG, WebP, GIF, BMP.`);
    return t;
  });
}

// Limit canvas allocation; browsers vary in their actual limits and may still fail.
function validateCanvasSize(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 16384 || height > 16384 || width * height > 40000000) {
    throw new Error('Image output must be at most 16,384 pixels per side and 40 million pixels total.');
  }
}
function previewManager(element) {
  let url = null;
  return {
    clear() { element.replaceChildren(); if (url) URL.revokeObjectURL(url); url = null; },
    show(blob, render) { this.clear(); url = URL.createObjectURL(blob); element.replaceChildren(render(url)); },
  };
}
function downloadImage(blob, name) {
  const ok = downloadBlob(blob, name);
  toast(ok ? 'Download started' : 'Could not start the download in this browser.', ok ? 'success' : 'error');
}

// One common callback for picker and drag/drop; native file inputs cannot be
// assigned a dropped FileList reliably, so pass files through a custom event.
function imageZone(options) {
  let zone;
  zone = dropzone({ ...options, onFiles: (files) => zone.dispatchEvent(new window.CustomEvent('iht-files', { detail: files })) });
  return zone;
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
const defs = {
  'image-compressor'(root) {
    const zone = imageZone({ accept: 'image/*', title: 'Choose an image or drop it here', sub: 'JPG, PNG or WebP — processed locally, never uploaded' });
    const quality = input({ type: 'range', min: 5, max: 100, value: '80' });
    const qualityOut = h('span', { class: 'hint', text: '80%' });
    quality.addEventListener('input', () => { qualityOut.textContent = `${quality.value}%`; });
    const fmtSel = select({ options: [{ v: 'jpeg', t: 'JPEG — best for photos' }, { v: 'webp', t: 'WebP — usually smallest' }, { v: 'png', t: 'PNG — lossless' }], value: 'jpeg' });
    const maxW = input({ type: 'number', min: 1, placeholder: 'original' });
    const status = statusLine('Choose an image to begin.');
    const grid = statsGrid();
    const preview = h('div', {}), previews = previewManager(preview);
    let revision = 0;
    let file = null, lastBlob = null;
    const origHook = (f) => {
      revision++; file = f;
      lastBlob = null; grid.replaceChildren(); previews.clear();
      zone.classList.add('has-file');
      zone.replaceChildren(filePill(f), h('span', { class: 'hint', text: 'Click to choose a different file' }), zone.querySelector('input[type=file]'));
      status.set(`Loaded ${f.name} (${fmtBytes(f.size)}). Adjust options, then Compress.`, 'info');
    };
    zone.addEventListener('iht-files', (e) => { if (e.detail[0]) origHook(e.detail[0]); });
    [quality, fmtSel, maxW].forEach((el) => { for (const type of ['input', 'change']) el.addEventListener(type, () => { revision++; grid.replaceChildren(); previews.clear(); status.set('Settings changed. Run the tool again for a new output.', 'info'); }); });
    const run = async () => {
      if (!file) { status.set('Choose an image first.', 'warning'); return; }
      status.set('Compressing…', 'info');
      const selected = file, token = ++revision;
      try {
        await checkDecodable(selected);
        const img = await loadImage(selected);
        if (file !== selected || revision !== token) return;
        let w = img.naturalWidth, h0 = img.naturalHeight;
        if (maxW.value !== '' && (!Number.isSafeInteger(Number(maxW.value)) || Number(maxW.value) < 1)) throw new Error('Max width must be a positive whole number.');
        if (Number(maxW.value) > 0 && Number(maxW.value) < w) {
          const t = computeTargetDims(w, h0, { width: Math.floor(Number(maxW.value)) });
          w = t.width; h0 = t.height;
        }
        validateCanvasSize(w, h0);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h0;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const fmt = fmtSel.value;
        if (fmt === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h0); }
        ctx.drawImage(img, 0, 0, w, h0);
        const blob = await canvasToBlob(canvas, MIME_BY_FMT[fmt], fmt === 'png' ? undefined : clampQuality(quality.value));
        if (file !== selected || revision !== token) return;
        lastBlob = blob;
        const saved = Math.max(0, Math.round((1 - blob.size / file.size) * 100));
        grid.set([
          { label: 'Original', value: fmtBytes(file.size) },
          { label: 'Compressed', value: fmtBytes(blob.size), kind: blob.size < file.size ? 'good' : 'warn' },
          { label: 'Saved', value: `${saved}%`, kind: saved > 0 ? 'good' : 'bad' },
          { label: 'Dimensions', value: `${w} × ${h0}` },
        ]);
        previews.show(blob, (url) => h('div', {},
          h('img', { class: 'img-preview', src: url, alt: 'Compressed preview', style: 'margin-top:12px' }),
          h('div', { style: 'margin-top:10px' },
            h('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
              downloadImage(blob, `compressed-${baseName(selected.name)}.${EXT_BY_FMT[fmt]}`);
            } }, 'Download compressed image'))));
        if (blob.size >= file.size) status.set('Done — but this format/quality did not shrink the file. Try lower quality or JPEG/WebP.', 'warning');
        else status.set(`Compressed ✓ ${fmtBytes(file.size)} → ${fmtBytes(blob.size)} (${saved}% smaller).`, 'success');
      } catch (e) { if (file === selected && revision === token) { grid.replaceChildren(); previews.clear(); status.set(e.message, 'error'); } }
    };
    root.append(zone,
      h('div', { class: 'field-row', style: 'margin-top:14px;align-items:end' },
        field({ label: 'Quality (%)', control: quality, hint: 'Used for JPEG and WebP; PNG is lossless.' }), qualityOut,
        field({ label: 'Output format', control: fmtSel }),
        field({ label: 'Max width (px)', control: maxW, hint: 'Blank keeps original size' })),
      actionsRow(btn({ label: 'Compress', icon: 'minimize', onClick: run })),
      status, grid, preview,
      privacyNote('Processed locally, never uploaded. Canvas output may discard metadata and animation. JPEG flattens transparency onto white. Output is limited to 16,384 px per side and 40 million pixels; input is limited to 100 MiB.'));
  },

  'image-resizer'(root) {
    const zone = imageZone({ accept: 'image/*', title: 'Choose an image or drop it here', sub: 'Processed locally — never uploaded' });
    const wIn = input({ type: 'number', min: 1, placeholder: 'width' });
    const hIn = input({ type: 'number', min: 1, placeholder: 'height' });
    const pctIn = input({ type: 'number', min: 1, max: 1000, placeholder: 'e.g. 50 (= half size)' });
    const lock = switchChip({ label: 'Lock aspect ratio', checked: true });
    const fmtSel = select({ options: [{ v: 'png', t: 'PNG' }, { v: 'jpeg', t: 'JPEG' }, { v: 'webp', t: 'WebP' }], value: 'png' });
    const status = statusLine('Choose an image to begin.');
    const info = h('p', { class: 'hint' });
    const preview = h('div', {}), previews = previewManager(preview);
    let revision = 0, selectionRevision = 0;
    let file = null, img = null, lastBlob = null;
    zone.addEventListener('iht-files', async (e) => {
      const f = e.detail[0];
      if (!f) return;
      const loadToken = ++selectionRevision; revision++; file = f; img = null; lastBlob = null; previews.clear(); info.textContent = '';
      zone.classList.add('has-file');
      zone.replaceChildren(filePill(f), h('span', { class: 'hint', text: 'Click to choose a different file' }), zone.querySelector('input[type=file]'));
      try {
        await checkDecodable(file);
        const loaded = await loadImage(f);
        if (file !== f || selectionRevision !== loadToken) return;
        img = loaded;
        wIn.placeholder = String(img.naturalWidth);
        hIn.placeholder = String(img.naturalHeight);
        info.textContent = `Original: ${img.naturalWidth} × ${img.naturalHeight} px.`;
        status.set(`Loaded ${f.name}. Enter target dimensions.`, 'info');
      } catch (err) { if (file === f && selectionRevision === loadToken) { file = null; img = null; status.set(err.message, 'error'); } }
    });
    [wIn, hIn].forEach((el) => el.addEventListener('input', () => {
      if (!img || !lock.querySelector('input').checked) return;
      if (el === wIn && Number(wIn.value) > 0) hIn.value = String(Math.round(img.naturalHeight * (Number(wIn.value) / img.naturalWidth)));
      if (el === hIn && Number(hIn.value) > 0) wIn.value = String(Math.round(img.naturalWidth * (Number(hIn.value) / img.naturalHeight)));
    }));
    [wIn, hIn, pctIn, fmtSel, lock].forEach((el) => { for (const type of ['input', 'change']) el.addEventListener(type, () => { revision++; previews.clear(); status.set('Settings changed. Run the tool again for a new output.', 'info'); }); });
    const run = async () => {
      if (!file || !img) { status.set('Choose an image first.', 'warning'); return; }
      status.set('Resizing…', 'info');
      const selected = file, format = fmtSel.value, token = ++revision;
      try {
        if (!pctIn.value) for (const field of [wIn, hIn]) if (field.value !== '' && (!Number.isSafeInteger(Number(field.value)) || Number(field.value) < 1)) throw new Error('Width and height must be positive whole numbers.');
        const target = pctIn.value
          ? computeTargetDims(img.naturalWidth, img.naturalHeight, { percent: Number(pctIn.value) })
          : computeTargetDims(img.naturalWidth, img.naturalHeight, { width: Number(wIn.value) || null, height: Number(hIn.value) || null, lock: lock.querySelector('input').checked });
        if (!target.width || !target.height) { status.set('Enter a width, a height, or a scale percentage.', 'warning'); return; }
        validateCanvasSize(target.width, target.height);
        const canvas = document.createElement('canvas');
        canvas.width = target.width; canvas.height = target.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (format === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, target.width, target.height); }
        ctx.drawImage(img, 0, 0, target.width, target.height);
        const blob = await canvasToBlob(canvas, MIME_BY_FMT[format], 0.92);
        if (file !== selected || revision !== token) return;
        lastBlob = blob;
        previews.show(blob, (url) => h('div', {},
          h('img', { class: 'img-preview', src: url, alt: 'Resized preview', style: 'margin-top:12px' }),
          h('div', { style: 'margin-top:10px' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { downloadImage(blob, `resized-${baseName(selected.name)}.${EXT_BY_FMT[format]}`); } }, `Download ${target.width} × ${target.height}`))));
        status.set(`Resized to ${target.width} × ${target.height} px (${fmtBytes(blob.size)}) ✓`, 'success');
      } catch (e) { if (file === selected && revision === token) { previews.clear(); status.set(e.message, 'error'); } }
    };
    root.append(zone, info,
      h('div', { class: 'field-row', style: 'margin-top:14px;align-items:end' },
        field({ label: 'Width (px)', control: wIn }),
        field({ label: 'Height (px)', control: hIn }),
        field({ label: 'Or scale %', control: pctIn, hint: 'Overrides W/H' }),
        field({ label: 'Format', control: fmtSel })),
      h('div', { class: 'switch-row', style: 'margin-bottom:6px' }, lock),
      actionsRow(btn({ label: 'Resize', icon: 'crop', onClick: run })),
      status, preview,
      privacyNote('Processed locally, never uploaded. Canvas output may discard metadata and animation. JPEG flattens transparency onto white. Output is limited to 16,384 px per side and 40 million pixels; input is limited to 100 MiB.'));
  },

  'image-converter'(root, preset = null) {
    const zone = imageZone({ accept: 'image/*', title: 'Choose an image or drop it here', sub: 'JPG, PNG, WebP, GIF, BMP — converted locally' });
    const fmtSel = select({ options: [{ v: 'png', t: 'PNG' }, { v: 'jpeg', t: 'JPEG' }, { v: 'webp', t: 'WebP' }], value: 'png' });
    if (preset) fmtSel.value = preset;
    const bgPicker = input({ type: 'color', value: '#ffffff' });
    const bgRow = field({ label: 'Background (for transparent → JPEG)', control: bgPicker });
    bgRow.hidden = fmtSel.value !== 'jpeg';
    fmtSel.addEventListener('change', () => { bgRow.hidden = fmtSel.value !== 'jpeg'; });
    const status = statusLine('Choose an image to begin.');
    const info = h('p', { class: 'hint' });
    const preview = h('div', {}), previews = previewManager(preview);
    let revision = 0, selectionRevision = 0;
    let file = null, lastBlob = null;
    zone.addEventListener('iht-files', async (e) => {
      const f = e.detail[0];
      if (!f) return;
      const loadToken = ++selectionRevision; revision++; file = f; lastBlob = null; previews.clear(); info.textContent = '';
      zone.classList.add('has-file');
      zone.replaceChildren(filePill(f), h('span', { class: 'hint', text: 'Click to choose a different file' }), zone.querySelector('input[type=file]'));
      try {
        const t = await checkDecodable(f);
        if (file !== f || selectionRevision !== loadToken) return;
        info.textContent = `Detected format: ${t.toUpperCase()}.`;
        status.set(preset ? `Loaded ${f.name}. Click Convert to ${EXT_BY_FMT[preset].toUpperCase()}.` : `Loaded ${f.name}. Choose the output format.`, 'info');
      } catch (err) { if (file === f && selectionRevision === loadToken) { file = null; status.set(err.message, 'error'); } }
    });
    [fmtSel, bgPicker].forEach((el) => { for (const type of ['input', 'change']) el.addEventListener(type, () => { revision++; previews.clear(); status.set('Settings changed. Run the tool again for a new output.', 'info'); }); });
    const run = async () => {
      if (!file) { status.set('Choose an image first.', 'warning'); return; }
      status.set('Converting…', 'info');
      const selected = file, format = fmtSel.value, token = ++revision;
      try {
        await checkDecodable(selected);
        const img = await loadImage(selected);
        if (file !== selected || revision !== token) return;
        validateCanvasSize(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (format === 'jpeg') { ctx.fillStyle = bgPicker.value; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.drawImage(img, 0, 0);
        const blob = await canvasToBlob(canvas, MIME_BY_FMT[format], 0.92);
        if (file !== selected || revision !== token) return;
        lastBlob = blob;
        previews.show(blob, (url) => h('div', {},
          h('img', { class: 'img-preview', src: url, alt: 'Converted preview', style: 'margin-top:12px' }),
          h('div', { style: 'margin-top:10px' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { downloadImage(blob, `${baseName(selected.name)}.${EXT_BY_FMT[format]}`); } }, `Download ${format.toUpperCase()}`))));
        status.set(`Converted ${selected.name} → ${format.toUpperCase()} (${fmtBytes(blob.size)}) ✓`, 'success');
      } catch (e) { if (file === selected && revision === token) { previews.clear(); status.set(e.message, 'error'); } }
    };
    root.append(zone, info,
      h('div', { class: 'field-row', style: 'margin-top:14px;align-items:end' },
        preset ? field({ label: 'Output format', control: h('p', { class: 'hint', text: `${EXT_BY_FMT[preset].toUpperCase()} — fixed on this page. Need another format? Use the Image Converter tool.`, style: 'margin:8px 0' }) }) : field({ label: 'Convert to', control: fmtSel }),
        bgRow),
      actionsRow(btn({ label: preset ? `Convert to ${EXT_BY_FMT[preset].toUpperCase()}` : 'Convert', icon: 'swap', onClick: run })),
      status, preview,
      privacyNote('Processed locally, never uploaded. Canvas output may discard metadata and animation; JPEG flattens transparency onto the chosen background. Output is limited to 16,384 px per side and 40 million pixels; input is limited to 100 MiB.'));
  },

  // Preset landing pages — same converter, output format locked.
  'jpg-to-png'(root) { defs['image-converter'](root, 'png'); },
  'png-to-jpg'(root) { defs['image-converter'](root, 'jpeg'); },
  'webp-to-png'(root) { defs['image-converter'](root, 'png'); },
  'jpg-to-webp'(root) { defs['image-converter'](root, 'webp'); },

  'image-cropper'(root) {
    const zone = imageZone({ accept: 'image/*', title: 'Choose an image or drop it here', sub: 'Cropped locally — never uploaded' });
    const aspect = segControl({ options: [{ v: 'free', t: 'Free' }, { v: '1', t: '1:1' }, { v: '4/3', t: '4:3' }, { v: '16/9', t: '16:9' }], value: 'free', ariaLabel: 'Aspect ratio' });
    const status = statusLine('Choose an image, then drag a selection on the preview.');
    const stage = h('div', { class: 'cropper-stage' });
    const canvas = document.createElement('canvas');
    stage.append(canvas);
    const preview = h('div', {}), previews = previewManager(preview);
    let revision = 0, selectionRevision = 0;
    let file = null, img = null, sel = null, dragging = false, startX = 0, startY = 0;
    let dispScale = 1;
    zone.addEventListener('iht-files', async (e) => {
      const f = e.detail[0];
      if (!f) return;
      const loadToken = ++selectionRevision; revision++; file = f; img = null; sel = null; previews.clear(); canvas.width = 0; canvas.height = 0;
      zone.classList.add('has-file');
      zone.replaceChildren(filePill(f), h('span', { class: 'hint', text: 'Click to choose a different file' }), zone.querySelector('input[type=file]'));
      try {
        await checkDecodable(file);
        const loaded = await loadImage(f);
        if (file !== f || selectionRevision !== loadToken) return;
        img = loaded;
        if (!img.naturalWidth || !img.naturalHeight) throw new Error('Image dimensions could not be read.');
        dispScale = Math.min(1, 900 / img.naturalWidth, 900 / img.naturalHeight);
        canvas.width = Math.max(1, Math.round(img.naturalWidth * dispScale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * dispScale));
        draw();
        sel = null;
        status.set(`Loaded ${img.naturalWidth} × ${img.naturalHeight} px. Drag on the image to select a crop area.`, 'info');
      } catch (err) { if (file === f && selectionRevision === loadToken) { file = null; img = null; status.set(err.message, 'error'); } }
    });
    function draw() {
      if (!img) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (sel) {
        ctx.fillStyle = 'rgba(8,10,16,0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sel.x / dispScale, sel.y / dispScale, sel.w / dispScale, sel.h / dispScale, sel.x, sel.y, sel.w, sel.h);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h);
      }
    }
    function applyAspect(s) {
      if (!img || !s || aspect.getValue() === 'free') return s;
      const [rw, rh] = aspect.getValue() === '1' ? [1, 1] : aspect.getValue().split('/').map(Number);
      const ratio = rw / rh;
      let w = s.w, hh = Math.round(w / ratio);
      if (hh > s.h) { hh = s.h; w = Math.round(hh * ratio); }
      return { ...s, w, h: hh };
    }
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: Math.max(0, Math.min(canvas.width, (e.clientX - r.left) * (canvas.width / r.width))), y: Math.max(0, Math.min(canvas.height, (e.clientY - r.top) * (canvas.height / r.height))) };
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (!img) return;
      revision++; previews.clear();
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      const p = pos(e);
      startX = p.x; startY = p.y;
      sel = applyAspect({ x: p.x, y: p.y, w: 1, h: 1 });
      draw();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging || !img) return;
      const p = pos(e);
      sel = applyAspect({
        x: Math.min(startX, p.x), y: Math.min(startY, p.y),
        w: Math.abs(p.x - startX), h: Math.abs(p.y - startY),
      });
      draw();
    });
    canvas.addEventListener('pointerup', () => {
      dragging = false;
      if (sel && (sel.w < 4 || sel.h < 4)) { sel = null; draw(); return; }
      if (sel) status.set(`Selection: ${Math.round(sel.w / dispScale)} × ${Math.round(sel.h / dispScale)} px. Click Crop to cut it.`, 'info');
    });
    aspect.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setTimeout(() => {
      if (sel && img) {
        sel = applyAspect(sel);
        sel.x = Math.min(sel.x, canvas.width - sel.w);
        sel.y = Math.min(sel.y, canvas.height - sel.h);
        draw();
      }
    }, 0)));
    [aspect].forEach((el) => { for (const type of ['click']) el.addEventListener(type, () => { revision++; previews.clear(); status.set('Settings changed. Run the tool again for a new output.', 'info'); }); });
    const run = async () => {
      if (!file || !img) { status.set('Choose an image first.', 'warning'); return; }
      if (!sel || sel.w < 4 || sel.h < 4) { status.set('Drag a selection on the image first.', 'warning'); return; }
      status.set('Cropping…', 'info');
      const selected = file, token = ++revision;
      try {
        const sx = sel.x / dispScale, sy = sel.y / dispScale, sw = sel.w / dispScale, sh = sel.h / dispScale;
        const out = document.createElement('canvas');
        const width = Math.max(1, Math.round(sw)), height = Math.max(1, Math.round(sh));
        validateCanvasSize(width, height);
        out.width = width; out.height = height;
        out.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
        const blob = await canvasToBlob(out, 'image/png');
        if (file !== selected || revision !== token) return;
        previews.show(blob, (url) => h('div', {},
          h('img', { class: 'img-preview', src: url, alt: 'Cropped preview', style: 'margin-top:12px' }),
          h('div', { style: 'margin-top:10px' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { downloadImage(blob, `cropped-${baseName(selected.name)}.png`); } }, `Download ${out.width} × ${out.height} PNG`))));
        status.set(`Cropped to ${out.width} × ${out.height} px ✓`, 'success');
      } catch (e) { if (file === selected && revision === token) status.set(e.message, 'error'); }
    };
    root.append(zone, h('div', { class: 'field-row', style: 'margin-top:14px;align-items:end' }, field({ label: 'Aspect ratio', control: aspect })),
      actionsRow(btn({ label: 'Crop', icon: 'crop', onClick: run })),
      status, h('br'), stage, preview,
      privacyNote('Processed locally, never uploaded. Canvas output may discard metadata and animation. Output is limited to 16,384 px per side and 40 million pixels; input is limited to 100 MiB.'));
  },

  'image-metadata-viewer'(root) {
    const zone = imageZone({ accept: 'image/jpeg,image/png,image/*', title: 'Choose a JPEG or PNG', sub: 'Parsed locally — the file is never uploaded' });
    const status = statusLine('Everything is decoded in your browser.');
    const out = h('div', { class: 'tool-docs', style: 'margin-top:16px' });
    let currentFile = null, revision = 0;
    zone.addEventListener('iht-files', async (e) => {
      const f = e.detail[0];
      if (!f) return;
      const token = ++revision; currentFile = f;
      zone.classList.add('has-file');
      zone.replaceChildren(filePill(f), h('span', { class: 'hint', text: 'Click to choose a different file' }), zone.querySelector('input[type=file]'));
      out.replaceChildren();
      status.set(`Analysing ${f.name}…`, 'info');
      try {
        if (f.size > 100 * 1024 * 1024) throw new Error('Choose an image no larger than 100 MiB.');
        const buf = await readFile(f, 'buffer');
        const meta = parseImageMetadata(buf);
        const img = await loadImage(f);
        if (currentFile !== f || revision !== token) return;
        const summary = [
          ['File name', f.name], ['File size', fmtBytes(f.size)],
          ['Dimensions', `${img.naturalWidth} × ${img.naturalHeight} px`],
          ['Format', (meta.type || 'unknown').toUpperCase()],
          ['Last modified', new Date(f.lastModified).toLocaleString()],
        ];
        out.append(
          h('section', { class: 'result-panel' }, h('div', { class: 'result-head' }, h('span', { class: 'result-label', text: 'Summary' })), h('div', { class: 'result-body', tabindex: '0', role: 'region', 'aria-label': 'Result details' }, table({ headers: ['Property', 'Value'], rows: summary }))));
        if (meta.summary?.length) out.append(h('section', {}, h('h3', { text: 'Parsed metadata', style: 'margin:20px 0 10px' }), table({ headers: ['Property', 'Value'], rows: meta.summary })));
        if (meta.exif && Object.keys(meta.exif).length) {
          for (const [group, entries] of Object.entries(meta.exif)) {
            if (!entries || !Object.keys(entries).length) continue;
            const rows = Object.entries(entries).map(([k, v]) => {
              let val = Array.isArray(v) ? v.map((x) => Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x).join(', ') : String(v);
              if ((k === 'GPSLatitude' || k === 'GPSLongitude') && Array.isArray(v)) val = `${v.map(n => Number.isFinite(n) ? Number(n.toPrecision(10)) : n).join(', ')} (degrees, minutes, seconds)`;
              if (k === 'ExposureTime' && Number.isFinite(v)) val = v < 1 ? `1/${Math.round(1 / v)} s` : `${v} s`;
              if (k === 'FNumber' && Number.isFinite(v)) val = `f/${Math.round(v * 100) / 100}`;
              return [k, val];
            });
            out.append(h('section', {}, h('h3', { text: group, style: 'margin:20px 0 10px' }), table({ headers: ['Tag', 'Value'], rows })));
          }
        } else if (meta.type === 'jpeg') {
          out.append(h('p', { class: 'hint', style: 'margin-top:14px', text: 'No readable JPEG EXIF tags were displayed. This does not establish that the image contains no metadata.' }));
        }
        if (meta.type === 'png' && meta.chunks?.length) {
          out.append(h('section', {}, h('h3', { text: 'PNG chunks', style: 'margin:20px 0 10px' }), table({ headers: ['Chunk', 'Size', 'Purpose'], rows: meta.chunks })));
        }
        status.set(`Analysed ${f.name} locally ✓`, 'success');
      } catch (err) { if (currentFile === f && revision === token) status.set(err.message, 'error'); }
    });
    root.append(zone, status, out,
      privacyNote('Read locally, without uploading. This partial viewer reads selected tags from the first JPEG EXIF block and lists PNG chunks; it does not decode PNG EXIF, XMP, IPTC, all tags or other formats. A missing result does not mean metadata or location is absent. It does not remove metadata.'));
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { computeTargetDims, clampQuality, sniffImageType, baseName, parseImageMetadata, MIME_BY_FMT };
