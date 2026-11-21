#!/usr/bin/env node
// Offline Library tool server for LM Studio (Model Context Protocol over stdio).
// Lets a local model such as Gemma search the library and read pages while you chat in
// LM Studio. Fully offline; reads the same data files as the app. No dependencies.
//
// Add to ~/.lmstudio/mcp.json (LM Studio: Program tab > Install > Edit mcp.json):
//   "offline-library": { "command": "/opt/homebrew/bin/node",
//                        "args": ["/path/to/bluedobie-offline-library/tools/library-mcp.cjs"] }
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const readline = require('node:readline');

const root = path.join(__dirname, '..');
const ctx = {window: {}};
for (const f of ['originals-data.js', 'library-data.js', 'search.js', 'ask.js']) vm.runInNewContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, {filename: f});
const S = ctx.window.LibrarySearch, A = ctx.window.LibraryAsk;
const docs = ctx.window.ORIGINAL_DOCUMENTS;
const byId = new Map(docs.map(d => [d.id, d]));
const index = S.createIndex(ctx.window.LIBRARY_PAGES.map(r => ({...r, original: byId.get(r.doc)})));
const pageRecord = new Map(index.recs.map(r => [r.doc + ':' + r.page, r]));
const VERSION = '1.0.0';

const FOOTER = '\n\nInstructions for answering: use only these pages; cite each fact by source number and page. Repeat every "Document caution" above that applies to your answer. For food safety, medical care, doses or water treatment, tell the reader to confirm the figures on the original page in the Offline Library app. If these pages do not answer the question, say so, or search again with different words.';

const TOOLS = [
  {name: 'search_library',
    description: 'Search the offline survival and emergency reference library (USDA canning guides, Army first-aid, survival and sanitation manuals, FEMA, CDC, EPA and other references). Returns the best-matching pages, numbered, with document cautions. Use short, specific keywords, e.g. "frostbite treatment" or "pressure canning venison quart". Put exact phrases in double quotes.',
    inputSchema: {type: 'object', properties: {
      query: {type: 'string', description: 'Keywords or a question'},
      max_results: {type: 'integer', minimum: 1, maximum: 6, description: 'Pages to return (default 4)'},
      topic: {type: 'string', description: 'Optional topic to limit the search, as listed by list_documents'}},
    required: ['query']}},
  {name: 'read_page',
    description: 'Read the full extracted text of one page of a library document, for example the page before or after a search result.',
    inputSchema: {type: 'object', properties: {
      document_id: {type: 'string', description: 'Document id, e.g. "usda-5" (shown in search results)'},
      page: {type: 'integer', minimum: 1, description: 'PDF page number'}},
    required: ['document_id', 'page']}},
  {name: 'list_documents',
    description: 'List every document in the library with its id, topic, edition and page count.',
    inputSchema: {type: 'object', properties: {}}}
];

function searchLibrary({query, max_results = 4, topic}) {
  if (!query || !String(query).trim()) throw Error('query is required');
  const pages = Math.max(1, Math.min(6, Number(max_results) || 4));
  const filter = topic ? r => r.original && r.original.topic.toLowerCase() === String(topic).toLowerCase() : null;
  const {keywords, sources} = A.retrieve(S, index, query, {pages, maxChars: 3500, filter});
  if (!sources.length) return `No pages matched "${keywords}". Try other words, or list_documents to see what the library covers.`;
  return sources.map(s => A.formatSource(s) + `\n(document_id: ${s.rec.doc}, page: ${s.rec.page})`).join('\n\n') + FOOTER;
}

function readPage({document_id, page}) {
  const doc = byId.get(String(document_id));
  if (!doc) throw Error(`Unknown document_id "${document_id}". Use list_documents.`);
  const n = Number(page);
  if (!Number.isInteger(n) || n < 1 || n > doc.pages) throw Error(`${doc.id} has pages 1 to ${doc.pages}.`);
  const rec = pageRecord.get(doc.id + ':' + n);
  if (!rec) return `${doc.title}, PDF page ${n} has no extractable text (it may be blank or a picture). Ask the reader to open the original page.`;
  return A.formatSource({n: 1, rec, text: S.normalize(rec.text).replace(/\n{3,}/g, '\n\n').trim().slice(0, 9000)}) + `\n(document_id: ${doc.id}, page: ${n} of ${doc.pages})`;
}

function listDocuments() {
  const topics = new Map();
  for (const d of docs) {
    if (!topics.has(d.topic)) topics.set(d.topic, []);
    topics.get(d.topic).push(`- ${d.id}: ${d.title} (${d.edition}; ${d.pages} pages)`);
  }
  return [...topics].map(([t, lines]) => `${t}\n${lines.join('\n')}`).join('\n\n');
}

function callTool(name, args) {
  if (name === 'search_library') return searchLibrary(args || {});
  if (name === 'read_page') return readPage(args || {});
  if (name === 'list_documents') return listDocuments();
  throw Error('Unknown tool ' + name);
}

function handle(msg) {
  const {id, method, params} = msg;
  if (method === 'initialize') {
    return {protocolVersion: (params && params.protocolVersion) || '2025-06-18', capabilities: {tools: {}},
      serverInfo: {name: 'offline-library', version: VERSION},
      instructions: 'Search the offline library before answering survival, first-aid, food, water or preparedness questions, and cite the pages.'};
  }
  if (method === 'ping') return {};
  if (method === 'tools/list') return {tools: TOOLS};
  if (method === 'tools/call') {
    try { return {content: [{type: 'text', text: callTool(params.name, params.arguments)}]}; }
    catch (e) { return {content: [{type: 'text', text: 'Error: ' + e.message}], isError: true}; }
  }
  if (id === undefined) return undefined; // notification, e.g. notifications/initialized
  const err = new Error('Method not found: ' + method);
  err.code = -32601;
  throw err;
}

if (require.main === module) {
  const send = obj => process.stdout.write(JSON.stringify(obj) + '\n');
  readline.createInterface({input: process.stdin}).on('line', line => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { send({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}); return; }
    try {
      const result = handle(msg);
      if (msg.id !== undefined && result !== undefined) send({jsonrpc: '2.0', id: msg.id, result});
    } catch (e) {
      if (msg.id !== undefined) send({jsonrpc: '2.0', id: msg.id, error: {code: e.code || -32603, message: e.message}});
    }
  });
  process.stderr.write(`offline-library MCP server ready: ${index.recs.length} pages, ${docs.length} documents\n`);
}
module.exports = {handle, searchLibrary, readPage, listDocuments, TOOLS};
