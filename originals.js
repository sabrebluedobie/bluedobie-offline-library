'use strict';
// Original PDFs: saved automatically (verified by size and SHA-256) into their own
// content-addressed cache, which survives app updates. Opened from local files, the
// PDFs are read straight from the originals folder instead.
window.originalDocuments = window.ORIGINAL_DOCUMENTS || [];
const ORIGINAL_CACHE = 'bluedobie-originals-v1';

async function verifiedPDF(response, item) {
  if (!response || !response.ok) throw Error('Original unavailable');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== item.bytes) throw Error('Incomplete original: size mismatch');
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw Error('Response is not a PDF');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  if (hash !== item.sha256) throw Error('Original does not match the verified source');
  return new Response(bytes, {headers: {'Content-Type': 'application/pdf', 'Content-Length': String(bytes.byteLength)}});
}

(() => {
  const items = window.originalDocuments;
  const root = document.getElementById('originals');
  const saveAll = document.getElementById('save-all');
  const storageEl = document.getElementById('storage-status');
  if (!root || !items.length) return;
  const LOCAL_FILE = location.protocol === 'file:';
  const rows = new Map();
  const state = {saved: 0, total: items.length, saving: false};
  const announce = () => window.dispatchEvent(new CustomEvent('originals-status', {detail: {...state}}));

  const sections = new Map();
  for (const item of items) {
    const topic = item.topic || 'Other';
    if (!sections.has(topic)) {
      const h = document.createElement('h3');
      h.className = 'topic';
      h.textContent = topic;
      root.append(h);
      sections.set(topic, h);
    }
  }
  for (const item of [...items].sort((a, b) => [...sections.keys()].indexOf(a.topic || 'Other') - [...sections.keys()].indexOf(b.topic || 'Other'))) {
    const box = document.createElement('article'), title = document.createElement('h4'), note = document.createElement('p'), status = document.createElement('p'), link = document.createElement('a');
    title.textContent = item.title;
    note.className = 'hint';
    note.textContent = `${item.edition} · ${item.pages} PDF pages · ${(item.bytes / 1048576).toFixed(2)} MiB. ${item.source} ${item.rights} ${item.sourceReview || ''} ${item.publicationNotice || ''}`;
    status.setAttribute('role', 'status');
    link.href = LOCAL_FILE ? item.path : './viewer.html?doc=' + encodeURIComponent(item.id);
    link.textContent = 'Open original PDF';
    box.append(title, status, link);
    if (item.caution) { const c = document.createElement('p'); c.className = 'doc-caution'; c.textContent = '⚠︎ ' + item.caution; box.append(c); }
    box.append(note);
    const section = sections.get(item.topic || 'Other');
    let last = section;
    while (last.nextElementSibling && last.nextElementSibling.tagName === 'ARTICLE') last = last.nextElementSibling;
    last.after(box);
    rows.set(item.id, {status, link});
  }

  if (LOCAL_FILE) {
    storageEl.textContent = 'Opened from local files: the PDFs are read straight from the originals folder next to index.html. Nothing needs to be saved.';
    saveAll.hidden = true;
    for (const {status} of rows.values()) status.textContent = 'In this folder.';
    state.saved = state.total;
    announce();
    return;
  }
  if (!('caches' in window)) {
    storageEl.textContent = 'This browser cannot save PDFs for offline use. Use HTTPS in Safari, Chrome, Edge or Firefox.';
    saveAll.hidden = true;
    announce();
    return;
  }

  async function showStorage() {
    try {
      const e = await navigator.storage?.estimate?.();
      const persistent = await navigator.storage?.persisted?.();
      storageEl.textContent = (e?.quota ? `Browser estimate: ${(e.usage / 1048576).toFixed(1)} MiB used of ${(e.quota / 1048576).toFixed(0)} MiB quota. ` : '') +
        (persistent ? 'Protected storage granted: the browser should not clear it on its own. Keep a portable copy too.' : 'Storage is “best effort”: the device may clear it when space runs low. Keep a portable copy too.');
    } catch { storageEl.textContent = 'Storage estimate unavailable. Keep a portable copy too.'; }
  }

  async function isSaved(cache, item) {
    try { await verifiedPDF(await cache.match(new URL(item.path, document.baseURI).href), item); return true; } catch { return false; }
  }

  async function saveEverything() {
    if (state.saving) return;
    state.saving = true;
    saveAll.disabled = true;
    try {
      // Ask the browser not to clear this storage under pressure (granted silently or not at all).
      try { await navigator.storage?.persist?.(); } catch (_) {}
      const cache = await caches.open(ORIGINAL_CACHE);
      state.saved = 0;
      for (const item of items) {
        const row = rows.get(item.id);
        if (await isSaved(cache, item)) { state.saved++; row.status.textContent = '✓ Saved on this device.'; announce(); continue; }
        if (navigator.onLine === false) { row.status.textContent = 'Not saved yet. Open the library online to save it.'; continue; }
        row.status.textContent = 'Saving…';
        announce();
        try {
          const url = new URL(item.path, document.baseURI).href;
          await cache.put(url, await verifiedPDF(await fetch(url, {cache: 'no-store'}), item));
          state.saved++;
          row.status.textContent = '✓ Saved on this device.';
        } catch (e) {
          row.status.textContent = 'Not saved: ' + e.message;
        }
        announce();
      }
    } catch (e) {
      storageEl.textContent = 'PDFs could not be saved: ' + e.message;
    } finally {
      state.saving = false;
      saveAll.disabled = false;
      announce();
      showStorage();
    }
  }

  saveAll.onclick = saveEverything;
  window.addEventListener('online', saveEverything);
  saveEverything();
})();
