import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const origin = 'https://i-have-tools.vercel.app';
const stores = new Map();
const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      async addAll(paths) { for (const path of paths) { assert.equal(path.cache, 'reload', 'core must bypass stale HTTP cache'); store.set(key(path), new Response(`core:${new URL(path.url).pathname}`)); } },
      async put(req, res) { store.set(key(req), res); },
      async match(req) { return store.get(key(req))?.clone(); },
      async keys() { return [...store.keys()]; },
      async delete(req) { return store.delete(key(req)); },
    };
  },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); },
  async match(req) { for (const name of stores.keys()) { const hit = await (await this.open(name)).match(req); if (hit) return hit; } },
};
const listeners = {};
let online = true;
let status = 200;
let lastFetchOptions;
const self = { location: { origin }, clients: { claim: async () => {} }, skipWaiting: async () => {}, addEventListener: (name, cb) => { listeners[name] = cb; } };
vm.runInNewContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), { self, caches, URL, Request, Response, fetch: async (req, options) => {
  lastFetchOptions = options;
  if (!online) throw Error('offline');
  return new Response(`network:${req.url}`, { status });
} });
async function lifecycle(name) { let promise; listeners[name]({ waitUntil(p) { promise = p; } }); await promise; }
async function request(path, mode = 'navigate', method = 'GET') {
  let promise;
  const requested = new URL(path, origin); requested.hash = ''; // browsers omit fragments from HTTP requests
  listeners.fetch({ request: { url: requested.href, mode, method }, respondWith(p) { promise = p; } });
  return promise && await promise;
}
await caches.open('unrelated-app');
await caches.open('iht-v2');
await caches.open('iht-v3-pages');
await lifecycle('install');
await lifecycle('activate');
assert.ok(stores.has('unrelated-app')); assert.ok(!stores.has('iht-v2')); assert.ok(!stores.has('iht-v3-pages'));
assert.match(await (await request('/tools/example/')).text(), /network:/);
assert.match(await (await request('/tools/example/?secret=private')).text(), /network:/);
assert.match(await (await request('/tools/fragment/#iht=income%3Dsecret')).text(), /network:.*fragment\/$/);
assert.equal([...stores.values()].some((s) => [...s.keys()].some((k) => k.includes('secret'))), false);
await request('/assets/js/tools/example.js', 'cors');
assert.equal(lastFetchOptions.cache, 'no-cache', 'deployed assets must revalidate the HTTP cache');
status = 404; await request('/missing/'); status = 200;
online = false;
assert.match(await (await request('/tools/example/?secret=other')).text(), /network:.*example\/$/);
assert.equal(await (await request('/missing/')).text(), 'core:/offline.html');
assert.match(await (await request('/assets/js/tools/example.js', 'cors')).text(), /network:/);
assert.equal(await (await request('/assets/js/missing.js', 'cors')).type, 'error');
assert.equal(await request('https://other.example/file', 'cors'), undefined);
assert.equal(await request('/tools/example/', 'navigate', 'POST'), undefined);
online = true;
for (let i = 0; i < 110; i++) await request(`/tools/item-${i}/`);
assert.equal(stores.get('iht-v4-pages').size, 100);
console.log('Service worker tests: lifecycle, privacy, offline, errors and cache limit passed');
