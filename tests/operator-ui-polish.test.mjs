import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {confirmOperatorAction} from '../src/operator-confirmation.js';
import {documentSlots} from '../src/operator-data.js';
import {equipmentView,insuranceView,applicantReviewStatusHTML} from '../src/onboarding-ui.js';

function mockDialogEnvironment(){
 const listeners=new Map(),controls=new Map();
 const focusReturn={isConnected:true,focused:false,focus(){this.focused=true;}};
 const element=(selector)=>({
  textContent:'',focus(){this.focused=true;},addEventListener(type,fn){listeners.set(selector+':'+type,fn);}
 });
 for(const selector of ['#lc-confirm-title','#lc-confirm-description','.lc-confirm-cancel','.lc-confirm-accept'])
  controls.set(selector,element(selector));
 const state={appended:false,removed:false,classes:[],attributes:{},backdropClicks:0};
 const modal={
  open:false,className:'',innerHTML:'',
  classList:{add(name){state.classes.push(name);}},
  setAttribute(name,value){state.attributes[name]=value;},
  querySelector(selector){return controls.get(selector);},
  addEventListener(type,fn){listeners.set('dialog:'+type,fn);},
  showModal(){this.open=true;},
  close(){this.open=false;},
  remove(){state.removed=true;}
 };
 const original=globalThis.document;
 globalThis.document={
  activeElement:focusReturn,
  querySelector(){return null;},
  createElement(name){assert.equal(name,'dialog');return modal;},
  body:{append(node){assert.equal(node,modal);state.appended=true;}}
 };
 return {
  controls,modal,state,focusReturn,
  fire(key,event={}){const fn=listeners.get(key);assert.equal(typeof fn,'function',key);return fn(event);},
  cleanup(){globalThis.document=original;}
 };
}

test('custom LiftCrew confirmation accepts explicitly and never calls a browser confirm',async()=>{
 const fixture=mockDialogEnvironment();
 try{
  const decision=confirmOperatorAction({title:'Remove machine?',message:'Remove Machine 2 from this application? Uploaded records are retained for audit.',confirmLabel:'Remove machine'});
  assert.equal(fixture.state.appended,true);
  assert.equal(fixture.modal.open,true);
  assert.equal(fixture.state.attributes['aria-labelledby'],'lc-confirm-title');
  assert.equal(fixture.controls.get('#lc-confirm-title').textContent,'Remove machine?');
  assert.match(fixture.controls.get('#lc-confirm-description').textContent,/Machine 2/);
  assert.equal(fixture.controls.get('.lc-confirm-accept').textContent,'Remove machine');
  fixture.fire('.lc-confirm-accept:click');
  assert.equal(await decision,true);
  assert.equal(fixture.modal.open,false);
  assert.equal(fixture.state.removed,true);
  assert.equal(fixture.focusReturn.focused,true);
 }finally{fixture.cleanup();}
});

test('Cancel or Escape rejects custom confirmation without changing data',async()=>{
 for(const action of ['.lc-confirm-cancel:click','dialog:cancel','dialog:click']){
  const fixture=mockDialogEnvironment();
  try{
   const decision=confirmOperatorAction({title:'Remove document?',message:'Existing records remain for audit.'});
   if(action==='dialog:cancel'){
    let prevented=false;
    fixture.fire('dialog:cancel',{preventDefault(){prevented=true;}});
    assert.equal(prevented,true);
   }else if(action==='dialog:click'){
    fixture.fire('dialog:click',{target:fixture.modal});
   }else fixture.fire(action);
   assert.equal(await decision,false);
   assert.equal(fixture.state.removed,true);
  }finally{fixture.cleanup();}
 }
});

test('operator portal uses custom dialogs for every confirmation, not window.confirm',()=>{
 const source=readFileSync(new URL('../src/operators.js',import.meta.url),'utf8');
 assert(!/\bconfirm\s*\(/.test(source));
 assert.equal((source.match(/confirmOperatorAction\s*\(/g)||[]).length,4);
 assert.match(source,/removeEquipmentAssignments/);
 assert.match(source,/removeDocument\(app,doc\)/);
});

test('unwanted rate card and stale insurance notice are absent while checks remain separate',()=>{
 const profile={business:{radiusMiles:50},equipment:[{id:'one',category:'Warehouse forklift',baseZip:'78701'},{id:'two',category:'Other',categoryOther:'Special equipment',baseZip:'78702'}],operators:[]};
 const machines=equipmentView(profile);
 assert(machines.includes('Service radius for this machine'));
 assert(!machines.includes('rate-preview'));
 assert(!machines.includes('Rate preview'));
 const insurance=insuranceView({docs:[],aiConsent:false,clearance:{review:{state:'stale'},reviewCurrent:false}});
 assert(!insurance.includes('data-manual-review'));
 assert(!insurance.includes('The application or insurance packet changed'));
 assert(insurance.includes('I authorize LiftCrew to review my insurance documents'));
 assert(insurance.includes('operator-privacy.html'));
 assert.equal(applicantReviewStatusHTML({state:'stale'},false),'');
 assert.equal(applicantReviewStatusHTML(null,false),'');
 assert.match(applicantReviewStatusHTML({state:'reading',created_at:new Date().toISOString()},true),/Reviewing your insurance/);
});

test('supporting document titles show sequential machine numbers',()=>{
 const profile={equipment:[{id:'one',make:'Toyota',model:'5FG',ownership:'Owned'},{id:'two',make:'JLG',ownership:'Owned'}],operators:[]};
 const slots=documentSlots(profile);
 assert(slots.some(([kind,id,title])=>kind==='equipment_photo'&&id==='one'&&title==='Machine 1 — Equipment photos'));
 assert(slots.some(([kind,id,title])=>kind==='inspection'&&id==='two'&&title==='Machine 2 — Inspection / maintenance records'));
});

test('step validation is scoped without relaxing full-profile validation',async()=>{
 const {extraProfileErrors}=await import('../src/provider-ui.js');
 const p={business:{legalName:'Test',entityType:'LLC',formationState:'TX',address:'Test',city:'Austin',state:'TX',zip:'78701',contactName:'Test',email:'test@example.com',phone:'5550100',radiusMiles:25,emergencyName:'Test',emergencyPhone:'5550101',availability:'Weekdays'},equipment:[],operators:[]};
 assert.deepEqual(extraProfileErrors(p,'business'),[]);
 assert(extraProfileErrors(p,'equipment').includes('Add your equipment'));
 assert(extraProfileErrors(p,'operators').includes('Add an operator'));
 assert(extraProfileErrors(p).includes('Add your equipment'));
 p.business.legalName='';assert(extraProfileErrors(p,'business').length>0);
});
