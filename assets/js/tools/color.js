// =============================================================================
// iHaveTools — Color tools: color-picker, hex-rgb-converter,
// color-contrast-checker, palette-generator
// =============================================================================
import { h, field, input, btn, actionsRow, statusLine, statsGrid, table, toast, copyText, mountTool } from '../ui.js';

/* ═══════════════════════════ Color engine ═══════════════════════════ */
export function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v))); }

export function hexToRgb(hex) {
  let s = String(hex).trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) s = [...s].map((c) => c + c).join('');
  else if (/^[0-9a-fA-F]{4}$/.test(s)) s = [...s].map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s)) throw new Error(`“${hex}” is not a valid HEX color. Use 3, 6 or 8 hex digits, like #4f46e5 or 46e.`);
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16), a: s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1 };
}
export function rgbToHex({ r, g, b, a = 1 }) {
  const px = (v) => clampByte(v).toString(16).padStart(2, '0');
  return `#${px(r)}${px(g)}${px(b)}${a < 1 ? px(a * 255) : ''}`;
}
export function rgbToHsl({ r, g, b, a = 1 }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0, sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  return { h: Math.round(hue), s: Math.round(sat * 100), l: Math.round(l * 100), a };
}
export function hslToRgb({ h: hue, s, l, a = 1 }) {
  if (!(hue >= 0 && hue <= 360) || !(s >= 0 && s <= 100) || !(l >= 0 && l <= 100)) throw new Error('HSL values must be H: 0–360, S: 0–100%, L: 0–100%.');
  const sn = s / 100, ln = l / 100;
  const k = (n) => (n + hue / 30) % 12;
  const aa = sn * Math.min(ln, 1 - ln);
  const f = (n) => ln - aa * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: clampByte(f(0) * 255), g: clampByte(f(8) * 255), b: clampByte(f(4) * 255), a };
}
export function parseColor(text) {
  const s = String(text).trim();
  if (!s) throw new Error('Enter a color first.');
  if (s.startsWith('#') || /^[0-9a-fA-F]{3,8}$/.test(s)) return hexToRgb(s);
  const rgbM = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/i.exec(s);
  if (rgbM) {
    const rgb = { r: clampByte(Number(rgbM[1])), g: clampByte(Number(rgbM[2])), b: clampByte(Number(rgbM[3])) };
    if (rgbM[4]) rgb.a = rgbM[4].endsWith('%') ? Number(rgbM[4].slice(0, -1)) / 100 : Number(rgbM[4]);
    if ([rgb.r, rgb.g, rgb.b].some((v) => v > 255 || v < 0)) throw new Error('RGB channels must be between 0 and 255.');
    return rgb;
  }
  const hslM = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/i.exec(s);
  if (hslM) return hslToRgb({ h: Number(hslM[1]), s: Number(hslM[2]), l: Number(hslM[3]), a: hslM[4] ? (hslM[4].endsWith('%') ? Number(hslM[4].slice(0, -1)) / 100 : Number(hslM[4])) : 1 });
  throw new Error(`“${s}” is not a color format this tool understands. Try #4f46e5, rgb(79,70,229) or hsl(243,75%,59%).`);
}
export function luminance({ r, g, b }) {
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrastRatio(rgb1, rgb2) {
  const l1 = luminance(rgb1), l2 = luminance(rgb2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
export function harmony(rgb, type) {
  const hsl = rgbToHsl(rgb);
  const rots = { complementary: [0, 180], analogous: [0, -30, 30], triadic: [0, 120, 240], split: [0, 150, 210], tetradic: [0, 90, 180, 270], mono: [0, 0, 0, 0] };
  const shades = { mono: [-25, -12, 0, 12, 25] };
  return (rots[type] || [0]).map((rot, i) => {
    const mod = { h: (hsl.h + rot + 360) % 360, s: hsl.s, l: Math.max(5, Math.min(95, hsl.l + ((shades[type] || [0])[i] || 0))) };
    return hslToRgb(mod);
  });
}

/* ═══════════════════════════ UI definitions ═══════════════════════════ */
function swatchButton(rgb, onPick) {
  const hex = rgbToHex(rgb).slice(0, 7);
  const hsl = rgbToHsl(rgb);
  return h('button', { type: 'button', class: 'swatch', onclick: () => onPick(hex), 'aria-label': `Copy ${hex}` },
    h('div', { class: 'sw-color', style: `background:${hex}` }),
    h('div', { class: 'sw-info' },
      h('span', { class: 'sw-hex', text: hex }),
      h('span', { class: 'sw-rgb', text: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` }),
      h('span', { class: 'sw-rgb', text: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` })));
}

const defs = {
  'color-picker'(root) {
    const color = input({ type: 'color', value: '#4f46e5' });
    const hexIn = input({ type: 'text', class: 'input mono', value: '#4f46e5', placeholder: '#4f46e5' });
    const grid = statsGrid();
    const status = statusLine('');
    const scales = h('div', {});
    let current = hexToRgb('#4f46e5');
    const eyedropperBtn = ('EyeDropper' in window)
      ? btn({ label: 'Pick from screen', variant: 'secondary', icon: 'eye', onClick: async () => {
          try {
            const ed = new window.EyeDropper();
            const res = await ed.open();
            setColor(res.sRGBHex);
            status.set('Color captured from screen ✓', 'success');
          } catch { status.set('Screen picking was cancelled.', 'info'); }
        } })
      : null;
    const setColor = (rgbOrHex) => {
      try {
        current = typeof rgbOrHex === 'string' ? hexToRgb(rgbOrHex) : rgbOrHex;
        const hex = rgbToHex(current).slice(0, 7);
        const hsl = rgbToHsl(current);
        color.value = hex;
        hexIn.value = hex;
        grid.set([
          { label: 'HEX', value: hex.toUpperCase(), kind: 'good' },
          { label: 'RGB', value: `${current.r}, ${current.g}, ${current.b}` },
          { label: 'HSL', value: `${hsl.h}, ${hsl.s}%, ${hsl.l}%` },
          { label: 'CSS rgb()', value: `rgb(${current.r} ${current.g} ${current.b})` },
        ]);
        scales.replaceChildren(
          h('h3', { text: 'Tints and shades', style: 'margin:20px 0 10px' }),
          h('div', { class: 'swatch-row' },
            [-60, -45, -30, -15, 0, 15, 30, 45, 60].map((d) => {
              const mod = hslToRgb({ h: hsl.h, s: hsl.s, l: Math.max(4, Math.min(96, hsl.l + d)) });
              return swatchButton(mod, async (hx) => { (await copyText(hx)) ? toast(`${hx} copied`, 'success') : toast('Copy failed', 'error'); });
            })));
      } catch (e) { status.set(e.message, 'error'); }
    };
    color.addEventListener('input', () => setColor(color.value));
    hexIn.addEventListener('input', () => { try { setColor(parseColor(hexIn.value)); status.set('', 'info'); } catch { /* typing */ } });
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Pick a color', control: color }),
        field({ label: '…or type HEX', control: hexIn }),
        eyedropperBtn ? field({ label: 'Screen', control: eyedropperBtn }) : h('div')),
      !eyedropperBtn ? h('p', { class: 'hint', text: 'Screen eyedropper needs Chrome/Edge 95+ or another browser supporting the EyeDropper API.' }) : h('div'),
      grid, scales, status);
    setColor('#4f46e5');
  },

  'hex-rgb-converter'(root) {
    const hex = input({ type: 'text', class: 'input mono', value: '#4f46e5' });
    const rgb = input({ type: 'text', class: 'input mono', value: 'rgb(79, 70, 229)' });
    const hsl = input({ type: 'text', class: 'input mono', value: 'hsl(243, 75%, 59%)' });
    const preview = h('div', { style: 'height:72px;border-radius:12px;border:1px solid var(--border);margin-bottom:14px', role: 'img', 'aria-label': 'Color preview' });
    const status = statusLine('Edit any field — the others update live.');
    const update = (source) => {
      try {
        const c = parseColor({ hex: hex.value, rgb: rgb.value, hsl: hsl.value }[source]);
        if (source !== 'hex') hex.value = rgbToHex(c);
        if (source !== 'rgb') rgb.value = `rgb(${c.r}, ${c.g}, ${c.b})`;
        if (source !== 'hsl') { const hh = rgbToHsl(c); hsl.value = `hsl(${hh.h}, ${hh.s}%, ${hh.l}%)`; }
        preview.style.background = rgbToHex(c);
        status.set('Converted ✓', 'success');
      } catch (e) { if (source) status.set(e.message, 'error'); }
    };
    [[hex, 'hex'], [rgb, 'rgb'], [hsl, 'hsl']].forEach(([el, name]) => el.addEventListener('input', () => update(name)));
    root.append(preview,
      field({ label: 'HEX', control: hex }),
      field({ label: 'RGB', control: rgb, hint: 'Accepts rgb(79, 70, 229) or 79, 70, 229' }),
      field({ label: 'HSL', control: hsl }),
      actionsRow(btn({ label: 'Copy all formats', variant: 'secondary', icon: 'copy', onClick: async () => {
        const c = parseColor(hex.value);
        const hh = rgbToHsl(c);
        (await copyText(`${rgbToHex(c)}\nrgb(${c.r}, ${c.g}, ${c.b})\nhsl(${hh.h}, ${hh.s}%, ${hh.l}%)`)) ? toast('All formats copied', 'success') : toast('Copy failed', 'error');
      } })),
      status);
    update('hex');
  },

  'color-contrast-checker'(root) {
    const fg = input({ type: 'color', value: '#1f2937' });
    const bg = input({ type: 'color', value: '#ffffff' });
    const fgHex = input({ type: 'text', class: 'input mono', value: '#1f2937' });
    const bgHex = input({ type: 'text', class: 'input mono', value: '#ffffff' });
    const grid = statsGrid();
    const status = statusLine('');
    const sample = h('div', { style: 'padding:22px;border-radius:12px;border:1px solid var(--border);margin-bottom:14px' });
    const render = () => {
      try {
        const f = hexToRgb(fgHex.value); const b = hexToRgb(bgHex.value);
        fg.value = rgbToHex(f).slice(0, 7); bg.value = rgbToHex(b).slice(0, 7);
        const ratio = contrastRatio(f, b);
        const rows = [
          ['Normal text (AA)', ratio >= 4.5], ['Normal text (AAA)', ratio >= 7],
          ['Large text ≥24px (AA)', ratio >= 3], ['Large text (AAA)', ratio >= 4.5],
          ['UI components / graphics (AA)', ratio >= 3],
        ];
        grid.set([
          { label: 'Contrast ratio', value: `${ratio.toFixed(2)}:1`, kind: ratio >= 4.5 ? 'good' : ratio >= 3 ? 'warn' : 'bad' },
          { label: 'WCAG AA', value: ratio >= 4.5 ? 'Pass' : ratio >= 3 ? 'Large text only' : 'Fail', kind: ratio >= 4.5 ? 'good' : ratio >= 3 ? 'warn' : 'bad' },
          { label: 'WCAG AAA', value: ratio >= 7 ? 'Pass' : ratio >= 4.5 ? 'Large text only' : 'Fail', kind: ratio >= 7 ? 'good' : ratio >= 4.5 ? 'warn' : 'bad' },
        ]);
        sample.style.background = rgbToHex(b).slice(0, 7);
        sample.replaceChildren(
          h('p', { style: `color:${rgbToHex(f).slice(0, 7)};font-size:1.05rem;margin:0 0 8px`, text: 'Normal text sample — The quick brown fox jumps over the lazy dog.' }),
          h('p', { style: `color:${rgbToHex(f).slice(0, 7)};font-size:.75rem;margin:0 0 12px`, text: 'Small text sample at 12px, often used for captions.' }),
          h('p', { style: `color:${rgbToHex(f).slice(0, 7)};font-size:1.6rem;font-weight:700;margin:0`, text: 'Large bold text 25px' }));
        status.set(`Passes ${rows.filter(([, ok]) => ok).length} of ${rows.length} WCAG thresholds.`, ratio >= 4.5 ? 'success' : 'warning');
      } catch (e) { status.set(e.message, 'error'); }
    };
    [[fg, fgHex], [bg, bgHex]].forEach(([c, x]) => {
      c.addEventListener('input', () => { x.value = c.value; render(); });
      x.addEventListener('input', () => { try { hexToRgb(x.value); render(); } catch { /* typing */ } });
    });
    root.append(
      sample,
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Text color', control: fg }), field({ label: 'HEX', control: fgHex }),
        field({ label: 'Background', control: bg }), field({ label: 'HEX', control: bgHex }),
        field({ label: ' ', control: btn({ label: 'Swap', variant: 'secondary', onClick: () => { [fgHex.value, bgHex.value] = [bgHex.value, fgHex.value]; render(); } }) })),
      grid, status,
      h('p', { class: 'hint', text: 'WCAG 2.1 requires 4.5:1 for normal text and 3:1 for large text (≥24px or ≥19px bold) at level AA; 7:1 and 4.5:1 at level AAA.' }));
    render();
  },

  'palette-generator'(root) {
    const base = input({ type: 'color', value: '#4f46e5' });
    const status = statusLine('Harmonies regenerate as you change the base color.');
    const out = h('div', {});
    const render = () => {
      const rgb = hexToRgb(base.value);
      const TYPES = [
        ['complementary', 'Complementary'], ['analogous', 'Analogous'], ['triadic', 'Triadic'],
        ['split', 'Split-complementary'], ['tetradic', 'Tetradic'], ['mono', 'Monochromatic'],
      ];
      out.replaceChildren(...TYPES.map(([type, label]) => h('section', { style: 'margin-bottom:20px' },
        h('h3', { text: label, style: 'margin:0 0 8px' }),
        h('div', { class: 'swatch-row' },
          harmony(rgb, type).map((c) => swatchButton(c, async (hx) => { (await copyText(hx)) ? toast(`${hx} copied`, 'success') : toast('Copy failed', 'error'); }))))));
    };
    base.addEventListener('input', render);
    root.append(field({ label: 'Base color', control: base }), out, status,
      h('p', { class: 'hint', text: 'Click any swatch to copy its HEX value. Swatches also show RGB and HSL on hover of the card.' }));
    render();
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, parseColor, luminance, contrastRatio, harmony };
