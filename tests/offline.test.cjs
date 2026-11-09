const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
function worker({fail=false}={}) {
  const handlers={}, files=new Map();let network=0;
  const cache={match:async key=>files.get(typeof key==='string'?key:key.url),addAll:async urls=>{if(fail)throw Error('offline');for(const u of urls)files.set(u,{ok:true,url:u})},put:async(k,v)=>files.set(k.url||k,v)};
  const scope='https://example.test/bluedobie-offline-library/';
  vm.runInNewContext(source('sw.js'),{URL,Response,self:{registration:{scope},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>cache},fetch:async()=>{network++;throw Error('network unavailable')}});
  const run=async(name,extra={})=>{let promise;handlers[name]({...extra,waitUntil:p=>promise=p,respondWith:p=>promise=p});return await promise};
  return {run,files,scope,network:()=>network};
}
test('install caches every shell asset and document payload',async()=>{const w=worker();await w.run('install');for(const f of ['index.html','offline.js','app.js','library.json'])assert.ok(w.files.has(w.scope+f));});
test('offline cold navigation and library fetch do not need network',async()=>{const w=worker();await w.run('install');for(const req of [{url:w.scope,mode:'navigate',method:'GET'},{url:w.scope+'index.html?launch=home',mode:'navigate',method:'GET'},{url:w.scope+'library.json',mode:'cors',method:'GET'}])assert.ok((await w.run('fetch',{request:req})).ok);assert.equal(w.network(),0);});
test('failed install rejects rather than claiming offline readiness',async()=>{await assert.rejects(worker({fail:true}).run('install'));});
test('cache checker reports incomplete offline cache honestly',async()=>{const w=worker({fail:true});let result;await w.run('message',{data:{type:'CHECK_OFFLINE'},ports:[{postMessage:r=>result=r}]});assert.equal(result.ok,false);});
test('cache checker repairs missing assets when online',async()=>{const w=worker();let result;await w.run('message',{data:{type:'CHECK_OFFLINE',allowRepair:true},ports:[{postMessage:r=>result=r}]});assert.equal(result.ok,true);assert.ok(w.files.has(w.scope+'library.json'));});
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
test('worker does not delete older caches or duplicate original PDFs in shell',()=>{assert.doesNotMatch(source('sw.js'),/caches\.delete/);assert.doesNotMatch(source('sw.js').split('const assetURLs')[0],/originals\/.*pdf/)});

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
test('unreliable new page extraction is a locator, never copied safety instructions',()=>{
 assert.match(source('app.js'),/if\(!h.d.pdfPage\)actions.append\(copy\)/);
 assert.match(source('app.js'),/Extracted instructions are withheld/);
 assert.match(source('viewer.js'),/validPage/);
});

test('reviewed reference release excludes held material and retains CDC notice',()=>{const docs=JSON.parse(source('originals.json')).filter(d=>!Number.isInteger(d.guide));assert.deepEqual(docs.map(d=>d.id).sort(),['cdc-emergency-water','cdc-handwashing','cdc-shelter-health','usgs-map-and-compass']);for(const d of docs){assert.ok(d.sourceReview);if(d.id.startsWith('cdc-'))assert.match(d.publicationNotice,/free of charge.*does not imply endorsement/)}const pages=JSON.parse(source('library.json')).filter(p=>p.pdfPage&&!p.originalId.startsWith('usda-'));assert.equal(pages.length,5);for(const p of pages){const d=docs.find(d=>d.id===p.originalId);assert.equal(p.sourceSha256,d.sha256);assert.ok(p.pdfPage<=d.pages)}});

test('offline PDF renderer has bounded page controls and bundled assets',()=>{assert.doesNotMatch(source('viewer.html'),/<iframe/);for(const id of ['previous','next','go-page','pdf-canvas'])assert.ok(source('viewer.html').includes('id="'+id+'"'));assert.match(source('sw.js'),/vendor\/pdfjs\/pdf.worker.min.mjs/);assert.match(source('viewer.js'),/isEvalSupported:false/);});
