const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
function worker({fail=false}={}) {
  const handlers={}, files=new Map();let network=0;
  const cache={match:async key=>files.get(typeof key==='string'?key:key.url),addAll:async urls=>{if(fail)throw Error('offline');for(const u of urls){assert.equal(u.cache,'reload');files.set(u.url,{ok:true,url:u.url})}},put:async(k,v)=>files.set(k.url||k,v)};
  const scope='https://example.test/bluedobie-offline-library/';
  vm.runInNewContext(source('sw.js'),{URL,Response,Request,self:{registration:{scope},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>cache},fetch:async()=>{network++;throw Error('network unavailable')}});
  const run=async(name,extra={})=>{let promise;handlers[name]({...extra,waitUntil:p=>promise=p,respondWith:p=>promise=p});return await promise};
  return {run,files,scope,network:()=>network};
}
test('install caches every shell asset and document payload',async()=>{const w=worker();await w.run('install');for(const f of ['index.html','offline.js','app.js','search.js','pagepic.js','library-data.js','originals-data.js'])assert.ok(w.files.has(w.scope+f));});
test('offline cold navigation and library fetch do not need network',async()=>{const w=worker();await w.run('install');for(const req of [{url:w.scope,mode:'navigate',method:'GET'},{url:w.scope+'index.html?launch=home',mode:'navigate',method:'GET'},{url:w.scope+'library-data.js',mode:'no-cors',method:'GET'}])assert.ok((await w.run('fetch',{request:req})).ok);assert.equal(w.network(),0);});
test('failed install rejects rather than claiming offline readiness',async()=>{await assert.rejects(worker({fail:true}).run('install'));});
test('cache checker reports incomplete offline cache honestly',async()=>{const w=worker({fail:true});let result;await w.run('message',{data:{type:'CHECK_OFFLINE'},ports:[{postMessage:r=>result=r}]});assert.equal(result.ok,false);});
test('cache checker repairs missing assets when online',async()=>{const w=worker();let result;await w.run('message',{data:{type:'CHECK_OFFLINE',allowRepair:true},ports:[{postMessage:r=>result=r}]});assert.equal(result.ok,true);assert.ok(w.files.has(w.scope+'library-data.js'));});
async function readiness({unsupported=false,registrationFails=false,complete=true,timeout=false,controlled=true,online=true,existingActive=false,existingPending=false}={}) {
  let registerCalls=0;
  const controller={postMessage:(data,ports)=>{if(!timeout)ports[0].peer.onmessage({data:{ok:complete}})}};
  const serviceWorker={addEventListener(){},removeEventListener(){},controller:controlled?controller:null,getRegistration:async()=>existingActive?{active:controller}:existingPending?{installing:{state:"installing"}}:undefined,
    register:async()=>{registerCalls++;if(registrationFails)throw Error('denied');serviceWorker.controller=controller},
    get ready(){serviceWorker.controller=controller;return Promise.resolve({active:controller})}};
  const nav=unsupported?{}:{onLine:online,serviceWorker};
  class Channel{constructor(){this.port1={close(){}};this.port2={peer:this.port1}}}
  const context={window:{isSecureContext:true},navigator:nav,MessageChannel:Channel,setTimeout:(f)=>setTimeout(f,5),clearTimeout};
  vm.runInNewContext(source('offline.js'),context);return {...await context.window.offlineReady,registerCalls};
}
test('unsupported browser never claims ready',async()=>assert.equal((await readiness({unsupported:true})).ok,false));
test('registration rejection is visible',async()=>{const r=await readiness({registrationFails:true,controlled:false});assert.equal(r.ok,false);assert.match(r.error,/denied/)});
test('success requires verified worker response',async()=>assert.equal((await readiness()).ok,true));
test('incomplete worker cache fails readiness',async()=>assert.equal((await readiness({complete:false})).ok,false));
test('silent or older worker times out instead of hanging forever',async()=>assert.equal((await readiness({timeout:true})).ok,false));
test('UI no longer promises offline availability merely after JSON fetch',()=>{assert.doesNotMatch(source('app.js'),/Ready · all included guides available offline/);assert.match(source('app.js'),/await window.offlineReady/);});

