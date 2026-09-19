// iHaveTools service worker — static asset caching only.
// Registered ONLY on production hosts (see site.js). Keeps repeat visits fast;
// HTML is always network-first so pages are never stale.
const VERSION = 'iht-v1';
const CORE = [
  '/assets/css/styles.css',
  '/assets/js/icons.js',
  '/assets/js/ui.js',
  '/assets/js/registry.js',
  '/assets/js/site.js',
  '/assets/icons/favicon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  const url = new URL(req.url);

  if (url.pathname.startsWith('/assets/')) {
    // static assets: cache-first (versioned by SW VERSION on deploy)
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }
  // navigations & everything else: network-first, cache fallback (offline)
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
  );
});
