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
  const n = Math.max(1, Math.round(seconds * sampleRate));
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
  if (!(rate > 0)) throw new Error('Speed must be greater than 0.');
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
  if (!(gain >= 0)) throw new Error('Volume factor must be positive.');
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = Math.max(-1, Math.min(1, data[i] * gain));
  return out;
}

/** Encode planar channel data into a 16-bit PCM WAV ArrayBuffer. Pure. */
export function encodeWav(channels, sampleRate) {
  const nCh = channels.length;
  if (!nCh) throw new Error('No audio data to encode.');
  const n = channels[0].length;
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
      const s = Math.max(-1, Math.min(1, channels[c][i] || 0));
      dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return buf;
}

/** Slice an AudioBuffer-like {sampleRate, numberOfChannels, getChannelData} between two times. */
export function sliceBuffer(buf, startSec, endSec) {
  const sr = buf.sampleRate;
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
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12) throw new Error('File is too small to be an MP4.');
  const topBoxes = [];
  let off = 0;
  const total = bytes.byteLength;
  let ftyp = null, mvhd = null, tracks = [];
  const readBox = (start, end, depth, path) => {
    if (end - start < 8) return;
    let size = dv.getUint32(start);
    const type = fourcc(dv, start + 4);
    let header = 8;
    if (size === 1) { // 64-bit size
      if (end - start < 16) return;
      size = Number(dv.getBigUint64(start + 8)) ;
      header = 16;
    } else if (size === 0) size = end - start;
    if (size < header || start + size > end) return;
    const body = start + header;
    if (depth === 0) topBoxes.push({ type, size });
    if (type === 'ftyp' && !ftyp) ftyp = fourcc(dv, body, 0);
    if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type) && depth < 6) {
      // walk children
      let c = body;
      while (c + 8 <= start + size) {
        const declaredChild = dv.getUint32(c);
        readBox(c, start + size, depth + 1, path + '/' + type);
        if (declaredChild < 8) break; // size 0/1 or corrupt — stop this level
        c += declaredChild;
      }
    }
    if (type === 'mvhd' && !mvhd) {
      const version = dv.getUint8(body);
      if (version === 1) {
        mvhd = { timescale: dv.getUint32(body + 20), duration: Number(dv.getBigUint64(body + 24)) };
      } else {
        mvhd = { timescale: dv.getUint32(body + 12), duration: dv.getUint32(body + 16) };
      }
    }
    if (type === 'tkhd') {
      const version = dv.getUint8(body);
      // v0 body: 76 bytes before width; v1 uses 64-bit times (+8 bytes × 2 + 4+4 for the extra time fields)
      const base = body + (version === 1 ? 88 : 76);
      if (base + 8 <= start + size) {
        tracks.push({
          id: dv.getUint32(body + (version === 1 ? 20 : 12)),
          width: dv.getUint32(base) / 65536,
          height: dv.getUint32(base + 4) / 65536,
        });
      }
    }
    if (type === 'mdhd') {
      const version = dv.getUint8(body);
      const t = tracks[tracks.length - 1];
      if (t && !t.timescale) {
        if (version === 1) { t.timescale = dv.getUint32(body + 20); t.duration = Number(dv.getBigUint64(body + 24)); }
        else { t.timescale = dv.getUint32(body + 12); t.duration = dv.getUint32(body + 16); }
      }
    }
    if (type === 'stsd') {
      const t = tracks[tracks.length - 1];
      if (t && !t.codec) {
        // stsd: version/flags(4) entryCount(4) then first entry: size(4) format(4)
        t.codec = fourcc(dv, body + 12);
      }
    }
  };
  try {
    while (off + 8 <= total) {
      const declared = dv.getUint32(off);
      readBox(off, total, 0, '');
      if (declared < 8) break; // 64-bit/corrupt/zero sizes: stop after this box
      off += declared;
    }
  } catch { /* truncated file — report what we found */ }
  if (!topBoxes.length) throw new Error('This does not look like an MP4/MOV file (no boxes found). Use a video file like .mp4 or .mov.');
  return { ftyp, mvhd, tracks, topBoxes, size: total };
}

