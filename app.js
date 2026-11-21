'use strict';
(() => {
const $ = id => document.getElementById(id);
const S = window.LibrarySearch;
const LOCAL_FILE = location.protocol === 'file:';
const PAGE_SIZE = 20;
const DB = 'bluedobie-offline-library-v1';
const originals = window.ORIGINAL_DOCUMENTS || [];
const originalById = new Map(originals.map(o => [o.id, o]));
let builtins = (window.LIBRARY_PAGES || []).map(r => ({...r, original: originalById.get(r.doc)}));
let imports = [], indexed = [], lastHits = [], lastQuery = null, shown = 0, objectURLs = [];

// ---- Device storage for imported TXT files (IndexedDB) ----
function db() { return new Promise((resolve, reject) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('files', {keyPath: 'id'}); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
async function stored() { const d = await db(); return new Promise((resolve, reject) => { const r = d.transaction('files', 'readonly').objectStore('files').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
async function put(item) { const d = await db(); return new Promise((resolve, reject) => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').put(item); t.oncomplete = resolve; t.onerror = () => reject(t.error); }); }
async function clear() { const d = await db(); return new Promise((resolve, reject) => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').clear(); t.oncomplete = resolve; t.onerror = () => reject(t.error); }); }

// Imported files have no pages: split them into ~1,500 character sections at blank lines.
function importSections(file) {
  const lines = S.normalize(file.text).replace(/\r/g, '').split('\n');
  const out = [];
  let part = [], size = 0;
  for (const line of lines) {
    if (size > 1200 && (!line.trim() || size > 1900)) { out.push(part.join('\n')); part = []; size = 0; }
    part.push(line); size += line.length + 1;
  }
  if (part.join('').trim()) out.push(part.join('\n'));
  return out.map((text, i) => ({id: file.id + '#' + i, doc: null, title: file.title, page: null, section: i + 1, layout: false, imported: true, text}));
}

function rebuildIndex() {
  const records = [...builtins, ...imports.flatMap(importSections)];
  indexed = records.map((r, order) => S.index({...r, order}));
  const current = $('guide').value;
  const titles = [...new Set(records.map(r => r.title))];
  $('guide').replaceChildren(new Option('All documents', ''), ...titles.map(t => new Option(t, t)));
  $('guide').value = titles.includes(current) ? current : '';
  $('count').textContent = `${builtins.length} searchable pages in ${originals.length} documents` + (imports.length ? ` · ${imports.length} imported file(s)` : '');
}

// ---- Links to the original page ----
function pageLink(rec, q) {
  const o = rec.original;
  if (!o || !rec.page) return null;
  if (LOCAL_FILE) return o.path + '#page=' + rec.page; // browser's own PDF reader, straight from disk
  return './viewer.html?doc=' + encodeURIComponent(o.id) + '&page=' + rec.page + (q ? '&q=' + encodeURIComponent(q) : '');
}

function where(rec) {
  if (rec.imported) return 'Imported file · section ' + rec.section;
  return 'PDF page ' + rec.page + (rec.original ? ' of ' + rec.original.pages : '') + (rec.printed ? ' · printed page ' + rec.printed : '');
}

// ---- Page pictures (lazy, one at a time) ----
const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { observer.unobserve(e.target); loadPicture(e.target); }
}, {rootMargin: '300px'}) : null;

function pictureFigure(rec, auto) {
  const fig = document.createElement('figure');
  fig.className = 'page-picture';
  fig._rec = rec;
  fig._whole = false;
  const frame = document.createElement('div');
  frame.className = 'pic-frame';
  const caption = document.createElement('figcaption');
  fig.append(frame, caption);
  if (auto) {
    frame.textContent = 'Loading picture of the original page…';
    if (observer) observer.observe(fig); else loadPicture(fig);
  } else {
    const button = document.createElement('button');
    button.className = 'secondary';
    button.textContent = 'Show picture of original page';
    button.onclick = () => { button.remove(); frame.textContent = 'Loading picture…'; loadPicture(fig); };
    frame.append(button);
  }
  return fig;
}

async function loadPicture(fig) {
  const rec = fig._rec, frame = fig.querySelector('.pic-frame'), caption = fig.querySelector('figcaption');
  const width = Math.max(260, Math.min(820, frame.clientWidth || fig.clientWidth || 600));
  try {
    const pic = await window.PagePicture.picture(rec.original, rec.page, lastQuery, {cssWidth: width, whole: fig._whole});
    if (!fig.isConnected) { URL.revokeObjectURL(pic.url); return; }
    objectURLs.push(pic.url);
    const img = new Image();
    img.src = pic.url;
    img.alt = `Picture of ${rec.title}, PDF page ${rec.page}` + (pic.found ? ', matching words highlighted' : '');
    img.style.aspectRatio = pic.width + ' / ' + pic.height;
    frame.replaceChildren(img);
    const toggle = document.createElement('button');
    toggle.className = 'link-button';
    toggle.textContent = fig._whole ? 'Show only the matching part' : 'Show whole page';
    toggle.onclick = () => { fig._whole = !fig._whole; frame.textContent = 'Loading picture…'; loadPicture(fig); };
    caption.replaceChildren(document.createTextNode(
      (pic.found ? 'Original PDF page, matching words highlighted in yellow. ' : 'Original PDF page. The words could not be located on the picture; read the whole page. ')), toggle);
  } catch (error) {
    frame.textContent = 'Page picture unavailable: ' + error.message;
    frame.classList.add('pic-error');
    const details = fig.parentElement && fig.parentElement.querySelector('details.extracted');
    if (details) details.open = true;
  }
}

// ---- Rendering results ----
// Reflow PDF line breaks into paragraphs so text reads well on a phone, but keep table
// rows (several columns separated by wide gaps) aligned in a sideways-scrolling block.
function readableHTML(text, query) {
  let html = '', para = [], table = [];
  const flushPara = () => { if (para.length) html += '<p>' + S.highlightHTML(para.join(''), query) + '</p>'; para = []; };
  const flushTable = () => {
    if (!table.length) return;
    const indent = Math.min(...table.map(l => l.match(/^ */)[0].length));
    html += '<div class="table-lines">' + S.highlightHTML(table.map(l => l.slice(indent)).join('\n'), query) + '</div>';
    table = [];
  };
  for (const raw of S.normalize(text).split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushPara(); flushTable(); continue; }
    if (/\S {3,}\S/.test(line.trim())) { flushPara(); table.push(line); continue; }
    flushTable();
    const t = line.trim();
    para.push(para.length && !/[a-z]-$/i.test(para[para.length - 1]) ? ' ' + t : t);
  }
  flushPara(); flushTable();
  return html;
}

function excerptBlock(rec, query) {
  const box = document.createElement('div');
  box.className = 'excerpt' + (rec.layout ? ' layout' : ' readable');
  const parts = S.excerpts(rec, query);
  box.innerHTML = rec.layout
    ? parts.map(p => S.highlightHTML(p.text, query)).join('\n<span class="gap">…</span>\n')
    : parts.map(p => readableHTML(p.text, query)).join('<span class="gap">…</span>');
  return box;
}

function resultCard(hit, q) {
  const rec = hit.rec, query = lastQuery;
  const article = document.createElement('article');
  article.className = 'result';
  const heading = document.createElement('h2');
  heading.textContent = rec.title;
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = where(rec) + (hit.allTerms || query.terms.length < 2 ? '' : ' · matches: ' + hit.matchedTerms.join(', '));
  article.append(heading, meta);

  const canPicture = window.PagePicture && window.PagePicture.available && rec.original && rec.page;
  if (rec.layout) {
    // Tables in this extraction can be scrambled into nearby text, so the picture of the
    // original page is the main result; the extracted words are secondary and labelled.
    if (canPicture) article.append(pictureFigure(rec, true));
    const details = document.createElement('details');
    details.className = 'extracted';
    const summary = document.createElement('summary');
    summary.textContent = 'Extracted text near the match (unverified)';
    const caution = document.createElement('p');
    caution.className = 'caution';
    caution.textContent = 'Machine-extracted from the PDF. Tables can be scrambled into neighbouring lines, so numbers may belong to a different row. Check the original page before using times, pressures, amounts or doses.';
    details.append(summary, caution, excerptBlock(rec, query));
    if (!canPicture) details.open = true;
    article.append(details);
  } else {
    article.append(excerptBlock(rec, query));
    const whole = document.createElement('details');
    whole.className = 'whole-text';
    const summary = document.createElement('summary');
    summary.textContent = rec.imported ? 'Show whole section' : 'Show whole page text';
    whole.append(summary);
    whole.addEventListener('toggle', () => {
      if (!whole.open || whole.querySelector('.excerpt')) return;
      const box = document.createElement('div');
      box.className = 'excerpt readable full';
      box.innerHTML = readableHTML(rec.text, query);
      whole.append(box);
    });
    article.append(whole);
    if (canPicture) article.append(pictureFigure(rec, false));
  }

  const actions = document.createElement('div');
  actions.className = 'result-actions';
  const href = pageLink(rec, q);
  if (href) {
    const a = document.createElement('a');
    a.href = href;
    a.className = 'open-page';
    a.textContent = 'Open page ' + rec.page + ' in the original PDF';
    actions.append(a);
  }
  if (!rec.layout) {
    const copy = document.createElement('button');
    copy.className = 'secondary';
    copy.textContent = 'Copy for Gemma';
    copy.onclick = () => copyText(`Question: ${q}\n\nSource: ${rec.title}\nLocation: ${where(rec)}\n\nSource excerpt:\n${rec.text}\n\nAnswer using this source only. Cite the guide and source page if available. For food preservation, verify altitude, gauge type, jar size, pack method, and processing time. If information is missing or a table is unclear, say so.`, copy);
    actions.append(copy);
  }
  article.append(actions);
  if (rec.original && /^USDA/.test(rec.title)) {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'Check processing times, pressure, altitude and jar size against the full original page before use.';
    article.append(note);
  }
  return article;
}

function clearResults() {
  for (const u of objectURLs) URL.revokeObjectURL(u);
  objectURLs = [];
  if (observer) observer.disconnect();
  $('results').replaceChildren();
}

function showMore(q) {
  const root = $('results');
  root.querySelector('.more')?.remove();
  const next = lastHits.slice(shown, shown + PAGE_SIZE);
  for (const hit of next) root.append(resultCard(hit, q));
  shown += next.length;
  if (shown < lastHits.length) {
    const more = document.createElement('button');
    more.className = 'more secondary';
    more.textContent = `Show more results (${lastHits.length - shown} left)`;
    more.onclick = () => showMore(q);
    root.append(more);
  }
}

function remember(q) {
  try { sessionStorage.setItem('library-last-query', q); } catch (_) {}
  try {
    const url = new URL(location.href);
    if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  } catch (_) {}
}

function doSearch() {
  const q = $('query').value.trim();
  const guide = $('guide').value;
  clearResults();
  remember(q);
  const {query, hits} = S.search(indexed, q, guide ? r => r.title === guide : null);
  lastQuery = query; lastHits = hits; shown = 0;
  if (query.empty) { rebuildCount(); $('examples').hidden = false; return; }
  $('examples').hidden = true;
  if (!hits.length) {
    $('count').textContent = 'No matches.';
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = query.phrases.length ? 'No page contains that exact phrase. Try removing the quotes.' : 'No matches. Try fewer or different words.';
    $('results').append(p);
    return;
  }
  const all = hits.filter(h => h.allTerms).length;
  $('count').textContent = query.terms.length > 1
    ? `${all} page(s) contain all your words · ${hits.length - all} contain some`
    : `${hits.length} matching page(s)`;
  showMore(q);
}
function rebuildCount() { $('count').textContent = `${builtins.length} searchable pages in ${originals.length} documents` + (imports.length ? ` · ${imports.length} imported file(s)` : ''); }

async function copyText(text, button) {
  try { await navigator.clipboard.writeText(text); button.textContent = 'Copied!'; setTimeout(() => button.textContent = 'Copy for Gemma', 1800); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); button.textContent = 'Copied (fallback)'; }
}

// ---- Wiring ----
let typing;
$('search').onclick = doSearch;
$('query').onkeydown = e => { if (e.key === 'Enter') { clearTimeout(typing); doSearch(); } };
$('query').oninput = () => { clearTimeout(typing); typing = setTimeout(doSearch, 350); };
$('guide').onchange = doSearch;
for (const chip of document.querySelectorAll('[data-example]')) chip.onclick = () => { $('query').value = chip.dataset.example; doSearch(); };

$('files').onchange = async e => {
  const selected = [...e.target.files].filter(f => /\.txt$/i.test(f.name));
  let count = 0;
  for (const f of selected) {
    const item = {id: 'user-' + f.name + '-' + f.size, title: 'Imported: ' + f.name, filename: f.name, text: await f.text()};
    try { await put(item); count++; } catch (err) { $('import-status').textContent = 'Import failed: ' + err.message; return; }
  }
  imports = await stored();
  rebuildIndex();
  $('import-status').textContent = `Imported ${count} file(s). Saved locally on this device.`;
  e.target.value = '';
};
$('clear-imports').onclick = async () => {
  if (!confirm('Remove all additional imported files from this device? The included documents remain.')) return;
  await clear(); imports = []; rebuildIndex(); clearResults(); $('import-status').textContent = 'Imported files removed.';
};

const status = {shell: null, originals: null};
function showStatus() {
  const el = $('status');
  if (LOCAL_FILE) {
    el.textContent = 'Opened from files on this device · works with no internet or browser cache';
    el.dataset.state = 'ok';
    return;
  }
  if (!status.shell) { el.textContent = 'Library loaded · checking offline storage…'; return; }
  if (!status.shell.ok) {
    el.textContent = 'Search loaded, but offline use is NOT verified: ' + (status.shell.error || 'Reload while online.');
    el.dataset.state = 'warn';
    return;
  }
  const o = status.originals;
  const pdfs = !o ? 'checking PDFs…' : o.saving ? `saving PDFs ${o.saved} of ${o.total}…` : o.saved === o.total ? `all ${o.total} PDFs saved` : `${o.saved} of ${o.total} PDFs saved`;
  el.textContent = 'Offline ready on this device: search ✓ · ' + pdfs;
  el.dataset.state = o && o.saved === o.total && !o.saving ? 'ok' : 'pending';
}
window.addEventListener('originals-status', e => { status.originals = e.detail; showStatus(); });

(async () => {
  try {
    if (!builtins.length) throw Error('library-data.js is missing');
    rebuildIndex();
    let q = '';
    try { q = new URLSearchParams(location.search).get('q') || sessionStorage.getItem('library-last-query') || ''; } catch (_) {}
    $('query').value = q;
    doSearch();
    showStatus();
    // Imported files load in the background; some browsers never answer for local files.
    Promise.race([stored(), new Promise((_, reject) => setTimeout(() => reject(Error('no response')), 4000))])
      .then(saved => { if (!saved.length) return; imports = saved; rebuildIndex(); if ($('query').value.trim()) doSearch(); })
      .catch(e => { $('import-status').textContent = 'Device storage for imported files is unavailable here: ' + e.message; });
    const offline = await window.offlineReady;
    status.shell = offline || {ok: false};
    showStatus();
    $('offline-details').textContent = JSON.stringify(window.offlineDiagnostic || {}, null, 2);
  } catch (e) {
    $('status').textContent = 'Library failed to load: ' + e.message;
  }
})();
})();
