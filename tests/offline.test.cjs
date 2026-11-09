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
  vm.runInNewContext(source('sw.js'),{URL,self:{registration:{scope},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>cache},fetch:async()=>{network++;throw Error('network unavailable')}});
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
