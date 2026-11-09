'use strict';
function chooseDocument(items,id){return items.find(item=>item.id===id && /^originals\/[a-f0-9]{64}\.pdf$/.test(item.path));}
(async()=>{
 const status=document.getElementById('document-status');
 try{
  const response=await fetch('./originals.json');if(!response.ok)throw Error('Reference list unavailable');
  const item=chooseDocument(await response.json(),new URLSearchParams(location.search).get('doc'));
  if(!item)throw Error('Unknown document. Return to the library and choose an original.');
  document.getElementById('document-title').textContent=item.title;
  const frame=document.getElementById('document-frame');const page=Number(new URLSearchParams(location.search).get('page'));const validPage=Number.isInteger(page)&&page>=1&&page<=item.pages;frame.src=new URL(item.path,document.baseURI).href+(validPage?'#page='+page:'');frame.hidden=false;
  status.textContent=`${validPage?'Search result: PDF page '+page+'. If your viewer does not jump there, navigate to that PDF page manually. ':''}${item.pages} PDF pages. Use Back to library above to leave this document. If blank, return and confirm this original is saved on this device.`;
 }catch(error){status.textContent=error.message;}
})();