function secFmt(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? `${h}h ` : '') + `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Decode a file with the browser's audio decoder. Lazily creates/closes an AudioContext. */
async function decodeAudio(file, status) {
  const bytes = await readFile(file, 'buffer');
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('This browser cannot decode audio (no Web Audio support).');
  const ctx = new Ctx();
  try {
    const buf = await new Promise((resolve, reject) => {
      ctx.decodeAudioData(bytes, resolve, () => reject(new Error('The browser could not decode this file’s audio. It may be an unsupported format, DRM-protected, or have no audio track.')));
    });
    return buf;
  } finally { ctx.close().catch(() => {}); }
}

/* ═══════════════════════════ Tool definitions ═══════════════════════════ */
const defs = {
  /* ---------- Tone generator ---------- */
  'tone-generator'(root) {
    let wave = 'sine';
    const freq = input({ type: 'number', min: 1, max: 20000, step: '1', value: '440' });
    const slider = input({ type: 'range', min: '20', max: '2000', step: '1', value: '440' });
    const vol = input({ type: 'range', min: '0', max: '100', step: '1', value: '60' });
    const dur = input({ type: 'number', min: 0.1, max: 60, step: '0.1', value: '2' });
    const grid = statsGrid();
    const status = statusLine('Pick a frequency, then play it or download it as a WAV file.');
    slider.addEventListener('input', () => { freq.value = slider.value; });
    freq.addEventListener('input', () => { const v = Number(freq.value); if (v >= 20 && v <= 2000) slider.value = String(v); });
    const build = () => {
      const samples = synthesizeSamples({ freq: Number(freq.value) || 440, wave, seconds: Number(dur.value) || 2, volume: (Number(vol.value) || 0) / 100 });
      const wav = encodeWav([samples], 44100);
      grid.set([
        { label: 'Frequency', value: `${freq.value} Hz` },
        { label: 'Waveform', value: wave },
        { label: 'Duration', value: `${dur.value} s` },
        { label: 'WAV size', value: fmtBytes(wav.byteLength) },
      ]);
      return wav;
    };
    let ctx = null;
    root.append(
      h('div', { class: 'field-row' },
        field({ label: 'Waveform', control: segControl({
          options: [{ v: 'sine', t: 'Sine' }, { v: 'square', t: 'Square' }, { v: 'sawtooth', t: 'Sawtooth' }, { v: 'triangle', t: 'Triangle' }],
          value: 'sine', onChange: (v) => { wave = v; },
        }) }),
        field({ label: 'Frequency (Hz, 1–20000)', hint: 'A4 = 440 Hz. Middle C ≈ 261.6 Hz.', control: freq }),
        field({ label: 'Duration (seconds, 0.1–60)', control: dur })),
      h('div', { class: 'field-row' },
        field({ label: 'Fine tune (20–2000 Hz)', control: slider }),
        field({ label: 'Volume (%)', control: vol })),
      grid,
      actionsRow(
        btn({ label: 'Play tone', icon: 'zap', onClick: () => {
          try {
            const wav = build();
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) { status.set('This browser cannot play audio. You can still download the WAV.', 'error'); return; }
            ctx = ctx || new Ctx();
            ctx.decodeAudioData(wav, (buf) => {
              const src = ctx.createBufferSource();
              src.buffer = buf; src.connect(ctx.destination); src.start();
              status.set(`Playing ${freq.value} Hz ${wave} for ${dur.value} s…`, 'success');
            }, () => status.set('Playback failed — try downloading the WAV instead.', 'error'));
          } catch (e) { status.set(e.message, 'error'); }
        } }),
        btn({ label: 'Download WAV', variant: 'secondary', icon: 'download', onClick: () => {
          try {
            const wav = build();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
            a.download = `tone-${freq.value}hz-${wave}.wav`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            status.set(`WAV downloaded — ${fmtBytes(wav.byteLength)}.`, 'success');
          } catch (e) { status.set(e.message, 'error'); }
        } })),
      status, privacyNote('The tone is generated mathematically in your browser. Nothing is recorded or sent anywhere.'));
    try { build(); } catch { /* keep the empty grid if defaults are invalid */ }
  },

  /* ---------- Audio trimmer ---------- */
  'audio-trimmer'(root) {
    let audio = null;
    const info = statsGrid();
    const start = input({ type: 'number', min: 0, step: '0.01', value: '0' });
    const end = input({ type: 'number', min: 0, step: '0.01', value: '0' });
    const status = statusLine('Drop an audio file to get started. Decoding happens in your browser.');
    const zone = dropzone({
      accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac',
      title: 'Choose an audio file or drop it here',
      sub: 'MP3, WAV, OGG, M4A… — decoded locally by your browser, never uploaded',
      onFiles: async ([file]) => {
        try {
          status.set(`Decoding “${file.name}” (${fmtBytes(file.size)})…`);
          audio = await decodeAudio(file, status);
          info.set([
            { label: 'Duration', value: secFmt(audio.duration), kind: 'good' },
            { label: 'Channels', value: audio.numberOfChannels === 1 ? 'Mono' : audio.numberOfChannels === 2 ? 'Stereo' : String(audio.numberOfChannels) },
            { label: 'Sample rate', value: `${audio.sampleRate.toLocaleString()} Hz` },
            { label: 'File', value: fmtBytes(file.size) },
          ]);
          start.value = '0';
          end.value = audio.duration.toFixed(2);
          status.set(`Loaded “${file.name}”. Choose the part to keep, then export.`, 'success');
        } catch (e) { info.replaceChildren(); status.set(e.message, 'error'); }
      },
    });
    const playBtn = btn({ label: 'Play selection', variant: 'secondary', icon: 'zap', onClick: () => {
      try {
        if (!audio) { status.set('Load an audio file first.', 'error'); return; }
        const sel = sliceBuffer(audio, Number(start.value) || 0, Number(end.value) || audio.duration);
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
            const sel = sliceBuffer(audio, Number(start.value) || 0, Number(end.value) || audio.duration);
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
    let audio = null;
    const info = statsGrid();
    const speed = input({ type: 'range', min: '25', max: '400', step: '5', value: '100' });
    const gain = input({ type: 'range', min: '10', max: '300', step: '5', value: '100' });
    const speedOut = h('span', { class: 'hint', text: '1.00× — output 0:00' });
    const status = statusLine('Drop an audio file, pick a speed and volume, then export a WAV.');
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
        try {
          status.set(`Decoding “${file.name}”…`);
          audio = await decodeAudio(file, status);
          info.set([
            { label: 'Original duration', value: secFmt(audio.duration) },
            { label: 'Channels', value: String(audio.numberOfChannels) },
            { label: 'Sample rate', value: `${audio.sampleRate.toLocaleString()} Hz` },
            { label: 'File', value: fmtBytes(file.size) },
          ]);
          update();
          status.set(`Loaded “${file.name}”.`, 'success');
        } catch (e) { info.replaceChildren(); status.set(e.message, 'error'); }
      },
    });
    root.append(
      zone, info,
      h('div', { class: 'field-row' },
        field({ label: 'Speed (0.25×–4×)', hint: 'Higher speed raises the pitch, like fast-forward.', control: speed }),
        field({ label: 'Volume (10%–300%)', hint: 'Above 100% the output is limited to avoid clipping.', control: gain })),
      h('p', { class: 'hint', text: '' }, speedOut),
      actionsRow(btn({ label: 'Export WAV', icon: 'download', onClick: () => {
        try {
          if (!audio) { status.set('Load an audio file first.', 'error'); return; }
          const f = (Number(speed.value) || 100) / 100;
          const g = (Number(gain.value) || 100) / 100;
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
    let audio = null;
    let srcName = 'video';
    const info = statsGrid();
    const status = statusLine('Drop a video — if your browser can decode its audio track, you can export it as WAV.');
    const zone = dropzone({
      accept: 'video/*,.mp4,.webm,.mov,.m4v,.mkv',
      title: 'Choose a video file or drop it here',
      sub: 'The audio track is decoded locally by your browser — the video is never uploaded',
      onFiles: async ([file]) => {
        try {
          status.set(`Reading “${file.name}” (${fmtBytes(file.size)})…`);
          srcName = file.name.replace(/\.[^.]+$/, '');
          audio = await decodeAudio(file, status);
          info.set([
            { label: 'Audio duration', value: secFmt(audio.duration), kind: 'good' },
            { label: 'Channels', value: audio.numberOfChannels === 2 ? 'Stereo' : String(audio.numberOfChannels) },
            { label: 'Sample rate', value: `${audio.sampleRate.toLocaleString()} Hz` },
            { label: 'File', value: fmtBytes(file.size) },
          ]);
          status.set(`Audio track decoded from “${file.name}”. Export it as WAV below.`, 'success');
        } catch (e) { info.replaceChildren(); audio = null; status.set(e.message, 'error'); }
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
    const info = statsGrid();
    const boxes = table({ headers: ['Box', 'Size'], rows: [], caption: 'Top-level boxes' });
    const status = statusLine('Drop an MP4/M4V/MOV file to read its structure — parsed locally, no upload.');
    const zone = dropzone({
      accept: 'video/mp4,.mp4,.m4v,.mov,.m4a',
      title: 'Choose an MP4/MOV file or drop it here',
      sub: 'Parsed byte-by-byte in your browser — nothing is uploaded',
      onFiles: async ([file]) => {
        try {
          status.set(`Parsing “${file.name}”…`);
          const bytes = new Uint8Array(await readFile(file, 'buffer'));
          const p = parseMp4(bytes);
          const duration = p.mvhd && p.mvhd.timescale ? p.mvhd.duration / p.mvhd.timescale : null;
          const kbps = duration ? Math.round((file.size * 8) / duration / 1000) : null;
          const vTrack = p.tracks.find((t) => t.width > 0);
          const codec = p.tracks.map((t) => t.codec).filter(Boolean);
          info.set([
            { label: 'Duration', value: secFmt(duration), kind: 'good' },
            { label: 'Video', value: vTrack ? `${vTrack.width}×${vTrack.height}` : 'no video track' },
            { label: 'Codecs', value: codec.length ? codec.join(', ') : '—' },
            { label: 'Avg bitrate', value: kbps ? `${kbps.toLocaleString()} kbps` : '—' },
            { label: 'Brand', value: p.ftyp || '—' },
            { label: 'File size', value: fmtBytes(file.size) },
          ]);
          boxes.update(p.topBoxes.slice(0, 20).map((b) => [b.type, fmtBytes(b.size)]));
          status.set(`Parsed ${p.topBoxes.length} top-level boxes, ${p.tracks.length} track${p.tracks.length === 1 ? '' : 's'}.`, 'success');
        } catch (e) { info.replaceChildren(); boxes.update([]); status.set(e.message, 'error'); }
      },
    });
    root.append(zone, info, boxes, status,
      privacyNote('The file is inspected in your browser memory only — nothing is uploaded or stored.'));
  },
};

export function mount(id) { mountTool(id, defs); }
export const __test = { synthesizeSamples, resampleLinear, applyGain, encodeWav, sliceBuffer, parseMp4, secFmt };
