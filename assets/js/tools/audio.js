// =============================================================================
// iHaveTools — Audio & Video engines (client-side, dependency-free).
//   • Pure DSP/parsing helpers are exported for tests and run anywhere.
//   • Web Audio API is used lazily (only on user action) so pages never crash
//     in environments without audio hardware.
//   • Video tools use the browser's built-in decoders (decodeAudioData for
//     audio tracks) and a hand-written ISO-BMFF/MP4 box parser — no uploads.
// =============================================================================
import {
  h, field, input, segControl, btn, actionsRow, statusLine, statsGrid, table,
  toast, copyText, privacyNote, mountTool, dropzone, readFile, fmtBytes,
} from '../ui.js';

/* ═══════════════════════════ Pure audio helpers ═══════════════════════════ */

/** Render a waveform to Float32 samples. Pure — used for the tone generator. */
export function synthesizeSamples({ freq = 440, wave = 'sine', seconds = 2, sampleRate = 44100, volume = 0.8 }) {
  if (!(freq >= 1 && freq <= 20000)) throw new Error('Frequency must be between 1 and 20000 Hz.');
  if (!(volume >= 0 && volume <= 1)) throw new Error('Volume must be between 0 and 100%.');
  if (!(seconds >= 0.01 && seconds <= 60)) throw new Error('Duration must be between 0.01 and 60 seconds.');
  if (!Number.isInteger(sampleRate) || sampleRate < 1 || sampleRate > 384000) throw new Error('Sample rate must be a whole number between 1 and 384000 Hz.');
  if (freq > sampleRate / 2) throw new Error('Frequency must not exceed half the sample rate (Nyquist limit).');
  if (!['sine', 'square', 'sawtooth', 'triangle'].includes(wave)) throw new Error('Choose a valid waveform.');
  const n = Math.max(1, Math.round(seconds * sampleRate));
  if (n > 30000000) throw new Error('Generated audio exceeds 30 million samples.');
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const ph = (t * freq) % 1;
    let v;
    switch (wave) {
      case 'square': v = ph < 0.5 ? 1 : -1; break;
      case 'sawtooth': v = 2 * ph - 1; break;
      case 'triangle': v = ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph; break;
      default: v = Math.sin(2 * Math.PI * freq * t); // sine
    }
    out[i] = v * volume;
  }
  // 3 ms fade-in/out to avoid clicks at the edges
  const fade = Math.min(Math.round(sampleRate * 0.003), Math.floor(n / 2));
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out[i] *= g;
    out[n - 1 - i] *= g;
  }
  return out;
}

/** Change playback speed by linear resampling (pitch shifts, like “speed” in players). */
export function resampleLinear(data, rate) {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Speed must be finite and greater than 0.');
  if (!data.length || data.length / rate > 30000000) throw new Error('Audio is empty or output exceeds 30 million samples.');
  if (rate === 1) return data.slice();
  const outLen = Math.max(1, Math.floor(data.length / rate));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * rate;
    const i0 = Math.floor(src);
    const frac = src - i0;
    const a = data[i0] ?? 0;
    const b = data[i0 + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** Multiply samples by a gain, hard-clamped to [-1, 1] to avoid clipping. */
export function applyGain(data, gain) {
  if (!Number.isFinite(gain) || gain < 0) throw new Error('Volume factor must be finite and non-negative.');
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = Math.max(-1, Math.min(1, data[i] * gain));
  return out;
}

/** Encode planar channel data into a 16-bit PCM WAV ArrayBuffer. Pure. */
export function encodeWav(channels, sampleRate) {
  const nCh = channels.length;
  if (!nCh || nCh > 32) throw new Error('Audio must have between 1 and 32 channels.');
  if (!Number.isInteger(sampleRate) || sampleRate < 1 || sampleRate > 384000) throw new Error('Invalid WAV sample rate.');
  const n = channels[0].length;
  if (!n || n * nCh > 30000000) throw new Error('Audio is empty or exceeds 30 million total samples.');
  if (channels.some(ch => ch.length !== n)) throw new Error('All audio channels must have the same length.');
  const bytesPerSample = 2;
  const dataSize = n * nCh * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(buf);
  const wstr = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, nCh, true); dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * nCh * bytesPerSample, true);
  dv.setUint16(32, nCh * bytesPerSample, true); dv.setUint16(34, 16, true);
  wstr(36, 'data'); dv.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nCh; c++) {
      const sample = channels[c][i];
      if (!Number.isFinite(sample)) throw new Error('Audio contains an invalid sample.');
      const s = Math.max(-1, Math.min(1, sample));
      dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return buf;
}

