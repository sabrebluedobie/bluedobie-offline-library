'use strict';
// Separate content-addressed storage survives shell updates; no automatic deletion.
window.originalDocuments = [];
const ORIGINAL_CACHE = 'bluedobie-originals-v1';
async function verifiedPDF(response, item) {
  if (!response || !response.ok) throw Error('Original unavailable');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== item.bytes) throw Error('Incomplete original: size mismatch');
  if (new TextDecoder().decode(bytes.slice(0,5)) !== '%PDF-') throw Error('Response is not a PDF');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  if (hash !== item.sha256) throw Error('Original does not match the verified source');
  return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Length':String(bytes.byteLength)}});
}
async function showStorage() {
  const el=document.getElementById('storage-status');
  try {
    const e=await navigator.storage?.estimate?.();
    const persistent=await navigator.storage?.persisted?.();
    el.textContent=(e?.quota ? `Browser estimate: ${(e.usage/1048576).toFixed(1)} MiB used of ${(e.quota/1048576).toFixed(0)} MiB quota. ` : 'Storage estimate unavailable. ')+(persistent?'Persistent storage granted; keep separate Files backups too.':'Storage is best effort; verify originals before relying on them offline.');
  } catch {el.textContent='Storage estimate unavailable. Keep separate local Files backups.';}
}
(async()=>{
  const root=document.getElementById('originals');
  try {
    const response=await fetch('./originals.json'); if(!response.ok)throw Error('Reference list unavailable');
    const items=await response.json(); window.originalDocuments=items;
    const cache=await caches.open(ORIGINAL_CACHE);
    for(const item of items){
      const url=new URL(item.path,document.baseURI).href;
      const box=document.createElement('article'),title=document.createElement('h3'),note=document.createElement('p'),status=document.createElement('p'),button=document.createElement('button'),link=document.createElement('a');
      title.textContent=item.title;
      note.textContent=`${item.edition} · ${item.pages} PDF pages · ${(item.bytes/1048576).toFixed(2)} MiB. ${item.source} ${item.rights} ${item.sourceReview||""}`;
      status.setAttribute('role','status'); button.textContent='Save verified original offline';
      link.href=url;link.target='_blank';link.rel='noopener';link.textContent='Open original PDF';link.hidden=true;
      async function check(){
        try{await verifiedPDF(await cache.match(url),item);status.textContent='Original verified in this device’s storage. Test opening it in Airplane Mode.';link.hidden=false;button.textContent='Verify / save original again';}
        catch(e){status.textContent='Original is not verified offline on this device.';link.hidden=true;}
      }
      button.onclick=async()=>{
        button.disabled=true;status.textContent='Checking original…';
        try {
          const saved=await cache.match(url);
          if(saved) {try {await verifiedPDF(saved,item);await check();return;}catch{/* Preserve older data until verified replacement succeeds. */}}
          if(navigator.onLine===false)throw Error('Connect once to save this original');
          const result=await verifiedPDF(await fetch(url,{cache:'no-store'}),item);
          await cache.put(url,result);
          await check();await showStorage();
        } catch(e){status.textContent='Not saved: '+e.message;}
        finally{button.disabled=false;}
      };
      box.append(title,note,status,button,document.createTextNode(' '),link);root.append(box);await check();
    }
    await showStorage();
  }catch(e){root.textContent='Original PDFs unavailable: '+e.message;}
})();