test('installed offline controller succeeds without registration network request',async()=>{const r=await readiness({online:false,registrationFails:true});assert.equal(r.ok,true);assert.equal(r.registerCalls,0)});
test('existing active registration is reused without fetching worker script',async()=>{const r=await readiness({online:false,controlled:false,existingActive:true,registrationFails:true});assert.equal(r.ok,true);assert.equal(r.registerCalls,0)});
test('first offline launch fails clearly without requesting registration',async()=>{const r=await readiness({online:false,controlled:false});assert.equal(r.ok,false);assert.equal(r.registerCalls,0);assert.match(r.error,/online once/)});
test('first online launch still installs worker',async()=>{const r=await readiness({controlled:false});assert.equal(r.ok,true);assert.equal(r.registerCalls,1)});
test('offline cache check never tries to repair missing files over network',async()=>{const w=worker();let result;await w.run('message',{data:{type:'CHECK_OFFLINE',allowRepair:false},ports:[{postMessage:r=>result=r}]});assert.equal(result.ok,false);assert.equal(w.files.size,0)});

test('pending installation is not mistaken for missing registration offline',async()=>{const r=await readiness({online:false,controlled:false,existingPending:true,registrationFails:true});assert.equal(r.ok,true);assert.equal(r.registerCalls,0)});

test('PDF navigation is never replaced by the HTML shell',async()=>{const w=worker();await w.run('install');const url=w.scope+'originals/test.pdf';w.files.set(url,new Response('%PDF-test',{headers:{'Content-Type':'application/pdf'}}));const r=await w.run('fetch',{request:{url,mode:'navigate',method:'GET'}});assert.equal(await r.text(),'%PDF-test')});
test('cached PDFs support bounded, suffix, open and invalid byte ranges',async()=>{for(const [range,status,expected] of [['bytes=2-4',206,'DF-'],['bytes=-4',206,'test'],['bytes=5-',206,'test'],['bytes=20-',416,''],['bytes=3-1',416,''],['bytes=0-1,4-5',416,'']]){const w=worker();const url=w.scope+'originals/test.pdf';w.files.set(url,new Response('%PDF-test'));const r=await w.run('fetch',{request:{url,mode:'navigate',method:'GET',headers:new Headers({Range:range})}});assert.equal(r.status,status);assert.equal(await r.text(),expected);assert.equal(w.network(),0)}});
test('missing offline PDF returns a clear error rather than the shell',async()=>{const w=worker();await w.run('install');const r=await w.run('fetch',{request:{url:w.scope+'originals/missing.pdf',mode:'navigate',method:'GET'}});assert.equal(r.status,503);assert.match(await r.text(),/not saved/)});
test('unknown navigation is not silently rewritten to app shell',async()=>{const w=worker();await w.run('install');await assert.rejects(w.run('fetch',{request:{url:w.scope+'missing.html',mode:'navigate',method:'GET'}}))});
async function verifyOriginal(data,item){
  const context={window:{},document:{getElementById:()=>({textContent:''})},fetch:async()=>{throw Error('test only')},Response,TextDecoder,crypto:require('node:crypto').webcrypto};
  vm.runInNewContext(source('originals.js'),context);
  return context.verifiedPDF(new Response(data),item);
}
test('original verifier accepts exact PDF and rejects partial or altered bytes',async()=>{
  const data='%PDF-safe';const item={bytes:data.length,sha256:require('node:crypto').createHash('sha256').update(data).digest('hex')};
  assert.equal(await (await verifyOriginal(data,item)).text(),data);
  await assert.rejects(verifyOriginal('%PDF-',item),/size mismatch/);
  await assert.rejects(verifyOriginal('%PDF-evil',item),/match the verified source/);
  await assert.rejects(verifyOriginal('<html>bad',item),/not a PDF/);
});
test('every local original matches its manifest size and hash',()=>{for(const d of JSON.parse(source('originals.json'))){const data=fs.readFileSync(path.join(root,d.path));assert.equal(data.length,d.bytes);assert.equal(require('node:crypto').createHash('sha256').update(data).digest('hex'),d.sha256)}});
test('worker never duplicates original PDFs in the shell cache',()=>{assert.doesNotMatch(source('sw.js').split('const assetURLs')[0],/originals\/.*pdf/)});
test('activation removes old app-shell copies but never saved original PDFs',async()=>{
  const handlers={},current=source('sw.js').match(/CACHE_PREFIX \+ '(v\d+)'/)[1],names=new Set(['bluedobie-library-static-v10','bluedobie-library-static-v11','bluedobie-library-static-v13','bluedobie-library-static-'+current,'bluedobie-originals-v1','other-app']);
  const caches={keys:async()=>[...names],delete:async n=>names.delete(n),open:async()=>({})};
  vm.runInNewContext(source('sw.js'),{URL,Response,Request,caches,self:{registration:{scope:'https://example.test/'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}}});
  let p;handlers.activate({waitUntil:x=>p=x});await p;
  assert.deepEqual([...names].sort(),['bluedobie-library-static-'+current,'bluedobie-originals-v1','other-app']);
});

