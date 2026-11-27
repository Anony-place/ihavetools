/* One disposable interpreter per run. The worker is not a security sandbox. */
importScripts('/assets/vendor/pyodide-0.27.7/pyodide.js');
self.onmessage = async ({ data }) => {
  const maxOutput = 100000;
  let chunks = [], total = 0, truncated = false;
  const decoder = new TextDecoder();
  const write = bytes => {
    const remaining = Math.max(0, maxOutput - total);
    if (bytes.length > remaining) truncated = true;
    if (remaining) { const part = bytes.subarray(0, remaining); chunks.push(decoder.decode(part, {stream:true})); total += part.length; }
    return bytes.length;
  };
  try {
    const py = await loadPyodide({ indexURL: '/assets/vendor/pyodide-0.27.7/' });
    self.postMessage({ type: 'ready' });
    const encoded = new TextEncoder().encode(data.stdin);
    let offset = 0;
    py.setStdin({ read: buffer => { const n = Math.min(buffer.length, encoded.length - offset); buffer.set(encoded.subarray(offset, offset + n)); offset += n; return n; } });
    py.setStdout({ write }); py.setStderr({ write });
    let error = '';
    try { py.runPython(data.code); } catch (e) { error = String(e); }
    chunks.push(decoder.decode());
    self.postMessage({ type:'result', output:chunks.join(''), error:error.slice(0, 10000), truncated });
  } catch (e) {
    self.postMessage({ type:'failure', message:String(e).slice(0, 1000) });
  }
};
