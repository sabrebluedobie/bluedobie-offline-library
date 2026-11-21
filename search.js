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

  function index(record) {
    const toks = tokens(record.text);
    const titleStems = new Set(tokens(record.title || '').map(t => t.stem));
    return {...record, toks, stems: toks.map(t => t.stem), stemSet: new Set(toks.map(t => t.stem)), titleStems};
  }

  function phraseAt(stems, phrase, i) {
    for (let k = 0; k < phrase.length; k++) if (stems[i + k] !== phrase[k]) return false;
    return true;
  }

  function phrasePositions(stems, phrase) {
    const out = [];
    for (let i = 0; i + phrase.length <= stems.length; i++) if (phraseAt(stems, phrase, i)) out.push(i);
    return out;
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

  function scoreRecord(rec, query) {
    const phraseHits = query.phrases.map(p => phrasePositions(rec.stems, p));
    if (phraseHits.some(h => !h.length)) return null; // quoted phrases are required
    const positions = query.terms.map(t => {
      if (!rec.stemSet.has(t)) return [];
      const out = [];
      rec.stems.forEach((s, i) => { if (s === t) out.push(i); });
      return out;
    });
    const matched = positions.filter(p => p.length).length;
    if (!matched && !query.phrases.length) return null;
    let score = 0;
    positions.forEach((p, i) => {
      if (p.length) score += 10 + Math.min(5, p.length);
      if (rec.titleStems.has(query.terms[i])) score += 4;
    });
    phraseHits.forEach(h => { score += 25 + Math.min(5, h.length); });
    const allTerms = matched === query.terms.length;
    if (allTerms && query.terms.length > 1) {
      score += 30;
      const span = windowSize(positions);
      score += Math.max(0, 20 - span / 4);
    }
    return {score, allTerms, matchedTerms: query.terms.filter((_, i) => positions[i].length)};
  }

  function search(indexed, q, filter) {
    const query = typeof q === 'string' ? parseQuery(q) : q;
    if (query.empty) return {query, hits: []};
    const hits = [];
    for (const rec of indexed) {
      if (filter && !filter(rec)) continue;
      const s = scoreRecord(rec, query);
      if (s) hits.push({rec, ...s});
    }
    hits.sort((a, b) => b.score - a.score || (a.rec.order || 0) - (b.rec.order || 0));
    return {query, hits};
  }

  function isMatch(stems, i, query) {
    if (query.terms.includes(stems[i])) return true;
    for (const p of query.phrases) for (let k = 0; k < p.length; k++) if (i - k >= 0 && phraseAt(stems, p, i - k)) return true;
    return false;
  }

  // Up to `max` short line-based excerpts around matches, best (most distinct terms) first.
  function excerpts(rec, query, {context = 1, max = 3} = {}) {
    const text = normalize(rec.text);
    const lineStarts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
    const lineOf = pos => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
    const hitLines = new Map();
    rec.toks.forEach((t, i) => {
      if (!isMatch(rec.stems, i, query)) return;
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

  global.LibrarySearch = {normalize, stem, tokens, parseQuery, index, search, excerpts, highlightHTML, escapeHTML};
})(typeof window !== 'undefined' ? window : globalThis);
