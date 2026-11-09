"use strict";
function chooseDocument(items,id){return items.find(item=>item.id===id && /^originals\/[a-f0-9]{64}\.pdf$/.test(item.path));}
function validPage(value,total){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=total?n:1;}
(async()=>{
 const $=id=>document.getElementById(id),status=$('document-status');
 try{
  const response=await fetch('./originals.json');if(!response.ok)throw Error('Reference list unavailable');
  const params=new URLSearchParams(location.search),item=chooseDocument(await response.json(),params.get('doc'));
  if(!item)throw Error('Unknown document. Return to the library and choose an original.');
  $('document-title').textContent=item.title;
  $('source-notice').textContent=item.id.startsWith('cdc-')?'CDC source, free from CDC. No CDC or U.S. Government endorsement.':'';
  $('source-context').textContent=[item.source,item.edition,item.rights,item.publicationNotice,item.sourceReview].filter(Boolean).join(' ');
  const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',document.baseURI).href;
  const original=await fetch(item.path);if(!original.ok)throw Error('Original unavailable. Save it from Originals while online first.');
  const bytes=await original.arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==item.bytes||hash!==item.sha256)throw Error('Original verification failed. Return and save the verified original again.');
  const asset=path=>new URL('./vendor/pdfjs/'+path,document.baseURI).href;
  const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),cMapUrl:asset('cmaps/'),cMapPacked:true,standardFontDataUrl:asset('standard_fonts/'),wasmUrl:asset('wasm/'),iccUrl:asset('iccs/'),isEvalSupported:false}).promise;
  if(pdf.numPages!==item.pages)throw Error('PDF page count does not match verified source.');
  let current=validPage(params.get('page'),pdf.numPages),rendering=null,sequence=0;
  $('page-number').max=pdf.numPages;$('page-total').textContent='of '+pdf.numPages;
  async function render(number){
   const token=++sequence;current=validPage(number,pdf.numPages);if(rendering){rendering.cancel();try{await rendering.promise}catch{}}
   $('page-number').value=current;$('previous').disabled=current===1;$('next').disabled=current===pdf.numPages;$('go-page').disabled=false;status.textContent='Rendering PDF page '+current+'…';
   try{const page=await pdf.getPage(current);if(token!==sequence)return;const base=page.getViewport({scale:1}),width=Math.max(240,$('pdf-area').clientWidth-16)*Number($('zoom').value),scale=width/base.width;const ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(4000000/(base.width*base.height*scale*scale)));const view=page.getViewport({scale:scale*ratio}),canvas=$('pdf-canvas');canvas.width=Math.floor(view.width);canvas.height=Math.floor(view.height);canvas.style.width=width+'px';canvas.style.height=(base.height*scale)+'px';canvas.setAttribute('aria-label',item.title+', PDF page '+current+' of '+pdf.numPages);rendering=page.render({canvasContext:canvas.getContext('2d'),viewport:view});await rendering.promise;if(token!==sequence)return;status.textContent='PDF page '+current+' of '+pdf.numPages+' · rendered on this device';$('pdf-area').scrollTop=0;}
   catch(error){if(token===sequence&&error.name!=='RenderingCancelledException')status.textContent='Page could not render: '+error.message;}
  }
  $('previous').onclick=()=>render(current-1);$('next').onclick=()=>render(current+1);$('go-page').onclick=()=>render($('page-number').value);$('page-number').onkeydown=e=>{if(e.key==='Enter')render($('page-number').value)};$('zoom').onchange=()=>render(current);
  await render(current);
 }catch(error){status.textContent='PDF unavailable: '+error.message+' Use Back to library above.';}
})();
