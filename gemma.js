'use strict';
// "Ask Gemma": answers from library pages using a local model. On a Mac the app talks to
// LM Studio's local server (nothing leaves the computer); on iPhone/iPad it copies the
// question and the chosen pages for pasting into Locally. The library picks the pages,
// so every answer comes with the exact pages to check.
(() => {
  const $ = id => document.getElementById(id);
  if (!$('ask-panel')) return;
  const S = window.LibrarySearch, A = window.LibraryAsk;
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const store = {
    get(k, d) { try { return localStorage.getItem('ask-' + k) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('ask-' + k, v); } catch {} }
  };
  let controller = null, pictureURLs = [];

  $('ask-server').value = store.get('server', 'http://localhost:1234');
  $('ask-server').onchange = () => { store.set('server', $('ask-server').value.trim()); $('ask-model').replaceChildren(new Option('Choose automatically', '')); };
  $('ask-model').onchange = () => store.set('model', $('ask-model').value);
  if (IOS) { $('ask-copy').classList.remove('secondary'); $('ask-mac').classList.add('secondary'); $('ask-copy').after($('ask-mac')); }

  const server = () => ($('ask-server').value.trim() || 'http://localhost:1234').replace(/\/+$/, '');
  const status = text => { $('ask-status').textContent = text; };

  // Chrome asks permission before a web page may reach this computer's local server.
  function lm(path, init = {}) {
    const url = server() + path;
    const opts = {...init};
    if (location.protocol === 'https:' && /^http:\/\/(localhost|127\.|\[::1\])/.test(url)) opts.targetAddressSpace = 'loopback';
    return fetch(url, opts);
  }

  function explain(error) {
    if (error.name === 'AbortError') return 'Stopped.';
    if (error instanceof TypeError) {
      return `Couldn't reach LM Studio at ${server()}. On the Mac: open LM Studio, Developer tab, start the server and turn on “Enable CORS” in Server Settings. ` +
        (location.protocol === 'file:' ? 'Browsers may block pages opened from files from reaching LM Studio; use the installed app, or chat in LM Studio with the library tool. ' : '') +
        (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? 'Safari may block web pages from reaching this Mac; Chrome works, or chat in LM Studio with the library tool. ' : 'If Chrome asks to allow access to devices on your local network, choose Allow. ');
    }
    return error.message;
  }

  // Pick a chat model (Gemma preferred) and size the pages to its context window.
  async function chooseModel() {
    const res = await lm('/v1/models');
    if (!res.ok) throw Error('LM Studio answered ' + res.status);
    const ids = (await res.json()).data.map(m => m.id).filter(id => !/embed/i.test(id));
    if (!ids.length) throw Error('No chat model is available in LM Studio. Download or load Gemma first.');
    const sel = $('ask-model'), saved = store.get('model', '');
    if (sel.options.length <= 1) for (const id of ids) sel.append(new Option(id, id));
    sel.value = ids.includes(saved) ? saved : '';
    const model = sel.value || ids.find(id => /gemma/i.test(id)) || ids[0];
    let context = 0;
    try {
      const info = await (await lm('/api/v0/models')).json();
      context = (info.data.find(m => m.id === model) || {}).loaded_context_length || 0;
    } catch (_) {}
    // Not loaded yet (LM Studio loads it on first use): reuse the size seen last time.
    if (context) store.set('context-' + model, String(context)); else context = Number(store.get('context-' + model, 0));
    const budget = context >= 12000 ? {pages: 5, maxChars: 3500} : context >= 7000 ? {pages: 4, maxChars: 2500} : {pages: 3, maxChars: 1800};
    return {model, context, ...budget};
  }

  function clearOutput() {
    for (const u of pictureURLs) URL.revokeObjectURL(u);
    pictureURLs = [];
    $('ask-answer').replaceChildren();
    $('ask-answer').hidden = true;
    $('ask-sources').replaceChildren();
  }

  function retrieve(budget) {
    const app = window.LibraryApp;
    if (!app || !app.index) throw Error('The library is still loading.');
    const question = $('ask-question').value.trim();
    if (!question) throw Error('Type a question first.');
    const r = A.retrieve(S, app.index, question, {...budget, filter: app.filter()});
    showSources(r);
    return {question, ...r};
  }

  // The pages given to the model, each with its caution, link and optional picture.
  function showSources({sources, query, keywords}) {
    const box = $('ask-sources');
    box.replaceChildren();
    const h = document.createElement('h3');
    h.textContent = sources.length ? `Pages given to Gemma (searched for: ${keywords})` : `No pages matched: ${keywords}`;
    box.append(h);
    for (const s of sources) {
      const rec = s.rec, card = document.createElement('div');
      card.className = 'ask-source';
      card.id = 'ask-src-' + s.n;
      const title = document.createElement('strong');
      title.textContent = `[${s.n}] ${rec.title}`;
      const where = document.createElement('div');
      where.className = 'meta';
      const span = s.pages && s.pages.length > 1 ? `PDF pages ${s.pages[0]}–${s.pages[s.pages.length - 1]}` : `PDF page ${rec.page}`;
      where.textContent = rec.page ? span + (rec.original ? ' of ' + rec.original.pages : '') + (s.next ? ` (plus the top of page ${s.next.page})` : '') : '';
      card.append(title, where);
      if (rec.original && rec.original.caution) {
        const c = document.createElement('p');
        c.className = 'doc-caution';
        c.textContent = '⚠︎ ' + rec.original.caution;
        card.append(c);
      }
      const actions = document.createElement('div');
      actions.className = 'result-actions';
      const href = window.LibraryApp.pageLink(rec, keywords);
      if (href) { const a = document.createElement('a'); a.className = 'open-page'; a.href = href; a.textContent = 'Open page ' + rec.page; actions.append(a); }
      if (window.PagePicture && window.PagePicture.available && rec.original) {
        const b = document.createElement('button');
        b.className = 'secondary';
        b.textContent = 'Show page picture';
        b.onclick = async () => {
          b.disabled = true; b.textContent = 'Loading…';
          try {
            const pic = await window.PagePicture.picture(rec.original, rec.page, query, {cssWidth: Math.min(760, card.clientWidth || 600)});
            pictureURLs.push(pic.url);
            const img = new Image();
            img.src = pic.url;
            img.alt = `${rec.title}, PDF page ${rec.page}, matching words highlighted`;
            img.className = 'ask-picture';
            b.replaceWith(img);
          } catch (e) { b.textContent = 'Picture unavailable: ' + e.message; }
        };
        actions.append(b);
      }
      card.append(actions);
      box.append(card);
    }
  }

  // Minimal, safe Markdown: paragraphs, bullet and numbered lists, bold, and [n] links.
  function renderAnswer(text) {
    const clean = text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
    const inline = s => S.escapeHTML(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, list) => '[' + list.split(/\s*,\s*/).map(n => `<a href="#ask-src-${n}">${n}</a>`).join(', ') + ']');
    let html = '', list = null;
    const close = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const raw of clean.split('\n')) {
      const line = raw.trim();
      let m;
      if (!line) { close(); continue; }
      if ((m = line.match(/^#{1,6}\s+(.*)$/))) { close(); html += `<h4>${inline(m[1])}</h4>`; }
      else if ((m = line.match(/^[*\-•]\s+(.*)$/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
      else { close(); html += `<p>${inline(line)}</p>`; }
    }
    close();
    $('ask-answer').innerHTML = '<p class="ask-label">Gemma’s answer — check the pages below before acting on it.</p>' + html;
    $('ask-answer').hidden = false;
  }

  async function askMac() {
    clearOutput();
    controller = new AbortController();
    $('ask-mac').disabled = true; $('ask-stop').hidden = false;
    const t0 = Date.now();
    let timer = null;
    try {
      status('Connecting to LM Studio…');
      const pick = await chooseModel();
      const r = retrieve(pick);
      if (!r.sources.length) { status('No library pages matched, so Gemma was not asked. Try other words.'); return; }
      const tick = what => { clearInterval(timer); timer = setInterval(() => status(`${what} · ${Math.round((Date.now() - t0) / 1000)} s`), 1000); };
      tick(`${pick.model} is reading ${r.sources.length} pages`);
      const res = await lm('/v1/chat/completions', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal,
        body: JSON.stringify({model: pick.model, messages: A.messages(r.question, r.sources), temperature: 0.2, max_tokens: 900, stream: true})
      });
      if (!res.ok) throw Error(`LM Studio answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buffer = '', answer = '', thinking = false;
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let delta;
          try { delta = (JSON.parse(data).choices || [])[0]?.delta || {}; } catch { continue; }
          if (delta.content) { if (!answer) tick(`${pick.model} is writing`); answer += delta.content; renderAnswer(answer); }
          else if ((delta.reasoning_content || delta.reasoning) && !thinking) { thinking = true; tick(`${pick.model} is thinking`); }
        }
      }
      clearInterval(timer);
      if (!answer.trim()) throw Error('Gemma returned an empty answer. Try again, or raise the context length for the model in LM Studio.');
      status(`Answered by ${pick.model} on this computer in ${Math.round((Date.now() - t0) / 1000)} s, from ${r.sources.length} library pages.`);
    } catch (e) {
      status(explain(e));
    } finally {
      clearInterval(timer);
      controller = null;
      $('ask-mac').disabled = false; $('ask-stop').hidden = true;
    }
  }

  // Phones run small models with short memory, so send fewer, shorter passages.
  async function copyForLocally() {
    clearOutput();
    try {
      const r = retrieve({pages: 3, maxChars: 1500});
      if (!r.sources.length) { status('No library pages matched. Try other words.'); return; }
      const text = A.pasteText(r.question, r.sources);
      try { await navigator.clipboard.writeText(text); }
      catch { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      status(`Copied your question with ${r.sources.length} library pages (${Math.round(text.length / 1000)}k characters). Open Locally, paste into a new chat and send. Check the answer against the pages below.`);
    } catch (e) { status(e.message); }
  }

  async function check() {
    status('Checking LM Studio…');
    try {
      const pick = await chooseModel();
      status(`Connected. Using ${pick.model}${pick.context ? ` (context ${pick.context.toLocaleString()} tokens, up to ${pick.pages} pages per question)` : ''}.`);
    } catch (e) { status(explain(e)); }
  }

  $('ask-mac').onclick = askMac;
  $('ask-copy').onclick = copyForLocally;
  $('ask-stop').onclick = () => controller && controller.abort();
  $('ask-check').onclick = check;
  $('ask-question').onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (IOS ? copyForLocally : askMac)(); };
})();
