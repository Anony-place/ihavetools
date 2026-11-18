// Storage and transfer planning; values and assumptions are bounded explicitly.
import { h, field, input, select, btn, actionsRow, statusLine, statsGrid, mountTool } from '../ui.js';

const units = { MB: 1e6, GB: 1e9, TB: 1e12, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 };
const fmt = n => n !== 0 && (Math.abs(n) < 0.0001 || Math.abs(n) >= 1e12) ? n.toExponential(6) : n.toLocaleString('en-US', {maximumFractionDigits: 4});
function decimal(value, label, min, max) {
  const text = String(value).trim();
  if (text.length > 24 || !/^(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/.test(text)) throw new Error(`${label} must be a decimal with at most six fractional digits.`);
  const n = Number(text);
  if (n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
}
function integer(value, label, min, max) {
  const text = String(value).trim();
  if (!/^\d{1,7}$/.test(text)) throw new Error(`${label} must be a whole number.`);
  const n = Number(text);
  if (n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
}
export function transferEstimate(size, unit, speed, efficiency, deadline = '') {
  const amount = decimal(size, 'File size', 0.000001, 1000000);
  if (!Object.hasOwn(units, unit)) throw new Error('Choose a valid file size unit.');
  const mbps = decimal(speed, 'Connection speed', 0.001, 1000000000);
  const percent = decimal(efficiency, 'Effective throughput', 1, 100);
  const bits = amount * units[unit] * 8, rate = mbps * 1e6 * percent / 100;
  const deadlineMinutes = String(deadline).trim() === '' ? null : decimal(deadline, 'Deadline', 0.000001, 1000000000);
  return { bytes: amount * units[unit], idealSeconds: bits / (mbps * 1e6), seconds: bits / rate, effectiveMBps: rate / 8e6,
    requiredMbps: deadlineMinutes === null ? null : bits / (deadlineMinutes * 60 * 1e6 * percent / 100) };
}
export function imageStorage(width, height, channels, depth) {
  const w = integer(width, 'Width', 1, 1000000), h = integer(height, 'Height', 1, 1000000);
  const c = integer(channels, 'Channels', 1, 4), d = integer(depth, 'Bits per channel', 1, 32);
  const pixels = w * h, bitsPerPixel = c * d, bits = pixels * bitsPerPixel;
  return { pixels, bitsPerPixel, bits, packedBytes: Math.ceil(bits / 8) };
}
const defs = {
  'download-time-calculator'(root) {
    const size=input({type:'text',inputmode:'decimal',value:'1'}), unit=select({options:Object.keys(units).map(v=>({v,t:v})),value:'GB'}), speed=input({type:'text',inputmode:'decimal',value:'100'}), efficiency=input({type:'text',inputmode:'decimal',value:'100'}), deadline=input({type:'text',inputmode:'decimal',placeholder:'Optional'}),grid=statsGrid(),status=statusLine('');
    const run=()=>{try {const r=transferEstimate(size.value,unit.value,speed.value,efficiency.value,deadline.value);
      grid.set([{label:'Estimated transfer time (seconds)',value:fmt(r.seconds),kind:'good'},{label:'Estimated transfer time (minutes)',value:fmt(r.seconds/60)},{label:'Ideal time at full speed (seconds)',value:fmt(r.idealSeconds)},{label:'Effective rate (MB/s)',value:fmt(r.effectiveMBps)}, ...(r.requiredMbps===null?[]:[{label:'Speed needed for deadline (Mbps)',value:fmt(r.requiredMbps)}])]);
      status.set('Estimate assumes a constant connection and selected effective throughput. Real transfer times vary; results use floating-point arithmetic and are rounded.', 'info');
    }catch(e){grid.replaceChildren();status.set(e.message,'error');}};
    const invalidate=()=>{grid.replaceChildren();status.set('Input changed. Calculate again.','info');}; root.addEventListener('input',invalidate);root.addEventListener('change',invalidate);
    root.append(h('div',{class:'field-row'},field({label:'File size',control:size}),field({label:'File size unit',control:unit}),field({label:'Connection speed (Mbps)',control:speed}),field({label:'Effective throughput (%)',control:efficiency}),field({label:'Target time (minutes, optional)',control:deadline})),h('p',{class:'hint',text:'Effective throughput is the percentage of the entered speed available to this transfer. Use your upload speed for uploads. Decimal Mbps means one million bits per second.'}),actionsRow(btn({label:'Calculate transfer time',icon:'clock',onClick:run})),grid,status);
  },
  'uncompressed-image-size-calculator'(root) {
    const width=input({type:'number',min:1,max:1000000,step:1,value:'1920'}),height=input({type:'number',min:1,max:1000000,step:1,value:'1080'}),channels=select({options:[{v:'1',t:'1 — grayscale'},{v:'2',t:'2 — grayscale + alpha'},{v:'3',t:'3 — RGB'},{v:'4',t:'4 — RGBA'}],value:'3'}),depth=input({type:'number',min:1,max:32,step:1,value:'8'}),grid=statsGrid(),status=statusLine('');
    const run=()=>{try {const r=imageStorage(width.value,height.value,channels.value,depth.value);
      grid.set([{label:'Ideal packed pixel data (bytes)',value:fmt(r.packedBytes),kind:'good'},{label:'Decimal megabytes (MB)',value:fmt(r.packedBytes/1e6)},{label:'Binary mebibytes (MiB)',value:fmt(r.packedBytes/1024**2)},{label:'Pixels',value:fmt(r.pixels)},{label:'Bits per pixel',value:fmt(r.bitsPerPixel)},{label:'Pixel data (bits)',value:fmt(r.bits)}]);
      status.set('Theoretical tightly packed pixel data only; actual files and memory use can differ. Fractions of a byte are rounded up. Display values are rounded.', 'info');
    }catch(e){grid.replaceChildren();status.set(e.message,'error');}};
    const invalidate=()=>{grid.replaceChildren();status.set('Input changed. Calculate again.','info');};root.addEventListener('input',invalidate);root.addEventListener('change',invalidate);
    root.append(h('div',{class:'field-row'},field({label:'Width (pixels)',control:width}),field({label:'Height (pixels)',control:height}),field({label:'Channels',control:channels}),field({label:'Bits per channel',control:depth})),h('p',{class:'hint',text:'Calculates ideal tightly packed raw pixel data, not the size of a JPEG, PNG, or other encoded file.'}),actionsRow(btn({label:'Calculate image data size',icon:'calculator',onClick:run})),grid,status);
  }
};
export function mount(id) { mountTool(id, defs); }
