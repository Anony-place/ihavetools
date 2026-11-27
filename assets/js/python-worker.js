/* One disposable interpreter per run. The worker is not a security sandbox. */
importScripts('/assets/vendor/pyodide-0.27.7/pyodide.js');
self.onmessage = async ({ data }) => {
  const maxOutput = 100000;
  let pending = '', total = 0, truncated = false, lastSent = 0;
  const decoder = new TextDecoder();
  const write = bytes => {
    const remaining = Math.max(0, maxOutput - total);
    if (bytes.length > remaining) truncated = true;
    if (remaining) {
      const part = bytes.subarray(0, remaining);
      pending += decoder.decode(part, {stream:true}); total += part.length;
      // Avoid flooding the UI with one message per byte or line, while showing
      // the first output immediately and subsequent output during long runs.
      const now = Date.now();
      if (pending && (lastSent === 0 || pending.length >= 1024 || now - lastSent >= 100)) {
        self.postMessage({type:'output', text:pending}); pending = ''; lastSent = now;
      }
    }
    return bytes.length;
  };
  try {
    const py = await loadPyodide({ indexURL: '/assets/vendor/pyodide-0.27.7/' });
    self.postMessage({ type: 'ready' });
    const shared = new Int32Array(data.stdinBuffer);
    const sharedBytes = new Uint8Array(data.stdinBuffer, 8);
    const decoder = new TextDecoder();
    const answers = data.stdin ? data.stdin.split(/\\r?\\n/) : [];
    if (data.stdin && /\\r?\\n$/.test(data.stdin)) answers.pop();
    let answerIndex = 0;
    py.setStdin({ stdin: prompt => {
      if (answerIndex < answers.length) return answers[answerIndex++];
      self.postMessage({ type:'input-request', prompt:String(prompt || '') });
      while (Atomics.load(shared, 0) === 0) Atomics.wait(shared, 0, 0, 1000);
      const state = Atomics.exchange(shared, 0, 0);
      if (state === 2) throw new Error('Execution stopped while waiting for input.');
      const length = Atomics.load(shared, 1);
      const answer = decoder.decode(sharedBytes.subarray(0, length));
      Atomics.store(shared, 1, 0);
      return answer;
    }, isatty:true });
    py.setStdout({ write }); py.setStderr({ write });
    let error = '';
    try { py.runPython(data.code); } catch (e) { error = String(e); }
    pending += decoder.decode();
    self.postMessage({ type:'result', output:pending, error:error.slice(0, 10000), truncated });
  } catch (e) {
    self.postMessage({ type:'failure', message:String(e).slice(0, 1000) });
  }
};
