// iHaveTools service worker — static asset caching only.
// Lives at the domain root so its scope covers the whole site (a worker
// under /assets/ could only control /assets/*). Registered ONLY on real
// HTTPS hosts (see site.js). Bump VERSION on every deploy that changes
// CSS/JS so clients drop old caches.
const VERSION = 'iht-v2';
const CORE = [
  '/assets/css/styles.css',
  '/assets/js/icons.js',
  '/assets/js/ui.js',
  '/assets/js/site.js',
  '/assets/js/search-index.js',
  '/assets/icons/favicon.svg',
  '/assets/icons/sprite.svg',
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
    // Static assets: stale-while-revalidate — serve the cached copy
    // instantly, refresh it in the background for the next visit.
    event.respondWith(
      caches.open(VERSION).then((cache) => cache.match(req).then((hit) => {
        const network = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || network;
      })),
    );
    return;
  }
  // Navigations & everything else: network-first so HTML is never stale,
  // cache fallback keeps visited pages (and the homepage) working offline.
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
