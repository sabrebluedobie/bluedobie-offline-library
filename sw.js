const CACHE = 'bluedobie-library-static-v8';
const ASSETS = ['./index.html', './style.css', './app.js', './offline.js', './library.json', './manifest.webmanifest', './icon.png', './originals.json', './originals.js', './viewer.html', './viewer.css', './viewer.js'];
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
    const shellPath = new URL(self.registration.scope).pathname;
    const isShell = url.pathname === shellPath || url.pathname === shellPath + 'index.html';
    if (url.pathname.startsWith(shellPath + 'originals/')) {
      const documents = await caches.open('bluedobie-originals-v1');
      const saved = await documents.match(url.origin + url.pathname);
      if (saved) return pdfRange(saved, request.headers?.get('Range'));
      try { return await fetch(request); } catch (_) { return new Response('Original not saved on this device. Open the library online and save it first.', {status:503,headers:{'Content-Type':'text/plain'}}); }
    }
    const isViewer = url.pathname === shellPath + 'viewer.html';
    const key = request.mode === 'navigate' && isShell ? assetURLs[0] :
      isViewer ? new URL('./viewer.html', self.registration.scope).href : request;
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && assetURLs.includes(url.href)) await cache.put(request, response.clone());
    return response;
  })());
});

// Safari/PDF viewers may ask for byte ranges even when the complete PDF is cached.
async function pdfRange(response, header) {
  if (!header) return response;
  const bytes = await response.arrayBuffer();
  const size = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return new Response(null, {status:416,headers:{'Content-Range':`bytes */${size}`}});
  let start = match[1] ? Number(match[1]) : Math.max(0,size-Number(match[2]));
  let end = match[1] ? (match[2] ? Math.min(Number(match[2]),size-1) : size-1) : size-1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':'application/pdf','Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1)}});
}
