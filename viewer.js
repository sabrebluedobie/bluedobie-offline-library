'use strict';
function chooseDocument(items,id){return items.find(item=>item.id===id && /^originals\/[a-f0-9]{64}\.pdf$/.test(item.path));}
(async()=>{
 const status=document.getElementById('document-status');
 try{
  const response=await fetch('./originals.json');if(!response.ok)throw Error('Reference list unavailable');
  const item=chooseDocument(await response.json(),new URLSearchParams(location.search).get('doc'));
  if(!item)throw Error('Unknown document. Return to the library and choose an original.');
  document.getElementById('document-title').textContent=item.title;
  const frame=document.getElementById('document-frame');frame.src=new URL(item.path,document.baseURI).href;frame.hidden=false;
  status.textContent=`${item.pages} PDF pages. Use Back to library above to leave this document. If blank, return and confirm this original is saved on this device.`;
 }catch(error){status.textContent=error.message;}
})();
