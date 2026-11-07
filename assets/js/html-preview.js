// Trusted wrapper only; user code is always placed in an opaque-origin iframe.
const frame = document.querySelector('iframe');
const notice = document.querySelector('#notice');
const id = location.hash.slice(1);
let channel = null;
function connect() {
  if (!/^[0-9a-f]{32}$/.test(id) || typeof BroadcastChannel === 'undefined') {
    notice.textContent = 'This preview needs a supported browser and an open editor tab. Open it from the HTML editor.';
    return;
  }
  try {
    channel = new BroadcastChannel(`iht-html-preview-${id}`);
    channel.onmessage = event => {
      const data = event.data;
      if (!data || data.type !== 'preview' || typeof data.html !== 'string' || data.html.length > 200000) return;
      frame.srcdoc = data.html;
      notice.hidden = true;
    };
    channel.postMessage({ type: 'ready' });
  } catch { notice.textContent = 'Could not connect to the editor. Try a current browser with cross-tab communication enabled.'; }
}
connect();
window.addEventListener('pagehide', () => { channel?.close(); channel = null; });
window.addEventListener('pageshow', event => { if (event.persisted && !channel) connect(); });
