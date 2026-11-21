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

  function documentTitle(rec, pages) {
    if (!rec.page) return rec.title;
    const span = pages && pages.length > 1 ? `PDF pages ${pages[0]}-${pages[pages.length - 1]}` : 'PDF page ' + rec.page;
    return rec.title + ', ' + span + (rec.original ? ' of ' + rec.original.pages : '');
  }

  // Whole page when it fits, otherwise the passages around the matching words.
  function sourceText(S, rec, query, maxChars) {
    const text = S.normalize(rec.text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length <= maxChars) return text;
    const parts = S.excerpts(rec, query, {context: 6, max: 4}).map(p => p.text);
    let out = '';
    for (const p of parts) { if (out.length + p.length > maxChars) break; out += (out ? '\n...\n' : '') + p; }
    return out || text.slice(0, maxChars);
  }

  // Pick the best pages, preferring pages with all the words. Neighbouring pages of the
  // same document are joined into one source in page order, and each source also carries
  // the top of the following page: a procedure's time or dose table often sits on the
  // next page (USDA lima and snap beans both start on one page and finish on the next).
  function retrieve(S, index, question, {pages = 4, maxChars = 3500, nextChars = Math.round(maxChars * 0.4), filter = null} = {}) {
    const q = keywords(question);
    const {query, hits} = S.search(index, q, filter);
    const chosen = hits.slice(0, pages);
    const key = r => r.doc + ':' + r.page;
    const byPage = index.byPage || (index.byPage = new Map(index.recs.map(r => [key(r), r])));
    const picked = new Set(chosen.map(h => key(h.rec)));
    const used = new Set(), sources = [];
    for (const h of chosen) {
      if (used.has(key(h.rec))) continue;
      let first = h.rec;
      if (first.doc && first.page) while (picked.has(first.doc + ':' + (first.page - 1)) && !used.has(first.doc + ':' + (first.page - 1))) first = byPage.get(first.doc + ':' + (first.page - 1));
      const run = [first];
      while (first.doc && first.page && picked.has(first.doc + ':' + (run[run.length - 1].page + 1))) run.push(byPage.get(first.doc + ':' + (run[run.length - 1].page + 1)));
      run.forEach(r => used.add(key(r)));
      const parts = run.map(r => ({page: r.page, text: sourceText(S, r, query, maxChars)}));
      const src = {n: sources.length + 1, rec: first, pages: run.map(r => r.page), parts, text: parts.map(p => p.text).join('\n\n')};
      const last = run[run.length - 1];
      const next = last.doc && last.page ? byPage.get(last.doc + ':' + (last.page + 1)) : null;
      if (next && nextChars > 0) {
        src.next = {page: next.page, text: S.normalize(next.text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, nextChars)};
      }
      sources.push(src);
    }
    return {keywords: q, query, sources};
  }

  function formatSource(src) {
    const rec = src.rec, o = rec.original || {};
    const lines = [`[${src.n}] ${documentTitle(rec, src.pages)}` + (o.edition ? ` (${o.edition})` : '')];
    if (o.caution) lines.push('Document caution: ' + o.caution);
    if (rec.layout) lines.push('(For the assistant only, do not repeat: machine-extracted text. Tables may be scrambled into nearby lines, so numbers in tables may belong to a different row. Only state numbers that appear in sentences; for table values, tell the reader to check the original page.)');
    if (src.parts && src.parts.length > 1) for (const part of src.parts) lines.push(`--- PDF page ${part.page} ---`, part.text);
    else lines.push('---', src.text);
    if (src.next) lines.push(`--- top of the next page (PDF page ${src.next.page}), cite as [${src.n}] page ${src.next.page} ---`, src.next.text);
    lines.push('---');
    return lines.join('\n');
  }

  const SYSTEM = [
    'You answer questions using only the numbered sources from an offline survival and emergency reference library.',
    'Cite every fact with its source number in square brackets, like [2].',
    'If the sources do not answer the question, say so plainly and suggest what to search for instead. Never fill gaps from memory.',
    'For food safety, medical care, medicines, doses, water treatment or anything that could hurt someone: give the exact figures only when a source states them, say which source and page, and tell the reader to confirm on that original page.',
    'Repeat any "Document caution" that applies to your answer.',
    'A page may hold several tables for different foods or conditions, and a table may continue on the next page. Use a number only from a table whose title names exactly the item asked about (for example "Snap and Italian Beans", not "Lima Beans"); if no table names it, say so.',
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
