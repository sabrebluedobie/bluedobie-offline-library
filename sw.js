const CACHE = 'bluedobie-library-static-v11';
const ASSETS = ['./index.html', './style.css', './app.js', './offline.js', './library.json', './manifest.webmanifest', './icon.png', './originals.json', './originals.js', './viewer.html', './viewer.css', './viewer.js'];
ASSETS.push(...["./vendor/pdfjs/LICENSE", "./vendor/pdfjs/pdf.worker.min.mjs", "./vendor/pdfjs/pdf.min.mjs", "./vendor/pdfjs/VERSION.txt", "./vendor/pdfjs/iccs/CGATS001Compat-v2-micro.icc", "./vendor/pdfjs/iccs/LICENSE", "./vendor/pdfjs/wasm/LICENSE_JBIG2", "./vendor/pdfjs/wasm/openjpeg.wasm", "./vendor/pdfjs/wasm/jbig2.wasm", "./vendor/pdfjs/wasm/LICENSE_PDFJS_QUICKJS", "./vendor/pdfjs/wasm/jbig2_nowasm_fallback.js", "./vendor/pdfjs/wasm/openjpeg_nowasm_fallback.js", "./vendor/pdfjs/wasm/quickjs-eval.wasm", "./vendor/pdfjs/wasm/LICENSE_QUICKJS", "./vendor/pdfjs/wasm/LICENSE_QCMS", "./vendor/pdfjs/wasm/LICENSE_PDFJS_JBIG2", "./vendor/pdfjs/wasm/quickjs-eval.js", "./vendor/pdfjs/wasm/LICENSE_OPENJPEG", "./vendor/pdfjs/wasm/LICENSE_PDFJS_OPENJPEG", "./vendor/pdfjs/wasm/qcms_bg.wasm", "./vendor/pdfjs/wasm/LICENSE_PDFJS_QCMS", "./vendor/pdfjs/standard_fonts/FoxitDingbats.pfb", "./vendor/pdfjs/standard_fonts/LiberationSans-Bold.ttf", "./vendor/pdfjs/standard_fonts/FoxitSymbol.pfb", "./vendor/pdfjs/standard_fonts/LiberationSans-BoldItalic.ttf", "./vendor/pdfjs/standard_fonts/LICENSE_LIBERATION", "./vendor/pdfjs/standard_fonts/FoxitFixedBoldItalic.pfb", "./vendor/pdfjs/standard_fonts/FoxitFixedItalic.pfb", "./vendor/pdfjs/standard_fonts/FoxitSerifItalic.pfb", "./vendor/pdfjs/standard_fonts/FoxitSerifBoldItalic.pfb", "./vendor/pdfjs/standard_fonts/FoxitSerifBold.pfb", "./vendor/pdfjs/standard_fonts/FoxitFixed.pfb", "./vendor/pdfjs/standard_fonts/LiberationSans-Italic.ttf", "./vendor/pdfjs/standard_fonts/FoxitSerif.pfb", "./vendor/pdfjs/standard_fonts/LICENSE_FOXIT", "./vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf", "./vendor/pdfjs/standard_fonts/FoxitFixedBold.pfb", "./vendor/pdfjs/cmaps/78-EUC-V.bcmap", "./vendor/pdfjs/cmaps/GBKp-EUC-H.bcmap", "./vendor/pdfjs/cmaps/Katakana.bcmap", "./vendor/pdfjs/cmaps/KSCpc-EUC-H.bcmap", "./vendor/pdfjs/cmaps/Adobe-CNS1-UCS2.bcmap", "./vendor/pdfjs/cmaps/Adobe-CNS1-5.bcmap", "./vendor/pdfjs/cmaps/Adobe-Japan1-6.bcmap", "./vendor/pdfjs/cmaps/Adobe-Japan1-4.bcmap", "./vendor/pdfjs/cmaps/Adobe-Japan1-UCS2.bcmap", "./vendor/pdfjs/cmaps/HKscs-B5-H.bcmap", "./vendor/pdfjs/cmaps/UniJISX0213-UTF32-H.bcmap", "./vendor/pdfjs/cmaps/HKdla-B5-V.bcmap", "./vendor/pdfjs/cmaps/ETenms-B5-H.bcmap", "./vendor/pdfjs/cmaps/H.bcmap", "./vendor/pdfjs/cmaps/Adobe-Korea1-UCS2.bcmap", "./vendor/pdfjs/cmaps/UniJIS-UTF8-V.bcmap", "./vendor/pdfjs/cmaps/WP-Symbol.bcmap", "./vendor/pdfjs/cmaps/Add-H.bcmap", "./vendor/pdfjs/cmaps/Adobe-Japan1-0.bcmap", "./vendor/pdfjs/cmaps/Adobe-CNS1-3.bcmap", "./vendor/pdfjs/cmaps/HKm314-B5-H.bcmap", "./vendor/pdfjs/cmaps/UniCNS-UTF8-V.bcmap", "./vendor/pdfjs/cmaps/LICENSE", "./vendor/pdfjs/cmaps/ETHK-B5-H.bcmap", "./vendor/pdfjs/cmaps/KSC-Johab-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-CNS1-1.bcmap", "./vendor/pdfjs/cmaps/UniGB-UCS2-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-Japan1-2.bcmap", "./vendor/pdfjs/cmaps/KSC-V.bcmap", "./vendor/pdfjs/cmaps/UniJISPro-UTF8-V.bcmap", "./vendor/pdfjs/cmaps/KSC-EUC-H.bcmap", "./vendor/pdfjs/cmaps/RKSJ-H.bcmap", "./vendor/pdfjs/cmaps/Add-RKSJ-V.bcmap", "./vendor/pdfjs/cmaps/UniKS-UCS2-V.bcmap", "./vendor/pdfjs/cmaps/78-V.bcmap", "./vendor/pdfjs/cmaps/CNS-EUC-H.bcmap", "./vendor/pdfjs/cmaps/HKm471-B5-V.bcmap", "./vendor/pdfjs/cmaps/HKgccs-B5-H.bcmap", "./vendor/pdfjs/cmaps/UniCNS-UTF8-H.bcmap", "./vendor/pdfjs/cmaps/HKm314-B5-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-Japan1-5.bcmap", "./vendor/pdfjs/cmaps/Adobe-CNS1-6.bcmap", "./vendor/pdfjs/cmaps/Add-V.bcmap", "./vendor/pdfjs/cmaps/UniJIS-UTF8-H.bcmap", "./vendor/pdfjs/cmaps/UniJISPro-UCS2-HW-V.bcmap", "./vendor/pdfjs/cmaps/HKgccs-B5-V.bcmap", "./vendor/pdfjs/cmaps/HKm471-B5-H.bcmap", "./vendor/pdfjs/cmaps/CNS-EUC-V.bcmap", "./vendor/pdfjs/cmaps/78-H.bcmap", "./vendor/pdfjs/cmaps/UniKS-UCS2-H.bcmap", "./vendor/pdfjs/cmaps/KSC-EUC-V.bcmap", "./vendor/pdfjs/cmaps/Add-RKSJ-H.bcmap", "./vendor/pdfjs/cmaps/RKSJ-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-CNS1-4.bcmap", "./vendor/pdfjs/cmaps/UniGB-UCS2-H.bcmap", "./vendor/pdfjs/cmaps/KSC-Johab-H.bcmap", "./vendor/pdfjs/cmaps/KSC-H.bcmap", "./vendor/pdfjs/cmaps/ETHK-B5-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-CNS1-0.bcmap", "./vendor/pdfjs/cmaps/Adobe-Japan1-3.bcmap", "./vendor/pdfjs/cmaps/KSCpc-EUC-V.bcmap", "./vendor/pdfjs/cmaps/GBKp-EUC-V.bcmap", "./vendor/pdfjs/cmaps/78-EUC-H.bcmap", "./vendor/pdfjs/cmaps/Roman.bcmap", "./vendor/pdfjs/cmaps/V.bcmap", "./vendor/pdfjs/cmaps/ETenms-B5-V.bcmap", "./vendor/pdfjs/cmaps/HKdla-B5-H.bcmap", "./vendor/pdfjs/cmaps/UniJISX0213-UTF32-V.bcmap", "./vendor/pdfjs/cmaps/HKscs-B5-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-Japan1-1.bcmap", "./vendor/pdfjs/cmaps/Adobe-CNS1-2.bcmap", "./vendor/pdfjs/cmaps/90msp-RKSJ-V.bcmap", "./vendor/pdfjs/cmaps/B5pc-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-GB1-1.bcmap", "./vendor/pdfjs/cmaps/B5-H.bcmap", "./vendor/pdfjs/cmaps/UniCNS-UTF16-V.bcmap", "./vendor/pdfjs/cmaps/UniGB-UTF16-H.bcmap", "./vendor/pdfjs/cmaps/Hankaku.bcmap", "./vendor/pdfjs/cmaps/90ms-RKSJ-V.bcmap", "./vendor/pdfjs/cmaps/EUC-V.bcmap", "./vendor/pdfjs/cmaps/UniJIS2004-UTF16-H.bcmap", "./vendor/pdfjs/cmaps/UniJIS2004-UTF8-H.bcmap", "./vendor/pdfjs/cmaps/GBTpc-EUC-V.bcmap", "./vendor/pdfjs/cmaps/UniCNS-UTF32-H.bcmap", "./vendor/pdfjs/cmaps/UniGB-UTF32-V.bcmap", "./vendor/pdfjs/cmaps/GBT-H.bcmap", "./vendor/pdfjs/cmaps/78-RKSJ-H.bcmap", "./vendor/pdfjs/cmaps/78ms-RKSJ-H.bcmap", "./vendor/pdfjs/cmaps/HKdlb-B5-H.bcmap", "./vendor/pdfjs/cmaps/83pv-RKSJ-H.bcmap", "./vendor/pdfjs/cmaps/GBT-EUC-H.bcmap", "./vendor/pdfjs/cmaps/UniJIS2004-UTF32-V.bcmap", "./vendor/pdfjs/cmaps/GBpc-EUC-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-Korea1-1.bcmap", "./vendor/pdfjs/cmaps/ETen-B5-H.bcmap", "./vendor/pdfjs/cmaps/KSCms-UHC-HW-H.bcmap", "./vendor/pdfjs/cmaps/CNS1-V.bcmap", "./vendor/pdfjs/cmaps/GBK-EUC-H.bcmap", "./vendor/pdfjs/cmaps/Ext-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-GB1-3.bcmap", "./vendor/pdfjs/cmaps/UniJIS-UCS2-H.bcmap", "./vendor/pdfjs/cmaps/CNS2-H.bcmap", "./vendor/pdfjs/cmaps/UniKS-UTF16-V.bcmap", "./vendor/pdfjs/cmaps/NWP-V.bcmap", "./vendor/pdfjs/cmaps/KSCms-UHC-V.bcmap", "./vendor/pdfjs/cmaps/GB-V.bcmap", "./vendor/pdfjs/cmaps/UniJIS-UTF32-V.bcmap", "./vendor/pdfjs/cmaps/UniJIS-UCS2-HW-H.bcmap", "./vendor/pdfjs/cmaps/UniCNS-UCS2-H.bcmap", "./vendor/pdfjs/cmaps/UniJISX02132004-UTF32-H.bcmap", "./vendor/pdfjs/cmaps/UniGB-UTF8-H.bcmap", "./vendor/pdfjs/cmaps/GB-EUC-V.bcmap", "./vendor/pdfjs/cmaps/UniJIS-UTF16-H.bcmap", "./vendor/pdfjs/cmaps/Adobe-GB1-5.bcmap", "./vendor/pdfjs/cmaps/UniKS-UTF8-H.bcmap", "./vendor/pdfjs/cmaps/UniKS-UTF32-H.bcmap", "./vendor/pdfjs/cmaps/90pv-RKSJ-H.bcmap", "./vendor/pdfjs/cmaps/GBK2K-V.bcmap", "./vendor/pdfjs/cmaps/Ext-RKSJ-V.bcmap", "./vendor/pdfjs/cmaps/UniCNS-UCS2-V.bcmap", "./vendor/pdfjs/cmaps/UniJIS-UCS2-HW-V.bcmap", "./vendor/pdfjs/cmaps/UniJIS-UTF32-H.bcmap", "./vendor/pdfjs/cmaps/GB-H.bcmap", "./vendor/pdfjs/cmaps/KSCms-UHC-H.bcmap", "./vendor/pdfjs/cmaps/NWP-H.bcmap", "./vendor/pdfjs/cmaps/UniKS-UTF16-H.bcmap", "./vendor/pdfjs/cmaps/Adobe-GB1-2.bcmap", "./vendor/pdfjs/cmaps/CNS2-V.bcmap", "./vendor/pdfjs/cmaps/Hiragana.bcmap", "./vendor/pdfjs/cmaps/UniJIS-UCS2-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-Korea1-0.bcmap", "./vendor/pdfjs/cmaps/GBK2K-H.bcmap", "./vendor/pdfjs/cmaps/90pv-RKSJ-V.bcmap", "./vendor/pdfjs/cmaps/Ext-RKSJ-H.bcmap", "./vendor/pdfjs/cmaps/Adobe-Korea1-2.bcmap", "./vendor/pdfjs/cmaps/UniKS-UTF32-V.bcmap", "./vendor/pdfjs/cmaps/UniKS-UTF8-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-GB1-0.bcmap", "./vendor/pdfjs/cmaps/UniJIS-UTF16-V.bcmap", "./vendor/pdfjs/cmaps/UniJISPro-UCS2-V.bcmap", "./vendor/pdfjs/cmaps/GB-EUC-H.bcmap", "./vendor/pdfjs/cmaps/UniGB-UTF8-V.bcmap", "./vendor/pdfjs/cmaps/UniJISX02132004-UTF32-V.bcmap", "./vendor/pdfjs/cmaps/GBTpc-EUC-H.bcmap", "./vendor/pdfjs/cmaps/Adobe-GB1-UCS2.bcmap", "./vendor/pdfjs/cmaps/UniJIS2004-UTF16-V.bcmap", "./vendor/pdfjs/cmaps/UniJIS2004-UTF8-V.bcmap", "./vendor/pdfjs/cmaps/90ms-RKSJ-H.bcmap", "./vendor/pdfjs/cmaps/EUC-H.bcmap", "./vendor/pdfjs/cmaps/UniGB-UTF16-V.bcmap", "./vendor/pdfjs/cmaps/UniCNS-UTF16-H.bcmap", "./vendor/pdfjs/cmaps/B5pc-H.bcmap", "./vendor/pdfjs/cmaps/90msp-RKSJ-H.bcmap", "./vendor/pdfjs/cmaps/B5-V.bcmap", "./vendor/pdfjs/cmaps/Adobe-GB1-4.bcmap", "./vendor/pdfjs/cmaps/Ext-H.bcmap", "./vendor/pdfjs/cmaps/GBK-EUC-V.bcmap", "./vendor/pdfjs/cmaps/CNS1-H.bcmap", "./vendor/pdfjs/cmaps/ETen-B5-V.bcmap", "./vendor/pdfjs/cmaps/KSCms-UHC-HW-V.bcmap", "./vendor/pdfjs/cmaps/UniJIS2004-UTF32-H.bcmap", "./vendor/pdfjs/cmaps/GBpc-EUC-H.bcmap", "./vendor/pdfjs/cmaps/GBT-EUC-V.bcmap", "./vendor/pdfjs/cmaps/HKdlb-B5-V.bcmap", "./vendor/pdfjs/cmaps/78ms-RKSJ-V.bcmap", "./vendor/pdfjs/cmaps/78-RKSJ-V.bcmap", "./vendor/pdfjs/cmaps/GBT-V.bcmap", "./vendor/pdfjs/cmaps/UniGB-UTF32-H.bcmap", "./vendor/pdfjs/cmaps/UniCNS-UTF32-V.bcmap"]);
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