/** Slice an AudioBuffer-like {sampleRate, numberOfChannels, getChannelData} between two times. */
export function sliceBuffer(buf, startSec, endSec) {
  const sr = buf.sampleRate;
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || startSec < 0 || endSec <= startSec || endSec > buf.length / sr) throw new Error('Choose a valid range within the audio duration; end must be after start.');
  const s0 = Math.max(0, Math.round(startSec * sr));
  const s1 = Math.min(buf.length, Math.round(endSec * sr));
  if (s1 <= s0) throw new Error('The selected range is too short.');
  const chans = [];
  for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c).slice(s0, s1));
  return { channels: chans, sampleRate: sr };
}

/* ═══════════════════════════ MP4 / ISO-BMFF parser ═══════════════════════════ */

function fourcc(dv, off) { return String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3)); }

/** Parse the interesting parts of an MP4/MOV file. Pure — throws readable errors. */
export function parseMp4(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 8) throw new Error('File is too small to be an MP4.');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), total = bytes.byteLength;
  const topBoxes = [], tracks = [], warnings = []; let ftyp = null, mvhd = null, boxCount = 0;
  const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
  const read64 = (offset, isDuration = false) => {
    const v = dv.getBigUint64(offset);
    if (isDuration && v === 0xffffffffffffffffn) return null;
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('MP4 contains a size or duration too large to inspect safely.');
    return Number(v);
  };
  const walk = (start, end, depth, track = null) => {
    if (depth > 6) throw new Error('MP4 box nesting exceeds the supported limit.');
    for (let pos = start; pos < end;) {
      if (++boxCount > 50000) throw new Error('MP4 contains too many boxes to inspect.');
      if (end - pos < 8) throw new Error('MP4 is truncated or has an incomplete box header.');
      const declared = dv.getUint32(pos), type = fourcc(dv, pos + 4);
      let header = 8, size = declared;
      if (declared === 1) { if (end-pos < 16) throw new Error('MP4 has a truncated extended box header.'); header = 16; size = read64(pos+8); }
      else if (declared === 0) size = end-pos;
      if (size < header || size > end-pos) throw new Error(`MP4 box “${type}” has an invalid or truncated size.`);
      const body=pos+header, limit=pos+size, available=limit-body;
      const need = (n) => { if (available < n) throw new Error(`MP4 box “${type}” is truncated.`); };
      if (depth === 0) topBoxes.push({type,size});
      if (type === 'ftyp' && !ftyp) {need(4);ftyp=fourcc(dv,body);}
      if (type === 'trak') { track={}; tracks.push(track); }
      if (type === 'mvhd' && !mvhd) {
        need(4); const v=dv.getUint8(body); if(v!==0 && v!==1) throw new Error('Unsupported MP4 movie header version.');
        need(v===1 ? 32 : 20); const duration=v===1 ? read64(body+24, true) : dv.getUint32(body+16);
        mvhd={timescale:dv.getUint32(body+(v===1?20:12)),duration:duration === 0xffffffff && v === 0 ? null : duration};
      }
      if (type === 'tkhd' && track) {
        need(4);const v=dv.getUint8(body);if(v!==0 && v!==1) throw new Error('Unsupported MP4 track header version.');
        const base=body+(v===1?88:76);need((v===1?88:76)+8);
        Object.assign(track,{id:dv.getUint32(body+(v===1?20:12)),width:dv.getUint32(base)/65536,height:dv.getUint32(base+4)/65536});
      }
      if (type === 'mdhd' && track) {
        need(4);const v=dv.getUint8(body);if(v!==0 && v!==1) throw new Error('Unsupported MP4 media header version.');
        need(v===1 ? 32 : 20); track.timescale=dv.getUint32(body+(v===1?20:12));
        const duration=v===1 ? read64(body+24, true) : dv.getUint32(body+16);track.duration=duration===0xffffffff && v===0 ? null : duration;
      }
      if (type === 'hdlr' && track) {need(12);track.handler=fourcc(dv,body+8);}
      if (type === 'stsd' && track) {
        need(8);const entries=dv.getUint32(body+4);
        if(entries) {need(16); const entrySize=dv.getUint32(body+8);if(entrySize<8 || entrySize>available-8) throw new Error('MP4 sample description is truncated.');track.codec=fourcc(dv,body+12);}
      }
      if (containers.has(type)) walk(body,limit,depth+1,track);
      pos=limit;
    }
  };
  walk(0,total,0);
  if (!topBoxes.some(b => ['ftyp','moov'].includes(b.type))) throw new Error('This does not look like an MP4/MOV file (no file type or movie box found).');
  if (!topBoxes.some(b=>b.type==='moov')) warnings.push('Movie metadata box not found; track details may be unavailable.');
  if (topBoxes.some(b=>b.type==='moof')) warnings.push('Fragmented MP4: duration and track metadata may be incomplete.');
  return {ftyp,mvhd,tracks,topBoxes,size:total,warnings};
}

