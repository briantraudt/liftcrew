import {SUPABASE_URL,SUPABASE_KEY} from './operator-config.js';
import {agreementBlocks,validatePublishedAgreement} from './published-agreement-format.js';
const status=document.querySelector('#agreement-status');
const article=document.querySelector('#published-agreement');
try{
 const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/current_provider_agreement',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Could not load the current published agreement. Please refresh or contact LiftCrew.');
 const agreement=validatePublishedAgreement(await response.json());
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(agreement.body)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==agreement.sha256)throw Error('The agreement integrity check failed. Refresh before proceeding.');
 status.textContent='Published · '+agreement.version;
 for(const block of agreementBlocks(agreement.body)){const el=document.createElement(block.tag);el.textContent=block.text;article.append(el);}
 const audit=document.createElement('p');audit.className='agreement-hash';audit.textContent='Published terms SHA-256: '+hash;article.after(audit);
 document.querySelector('#agreement-actions').hidden=false;
 document.querySelector('#download-agreement').onclick=()=>{const url=URL.createObjectURL(new Blob([agreement.body],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=agreement.version.replace(/[^a-zA-Z0-9._-]/g,'-')+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
 document.querySelector('#print-agreement').onclick=()=>window.print();
}catch(error){status.setAttribute('role','alert');status.textContent=error.message||'Unable to load the agreement. Please refresh or contact LiftCrew.';article.replaceChildren();}
