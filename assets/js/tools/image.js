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

// Fit inside optional bounds without cropping; no bounds retain original size.
export function fitInside(w, h, maxWidth, maxHeight, upscale = false) {
  if (![w, h].every(n => Number.isSafeInteger(n) && n > 0) || ![maxWidth, maxHeight].every(n => n == null || (Number.isSafeInteger(n) && n > 0))) throw new Error('Dimensions must be positive whole numbers.');
  const scale = maxWidth == null && maxHeight == null ? 1 : Math.min(maxWidth == null ? Infinity : maxWidth / w, maxHeight == null ? Infinity : maxHeight / h, upscale ? Infinity : 1);
  return { width: Math.max(1, Math.min(maxWidth ?? Infinity, Math.round(w * scale))), height: Math.max(1, Math.min(maxHeight ?? Infinity, Math.round(h * scale))) };
}
// Center a proportionally fitted image on a fixed canvas, without cropping.
export function paddedLayout(w, h, canvasWidth, canvasHeight, upscale = false) {
  if (![canvasWidth, canvasHeight].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Both canvas dimensions are required.');
  const image = fitInside(w, h, canvasWidth, canvasHeight, upscale);
  return { width: canvasWidth, height: canvasHeight, imageWidth: image.width, imageHeight: image.height,
    x: Math.floor((canvasWidth - image.width) / 2), y: Math.floor((canvasHeight - image.height) / 2) };
}
export function sizeChange(original, output) {
  if (!Number.isSafeInteger(original) || original <= 0 || !Number.isSafeInteger(output) || output < 0) throw new Error('Invalid file size.');
  if (original === output) return 'Unchanged';
  const pct = Math.abs((output - original) / original * 100);
  return `${pct < 0.1 ? '<0.1' : pct.toFixed(1)}% ${output < original ? 'smaller' : 'larger'}`;
}
// Search integer encoder qualities, retaining only blobs actually at/below target.
// Encoded size is not guaranteed monotonic; this is best effort, not a global optimum.
export async function encodeToTarget(encode, targetBytes, isCurrent = () => true) {
  if (!Number.isSafeInteger(targetBytes) || targetBytes < 1) throw new Error('Invalid target size.');
  let best = null;
  const sample = async quality => {
    if (!isCurrent()) throw new Error('Cancelled');
    const blob = await encode(quality / 100);
    if (!isCurrent()) throw new Error('Cancelled');
    if (!blob || !Number.isSafeInteger(blob.size)) throw new Error('Encoder did not return an image.');
    if (blob.size <= targetBytes && (!best || quality > best.quality)) best = { blob, quality };
    return blob.size <= targetBytes;
  };
  if (await sample(100)) return best;
  if (!await sample(5)) throw new Error('No tested quality met the target at these dimensions. Try a larger target or smaller dimensions.');
  let low = 5, high = 100;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (await sample(middle)) low = middle; else high = middle;
  }
  return best;
}
export function batchFilename(name, index, fmt, prefix = '') {
  if (!Object.hasOwn(EXT_BY_FMT, fmt) || !Number.isSafeInteger(index) || index < 1) throw new Error('Invalid output name.');
  if (!/^[A-Za-z0-9_-]{0,40}$/.test(prefix)) throw new Error('Prefix must use at most 40 letters, numbers, hyphens or underscores.');
  const clean = baseName(name).normalize('NFC').replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g, '_').replace(/^\.+/, '').replace(/[. ]+$/, '');
  let stem = '', bytes = 0;
  for (let ch of clean) {
    if (ch.length === 1 && /[\uD800-\uDFFF]/.test(ch)) ch = '_';
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > 180 || [...stem].length >= 80) break;
    stem += ch; bytes += n;
  }
  return `${String(index).padStart(3, '0')}-${prefix ? `${prefix}-` : ''}${stem || 'image'}.${EXT_BY_FMT[fmt]}`;
}

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
    if (!t || !allowed.includes(t)) throw new Error(`“${file.name}” does not look like a supported image${t ? ` (detected: ${t})` : ''}. Supported: ${allowed.map(x => x === 'jpeg' ? 'JPG' : x.toUpperCase()).join(', ')}.`);
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
  zone = dropzone({ ...options, onFiles: (files) => { zone.dispatchEvent(new window.CustomEvent('iht-files', { detail: files })); zone.querySelector('input[type=file]').value = ''; }, onReject: () => zone.dispatchEvent(new window.CustomEvent('iht-rejected')) });
  zone.resetSelectionUI = () => { zone.replaceChildren(h('span', { class: 'dz-title', text: options.title || 'Choose an image' }), zone.querySelector('input[type=file]')); zone.clear(); };
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
    zone.addEventListener('iht-rejected', () => { revision++; file = null; lastBlob = null; grid.replaceChildren(); previews.clear(); zone.resetSelectionUI(); status.set('Selection rejected. Choose an image no larger than 100 MiB.', 'error'); });
    window.addEventListener('pagehide', () => { revision++; previews.clear(); }, { once: true });
    [quality, fmtSel, maxW].forEach((el) => { for (const type of ['input', 'change']) el.addEventListener(type, () => { revision++; grid.replaceChildren(); previews.clear(); status.set('Settings changed. Run the tool again for a new output.', 'info'); }); });
    const run = async () => {
      if (!file) { status.set('Choose an image first.', 'warning'); return; }
      previews.clear(); grid.replaceChildren();
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

  'bulk-image-resizer'(root) {
    const zone = imageZone({ accept: 'image/jpeg,image/png,image/webp,image/gif,image/bmp', multiple: true, title: 'Choose images or drop them here', sub: 'Up to 20 images, 20 MiB each and 100 MiB total' });
    const width = input({ type: 'number', min: 1, max: 4096, value: '1200' });
    const height = input({ type: 'number', min: 1, max: 4096, value: '1200' });
    const format = select({ options: [{ v: 'jpeg', t: 'JPEG' }, { v: 'png', t: 'PNG' }, { v: 'webp', t: 'WebP' }], value: 'jpeg' });
    const layout = select({ options: [{ v: 'fit', t: 'Fit within bounds (no padding)' }, { v: 'white', t: 'Exact canvas with white padding' }, { v: 'transparent', t: 'Exact canvas with transparent padding' }], value: 'fit' });
    const quality = input({ type: 'number', min: 5, max: 100, value: '85' });
    const target = input({ type: 'number', min: 1, max: 51200, step: 1, placeholder: 'optional' });
    const prefix = input({ type: 'text', maxlength: 40, placeholder: 'optional, e.g. product' });
    const watermark = input({ type: 'text', maxlength: 80, placeholder: 'Optional text' });
    const watermarkPosition = select({ options: [{v:'bottom-right',t:'Bottom right'}, {v:'bottom-left',t:'Bottom left'}, {v:'top-right',t:'Top right'}, {v:'top-left',t:'Top left'}, {v:'center',t:'Center'}], value:'bottom-right' });
    const watermarkSize = input({ type: 'number', min: 2, max: 20, value: '8' });
    const watermarkOpacity = input({ type: 'number', min: 1, max: 100, value: '70' });
    const watermarkColor = select({ options: [{v:'white',t:'White'}, {v:'black',t:'Black'}], value:'white' });
    const upscale = switchChip({ label: 'Allow enlargement', checked: false });
    const rotation = select({ options: [{v:'0',t:'No rotation'}, {v:'90',t:'90° clockwise'}, {v:'180',t:'180°'}, {v:'270',t:'90° counterclockwise'}], value:'0' });
    const flipX = switchChip({ label:'Flip horizontally', checked:false });
    const flipY = switchChip({ label:'Flip vertically', checked:false });
    const status = statusLine('Choose images to begin.');
    const list = h('div', {}), results = h('div', {}), preview = h('div', {}), previews = previewManager(preview);
    let files = [], revision = 0, archive = null;
    const invalidate = () => { revision++; archive = null; results.replaceChildren(); previews.clear(); download.disabled = true; };
    const runButton = btn({ label: 'Process images', icon: 'crop', onClick: () => run() });
    const cancel = btn({ label: 'Cancel', variant: 'secondary', onClick: () => { invalidate(); status.set('Cancelled. No partial ZIP is available.', 'info'); } });
    const download = btn({ label: 'Download ZIP', variant: 'secondary', disabled: true, onClick: () => {
      if (!archive) return;
      const ok = downloadBlob(archive, 'resized-images.zip');
      status.set(ok ? 'ZIP download requested.' : 'Could not request the ZIP download.', ok ? 'success' : 'error');
    } });
    const renderQueue = () => {
      if (!files.length) { list.replaceChildren(); return; }
      const queue = h('ol', { class: 'file-list', 'aria-label': 'Selected images', style: 'list-style:none;padding:0' });
      files.forEach((f, i) => {
        let preview;
        try { preview = batchFilename(f.name, i + 1, format.value, prefix.value); }
        catch { preview = 'Enter a valid prefix to preview names.'; }
        const action = (label, disabled, fn) => h('button', { type: 'button', class: 'btn btn-secondary btn-sm', disabled, 'aria-label': `${label} ${i + 1}: ${f.name}`, onclick: fn }, label);
        const update = (next, msg) => { invalidate(); files = next; zone.clear(); renderQueue(); status.set(msg, 'info'); const row = list.querySelectorAll('li')[Math.min(i, files.length - 1)]; (row?.querySelector('button:not(:disabled)') || zone.querySelector('input[type=file]'))?.focus(); };
        queue.append(h('li', { class: 'file-row', style: 'flex-wrap:wrap' },
          h('div', { style: 'flex:1 1 180px;min-width:0;overflow-wrap:anywhere' },
            h('strong', { text: `${i + 1}. ${f.name}` }), h('div', { class: 'hint', text: `${fmtBytes(f.size)} → ${preview}` })),
          h('div', { class: 'fr-actions', style: 'flex-wrap:wrap;max-width:100%' },
            action('Move up', i === 0, () => { const next=files.slice(); [next[i-1],next[i]]=[next[i],next[i-1]]; update(next, 'Image moved. Process again for a new ZIP.'); }),
            action('Move down', i === files.length-1, () => { const next=files.slice(); [next[i],next[i+1]]=[next[i+1],next[i]]; update(next, 'Image moved. Process again for a new ZIP.'); }),
            action('Remove', false, () => update(files.filter((_, index) => index !== i), 'Image removed. Process again for a new ZIP.')))));
      });
      list.replaceChildren(h('p', { class: 'hint', text: 'Selection order determines numbering. New selections replace this list.' }), queue,
        btn({ label: 'Clear selected images', variant: 'secondary', onClick: () => { invalidate(); files=[]; zone.clear(); renderQueue(); status.set('Selection cleared.', 'info'); zone.querySelector('input[type=file]')?.focus(); } }));
    };
    zone.addEventListener('iht-rejected', () => { invalidate(); files = []; zone.clear(); list.replaceChildren(); status.set('Selection rejected. Choose files within the batch limits.', 'error'); });
    zone.addEventListener('iht-files', e => {
      invalidate(); files = []; zone.clear(); list.replaceChildren();
      const selected = e.detail;
      if (selected.length > 20 || selected.some(f => f.size > 20 * 1024 * 1024) || selected.reduce((sum, f) => sum + f.size, 0) > 100 * 1024 * 1024) {
        status.set('Select at most 20 images, 20 MiB each and 100 MiB total.', 'error'); return;
      }
      files = selected.slice();
      renderQueue();
      status.set(`${files.length} images selected. Set size and quality, then process.`, 'info');
    });
    for (const el of [width, height, format, layout, quality, target, prefix, upscale, rotation, flipX, flipY, watermark, watermarkPosition, watermarkSize, watermarkOpacity, watermarkColor]) for (const ev of (el === prefix ? ['input'] : ['input', 'change'])) el.addEventListener(ev, () => { invalidate(); if (el === format || el === prefix) renderQueue(); status.set('Settings changed. Process again to create a new ZIP.', 'info'); });
    window.addEventListener('pagehide', invalidate);
    async function run() {
      invalidate();
      if (!files.length) { status.set('Choose images first.', 'warning'); return; }
      const w = width.value === '' ? null : Number(width.value), h0 = height.value === '' ? null : Number(height.value), q = Number(quality.value), fmt = format.value;
      if (![w, h0].every(n => n == null || (Number.isSafeInteger(n) && n >= 1 && n <= 4096))) { status.set('Maximum dimensions must be blank or whole numbers from 1 to 4096.', 'error'); return; }
      if (!/^[A-Za-z0-9_-]{0,40}$/.test(prefix.value)) { status.set('Prefix must use at most 40 letters, numbers, hyphens or underscores.', 'error'); return; }
      const namingPrefix = prefix.value;
      const mode = layout.value;
      if (!['fit', 'white', 'transparent'].includes(mode)) { status.set('Choose a supported layout.', 'error'); return; }
      if (mode !== 'fit' && (w == null || h0 == null)) { status.set('Exact canvas requires both width and height.', 'error'); return; }
      if (mode === 'transparent' && fmt === 'jpeg') { status.set('Transparent padding requires PNG or WebP output; JPEG cannot preserve transparency.', 'error'); return; }
      const targetKiB = target.value === '' ? null : Number(target.value);
      if (targetKiB != null && (!Number.isSafeInteger(targetKiB) || targetKiB < 1 || targetKiB > 51200)) { status.set('Target must be a whole number from 1 to 51200 KiB.', 'error'); return; }
      if (targetKiB != null && fmt === 'png') { status.set('Target size is available for JPEG and WebP only; PNG ignores quality.', 'error'); return; }
      if (!MIME_BY_FMT[fmt] || (targetKiB == null && (!quality.value || !Number.isFinite(q) || q < 5 || q > 100))) { status.set('Quality must be between 5 and 100 and the format must be supported.', 'error'); return; }
      const deg = Number(rotation.value), horizontal = flipX.querySelector('input').checked, vertical = flipY.querySelector('input').checked;
      if (![0,90,180,270].includes(deg)) { status.set('Choose a valid rotation.', 'error'); return; }
      const text = watermark.value.trim(), position = watermarkPosition.value, fontPct = Number(watermarkSize.value), opacity = Number(watermarkOpacity.value), color = watermarkColor.value;
      if (text && (text.length > 80 || /[\x00-\x1f\x7f]/.test(text) || !['bottom-right','bottom-left','top-right','top-left','center'].includes(position) || !['white','black'].includes(color) || !Number.isFinite(fontPct) || fontPct < 2 || fontPct > 20 || !Number.isFinite(opacity) || opacity < 1 || opacity > 100)) { status.set('Watermark needs one line of up to 80 characters, size 2–20% and opacity 1–100%.', 'error'); return; }
      const token = revision, selected = files.slice(), enlarge = upscale.querySelector('input').checked;
      const entries = {}, rows = []; let total = 0, totalOriginal = 0, larger = 0, successes = 0, firstPreview = null;
      status.set('Preparing image tools…', 'info');
      try {
        const { zipSync } = await import('../../vendor/fflate.js');
        if (revision !== token) return;
        for (let i = 0; i < selected.length; i++) {
          if (revision !== token) return;
          const f = selected[i]; status.set(`Processing ${i + 1} of ${selected.length}…`, 'info');
          let canvas;
          try {
            await checkDecodable(f);
            if (revision !== token) return;
            const img = await loadImage(f);
            if (revision !== token) return;
            const rotatedW = deg % 180 ? img.naturalHeight : img.naturalWidth, rotatedH = deg % 180 ? img.naturalWidth : img.naturalHeight;
            const fit = mode === 'fit' ? fitInside(rotatedW, rotatedH, w, h0, enlarge) : null;
            const dims = fit ? { ...fit, imageWidth: fit.width, imageHeight: fit.height, x: 0, y: 0 } : paddedLayout(rotatedW, rotatedH, w, h0, enlarge);
            validateCanvasSize(dims.width, dims.height);
            canvas = document.createElement('canvas'); canvas.width = dims.width; canvas.height = dims.height;
            const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable.');
            ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
            if (fmt === 'jpeg' || mode === 'white') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dims.width, dims.height); }
            if (!deg && !horizontal && !vertical) ctx.drawImage(img, dims.x, dims.y, dims.imageWidth, dims.imageHeight);
            else {
              ctx.translate(dims.x + dims.imageWidth / 2, dims.y + dims.imageHeight / 2);
              ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1); ctx.rotate(deg * Math.PI / 180);
              const drawW = deg % 180 ? dims.imageHeight : dims.imageWidth, drawH = deg % 180 ? dims.imageWidth : dims.imageHeight;
              ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            }
            if (text) {
              // Draw in output coordinates after rotation, mirror and padding.
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              const size = Math.max(1, Math.min(dims.width, dims.height) * fontPct / 100);
              const marginX = dims.width * 0.05, marginY = dims.height * 0.05;
              ctx.globalAlpha = opacity / 100; ctx.fillStyle = color;
              ctx.font = `bold ${size}px sans-serif`; ctx.textBaseline = 'middle';
              ctx.textAlign = position === 'center' ? 'center' : position.endsWith('left') ? 'left' : 'right';
              const x = position === 'center' ? dims.width / 2 : position.endsWith('left') ? marginX : dims.width - marginX;
              const y = position === 'center' ? dims.height / 2 : position.startsWith('top') ? marginY + size / 2 : dims.height - marginY - size / 2;
              ctx.fillText(text, x, y, dims.width * 0.9);
              ctx.globalAlpha = 1;
            }
            const choice = targetKiB == null ? { blob: await canvasToBlob(canvas, MIME_BY_FMT[fmt], fmt === 'png' ? undefined : q / 100) } : await encodeToTarget(qualityValue => canvasToBlob(canvas, MIME_BY_FMT[fmt], qualityValue), targetKiB * 1024, () => revision === token);
            const blob = choice.blob;
            if (revision !== token) return;
            if (total + blob.size > 50 * 1024 * 1024) throw new Error('Output limit of 50 MiB reached; use a smaller batch.');
            const bytes = new Uint8Array(await blob.arrayBuffer());
            if (revision !== token) return;
            total += bytes.length; totalOriginal += f.size; if (blob.size > f.size) larger++;
            const name = batchFilename(f.name, i + 1, fmt, namingPrefix); entries[name] = bytes; successes++;
            if (!firstPreview) firstPreview = { blob, name: f.name };
            rows.push([f.name, `${dims.width} × ${dims.height}`, fmtBytes(f.size), fmtBytes(blob.size), sizeChange(f.size, blob.size), targetKiB == null ? name : `${name} — target met at quality ${choice.quality}%`]);
          } catch (err) { if (revision !== token) return; rows.push([f.name, 'Failed', fmtBytes(f.size), '—', '—', err.message]); }
          finally { if (canvas) { canvas.width = 0; canvas.height = 0; } }
        }
        if (!successes) { results.replaceChildren(table({ headers: ['File', 'Dimensions', 'Original', 'Output', 'Change', 'Result'], rows })); status.set('No images succeeded. Check the individual errors.', 'error'); return; }
        const zip = zipSync(entries, { level: 0 });
        if (revision !== token) return;
        archive = new Blob([zip], { type: 'application/zip' });
        results.replaceChildren(h('p', { class: 'hint', text: `Successful image files: ${fmtBytes(totalOriginal)} → ${fmtBytes(total)} (${sizeChange(totalOriginal, total)}). ${larger} output${larger === 1 ? '' : 's'} larger than the original. ZIP overhead is not included.` }), table({ headers: ['File', 'Dimensions', 'Original', 'Output', 'Change', 'Result'], rows }));
        previews.show(firstPreview.blob, url => h('div', {}, h('p', {class:'hint', text:`Preview of first successful output: ${firstPreview.name}`}), h('img', {class:'img-preview', src:url, alt:'First processed image preview'})));
        download.disabled = false;
        status.set(`${successes} of ${selected.length} images ready in ZIP. ${selected.length - successes} failed.`, successes === selected.length ? 'success' : 'warning');
      } catch (err) { if (revision === token) status.set(`Could not create ZIP: ${err.message}`, 'error'); }
    }
    root.append(zone, list, h('div', { class: 'field-row', style: 'margin-top:14px' },
      field({ label: 'Maximum width (px)', control: width, hint: 'Blank means no width limit.' }), field({ label: 'Maximum height (px)', control: height, hint: 'Blank means no height limit; clear both to keep original dimensions.' }),
      field({ label: 'Layout', control: layout, hint: 'Exact canvas needs both dimensions; image is centered without cropping.' }), field({ label: 'Output format', control: format }), field({ label: 'Quality (5–100)', control: quality, hint: 'PNG ignores quality; target mode chooses quality automatically.' }),
      field({ label: 'Target per image (KiB)', control: target, hint: 'Optional, whole KiB (1 KiB = 1024 bytes). JPEG/WebP only; searches quality 5–100 at selected dimensions.' }),
      field({ label: 'Filename prefix', control: prefix, hint: 'Optional: up to 40 ASCII letters, numbers, hyphens or underscores.' })),
      h('div', { class: 'field-row' }, field({label:'Rotate all images', control:rotation, hint:'Applied before resizing and padding.'}), field({label:'Mirror after rotation',control:flipX}), field({label:'',control:flipY})),
      h('div', { class: 'field-row' }, field({label:'Watermark text', control:watermark, hint:'Optional; single line up to 80 characters.'}), field({label:'Watermark position', control:watermarkPosition}), field({label:'Watermark size (% of shorter side)', control:watermarkSize}), field({label:'Watermark opacity (%)', control:watermarkOpacity}), field({label:'Watermark color', control:watermarkColor})),
      upscale, actionsRow(runButton, cancel, download), status, preview, results,
      privacyNote('Images are processed locally, not uploaded. Optional text is drawn on the final output after rotation and padding; fonts vary by browser, and watermarks do not prevent copying. Check the first output preview and inspect the rest. The chosen rotation and output-axis mirrors apply to every image before resizing and padding; preview individual photos to choose appropriate settings. Fit mode uses optional bounds; clear both to retain original dimensions. Exact canvas centers the full image with white or transparent padding, without cropping. JPEG cannot preserve transparency. Outputs are not guaranteed to be smaller; rounding affects aspect ratio. A target may fail at the selected dimensions; try a larger target or smaller dimensions. Target mode uses lossy quality and tests a limited set of values. JPEG uses a white background; canvas output may remove metadata or animation. Browser decoding can use substantial memory before dimensions are known. Output must be at most 16,384 px per side and 40 million pixels; ZIP image payload is capped at 50 MiB. Device limits may be lower.'));
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
    zone.addEventListener('iht-rejected', () => { revision++; selectionRevision++; file = null; img = null; lastBlob = null; info.textContent = ''; wIn.placeholder = 'width'; hIn.placeholder = 'height'; previews.clear(); zone.resetSelectionUI(); status.set('Selection rejected. Choose an image no larger than 100 MiB.', 'error'); });
    window.addEventListener('pagehide', () => { revision++; selectionRevision++; previews.clear(); }, { once: true });
    zone.addEventListener('iht-files', async (e) => {
      const f = e.detail[0];
      if (!f) return;
      const loadToken = ++selectionRevision; revision++; file = f; img = null; lastBlob = null; previews.clear(); info.textContent = ''; wIn.placeholder = 'width'; hIn.placeholder = 'height';
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
      previews.clear();
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
    const quality = input({type:'number', min:5, max:100, step:1, value:'92'});
    quality.disabled = fmtSel.value === 'png';
    const bgPicker = input({ type: 'color', value: '#ffffff' });
    const bgRow = field({ label: 'Background (for transparent → JPEG)', control: bgPicker });
    bgRow.hidden = fmtSel.value !== 'jpeg';
    fmtSel.addEventListener('change', () => { bgRow.hidden = fmtSel.value !== 'jpeg'; quality.disabled = fmtSel.value === 'png'; });
    const status = statusLine('Choose an image to begin.');
    const info = h('p', { class: 'hint' });
    const preview = h('div', {}), previews = previewManager(preview);
    let revision = 0, selectionRevision = 0;
    let file = null, lastBlob = null;
    zone.addEventListener('iht-rejected', () => { revision++; selectionRevision++; file = null; lastBlob = null; info.textContent = ''; previews.clear(); zone.resetSelectionUI(); status.set('Selection rejected. Choose an image no larger than 100 MiB.', 'error'); });
    window.addEventListener('pagehide', () => { revision++; selectionRevision++; previews.clear(); }, { once: true });
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
    [fmtSel, bgPicker, quality].forEach((el) => { for (const type of ['input', 'change']) el.addEventListener(type, () => { revision++; previews.clear(); status.set('Settings changed. Run the tool again for a new output.', 'info'); }); });
    const run = async () => {
      if (!file) { status.set('Choose an image first.', 'warning'); return; }
      previews.clear();
      const format = fmtSel.value, q = Number(quality.value);
      if (!Object.hasOwn(MIME_BY_FMT, format)) { status.set('Choose a supported output format.', 'error'); return; }
      if (format !== 'png' && (!quality.value || !Number.isInteger(q) || q < 5 || q > 100)) { status.set('Quality must be a whole number from 5 to 100.', 'warning'); return; }
      status.set('Converting…', 'info');
      const selected = file, token = ++revision;
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
        const blob = await canvasToBlob(canvas, MIME_BY_FMT[format], format === 'png' ? undefined : q / 100);
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
        bgRow, field({label:'Quality (5–100)', control:quality, hint:'For JPEG and WebP; PNG ignores quality.'})),
      actionsRow(btn({ label: preset ? `Convert to ${EXT_BY_FMT[preset].toUpperCase()}` : 'Convert', icon: 'swap', onClick: run })),
      status, preview,
      privacyNote('Processed locally, never uploaded. Canvas output may discard metadata and animation; JPEG flattens transparency onto the chosen background. Output is limited to 16,384 px per side and 40 million pixels; input is limited to 100 MiB.'));
  },

  // Preset landing pages — same converter, output format locked.
  'jpg-to-png'(root) { defs['image-converter'](root, 'png'); },
  'png-to-jpg'(root) { defs['image-converter'](root, 'jpeg'); },
  'webp-to-png'(root) { defs['image-converter'](root, 'png'); },
  'jpg-to-webp'(root) { defs['image-converter'](root, 'webp'); },

  'image-rotator'(root) {
    const zone = imageZone({ accept: 'image/jpeg,image/png,image/webp', title: 'Choose a JPG, PNG or WebP image', sub: 'Processed locally — never uploaded' });
    const angle = select({ options: [{v:'0',t:'No rotation'}, {v:'90',t:'90° clockwise'}, {v:'180',t:'180°'}, {v:'270',t:'90° counterclockwise'}], value:'90' });
    const flipX = switchChip({ label:'Flip horizontally', checked:false });
    const flipY = switchChip({ label:'Flip vertically', checked:false });
    const format = select({ options: [{v:'png',t:'PNG'}, {v:'jpeg',t:'JPEG'}, {v:'webp',t:'WebP'}], value:'png' });
    const status = statusLine('Choose an image, select a rotation or mirror, then create a preview.');
    const info = h('p', { class:'hint' });
    const preview = h('div', {}), previews = previewManager(preview);
    let file = null, img = null, selection = 0, operation = 0;
    const invalidate = () => { operation++; previews.clear(); };
    const reset = () => { selection++; invalidate(); file = null; img = null; info.textContent = ''; zone.resetSelectionUI(); };
    zone.addEventListener('iht-rejected', () => { reset(); status.set('Selection rejected. Choose an image no larger than 100 MiB.', 'error'); });
    zone.addEventListener('iht-files', async e => {
      const chosen = e.detail[0]; if (!chosen) return;
      const token = ++selection; invalidate(); file = null; img = null; info.textContent = '';
      status.set('Reading image locally…', 'info');
      try {
        await checkDecodable(chosen, ['jpeg','png','webp']);
        const loaded = await loadImage(chosen); if (selection !== token) return;
        validateCanvasSize(loaded.naturalWidth, loaded.naturalHeight);
        file = chosen; img = loaded;
        zone.classList.add('has-file'); zone.replaceChildren(filePill(chosen), h('span', {class:'hint',text:'Click to choose a different file'}), zone.querySelector('input[type=file]'));
        info.textContent = `Decoded image: ${loaded.naturalWidth} × ${loaded.naturalHeight} px.`;
        status.set('Image ready. Choose settings and create a preview.', 'success');
      } catch (err) { if (selection === token) { zone.resetSelectionUI(); status.set(err.message, 'error'); } }
    });
    [angle, flipX, flipY, format].forEach(el => el.addEventListener('change', () => { invalidate(); status.set('Settings changed. Create a new preview.', 'info'); }));
    window.addEventListener('pagehide', () => { selection++; invalidate(); }, {once:true});
    const run = async () => {
      if (!file || !img) { status.set('Choose a supported image first.', 'warning'); return; }
      invalidate(); const token = operation, selected = file, source = img;
      const deg = Number(angle.value), fmt = format.value, horizontal = flipX.querySelector('input').checked, vertical = flipY.querySelector('input').checked;
      if (![0,90,180,270].includes(deg) || !Object.hasOwn(MIME_BY_FMT, fmt)) { status.set('Choose valid output settings.', 'error'); return; }
      let canvas;
      try {
        const sw = source.naturalWidth, sh = source.naturalHeight;
        const width = deg % 180 ? sh : sw, height = deg % 180 ? sw : sh;
        validateCanvasSize(width, height);
        canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas is unavailable in this browser.');
        if (fmt === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); }
        ctx.translate(width / 2, height / 2); ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1); ctx.rotate(deg * Math.PI / 180);
        ctx.drawImage(source, -sw / 2, -sh / 2); status.set('Creating image locally…', 'info');
        const blob = await canvasToBlob(canvas, MIME_BY_FMT[fmt], .92);
        if (token !== operation || file !== selected) return;
        const name = `rotated-${baseName(selected.name).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0,70) || 'image'}.${EXT_BY_FMT[fmt]}`;
        previews.show(blob, url => h('div', {}, h('img', {class:'img-preview', src:url, alt:'Rotated and mirrored image preview'}),
          h('div', {style:'margin-top:10px'}, h('button', {type:'button',class:'btn btn-primary',onclick:() => downloadImage(blob,name)}, `Download ${width} × ${height} ${fmt.toUpperCase()}`))));
        status.set(`Ready: ${width} × ${height} px, ${fmtBytes(blob.size)}.`, 'success');
      } catch (err) { if (token === operation && file === selected) status.set(err.message, 'error'); }
      finally { if (canvas) { canvas.width = 0; canvas.height = 0; } }
    };
    root.append(zone, info, h('div', {class:'field-row'}, field({label:'Rotation',control:angle}), field({label:'Output format',control:format})),
      h('div', {class:'field-row'}, field({label:'Mirroring after rotation',control:flipX}), field({label:'',control:flipY})),
      actionsRow(btn({label:'Create preview', icon:'image', onClick:run}), btn({label:'Clear image',variant:'ghost',icon:'x',onClick:() => { reset(); status.set('Image cleared.', 'info'); }})),
      status, preview, privacyNote('One JPG, PNG or WebP up to 100 MiB. Output is limited to 16,384 px per side and 40 million pixels. Browser decoding may apply orientation; canvas output can discard metadata, color profiles and animation. JPEG and WebP are re-encoded; JPEG uses a white background.'));
  },

  'image-cropper'(root) {
    const zone = imageZone({ accept: 'image/*', title: 'Choose an image or drop it here', sub: 'Cropped locally — never uploaded' });
    const aspect = segControl({ options: [{ v: 'free', t: 'Free' }, { v: '1', t: '1:1' }, { v: '4/3', t: '4:3' }, { v: '3/2', t: '3:2' }, { v: '16/9', t: '16:9' }, { v: '9/16', t: '9:16' }], value: 'free', ariaLabel: 'Aspect ratio' });
    const status = statusLine('Choose an image, then drag a selection or enter crop coordinates.');
    const xIn = input({ type: 'number', min: 0, step: 1 });
    const yIn = input({ type: 'number', min: 0, step: 1 });
    const widthIn = input({ type: 'number', min: 1, step: 1 });
    const heightIn = input({ type: 'number', min: 1, step: 1 });
    const coords = [xIn, yIn, widthIn, heightIn];
    const format = select({options:[{v:'png',t:'PNG (transparent)'}, {v:'jpeg',t:'JPEG (white background)'}, {v:'webp',t:'WebP (transparent)'}], value:'png'});
    const quality = input({type:'number', min:5, max:100, step:1, value:'90'});
    const stage = h('div', { class: 'cropper-stage' });
    const canvas = document.createElement('canvas');
    stage.append(canvas);
    const preview = h('div', {}), previews = previewManager(preview);
    let revision = 0, selectionRevision = 0;
    let file = null, img = null, sel = null, dragging = false, startX = 0, startY = 0;
    let scaleX = 1, scaleY = 1;
    const clearCrop = () => { coords.forEach(el => { el.value = ''; }); canvas.width = 0; canvas.height = 0; sel = null; dragging = false; };
    zone.addEventListener('iht-rejected', () => { revision++; selectionRevision++; file = null; img = null; clearCrop(); previews.clear(); zone.resetSelectionUI(); status.set('Selection rejected. Choose an image no larger than 100 MiB.', 'error'); });
    window.addEventListener('pagehide', () => { revision++; selectionRevision++; previews.clear(); }, { once: true });
    const fromFields = () => {
      if (!img || coords.some(el => el.value.trim() === '')) return null;
      const [x, y, w, h] = coords.map(el => Number(el.value));
      if (![x,y,w,h].every(Number.isSafeInteger) || x < 0 || y < 0 || w < 1 || h < 1 || x + w > img.naturalWidth || y + h > img.naturalHeight) return null;
      return { x, y, w, h };
    };
    const showFields = () => {
      if (!sel || !img) return;
      const x = Math.max(0, Math.min(img.naturalWidth - 1, Math.round(sel.x / scaleX)));
      const y = Math.max(0, Math.min(img.naturalHeight - 1, Math.round(sel.y / scaleY)));
      const w = Math.max(1, Math.min(img.naturalWidth - x, Math.round(sel.w / scaleX)));
      const h = Math.max(1, Math.min(img.naturalHeight - y, Math.round(sel.h / scaleY)));
      [x,y,w,h].forEach((v,i) => { coords[i].value = String(v); });
      sel = { x:x*scaleX, y:y*scaleY, w:w*scaleX, h:h*scaleY };
    };
    coords.forEach(el => el.addEventListener('input', () => {
      revision++; previews.clear(); const c = fromFields();
      sel = c ? { x:c.x*scaleX, y:c.y*scaleY, w:c.w*scaleX, h:c.h*scaleY } : null;
      draw(); status.set(c ? 'Coordinates updated. Crop to create a new output.' : 'Enter whole-number coordinates within the image.', c ? 'info' : 'warning');
    }));
    zone.addEventListener('iht-files', async (e) => {
      const f = e.detail[0];
      if (!f) return;
      const loadToken = ++selectionRevision; revision++; file = f; img = null; sel = null; previews.clear(); clearCrop();
      zone.classList.add('has-file');
      zone.replaceChildren(filePill(f), h('span', { class: 'hint', text: 'Click to choose a different file' }), zone.querySelector('input[type=file]'));
      try {
        await checkDecodable(file);
        const loaded = await loadImage(f);
        if (file !== f || selectionRevision !== loadToken) return;
        img = loaded;
        if (!img.naturalWidth || !img.naturalHeight) throw new Error('Image dimensions could not be read.');
        const scale = Math.min(1, 900 / img.naturalWidth, 900 / img.naturalHeight);
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        scaleX = canvas.width / img.naturalWidth; scaleY = canvas.height / img.naturalHeight;
        sel = { x:0, y:0, w:canvas.width, h:canvas.height }; showFields(); draw();
        status.set(`Loaded ${img.naturalWidth} × ${img.naturalHeight} px. Drag or enter pixel coordinates.`, 'info');
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
        ctx.drawImage(img, sel.x / scaleX, sel.y / scaleY, sel.w / scaleX, sel.h / scaleY, sel.x, sel.y, sel.w, sel.h);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h);
      }
    }
    function applyAspect(s) {
      if (!img || !s || aspect.getValue() === 'free') return s;
      const [rw, rh] = aspect.getValue() === '1' ? [1, 1] : aspect.getValue().split('/').map(Number);
      const ratio = (rw / rh) * scaleX / scaleY;
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
      if (sel && (sel.w < 4 || sel.h < 4)) { sel = null; coords.forEach(el => { el.value = ''; }); draw(); status.set('Selection is too small. Drag again or enter coordinates.', 'warning'); return; }
      if (sel) { showFields(); draw(); status.set(`Selection: ${widthIn.value} × ${heightIn.value} px. Click Crop to cut it.`, 'info'); }
    });
    canvas.addEventListener('pointercancel', () => { dragging = false; sel = null; coords.forEach(el => { el.value = ''; }); revision++; previews.clear(); draw(); status.set('Selection cancelled. Drag again or enter coordinates.', 'info'); });
    aspect.addEventListener('click', () => {
      revision++; previews.clear();
      if (sel && img) { sel = applyAspect(sel); sel.x = Math.min(sel.x, canvas.width - sel.w); sel.y = Math.min(sel.y, canvas.height - sel.h); showFields(); draw(); }
      status.set('Aspect applied to the current selection. Crop to create a new output.', 'info');
    });
    const settingsChanged = () => { revision++; previews.clear(); quality.disabled = format.value === 'png'; status.set('Output settings changed. Crop again.', 'info'); };
    format.addEventListener('change', settingsChanged); quality.addEventListener('input', settingsChanged); quality.disabled = true;
    const resetSelection = () => {
      if (!img) { status.set('Choose an image first.', 'warning'); return; }
      revision++; previews.clear(); sel = {x:0, y:0, w:canvas.width, h:canvas.height}; showFields(); draw();
      status.set('Full image selected. Aspect presets can adjust it.', 'info');
    };
    const run = async () => {
      if (!file || !img) { status.set('Choose an image first.', 'warning'); return; }
      previews.clear();
      const crop = fromFields();
      if (!crop) { status.set('Enter whole-number coordinates within the image, with positive width and height.', 'warning'); return; }
      const fmt = format.value, q = Number(quality.value);
      if (!Object.hasOwn(MIME_BY_FMT, fmt)) { status.set('Choose a supported output format.', 'error'); return; }
      if (fmt !== 'png' && (!quality.value || !Number.isInteger(q) || q < 5 || q > 100)) { status.set('Quality must be a whole number from 5 to 100.', 'warning'); return; }
      status.set('Cropping…', 'info');
      const selected = file, token = ++revision;
      try {
        const { x:sx, y:sy, w:sw, h:sh } = crop;
        const out = document.createElement('canvas');
        const width = Math.max(1, Math.round(sw)), height = Math.max(1, Math.round(sh));
        validateCanvasSize(width, height);
        out.width = width; out.height = height;
        const ctx = out.getContext('2d');
        if (fmt === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
        const blob = await canvasToBlob(out, MIME_BY_FMT[fmt], fmt === 'png' ? undefined : q / 100);
        if (file !== selected || revision !== token) return;
        previews.show(blob, (url) => h('div', {},
          h('img', { class: 'img-preview', src: url, alt: 'Cropped preview', style: 'margin-top:12px' }),
          h('div', { style: 'margin-top:10px' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { downloadImage(blob, `cropped-${baseName(selected.name)}.${EXT_BY_FMT[fmt]}`); } }, `Download ${out.width} × ${out.height} ${fmt === 'jpeg' ? 'JPEG' : fmt.toUpperCase()}`))));
        status.set(`Cropped to ${out.width} × ${out.height} px ✓`, 'success');
      } catch (e) { if (file === selected && revision === token) status.set(e.message, 'error'); }
    };
    root.append(zone, h('div', { class: 'field-row', style: 'margin-top:14px;align-items:end' }, field({ label: 'Aspect ratio', control: aspect })),
      h('p', { class: 'hint', text: 'Drag the preview or enter pixel coordinates from the top-left corner. Aspect buttons adjust the current selection; manual coordinates can use any ratio.' }),
      h('div', { class: 'field-row' }, field({ label: 'Left (px)', control: xIn }), field({ label: 'Top (px)', control: yIn }), field({ label: 'Crop width (px)', control: widthIn }), field({ label: 'Crop height (px)', control: heightIn })),
      h('div', {class:'field-row'}, field({label:'Output format', control:format}), field({label:'Quality (5–100)', control:quality, hint:'For JPEG and WebP; PNG ignores quality.'})),
      actionsRow(btn({ label: 'Crop', icon: 'crop', onClick: run }), btn({label:'Select full image', variant:'secondary', onClick:resetSelection})),
      status, h('br'), stage, preview,
      privacyNote('Processed locally, never uploaded. PNG and WebP can preserve transparency; JPEG uses a white background. JPEG and WebP use lossy quality settings. Canvas output may discard metadata and animation. Unsupported encoders are rejected; output size may be larger than the original. Browser decoding can consume substantial memory. Output is limited to 16,384 px per side and 40 million pixels; input is limited to 100 MiB.'));
  },

  'image-metadata-viewer'(root) {
    const zone = imageZone({ accept: 'image/jpeg,image/png,image/*', title: 'Choose a JPEG or PNG', sub: 'Parsed locally — the file is never uploaded' });
    const status = statusLine('Everything is decoded in your browser.');
    const out = h('div', { class: 'tool-docs', style: 'margin-top:16px' });
    let currentFile = null, revision = 0;
    zone.addEventListener('iht-rejected', () => { revision++; currentFile = null; out.replaceChildren(); zone.resetSelectionUI(); status.set('Selection rejected. Choose an image no larger than 100 MiB.', 'error'); });
    window.addEventListener('pagehide', () => { revision++; }, { once: true });
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