function secFmt(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? `${h}h ` : '') + `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Decode a file with the browser's audio decoder. Lazily creates/closes an AudioContext. */
async function decodeAudio(file, status) {
  if (file.size > 100 * 1024 * 1024) throw new Error('Choose a file no larger than 100 MiB.');
  const bytes = await readFile(file, 'buffer');
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('This browser cannot decode audio (no Web Audio support).');
  const ctx = new Ctx();
  try {
    const buf = await new Promise((resolve, reject) => {
      ctx.decodeAudioData(bytes, resolve, () => reject(new Error('The browser could not decode this file’s audio. It may be an unsupported format, DRM-protected, or have no audio track.')));
    });
    if (buf.length * buf.numberOfChannels > 30000000) throw new Error('Decoded audio is too large; use a shorter or lower-channel file (maximum 30 million total samples).');
    return buf;
  } finally { ctx.close().catch(() => {}); }
}

/* ═══════════════════════════ Tool definitions ═══════════════════════════ */
const defs = {
  /* ---------- Tone generator ---------- */
  'tone-generator'(root) {
    let wave = 'sine', revision = 0, ctx = null, activeSource = null;
    const stopPlaying = () => { if (activeSource) { try { activeSource.stop(); } catch {} activeSource = null; } };
    const freq = input({ type: 'number', min: 1, max: 20000, step: '1', value: '440' });
    const slider = input({ type: 'range', min: '20', max: '2000', step: '1', value: '440' });
    const vol = input({ type: 'range', min: '0', max: '100', step: '1', value: '60' });
    const dur = input({ type: 'number', min: 0.1, max: 60, step: '0.1', value: '2' });
    const grid = statsGrid();
    const status = statusLine('Pick a frequency, then play it or download it as a WAV file.');
    slider.addEventListener('input', () => { freq.value = slider.value; });
    freq.addEventListener('input', () => { const v = Number(freq.value); if (v >= 20 && v <= 2000) slider.value = String(v); });
    const build = () => {
      if (!freq.value.trim() || !dur.value.trim()) throw new Error('Enter a frequency and duration.');
      const hz = Number(freq.value), seconds = Number(dur.value);
      if (!Number.isFinite(seconds) || seconds < 0.1 || seconds > 60) throw new Error('Duration must be between 0.1 and 60 seconds.');
      const samples = synthesizeSamples({ freq: hz, wave, seconds, volume: Number(vol.value) / 100 });
      const wav = encodeWav([samples], 44100);
      grid.set([
        { label: 'Frequency', value: `${freq.value} Hz` },
        { label: 'Waveform', value: wave },
        { label: 'Duration', value: `${dur.value} s` },
        { label: 'WAV size', value: fmtBytes(wav.byteLength) },
      ]);
      return wav;
    };
    const invalidate = () => { revision++; stopPlaying(); grid.replaceChildren(); status.set('Settings changed. Play or download again.', 'info'); };
    root.addEventListener('input', invalidate); root.addEventListener('change', invalidate);
    window.addEventListener('pagehide', () => { revision++; stopPlaying(); if (ctx) { ctx.close().catch(() => {}); ctx = null; } });
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Waveform', control: segControl({
          options: [{ v: 'sine', t: 'Sine' }, { v: 'square', t: 'Square' }, { v: 'sawtooth', t: 'Sawtooth' }, { v: 'triangle', t: 'Triangle' }],
          value: 'sine', onChange: (v) => { wave = v; invalidate(); },
        }) }),
        field({ label: 'Frequency (Hz, 1–20000)', hint: 'A4 = 440 Hz. Middle C ≈ 261.6 Hz.', control: freq }),
        field({ label: 'Duration (seconds, 0.1–60)', control: dur })),
      h('div', { class: 'field-row' },
        field({ label: 'Fine tune (20–2000 Hz)', control: slider }),
        field({ label: 'Volume (%)', control: vol })),
      grid,
      actionsRow(
        btn({ label: 'Play tone', icon: 'zap', onClick: () => {
          const token = ++revision; stopPlaying();
          try {
            const wav = build();
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) { status.set('This browser cannot play audio. You can still download the WAV.', 'error'); return; }
            ctx = ctx || new Ctx();
            const playContext = ctx, description = `${freq.value} Hz ${wave} for ${dur.value} s`;
            status.set('Preparing audio…', 'info');
            playContext.decodeAudioData(wav, (buf) => {
              if (token !== revision) return;
              try {
                const src = playContext.createBufferSource();
                activeSource = src;
                src.buffer = buf; src.connect(playContext.destination);
                src.onended = () => { if (activeSource === src) activeSource = null; };
                src.start();
                status.set(`Playing ${description}…`, 'success');
              } catch (e) { if (token === revision) status.set(e.message, 'error'); }
            }, () => { if (token === revision) status.set('Playback failed — try downloading the WAV instead.', 'error'); });
          } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
        } }),
        btn({ label: 'Download WAV', variant: 'secondary', icon: 'download', onClick: () => {
          try {
            const wav = build();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
            a.download = `tone-${freq.value}hz-${wave}.wav`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            status.set(`WAV download requested — ${fmtBytes(wav.byteLength)}.`, 'success');
          } catch (e) { grid.replaceChildren(); status.set(e.message, 'error'); }
        } })),
      status, privacyNote('The tone is generated mathematically in your browser. Nothing is recorded or sent anywhere.'));
    try { build(); } catch { /* keep the empty grid if defaults are invalid */ }
  },

  /* ---------- Audio trimmer ---------- */
  'audio-trimmer'(root) {
    let audio = null, revision = 0;
    const info = statsGrid();
    const start = input({ type: 'number', min: 0, step: '0.01', value: '0' });
    const end = input({ type: 'number', min: 0, step: '0.01', value: '0' });
    const status = statusLine('Drop an audio file to get started. Decoding happens in your browser. Files up to 100 MiB and 30 million decoded samples are supported.');
    const zone = dropzone({
      accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac',
      title: 'Choose an audio file or drop it here',
      sub: 'MP3, WAV, OGG, M4A… — decoded locally by your browser, never uploaded',
      onFiles: async ([file]) => {
        const token = ++revision; audio = null; info.replaceChildren();
        try {
          status.set(`Decoding “${file.name}” (${fmtBytes(file.size)})…`);
          const decoded = await decodeAudio(file, status);
          if (token !== revision) return;
          audio = decoded;
          info.set([
            { label: 'Duration', value: secFmt(audio.duration), kind: 'good' },
            { label: 'Channels', value: audio.numberOfChannels === 1 ? 'Mono' : audio.numberOfChannels === 2 ? 'Stereo' : String(audio.numberOfChannels) },
            { label: 'Sample rate', value: `${audio.sampleRate.toLocaleString()} Hz` },
            { label: 'File', value: fmtBytes(file.size) },
          ]);
          start.value = '0';
          end.value = String(audio.duration);
          status.set(`Loaded “${file.name}”. Choose the part to keep, then export.`, 'success');
        } catch (e) { if (token === revision) { audio = null; info.replaceChildren(); status.set(e.message, 'error'); } }
      },
    });
    const playBtn = btn({ label: 'Play selection', variant: 'secondary', icon: 'zap', onClick: () => {
      try {
        if (!audio) { status.set('Load an audio file first.', 'error'); return; }
        const sel = sliceBuffer(audio, start.value === '' ? NaN : Number(start.value), end.value === '' ? NaN : Number(end.value));
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const buf = ctx.createBuffer(sel.channels.length, sel.channels[0].length, sel.sampleRate);
        sel.channels.forEach((ch, c) => buf.copyToChannel(ch, c));
        const src = ctx.createBufferSource();
        src.buffer = buf; src.connect(ctx.destination); src.start();
        src.onended = () => ctx.close().catch(() => {});
        status.set(`Playing ${secFmt(Number(end.value) - Number(start.value))} selection…`, 'success');
      } catch (e) { status.set(e.message, 'error'); }
    } });
    root.append(
      zone, info,
      h('div', { class: 'field-row' },
        field({ label: 'Keep from (seconds)', control: start }),
        field({ label: 'Keep until (seconds)', control: end })),
      actionsRow(
        btn({ label: 'Export WAV of selection', icon: 'download', onClick: () => {
          try {
            if (!audio) { status.set('Load an audio file first.', 'error'); return; }
            const sel = sliceBuffer(audio, start.value === '' ? NaN : Number(start.value), end.value === '' ? NaN : Number(end.value));
            const wav = encodeWav(sel.channels, sel.sampleRate);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
            a.download = 'trimmed.wav';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            status.set(`Exported ${secFmt(Number(end.value) - Number(start.value))} as WAV (${fmtBytes(wav.byteLength)}).`, 'success');
          } catch (e) { status.set(e.message, 'error'); }
        } }),
        playBtn),
      status, privacyNote('Your audio file is decoded and cut entirely in your browser memory. It is never uploaded. Exported files are 16-bit WAV.'));
  },

  /* ---------- Audio speed & volume changer ---------- */
  'audio-speed-changer'(root) {
    let audio = null, revision = 0;
    const info = statsGrid();
    const speed = input({ type: 'range', min: '25', max: '400', step: '5', value: '100' });
    const gain = input({ type: 'range', min: '10', max: '300', step: '5', value: '100' });
    const speedOut = h('span', { class: 'hint', text: '1.00× — output 0:00' });
    const status = statusLine('Drop an audio file (up to 100 MiB and 30 million decoded samples), pick a speed and volume, then export a WAV.');
    const update = () => {
      const f = (Number(speed.value) || 100) / 100;
      const g = (Number(gain.value) || 100) / 100;
      const outDur = audio ? audio.duration / f : 0;
      speedOut.textContent = `${f.toFixed(2)}× · volume ${Math.round(g * 100)}%${audio ? ` — output length ${secFmt(outDur)}` : ''}`;
    };
    speed.addEventListener('input', update);
    gain.addEventListener('input', update);
    const zone = dropzone({
      accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac',
      title: 'Choose an audio file or drop it here',
      sub: 'Speed and volume are applied locally — nothing is uploaded',
      onFiles: async ([file]) => {
        const token = ++revision; audio = null; info.replaceChildren(); update();
        try {
          status.set(`Decoding “${file.name}”…`);
          const decoded = await decodeAudio(file, status);
          if (token !== revision) return;
          audio = decoded;
          info.set([
            { label: 'Original duration', value: secFmt(audio.duration) },
            { label: 'Channels', value: String(audio.numberOfChannels) },
            { label: 'Sample rate', value: `${audio.sampleRate.toLocaleString()} Hz` },
            { label: 'File', value: fmtBytes(file.size) },
          ]);
          update();
          status.set(`Loaded “${file.name}”.`, 'success');
        } catch (e) { if (token === revision) { audio = null; info.replaceChildren(); update(); status.set(e.message, 'error'); } }
      },
    });
    root.append(
      zone, info,
      h('div', { class: 'field-row' },
        field({ label: 'Speed (0.25×–4×)', hint: 'Higher speed raises pitch; linear resampling has no anti-alias filter and may reduce fidelity.', control: speed }),
        field({ label: 'Volume (10%–300%)', hint: 'Above 100%, peaks beyond full scale are hard-clipped and may distort.', control: gain })),
      h('p', { class: 'hint', text: '' }, speedOut),
      actionsRow(btn({ label: 'Export WAV', icon: 'download', onClick: () => {
        try {
          if (!audio) { status.set('Load an audio file first.', 'error'); return; }
          const f = (Number(speed.value) || 100) / 100;
          const g = (Number(gain.value) || 100) / 100;
          if (Math.floor(audio.length / f) * audio.numberOfChannels > 30000000) throw new Error('The slowed output is too large; use a shorter audio file or a faster speed.');
          const chans = [];
          for (let c = 0; c < audio.numberOfChannels; c++) chans.push(applyGain(resampleLinear(audio.getChannelData(c), f), g));
          const wav = encodeWav(chans, audio.sampleRate);
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
          a.download = `speed-${f.toFixed(2)}x.wav`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          status.set(`Exported ${secFmt(audio.duration / f)} WAV (${fmtBytes(wav.byteLength)}).`, 'success');
        } catch (e) { status.set(e.message, 'error'); }
      } })),
      status, privacyNote('Audio processing happens entirely in your browser. Files are never uploaded.'));
  },

  /* ---------- Extract audio from video ---------- */
  'extract-audio'(root) {
    let audio = null, revision = 0;
    let srcName = 'video';
    const info = statsGrid();
    const status = statusLine('Drop a video up to 100 MiB — if your browser can decode its audio track (up to 30 million samples), you can export it as WAV.');
    const zone = dropzone({
      accept: 'video/*,.mp4,.webm,.mov,.m4v,.mkv',
      title: 'Choose a video file or drop it here',
      sub: 'The audio track is decoded locally by your browser — the video is never uploaded',
      onFiles: async ([file]) => {
        const token = ++revision; audio = null; info.replaceChildren();
        try {
          status.set(`Reading “${file.name}” (${fmtBytes(file.size)})…`);
          srcName = file.name.replace(/\.[^.]+$/, '');
          const decoded = await decodeAudio(file, status);
          if (token !== revision) return;
          audio = decoded;
          info.set([
            { label: 'Audio duration', value: secFmt(audio.duration), kind: 'good' },
            { label: 'Channels', value: audio.numberOfChannels === 2 ? 'Stereo' : String(audio.numberOfChannels) },
            { label: 'Sample rate', value: `${audio.sampleRate.toLocaleString()} Hz` },
            { label: 'File', value: fmtBytes(file.size) },
          ]);
          status.set(`Audio track decoded from “${file.name}”. Export it as WAV below.`, 'success');
        } catch (e) { if (token === revision) { info.replaceChildren(); audio = null; status.set(e.message, 'error'); } }
      },
    });
    root.append(
      zone, info,
      actionsRow(btn({ label: 'Export audio as WAV', icon: 'download', onClick: () => {
        try {
          if (!audio) { status.set('Load a video file first.', 'error'); return; }
          const chans = [];
          for (let c = 0; c < audio.numberOfChannels; c++) chans.push(audio.getChannelData(c));
          const wav = encodeWav(chans, audio.sampleRate);
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
          a.download = `${srcName}-audio.wav`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          status.set(`Exported ${secFmt(audio.duration)} WAV (${fmtBytes(wav.byteLength)}).`, 'success');
        } catch (e) { status.set(e.message, 'error'); }
      } })),
      status, privacyNote('Your video never leaves the browser. Only its decoded audio is written to a WAV file.'));
  },

  /* ---------- MP4 inspector ---------- */
  'mp4-inspector'(root) {
    let revision = 0;
    const info = statsGrid();
    const boxes = table({ headers: ['Box', 'Size'], rows: [], caption: 'Top-level boxes' });
    const status = statusLine('Drop an MP4/M4V/MOV file to read its structure — parsed locally, no upload.');
    const zone = dropzone({
      accept: 'video/mp4,.mp4,.m4v,.mov,.m4a',
      title: 'Choose an MP4/MOV file or drop it here',
      sub: 'Parsed byte-by-byte in your browser — nothing is uploaded',
      onFiles: async ([file]) => {
        const token = ++revision; info.replaceChildren(); boxes.update([]);
        try {
          if (file.size > 100 * 1024 * 1024) throw new Error('Choose a file no larger than 100 MiB.');
          status.set(`Parsing “${file.name}”…`);
          const bytes = new Uint8Array(await readFile(file, 'buffer'));
          if (token !== revision) return;
          const p = parseMp4(bytes);
          const duration = p.mvhd && p.mvhd.timescale && p.mvhd.duration != null ? p.mvhd.duration / p.mvhd.timescale : null;
          const kbps = duration ? Math.round((file.size * 8) / duration / 1000) : null;
          const vTrack = p.tracks.find((t) => t.width > 0);
          const codec = p.tracks.map((t) => t.codec).filter(Boolean);
          info.set([
            { label: 'Duration', value: secFmt(duration), kind: 'good' },
            { label: 'Video', value: vTrack ? `${vTrack.width}×${vTrack.height}` : 'not available' },
            { label: 'Codecs', value: codec.length ? codec.join(', ') : '—' },
            { label: 'Avg bitrate', value: kbps ? `${kbps.toLocaleString()} kbps` : '—' },
            { label: 'Brand', value: p.ftyp || '—' },
            { label: 'File size', value: fmtBytes(file.size) },
          ]);
          boxes.update(p.topBoxes.slice(0, 20).map((b) => [b.type, fmtBytes(b.size)]));
          status.set(`Parsed ${p.topBoxes.length} top-level boxes, ${p.tracks.length} track${p.tracks.length === 1 ? '' : 's'}. ${p.warnings.join(' ')} Only the first sample description per track is shown.`, p.warnings.length ? 'warning' : 'success');
        } catch (e) { if (token === revision) { info.replaceChildren(); boxes.update([]); status.set(e.message, 'error'); } }
      },
    });
    root.append(zone, info, boxes, status,
      privacyNote('The file is inspected in your browser memory only — nothing is uploaded or stored.'));
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { synthesizeSamples, resampleLinear, applyGain, encodeWav, sliceBuffer, parseMp4, secFmt };
