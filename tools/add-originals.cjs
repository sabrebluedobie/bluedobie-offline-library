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

// One record per page that has readable words; pdftotext separates pages with form feeds.
function pageTexts(file, pages) {
  const text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], {encoding: 'utf8', maxBuffer: 1 << 28});
  const parts = text.split('\f');
  if (parts.length < pages) throw Error(`pdftotext returned ${parts.length} pages, expected ${pages}`);
  return parts.slice(0, pages).map((t, i) => ({page: i + 1, text: t.replace(/\s+$/, '')}));
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
    for (const {page, text} of pageTexts(a.file, info.pages)) {
      if (text.replace(/[^A-Za-z]/g, '').length < 20) continue; // blank or picture-only page
      library.push({id: `${a.id}-page-${page}`, title: a.title, filename: `${a.id}-page-${page}.txt`, text, pdfPage: page,
        originalId: a.id, source: a.source, sourceSha256: sha256, extraction: 'Search locator only; read original PDF.'});
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
  if (!manifest) { console.error('Usage: node tools/add-originals.cjs additions.json'); process.exit(2); }
  const report = addAll(JSON.parse(fs.readFileSync(manifest, 'utf8')));
  console.log(report.join('\n'));
  const {files, records} = require('./build-data.cjs').build();
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(root, name), text);
  console.log(`Regenerated data: ${records.length} searchable pages. Now bump CACHE in sw.js and run the tests.`);
}
module.exports = {addAll};
