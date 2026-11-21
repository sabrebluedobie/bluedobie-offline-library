'use strict';
// Turns a question into numbered library sources and prompts for a local model (Gemma in
// LM Studio on a Mac, or pasted into Locally on iPhone/iPad). The library chooses the
// sources itself (deterministic keyword search), so every answer can be checked against
// the exact pages it was given. Shared by the app, the LM Studio tool server and tests.
(function (global) {
  const STOP = new Set(('a an and are as at be been but by can could did do does doing for from had has have how i if in into is it its ' +
    'me my of on or our should so than that the their them then there these they this to too us was we were what when where which ' +
    'while who why will with would you your about please tell know need want long much many way ok okay any some').split(' '));

  // Keep the meaningful words of a question; quoted phrases are kept as they are.
  function keywords(question) {
    const phrases = [];
    const rest = String(question).replace(/"([^"]*)"?/g, (_, p) => { if (p.trim()) phrases.push('"' + p.trim() + '"'); return ' '; });
    const words = (rest.match(/[A-Za-z0-9]+/g) || []).filter(w => !STOP.has(w.toLowerCase()));
    return [...phrases, ...words].join(' ') || String(question);
  }

  function documentTitle(rec) { return rec.title + (rec.page ? ', PDF page ' + rec.page + (rec.original ? ' of ' + rec.original.pages : '') : ''); }

  // Whole page when it fits, otherwise the passages around the matching words.
  function sourceText(S, rec, query, maxChars) {
    const text = S.normalize(rec.text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length <= maxChars) return text;
    const parts = S.excerpts(rec, query, {context: 6, max: 4}).map(p => p.text);
    let out = '';
    for (const p of parts) { if (out.length + p.length > maxChars) break; out += (out ? '\n...\n' : '') + p; }
    return out || text.slice(0, maxChars);
  }

  // Pick the best pages, at most one per page and preferring pages with all the words.
  function retrieve(S, index, question, {pages = 4, maxChars = 3500, filter = null} = {}) {
    const q = keywords(question);
    const {query, hits} = S.search(index, q, filter);
    const chosen = hits.slice(0, pages);
    return {keywords: q, query, sources: chosen.map((h, i) => ({n: i + 1, rec: h.rec, text: sourceText(S, h.rec, query, maxChars)}))};
  }

  function formatSource(src) {
    const rec = src.rec, o = rec.original || {};
    const lines = [`[${src.n}] ${documentTitle(rec)}` + (o.edition ? ` (${o.edition})` : '')];
    if (o.caution) lines.push('Document caution: ' + o.caution);
    if (rec.layout) lines.push('Note: machine-extracted text. Tables may be scrambled into nearby lines, so numbers may belong to a different row. Do not state numbers from tables in this source; tell the reader to check the original page.');
    lines.push('---', src.text, '---');
    return lines.join('\n');
  }

  const SYSTEM = [
    'You answer questions using only the numbered sources from an offline survival and emergency reference library.',
    'Cite every fact with its source number in square brackets, like [2].',
    'If the sources do not answer the question, say so plainly and suggest what to search for instead. Never fill gaps from memory.',
    'For food safety, medical care, medicines, doses, water treatment or anything that could hurt someone: give the exact figures only when a source states them, say which source and page, and tell the reader to confirm on that original page.',
    'Repeat any document caution that applies to your answer.',
    'Be concise and practical. Use short steps or bullet points where they help.'
  ].join(' ');

  function messages(question, sources) {
    const body = sources.length
      ? 'Sources:\n\n' + sources.map(formatSource).join('\n\n')
      : 'No sources in the library matched this question.';
    return [{role: 'system', content: SYSTEM}, {role: 'user', content: body + '\n\nQuestion: ' + question}];
  }

  // One block of text to paste into a chat app such as Locally.
  function pasteText(question, sources) {
    return SYSTEM + '\n\n' + messages(question, sources)[1].content;
  }

  global.LibraryAsk = {keywords, retrieve, formatSource, messages, pasteText, SYSTEM};
})(typeof window !== 'undefined' ? window : globalThis);
