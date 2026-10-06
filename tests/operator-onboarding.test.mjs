import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {documentSlots,validateFile,renewalIssues,missingItems,escapeHtml} from '../src/operator-data.js';
import {AGREEMENT_HASH} from '../src/operator-config.js';
test('document checklist follows each machine, operator and delivery arrangement',()=>{
 const p={equipment:[{id:'a',ownership:'Owned',transport:'Third-party hauler'},{id:'b',ownership:'Rented',transport:'Self-delivery'}],operators:[{id:'c'},{id:'d'}]};
 const slots=documentSlots(p);assert.equal(slots.length,16);assert(slots.some(([kind,id])=>kind==='lease'&&id==='b'));assert(!slots.some(([kind,id])=>kind==='lease'&&id==='a'));assert(slots.some(([kind])=>kind==='transport'));assert.equal(slots.filter(([kind])=>kind==='evaluation').length,2);
});
test('only active documents satisfy requirements and absent records cannot pass the checklist',()=>{
 const p={business:{},equipment:[],operators:[],insurance:{}};const missing=missingItems(p,[{kind:'w9',entity_id:'',active:false}]);assert(missing.includes('Business W-9'));assert(missing.includes('Add a machine'));assert(missing.includes('Add an operator'));
});
test('unsafe or oversized upload types are rejected',()=>{
 assert.equal(validateFile({name:'certificate.PDF',type:'application/pdf',size:100}),'pdf');
 for(const file of [{name:'x.svg',type:'image/svg+xml',size:100},{name:'x.html',type:'application/pdf',size:100},{name:'x.pdf',type:'application/pdf',size:10485761},{name:'x.pdf',type:'application/pdf',size:0}])assert.throws(()=>validateFile(file));
});
test('expired policies, evaluations and current documents require renewal',()=>{
 const p={insurance:{cgl:{expiry:'2000-01-01'}},operators:[{name:'Test',evaluationDate:'2000-01-01'}]};assert.equal(renewalIssues(p,[{active:true,filename:'current.pdf',expires_on:'2000-01-01'},{active:false,filename:'archived.pdf',expires_on:'2000-01-01'}]).length,3);
});
test('agreement hash binds the actual published draft source',()=>{
 const terms=readFileSync(new URL('../public/documents/provider-agreement-v1-draft.md',import.meta.url));assert.equal(createHash('sha256').update(terms).digest('hex'),AGREEMENT_HASH);
});
test('application text is escaped before rendering',()=>assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
