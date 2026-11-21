#!/usr/bin/env node
// Adds reviewed original PDFs to the library.
//
//   node tools/add-originals.cjs path/to/additions.json
//
// additions.json is an array of documents, each with the local PDF to add and its reviewed
// metadata (all fields are required unless marked optional):
//   { "file": "/abs/path/doc.pdf", "id": "army-atp-4-02-11", "title": "U.S. Army: First Aid",
//     "topic": "First aid & medical", "edition": "...", "source": "https://... (official PDF URL)",
//     "landing": "https://... (optional)", "rights": "...", "sourceReview": "...",
//     "caution": "... (optional, shown on every search result)", "publicationNotice": "... (optional)" }
//
// For each document it checks the file is an unencrypted PDF without JavaScript, stores it
// unchanged as originals/<sha256>.pdf, extracts each page's text (pdftotext -layout, from
// poppler) as a page-locator record in library.json, adds the manifest entry to
// originals.json, and regenerates the app's data scripts. Requires pdfinfo and pdftotext.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.join(__dirname, '..');
const REQUIRED = ['file', 'id', 'title', 'topic', 'edition', 'source', 'rights', 'sourceReview'];

function pdfInfo(file) {
  const out = execFileSync('pdfinfo', [file], {encoding: 'utf8'});
  const field = name => (out.match(new RegExp('^' + name + ':\\s*(.*)$', 'm')) || [])[1];
  return {pages: Number(field('Pages')), encrypted: !/^no/i.test(field('Encrypted') || 'no'), javascript: /^yes/i.test(field('JavaScript') || 'no')};
}

const LAYOUT_NOTE = 'Search locator only; read original PDF.';
const READING_NOTE = 'Search locator only; read original PDF. Two-column page: text in reading order.';

// Is this layout-mode page two columns of running text side by side? Layout mode reads
// straight across both columns, interleaving their sentences. True when one gutter
// position recurs on most lines with several words of text on both sides; tables
// (several aligned gaps, short cells) and forms do not qualify.
function twoColumns(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 15);
  if (lines.length < 8) return false;
  const width = Math.max(...lines.map(l => l.trimEnd().length));
  const hits = new Map();
  for (const l of lines) {
    const seen = new Set();
    for (const m of l.matchAll(/ {2,}(?=\S)/g)) {
      const at = m.index + m[0].length;
      if (at < 15) continue;
      const bucket = Math.round(at / 3);
      if (!seen.has(bucket)) { seen.add(bucket); hits.set(bucket, (hits.get(bucket) || 0) + 1); }
    }
  }
  const peaks = [...hits].filter(([, c]) => c >= 0.3 * lines.length).map(([b]) => b).sort((a, b) => a - b).filter((b, i, a) => i === 0 || b - a[i - 1] > 1);
  if (peaks.length !== 1) return false;
  const gutter = peaks[0] * 3, pos = gutter / width;
  if (pos <= 0.3 || pos >= 0.7) return false;
  const words = t => (t.match(/[A-Za-z]{2,}/g) || []).length;
  let prose = 0;
  for (const l of lines) {
    const m = [...l.matchAll(/ {2,}(?=\S)/g)].find(x => Math.abs(x.index + x[0].length - gutter) <= 4);
    if (!m) continue;
    const left = l.slice(0, m.index).trim(), right = l.slice(m.index).trim();
    if (left.length >= 22 && right.length >= 22 && words(left) >= 3 && words(right) >= 3) prose++;
  }
  return prose >= 0.35 * lines.length;
}

function readingOrder(file, page) {
  return execFileSync('pdftotext', ['-f', String(page), '-l', String(page), '-enc', 'UTF-8', file, '-'], {encoding: 'utf8'}).replace(/\f/g, '').replace(/\s+$/, '');
}

// One record per page. Layout mode keeps table rows on one line; two-column prose pages
// are re-extracted in reading order so their sentences stay intact.
function pageTexts(file, pages) {
  const text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], {encoding: 'utf8', maxBuffer: 1 << 28});
  const parts = text.split('\f');
  if (parts.length < pages) throw Error(`pdftotext returned ${parts.length} pages, expected ${pages}`);
  return parts.slice(0, pages).map((t, i) => {
    const layout = t.replace(/\s+$/, '');
    return twoColumns(layout) ? {page: i + 1, text: readingOrder(file, i + 1), extraction: READING_NOTE}
      : {page: i + 1, text: layout, extraction: LAYOUT_NOTE};
  });
}

