const CACHE = 'bluedobie-library-static-v5';
const ASSETS = ['./index.html', './style.css', './app.js', './offline.js', './library.json', './manifest.webmanifest', './icon.png'];
const assetURLs = ASSETS.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(assetURLs)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  // Keep earlier versions until normal browser eviction. An open older tab may still need them.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_OFFLINE' || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // Refill missing assets online; an offline failure must never claim readiness.
      const missing = [];
      for (const url of assetURLs) if (!(await cache.match(url))) missing.push(url);
      if (missing.length) {
        if (event.data.allowRepair !== true) {
          event.ports[0].postMessage({ok: false});
          return;
        }
        await cache.addAll(missing);
      }
      const complete = (await Promise.all(assetURLs.map(url => cache.match(url)))).every(Boolean);
      event.ports[0].postMessage({ok: complete, cache: CACHE});
    } catch (_) {
      event.ports[0].postMessage({ok: false});
    }
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Use one cache generation for both the app shell and its data, even while online.
    const key = request.mode === 'navigate' ? assetURLs[0] : request;
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && assetURLs.includes(url.href)) await cache.put(request, response.clone());
    return response;
  })());
});