test('release includes exactly the complete USDA set and no held sources',()=>{const a=JSON.parse(source('originals.json')).filter(d=>Number.isInteger(d.guide));assert.deepEqual(a.map(d=>d.guide).sort((a,b)=>a-b),[0,1,2,3,4,5,6,7]);assert.equal(a.length,8);for(const d of a)assert.match(d.source,/^https:\/\/nchfp\.uga\.edu\/papers\/guide\//)});

test('document screen query navigation works without network',async()=>{const w=worker();await w.run('install');for(const path of ['viewer.html?doc=usda-5','viewer.css','viewer.js']){const r=await w.run('fetch',{request:{url:w.scope+path,mode:path.startsWith('viewer.html')?'navigate':'cors',method:'GET'}});assert.ok(r.ok)}assert.equal(w.network(),0)});
test('PDF links stay within app document screen',()=>{assert.match(source('app.js'),/viewer\.html\?doc=/);assert.match(source('originals.js'),/viewer\.html\?doc=/);assert.doesNotMatch(source('app.js')+source('originals.js'),/target='_blank'/);assert.match(source('viewer.html'),/id="back-library" href="\.\/index\.html"/)});
test('viewer does not use query parameters as arbitrary PDF URLs',()=>{const context={document:{getElementById:()=>({})},fetch:async()=>{throw Error('test')}};vm.runInNewContext(source('viewer.js'),context);assert.equal(context.chooseDocument([{id:'bad',path:'https://attacker.invalid/x.pdf'}],'bad'),undefined);assert.equal(context.chooseDocument([{id:'good',path:'originals/'+'a'.repeat(64)+'.pdf'}],'good').id,'good')});


test('new USDA page search records retain provenance and source page bounds',()=>{
 const docs=JSON.parse(source('originals.json'));const pages=JSON.parse(source('library.json')).filter(x=>x.pdfPage&&x.originalId.startsWith('usda-'));
 assert.equal(pages.length,59);
 for(const p of pages){const d=docs.find(d=>d.id===p.originalId);assert.ok(d);assert.ok(p.pdfPage>=1&&p.pdfPage<=d.pages);assert.equal(p.sourceSha256,d.sha256);assert.equal(p.source,d.source);assert.ok(p.text.trim());}
 for(const [id,word] of [['usda-6','sauerkraut'],['usda-7','pectin'],['usda-0','canning']])assert.ok(pages.some(p=>p.originalId===id&&p.text.toLowerCase().includes(word)));
});
test('unreliable page extraction is shown as a page picture, labelled, and never copied for AI',()=>{
 const app=source('app.js');
 assert.match(app,/if \(!rec\.layout\) \{\s*const copy/);
 assert.match(app,/Extracted text near the match \(unverified\)/);
 assert.match(app,/Tables can be scrambled/);
 assert.match(app,/pictureFigure\(rec, true\)/);
 assert.match(source('viewer.js'),/validPage/);
});

test('reviewed reference release excludes held material and retains CDC notice',()=>{const docs=JSON.parse(source('originals.json')).filter(d=>!Number.isInteger(d.guide)&&!['cdc-diabetes-emergencies','cdc-emergency-insulin','cdc-diabetic-ketoacidosis','fda-emergency-insulin','fda-insulin-products'].includes(d.id)&&!ADDITIONS_2026_11_21.includes(d.id));assert.deepEqual(docs.map(d=>d.id).sort(),['cdc-emergency-water','cdc-food-power-outage','cdc-handwashing','cdc-shelter-health','cdc-wound-care','ifrc-shelter-safety','usgs-map-and-compass']);for(const d of docs){assert.ok(d.sourceReview);if(d.id.startsWith('cdc-'))assert.match(d.publicationNotice,/free of charge.*does not imply endorsement/)}const pages=JSON.parse(source('library.json')).filter(p=>p.pdfPage&&docs.some(d=>d.id===p.originalId));assert.equal(pages.length,65);for(const p of pages){const d=docs.find(d=>d.id===p.originalId);assert.equal(p.sourceSha256,d.sha256);assert.ok(p.pdfPage<=d.pages)}});

test('offline PDF renderer has bounded page controls and bundled assets',()=>{assert.doesNotMatch(source('viewer.html'),/<iframe/);for(const id of ['previous','next','go-page','pdf-canvas'])assert.ok(source('viewer.html').includes('id="'+id+'"'));assert.match(source('sw.js'),/vendor\/pdfjs\/pdf.worker.min.mjs/);assert.match(source('pagepic.js'),/isEvalSupported: false/);});

// ---- Data build, search and local-file mode ----
const built=require('../tools/build-data.cjs').build();
function loadSearch(){const ctx={};vm.runInNewContext(source('search.js'),ctx);return ctx.LibrarySearch;}
function loadPages(){const ctx={window:{}};vm.runInNewContext(source('library-data.js'),ctx);return ctx.window.LIBRARY_PAGES;}

test('generated data scripts are up to date with library.json and originals.json',()=>{for(const [name,text] of Object.entries(built.files))assert.equal(source(name),text,name+' is stale: run node tools/build-data.cjs')});
test('every original page record points at a real page and carries no damaged characters',()=>{
  const docs=new Map(JSON.parse(source('originals.json')).map(d=>[d.id,d]));const pages=loadPages();
  for(const p of pages){const d=docs.get(p.doc);assert.ok(d,p.id);assert.ok(p.page>=1&&p.page<=d.pages,p.id);assert.doesNotMatch(p.text,/[\ufffd\u00ad]/,p.id);assert.equal(typeof p.layout,'boolean')}
  for(const g of ['usda-1','usda-2','usda-3','usda-4','usda-5'])assert.ok(pages.filter(p=>p.doc===g&&!p.layout).length>=10,g);
  assert.equal(pages.filter(p=>p.layout).length,JSON.parse(source('library.json')).filter(p=>Number.isInteger(p.pdfPage)).length);
});
test('search matches whole words with plural and ending variants',()=>{
  const S=loadSearch();
  for(const [a,b] of [['jar','jars'],['pickle','pickling'],['pickles','pickled'],['canning','canned'],['tomato','tomatoes'],['berry','berries']])assert.equal(S.stem(a),S.stem(b),a+'/'+b);
  const idx=[{id:'a',title:'A',text:'Pecans and a scanner.'},{id:'b',title:'B',text:'Can the jars.'}];const index=S.createIndex(idx);
  assert.deepEqual([...S.search(index,'can').hits.map(h=>h.rec.id)],['b']);
  assert.deepEqual([...S.search(index,'jar').hits.map(h=>h.rec.id)],['b']);
});
test('quoted phrases are required and ranked pages put all words first',()=>{
  const S=loadSearch();const idx=S.createIndex(loadPages());
  const phrase=S.search(idx,'"weighted gauge"');assert.ok(phrase.hits.length>10);
  for(const h of phrase.hits)assert.match(h.rec.text.toLowerCase().replace(/\s+/g,' '),/weighted[\s-]+gauge/);
  const venison=S.search(idx,'venison quart');assert.equal(venison.hits[0].rec.doc,'usda-5');assert.ok(venison.hits[0].allTerms);
  assert.equal(S.search(idx,'sauerkraut').hits[0].rec.doc,'usda-6');
});
test('results show short highlighted excerpts, safely escaped',()=>{
  const S=loadSearch();const q=S.parseQuery('venison');
  const rec=({id:'x',title:'T',text:'line one\nline two\nGround venison <b>here</b>\nline four\nline five\nline six\nline seven'});
  const ex=S.excerpts(rec,q);assert.equal(ex.length,1);assert.doesNotMatch(ex[0].text,/line seven/);
  const html=S.highlightHTML(ex[0].text,q);assert.match(html,/<mark>venison<\/mark>/);assert.match(html,/&lt;b&gt;here/);assert.doesNotMatch(html,/<b>/);
});
test('opened from local files, the library is ready without a worker or cache',async()=>{
  const context={window:{isSecureContext:false,location:{protocol:'file:',origin:'null',pathname:'/x/index.html'}},navigator:{},setTimeout,clearTimeout};
  vm.runInNewContext(source('offline.js'),context);const r=await context.window.offlineReady;assert.equal(r.ok,true);assert.equal(r.local,true);
  assert.match(source('app.js'),/if \(LOCAL_FILE\) return o\.path \+ '#page='/);
  assert.match(source('viewer.js'),/location\.protocol==='file:'/);
});
test('data loads as plain scripts so index.html works straight from disk',()=>{
  const html=source('index.html');
  for(const f of ['originals-data.js','library-data.js','search.js'])assert.match(html,new RegExp('<script src="'+f.replace('.','\\.')+'"></script>'));
  assert.doesNotMatch(source('app.js')+source('originals.js'),/fetch\('\.\/(library|originals)\.json'\)/);
});
test('every script and stylesheet the pages load is precached for offline use',()=>{
  const assets=source('sw.js').match(/const ASSETS = \[([^\]]*)\]/)[1];
  for(const page of ['index.html','viewer.html'])for(const m of source(page).matchAll(/(?:src|href)="([^"#?]+\.(?:js|css|webmanifest|png))"/g))assert.ok(assets.includes("'./"+m[1]+"'"),page+' needs '+m[1]);
  assert.match(source('pagepic.js'),/import\('\.\/vendor\/pdfjs\/pdf\.min\.mjs'\)/);
});
test('the app asks the browser to keep its storage and saves every original automatically',()=>{
  const o=source('originals.js');assert.match(o,/navigator\.storage\?\.persist\?\.\(\)/);assert.match(o,/saveEverything\(\);\s*\}\)\(\);\s*$/);
});

test('IFRC handbook keeps noncommercial attribution and page-linked search',()=>{
 const docs=JSON.parse(source('originals.json')),d=docs.find(d=>d.id==='ifrc-shelter-safety');
 assert.equal(d.pages,62);assert.match(d.rights,/noncommercial/);assert.match(d.rights,/2011/);assert.match(d.source,/^https:\/\/www.ifrc.org\//);
 const pages=JSON.parse(source('library.json')).filter(p=>p.originalId===d.id);
 assert.equal(pages.length,58);assert.equal(new Set(pages.map(p=>p.pdfPage)).size,58);
 for(const p of pages){assert.ok(p.pdfPage>=1&&p.pdfPage<=62);assert.equal(p.sourceSha256,d.sha256);assert.equal(p.source,d.source);assert.ok(p.text.trim());assert.match(p.extraction,/locator/)}
 for(const term of ['earthquake','flood','fire','wind'])assert.ok(pages.some(p=>p.text.toLowerCase().includes(term)));
 assert.match(source('index.html'),/noncommercial use with attribution/);
});

 test('diabetes references preserve provenance and safe page locators',()=>{const ds=JSON.parse(source('originals.json')).filter(d=>['cdc-diabetes-emergencies','cdc-emergency-insulin','cdc-diabetic-ketoacidosis','fda-emergency-insulin','fda-insulin-products'].includes(d.id));assert.equal(ds.length,5);const ps=JSON.parse(source('library.json')).filter(p=>ds.some(d=>d.id===p.originalId));assert.equal(ps.length,33);for(const d of ds){assert.match(d.sourceReview,/product-specific/);assert.match(d.publicationNotice,/does not imply endorsement/)}for(const p of ps){const d=ds.find(d=>d.id===p.originalId);assert.ok(p.pdfPage>=1&&p.pdfPage<=d.pages);assert.equal(p.sourceSha256,d.sha256);assert.match(p.extraction,/locator/);}});

const ADDITIONS_2026_11_21=['army-atp-4-02-11','fema-cert-manual','phs-ships-medicine-chest','twdb-rainwater-manual','nrcs-springs-wells','army-tc-4-02-3','army-atp-4-25-12','epa-emergency-disinfection','uky-poisonous-plants','msu-forgotten-foods','army-atp-3-50-21','fema-are-you-ready','cpsc-generators-co','epa-burn-wise','dhs-auxfog','fda-food-facts','peace-corps-poultry','cdc-extreme-cold','cdc-niosh-poisonous-plants'];
test('November 21 survival additions carry rights, review, caution and page locators',()=>{
  const docs=JSON.parse(source('originals.json')),lib=JSON.parse(source('library.json'));
  for(const id of ADDITIONS_2026_11_21){
    const d=docs.find(d=>d.id===id);assert.ok(d,id);
    for(const k of ['title','topic','edition','rights','sourceReview','caution','retrieved'])assert.ok(d[k]&&d[k].length>3,id+' '+k);
    assert.match(d.source,/^https:\/\/(armypubs\.army\.mil|www\.ready\.gov|www\.govinfo\.gov|www\.twdb\.texas\.gov|directives\.nrcs\.usda\.gov|www\.epa\.gov|publications\.ca\.uky\.edu|extension\.msstate\.edu|www\.cpsc\.gov|www\.cisa\.gov|www\.fda\.gov|files\.peacecorps\.gov|stacks\.cdc\.gov|www\.cdc\.gov)\//,id);
    if(id.startsWith('cdc-'))assert.match(d.publicationNotice,/free of charge.*does not imply endorsement/);
    const pages=lib.filter(p=>p.originalId===id);assert.ok(pages.length>0,id);
    for(const p of pages){assert.equal(p.sourceSha256,d.sha256);assert.ok(p.pdfPage>=1&&p.pdfPage<=d.pages);assert.match(p.extraction,/locator/)}
  }
  for(const id of ['army-atp-4-02-11','army-tc-4-02-3','army-atp-4-25-12','army-atp-3-50-21'])assert.match(docs.find(d=>d.id===id).rights,/Approved for public release/i);
  for(const id of ['uky-poisonous-plants','msu-forgotten-foods'])assert.match(docs.find(d=>d.id===id).rights,/nonprofit/);
  assert.match(docs.find(d=>d.id==='phs-ships-medicine-chest').caution,/outdated/);
  assert.match(docs.find(d=>d.id==='army-atp-3-50-21').caution,/edibility test/);
  assert.match(docs.find(d=>d.id==='cdc-niosh-poisonous-plants').sourceReview,/not byte-identical/);
});
test('every original has a topic and the menu groups documents by topic',()=>{
  for(const d of JSON.parse(source('originals.json')))assert.ok(d.topic,d.id);
  assert.match(source('app.js'),/optgroup/);
});
test('search index stays compact and ranks rare words above common ones',()=>{
  const S=loadSearch();const idx=S.createIndex(loadPages());
  assert.ok(idx.recs.every(r=>r.seq instanceof idx.recs[0].seq.constructor&&!('toks' in r)));
  const top=q=>S.search(idx,q).hits[0].rec.doc;
  assert.equal(top('venison quart'),'usda-5');
  assert.equal(top('pressure canning venison quart jars altitude 800 feet'),'usda-5');
  assert.equal(top('first flush diverter'),'twdb-rainwater-manual');
  assert.equal(top('generator carbon monoxide'),'cpsc-generators-co');
  assert.equal(top('latrine'),'army-atp-4-25-12');
});