// Re-extract existing two-column pages (all page-locator documents) in reading order.
function refreshColumns() {
  const originals = new Map(JSON.parse(fs.readFileSync(path.join(root, 'originals.json'), 'utf8')).map(o => [o.id, o]));
  const libraryPath = path.join(root, 'library.json');
  const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
  const changed = [];
  for (const rec of library) {
    if (!Number.isInteger(rec.pdfPage) || !originals.has(rec.originalId) || rec.extraction === READING_NOTE) continue;
    if (!twoColumns(rec.text)) continue;
    const o = originals.get(rec.originalId);
    rec.text = readingOrder(path.join(root, o.path), rec.pdfPage);
    rec.extraction = (rec.extraction || LAYOUT_NOTE).replace(/\s*$/, '') + ' Two-column page: text in reading order.';
    changed.push(rec.id);
  }
  fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2) + '\n');
  return changed;
}

function addAll(additions, {today = new Date().toISOString().slice(0, 10)} = {}) {
  const originalsPath = path.join(root, 'originals.json'), libraryPath = path.join(root, 'library.json');
  const originals = JSON.parse(fs.readFileSync(originalsPath, 'utf8'));
  const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
  const report = [];
  for (const a of additions) {
    for (const k of REQUIRED) if (!a[k]) throw Error(`${a.id || a.file}: missing ${k}`);
    if (!/^[a-z0-9-]+$/.test(a.id)) throw Error(`${a.id}: id must be lowercase letters, digits and dashes`);
    if (originals.some(o => o.id === a.id)) throw Error(`${a.id}: already in originals.json`);
    if (!/^https:\/\//.test(a.source)) throw Error(`${a.id}: source must be an https URL`);
    const bytes = fs.readFileSync(a.file);
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw Error(`${a.id}: not a PDF`);
    const info = pdfInfo(a.file);
    if (info.encrypted) throw Error(`${a.id}: encrypted PDFs are not accepted`);
    if (info.javascript) throw Error(`${a.id}: PDFs containing JavaScript are not accepted`);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (originals.some(o => o.sha256 === sha256)) throw Error(`${a.id}: same file already listed as ${originals.find(o => o.sha256 === sha256).id}`);
    const rel = `originals/${sha256}.pdf`;
    fs.mkdirSync(path.join(root, 'originals'), {recursive: true});
    fs.writeFileSync(path.join(root, rel), bytes);

    const entry = {id: a.id, title: a.title, topic: a.topic, path: rel, sha256, bytes: bytes.length, pages: info.pages,
      edition: a.edition, source: a.source, ...(a.landing ? {landing: a.landing} : {}), rights: a.rights,
      retrieved: a.retrieved || today, sourceReview: a.sourceReview,
      ...(a.caution ? {caution: a.caution} : {}), ...(a.publicationNotice ? {publicationNotice: a.publicationNotice} : {})};
    originals.push(entry);

    let kept = 0;
    for (const {page, text, extraction} of pageTexts(a.file, info.pages)) {
      if (text.replace(/[^A-Za-z]/g, '').length < 20) continue; // blank or picture-only page
      library.push({id: `${a.id}-page-${page}`, title: a.title, filename: `${a.id}-page-${page}.txt`, text, pdfPage: page,
        originalId: a.id, source: a.source, sourceSha256: sha256, extraction});
      kept++;
    }
    report.push(`${a.id}: ${info.pages} pages (${kept} with text), ${(bytes.length / 1048576).toFixed(1)} MiB`);
  }
  fs.writeFileSync(originalsPath, JSON.stringify(originals, null, 2) + '\n');
  fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2) + '\n');
  return report;
}

if (require.main === module) {
  const manifest = process.argv[2];
  if (!manifest) { console.error('Usage: node tools/add-originals.cjs additions.json | --refresh-columns'); process.exit(2); }
  if (manifest === '--refresh-columns') {
    const changed = refreshColumns();
    console.log(`Re-extracted ${changed.length} two-column pages in reading order.`);
  } else {
    const report = addAll(JSON.parse(fs.readFileSync(manifest, 'utf8')));
    console.log(report.join('\n'));
  }
  const {files, records} = require('./build-data.cjs').build();
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(root, name), text);
  console.log(`Regenerated data: ${records.length} searchable pages. Now bump CACHE in sw.js and run the tests.`);
}
module.exports = {addAll, twoColumns, refreshColumns};
