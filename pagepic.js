'use strict';
// Draws pictures of original PDF pages on this device with the bundled PDF.js, and
// highlights the searched words on the page. Used by search results and the viewer.
// Needs the installed (http/https) app: browsers block PDF.js when opened from local files.
(function () {
  const LOCAL_FILE = location.protocol === 'file:';
  const docs = new Map();
  let library = null, sharedWorker = null, queue = Promise.resolve();

  const asset = p => new URL('./vendor/pdfjs/' + p, document.baseURI).href;
  const DOCUMENT_OPTIONS = {cMapPacked: true, isEvalSupported: false};

  function loadLibrary() {
    if (LOCAL_FILE) return Promise.reject(Error('Page pictures work in the installed app. This copy was opened from local files, so use “Open page” instead.'));
    library = library || import('./vendor/pdfjs/pdf.min.mjs').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = asset('pdf.worker.min.mjs');
      return pdfjs;
    }).catch(error => { library = null; throw error; });
    return library;
  }

  async function sha256(bytes) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  }

  // Load and verify one original (size, hash and page count) once per page view.
  function openDocument(item) {
    if (!docs.has(item.id)) {
      docs.set(item.id, (async () => {
        if (!/^originals\/[a-f0-9]{64}\.pdf$/.test(item.path)) throw Error('Unknown document');
        const pdfjs = await loadLibrary();
        const response = await fetch(item.path);
        if (!response.ok) throw Error('This PDF is not saved on this device yet. Open the library online once to save it.');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== item.bytes || await sha256(bytes) !== item.sha256) throw Error('PDF verification failed. Reopen the library online to save it again.');
        sharedWorker = sharedWorker || new pdfjs.PDFWorker();
        const pdf = await pdfjs.getDocument({...DOCUMENT_OPTIONS, data: new Uint8Array(bytes), worker: sharedWorker,
          cMapUrl: asset('cmaps/'), standardFontDataUrl: asset('standard_fonts/'), wasmUrl: asset('wasm/'), iccUrl: asset('iccs/')}).promise;
        if (pdf.numPages !== item.pages) throw Error('PDF page count does not match verified source.');
        return {pdfjs, pdf};
      })().catch(error => { docs.delete(item.id); throw error; }));
    }
    return docs.get(item.id);
  }

  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h * 0.8 && b.y < a.y + a.h * 0.8;

  // Is there printed ink under this rectangle? Text that is clipped away (for example a
  // table title from the next page inside a placed figure) is in the PDF but not visible.
  function hasInk(ctx, r) {
    const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
    const w = Math.min(ctx.canvas.width - x, Math.ceil(r.w)), h = Math.min(ctx.canvas.height - y, Math.ceil(r.h));
    if (w < 1 || h < 1) return false;
    const d = ctx.getImageData(x, y, w, h).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 420) dark++;
    return dark / (w * h) > 0.03;
  }

  // Rectangles (in canvas pixels) for every visible word on the page whose stem is in the query.
  async function matchRects(pdfjs, page, viewport, query, ctx) {
    const S = window.LibrarySearch;
    if (!query || !S || !query.marks.size) return [];
    const content = await page.getTextContent({includeMarkedContent: true});
    const boxes = [];
    let figureDepth = 0;
    const stack = [];
    for (const item of content.items) {
      if (item.type === 'beginMarkedContent' || item.type === 'beginMarkedContentProps') { const fig = /^(Figure|PlacedPDF)$/.test(item.tag); stack.push(fig); if (fig) figureDepth++; continue; }
      if (item.type === 'endMarkedContent') { if (stack.pop()) figureDepth--; continue; }
      if (!item.str || !item.str.trim()) continue;
      const tx = pdfjs.Util.transform(viewport.transform, item.transform);
      if (Math.abs(tx[1]) > 0.01 || Math.abs(tx[2]) > 0.01) continue; // rotated text: skip
      const height = Math.hypot(tx[2], tx[3]);
      boxes.push({item, inFigure: figureDepth > 0, x: tx[4], y: tx[5] - height, w: item.width * viewport.scale, h: height * 1.15});
    }
    const rects = [];
    for (const box of boxes) {
      const toks = S.tokens(box.item.str).filter(t => query.marks.has(t.stem));
      if (!toks.length) continue;
      // Figure text lying on top of ordinary page text has been clipped out of view.
      if (box.inFigure && boxes.some(b => !b.inFigure && overlaps(box, b))) continue;
      // Place each word by its measured share of the line's width (closer than counting letters).
      const str = S.normalize(box.item.str);
      let measure = s => s.length;
      if (ctx) { ctx.save(); ctx.font = '100px sans-serif'; const full = ctx.measureText(str).width; ctx.restore(); if (full > 0) measure = s => { ctx.save(); ctx.font = '100px sans-serif'; const w = ctx.measureText(s).width; ctx.restore(); return w * str.length / full; }; }
      const len = str.length || 1;
      for (const t of toks) {
        const x0 = measure(str.slice(0, t.start)), x1 = measure(str.slice(0, t.end));
        const r = {x: box.x + box.w * x0 / len, y: box.y, w: box.w * (x1 - x0) / len, h: box.h};
        if (!ctx || hasInk(ctx, r)) rects.push(r);
      }
    }
    return rects;
  }

  function paintMarks(ctx, rects, ratio) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(255, 205, 0, 0.6)';
    for (const r of rects) ctx.fillRect(r.x - 2 * ratio, r.y - ratio, r.w + 4 * ratio, r.h + 2 * ratio);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(214, 110, 0, 0.9)';
    ctx.lineWidth = 1.5 * ratio;
    for (const r of rects) ctx.strokeRect(r.x - 2 * ratio, r.y - ratio, r.w + 4 * ratio, r.h + 2 * ratio);
    ctx.restore();
  }

  // Render page `number` into `canvas` at `cssWidth` CSS pixels wide, highlighting query words.
  async function draw(item, number, canvas, cssWidth, query) {
    const {pdfjs, pdf} = await openDocument(item);
    const page = await pdf.getPage(number);
    const base = page.getViewport({scale: 1});
    const scale = cssWidth / base.width;
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4000000 / (base.width * base.height * scale * scale)));
    const viewport = page.getViewport({scale: scale * ratio});
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const task = page.render({canvasContext: ctx, viewport});
    await task.promise;
    const rects = await matchRects(pdfjs, page, viewport, query, ctx);
    paintMarks(ctx, rects, ratio);
    page.cleanup();
    return {rects, ratio, cssHeight: base.height * scale, task};
  }

  // A picture for a search result: by default a band of the page around the densest
  // group of matches, or the whole page. Rendering is queued to keep phones responsive.
  function picture(item, number, query, {cssWidth, whole = false} = {}) {
    const job = queue.then(async () => {
      const canvas = document.createElement('canvas');
      const {rects} = await draw(item, number, canvas, cssWidth, query);
      let out = canvas;
      if (!whole && rects.length) {
        const band = Math.min(canvas.height, Math.round(canvas.width * 0.7));
        let bestY = rects[0].y, bestCount = 0;
        for (const r of rects) {
          const count = rects.filter(o => Math.abs(o.y - r.y) < band / 2).length;
          if (count > bestCount) { bestCount = count; bestY = r.y; }
        }
        const top = Math.max(0, Math.min(canvas.height - band, Math.round(bestY - band / 2)));
        out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = band;
        out.getContext('2d').drawImage(canvas, 0, top, canvas.width, band, 0, 0, canvas.width, band);
        canvas.width = canvas.height = 0;
      }
      const blob = await new Promise(resolve => out.toBlob(resolve, 'image/jpeg', 0.85));
      const size = {width: out.width, height: out.height};
      out.width = out.height = 0;
      if (!blob) throw Error('Could not create page picture');
      return {url: URL.createObjectURL(blob), found: rects.length, cropped: out !== canvas, ...size};
    });
    queue = job.catch(() => {});
    return job;
  }

  window.PagePicture = {available: !LOCAL_FILE, openDocument, draw, picture, DOCUMENT_OPTIONS};
})();
