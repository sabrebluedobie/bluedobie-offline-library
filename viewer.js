"use strict";
function chooseDocument(items,id){return items.find(item=>item.id===id && /^originals\/[a-f0-9]{64}\.pdf$/.test(item.path));}
function validPage(value,total){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=total?n:1;}
(async()=>{
 const $=id=>document.getElementById(id),status=$('document-status');
 try{
  const params=new URLSearchParams(location.search),item=chooseDocument(window.ORIGINAL_DOCUMENTS||[],params.get('doc'));
  if(!item)throw Error('Unknown document. Return to the library and choose an original.');
  // Opened from local files: hand the PDF to the browser's own reader at the right page.
  if(location.protocol==='file:'){location.replace(item.path+'#page='+validPage(params.get('page'),item.pages));return;}
  $('document-title').textContent=item.title;
  $('source-notice').textContent=item.id.startsWith('cdc-')?'CDC source, free from CDC. No CDC or U.S. Government endorsement.':'';
  $('source-context').textContent=[item.source,item.edition,item.rights,item.publicationNotice,item.sourceReview].filter(Boolean).join(' ');
  const q=params.get('q')||'';
  const query=q&&window.LibrarySearch?window.LibrarySearch.parseQuery(q):null;
  if(query&&!query.empty)$('highlight-note').textContent='Search words highlighted in yellow: '+q;
  const {pdf}=await window.PagePicture.openDocument(item);
  let current=validPage(params.get('page'),pdf.numPages),sequence=0;
  $('page-number').max=pdf.numPages;$('page-total').textContent='of '+pdf.numPages;
  async function render(number){
   const token=++sequence;current=validPage(number,pdf.numPages);
   $('page-number').value=current;$('previous').disabled=current===1;$('next').disabled=current===pdf.numPages;$('go-page').disabled=false;status.textContent='Rendering PDF page '+current+'…';
   try{
    const width=Math.max(240,$('pdf-area').clientWidth-16)*Number($('zoom').value);
    const canvas=document.createElement('canvas');
    const result=await window.PagePicture.draw(item,current,canvas,width,query&&!query.empty?query:null);
    if(token!==sequence)return;
    canvas.id='pdf-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',item.title+', PDF page '+current+' of '+pdf.numPages);
    canvas.style.width=width+'px';canvas.style.height=result.cssHeight+'px';
    $('pdf-canvas').replaceWith(canvas);
    status.textContent='PDF page '+current+' of '+pdf.numPages+(result.rects.length?' · '+result.rects.length+' highlighted match(es)':'')+' · rendered on this device';
    $('pdf-area').scrollTop=0;
    try{const url=new URL(location.href);url.searchParams.set('page',current);history.replaceState(null,'',url);}catch(_){}
   }catch(error){if(token===sequence)status.textContent='Page could not render: '+error.message;}
  }
  $('previous').onclick=()=>render(current-1);$('next').onclick=()=>render(current+1);$('go-page').onclick=()=>render($('page-number').value);$('page-number').onkeydown=e=>{if(e.key==='Enter')render($('page-number').value)};$('zoom').onchange=()=>render(current);
  await render(current);
 }catch(error){status.textContent='PDF unavailable: '+error.message+' Use Back to library above.';}
})();
