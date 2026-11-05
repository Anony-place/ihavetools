// Static, same-origin resources only. Never cache tool inputs or uploaded files.
const VERSION = 'iht-v3';
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const CORE = ['/', '/offline.html', '/assets/css/styles.css', '/assets/js/icons.js',
  '/assets/js/ui.js', '/assets/js/site.js', '/assets/js/search-index.js',
  '/assets/icons/favicon.svg', '/assets/icons/sprite.svg',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/manifest.webmanifest'];
const LIMIT = 100;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith('iht-') && ![VERSION, PAGES, ASSETS].includes(key))
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
async function remember(name, request, response) {
  if (!response.ok || response.type === 'opaque') return;
  try {
    const cache = await caches.open(name);
    await cache.put(request, response);
    const keys = await cache.keys();
    while (keys.length > LIMIT) await cache.delete(keys.shift());
  } catch { /* Quota or private browsing: networking must still work. */ }
}
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(req);
        // Do not persist query strings (which can contain user-provided inputs).
        if (!url.search && response.ok) await remember(PAGES, req, response.clone());
        return response;
      } catch {
        const path = url.origin + url.pathname;
        return (await (await caches.open(PAGES)).match(path)) || (await (await caches.open(VERSION)).match(path)) || (await caches.match('/offline.html')) || Response.error();
      }
    })());
  } else if (url.pathname.startsWith('/assets/') && !url.search) {
    // Network first avoids serving old JS/CSS after deployment; cached copies
    // remain available when offline. Do not cache non-asset API responses.
    event.respondWith((async () => {
      try {
        const response = await fetch(req);
        if (response.ok) await remember(ASSETS, req, response.clone());
        return response;
      } catch { return (await (await caches.open(ASSETS)).match(req)) || (await caches.match(req)) || Response.error(); }
    })());
  }
});
