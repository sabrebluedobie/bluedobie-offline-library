'use strict';
// Local keyword search: whole words with simple plural/ending matching, "quoted phrases",
// ranking, and short highlighted excerpts. No network, no AI.
(function (global) {
  const WORD = /[A-Za-z0-9]+/g;

  function normalize(text) {
    return String(text).replace(/­/g, '').replace(/[� ]/g, ' ');
  }

  function undouble(w) {
    return /([b-df-hj-km-np-rtv-y])\1$/.test(w) ? w.slice(0, -1) : w;
  }

  // Light English stemmer: jars/jar, pickles/pickled/pickling/pickle, canning/canned/can.
  function stem(word) {
    let w = word.toLowerCase();
    if (/^\d/.test(w) || w.length <= 3) return w;
    if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
    else if (w.endsWith('sses')) w = w.slice(0, -2);
    else if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
    if (w.length > 5 && w.endsWith('ing')) w = undouble(w.slice(0, -3));
    else if (w.length > 4 && w.endsWith('ied')) w = w.slice(0, -3) + 'y';
    else if (w.length > 4 && w.endsWith('ed')) w = undouble(w.slice(0, -2));
    if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
    return w;
  }

  function tokens(text) {
    const out = [];
    const s = normalize(text);
    WORD.lastIndex = 0;
    let m;
    while ((m = WORD.exec(s))) out.push({word: m[0], stem: stem(m[0]), start: m.index, end: m.index + m[0].length});
    return out;
  }

  // "weighted gauge" venison -> phrase [weight, gaug] + term venison
  function parseQuery(q) {
    const phrases = [], terms = [];
    const rest = normalize(q).replace(/"([^"]*)"?/g, (_, inner) => {
      const p = tokens(inner).map(t => t.stem);
      if (p.length > 1) phrases.push(p); else if (p.length === 1) terms.push(p[0]);
      return ' ';
    });
    for (const t of tokens(rest)) if (t.word.length > 1 || /\d/.test(t.word)) terms.push(t.stem);
    const uniqueTerms = [...new Set(terms)];
    const marks = new Set([...uniqueTerms, ...phrases.flat()]);
    return {terms: uniqueTerms, phrases, marks, empty: !uniqueTerms.length && !phrases.length};
  }

  // ---- Compact index ----
  // Every distinct word stem gets a number; each page keeps its words as one Int32Array, and
  // each stem keeps the list of pages containing it. Thousands of pages fit in a few MB,
  // which matters on phones.
  function createIndex(records) {
    const ids = new Map(), stems = [], stemCache = new Map();
    const idOf = st => { let id = ids.get(st); if (id === undefined) { id = stems.length; ids.set(st, id); stems.push(st); } return id; };
    const seqFor = text => {
      const out = [];
      const t = normalize(text);
      WORD.lastIndex = 0;
      let m;
      while ((m = WORD.exec(t))) {
        const w = m[0].toLowerCase();
        let id = stemCache.get(w);
        if (id === undefined) { id = idOf(stem(w)); stemCache.set(w, id); }
        out.push(id);
      }
      return Int32Array.from(out);
    };
    const postings = [];
    let total = 0;
    const recs = records.map((r, order) => {
      const seq = seqFor(r.text);
      const title = new Set(seqFor(r.title || ''));
      total += seq.length;
      for (const id of new Set(seq)) (postings[id] || (postings[id] = [])).push(order);
      return {...r, order, seq, titleIds: title};
    });
    return {recs, ids, stems, postings, N: recs.length, avgLen: total / Math.max(1, recs.length)};
  }

  function phraseAt(seq, phrase, i) {
    for (let k = 0; k < phrase.length; k++) if (seq[i + k] !== phrase[k]) return false;
    return true;
  }

  // Smallest token window containing every matched term (for "words near each other").
  function windowSize(positionsByTerm) {
    const lists = positionsByTerm.filter(l => l.length);
    if (lists.length < 2) return 0;
    const all = [];
    lists.forEach((l, i) => l.forEach(p => all.push([p, i])));
    all.sort((a, b) => a[0] - b[0]);
    const need = lists.length, count = new Array(need).fill(0);
    let have = 0, best = Infinity, lo = 0;
    for (let hi = 0; hi < all.length; hi++) {
      if (count[all[hi][1]]++ === 0) have++;
      while (have === need) {
        best = Math.min(best, all[hi][0] - all[lo][0]);
        if (--count[all[lo][1]] === 0) have--;
        lo++;
      }
    }
    return best;
  }

  // BM25 ranking: words that are rare in the library count for more than common ones, and
  // long pages are not favoured just for being long. Pages with every word, with the words
  // close together, or with an exact quoted phrase rank higher. Quoted phrases are required.
  function search(index, q, filter) {
    const query = typeof q === 'string' ? parseQuery(q) : q;
    if (query.empty) return {query, hits: []};
    const {recs, ids, postings, N, avgLen} = index;
    const termIds = query.terms.map(t => ids.has(t) ? ids.get(t) : -1);
    const phraseIds = query.phrases.map(p => p.map(t => ids.has(t) ? ids.get(t) : -1));
    if (phraseIds.some(p => p.includes(-1))) return {query, hits: []};
    const idf = id => { const df = postings[id] ? postings[id].length : 0; return Math.log(1 + (N - df + 0.5) / (df + 0.5)); };
    const termIdf = termIds.map(id => id < 0 ? 0 : idf(id));
    const sumIdf = termIdf.reduce((a, b) => a + b, 0) || 1;

    let candidates;
    if (phraseIds.length) {
      const rarest = phraseIds.flat().reduce((best, id) => (postings[id] || []).length < (postings[best] || []).length ? id : best);
      candidates = postings[rarest] || [];
    } else {
      const set = new Set();
      for (const id of termIds) if (id >= 0 && postings[id]) for (const r of postings[id]) set.add(r);
      candidates = [...set];
    }

    const hits = [];
    for (const ri of candidates) {
      const rec = recs[ri];
      if (filter && !filter(rec)) continue;
      const seq = rec.seq;
      let phraseCount = 0, phraseOk = true;
      for (const p of phraseIds) {
        let c = 0;
        for (let i = 0; i + p.length <= seq.length; i++) if (seq[i] === p[0] && phraseAt(seq, p, i)) c++;
        if (!c) { phraseOk = false; break; }
        phraseCount += c;
      }
      if (!phraseOk) continue;
      const positions = termIds.map(() => []);
      if (termIds.length) for (let i = 0; i < seq.length; i++) { const k = termIds.indexOf(seq[i]); if (k >= 0) positions[k].push(i); }
      const matched = positions.filter(p => p.length).length;
      if (!matched && !phraseIds.length) continue;
      const norm = 1.2 * (0.25 + 0.75 * seq.length / avgLen);
      let score = 0;
      positions.forEach((p, k) => {
        if (p.length) score += termIdf[k] * (p.length * 2.2) / (p.length + norm);
        if (termIds[k] >= 0 && rec.titleIds.has(termIds[k])) score += termIdf[k] * 0.3;
      });
      if (phraseIds.length) {
        const pIdf = phraseIds.flat().reduce((a, id) => a + idf(id), 0);
        score += pIdf * (1 + Math.min(3, phraseCount) * 0.2);
      }
      const allTerms = matched === termIds.length;
      if (allTerms && termIds.length > 1) {
        score += sumIdf * 0.5;
        score += sumIdf * 0.5 * Math.max(0, 1 - windowSize(positions) / 80);
      }
      hits.push({rec, score, allTerms, matchedTerms: query.terms.filter((_, k) => positions[k].length)});
    }
    hits.sort((a, b) => b.score - a.score || a.rec.order - b.rec.order);
    return {query, hits};
  }

  function phraseAtStems(stems, phrase, i) {
    for (let k = 0; k < phrase.length; k++) if (stems[i + k] !== phrase[k]) return false;
    return true;
  }

  function isMatch(stems, i, query) {
    if (query.terms.includes(stems[i])) return true;
    for (const p of query.phrases) for (let k = 0; k < p.length; k++) if (i - k >= 0 && phraseAtStems(stems, p, i - k)) return true;
    return false;
  }

  // Up to `max` short line-based excerpts around matches, best (most distinct terms) first.
  function excerpts(rec, query, {context = 1, max = 3} = {}) {
    const text = normalize(rec.text);
    const lineStarts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
    const lineOf = pos => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
    const hitLines = new Map();
    const toks = tokens(text), stems = toks.map(t => t.stem);
    toks.forEach((t, i) => {
      if (!isMatch(stems, i, query)) return;
      const line = lineOf(t.start);
      if (!hitLines.has(line)) hitLines.set(line, new Set());
      hitLines.get(line).add(t.stem);
    });
    const lines = text.split('\n');
    const ranges = [];
    for (const line of [...hitLines.keys()].sort((a, b) => a - b)) {
      let from = line - context, to = line + context;
      while (from > 0 && !lines[from].trim()) from--;
      while (to < lines.length - 1 && !lines[to].trim()) to++;
      from = Math.max(0, from); to = Math.min(lines.length - 1, to);
      const last = ranges[ranges.length - 1];
      if (last && from <= last.to + 1) { last.to = Math.max(last.to, to); hitLines.get(line).forEach(s => last.stems.add(s)); }
      else ranges.push({from, to, stems: new Set(hitLines.get(line))});
    }
    return ranges
      .map(r => ({...r, size: r.stems.size}))
      .sort((a, b) => b.size - a.size || a.from - b.from)
      .slice(0, max)
      .sort((a, b) => a.from - b.from)
      .map(r => ({text: lines.slice(r.from, r.to + 1).join('\n').replace(/^\s*\n|\s+$/g, '').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n'), firstLine: r.from + 1}));
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  }

  // Highlight every word whose stem is part of the query. Output is escaped HTML.
  function highlightHTML(text, query) {
    const s = normalize(text);
    let out = '', last = 0;
    for (const t of tokens(s)) {
      if (!query.marks.has(t.stem)) continue;
      out += escapeHTML(s.slice(last, t.start)) + '<mark>' + escapeHTML(t.word) + '</mark>';
      last = t.end;
    }
    return out + escapeHTML(s.slice(last));
  }

  global.LibrarySearch = {normalize, stem, tokens, parseQuery, createIndex, search, excerpts, highlightHTML, escapeHTML};
})(typeof window !== 'undefined' ? window : globalThis);
