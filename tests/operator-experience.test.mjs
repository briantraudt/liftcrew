import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingStages,stageForStep,machineRadius,businessRadiusForMachines,defaultMachineRadius,normalizeMachineRadiusFallbacks,priceWarnings,renewalAlerts,ratePreviewMarkup} from '../src/onboarding-experience.js';

test('four displayed stages preserve every original step exactly once',()=>{
 const ids=onboardingStages.flatMap(stage=>stage.steps);
 assert.deepEqual(ids,['business','equipment','operators','insurance','documents','agreement','finish']);
 assert.equal(stageForStep('insurance'),2);
 assert.equal(stageForStep('finish'),3);
 assert.equal(stageForStep('agreement'),3);
 assert.equal(stageForStep('insurance'),2);
});
test('each machine radius is independent and legacy radius is a fallback',()=>{
 assert.equal(machineRadius(100,''),100);
 assert.equal(machineRadius(100,40),40);
 assert.equal(machineRadius(100,300),300);
 assert.equal(machineRadius(100,'invalid'),100);
 assert.equal(machineRadius(100,'1e2'),100);
 assert.equal(machineRadius(0,20),20);
});
test('the legacy ceiling follows the largest machine radius without expanding individual machines',()=>{
 const p={business:{radiusMiles:50},equipment:[{radiusMilesOverride:25},{radiusMilesOverride:75}]};
 assert.equal(businessRadiusForMachines(p),75);
 assert.equal(machineRadius(75,25),25);
 assert.equal(businessRadiusForMachines({business:{radiusMiles:50},equipment:[{}]}),50);
});
test('pricing warnings are advisory, not rate rejection',()=>{
 assert.equal(priceWarnings({hourlyRate:100,fourHourRate:500,dailyRate:200}).length,2);
 assert.equal(priceWarnings({hourlyRate:100,fourHourRate:350,dailyRate:650}).length,0);
 assert.match(ratePreviewMarkup({hourlyRate:'25',fourHourRate:'95',dailyRate:'180'},100),/\$95\.00/);
 assert.doesNotMatch(ratePreviewMarkup({hourlyRate:'invalid'},100),/NaN/);
});
test('renewal notices show upcoming and overdue evidence without claiming approval',()=>{
 const now=new Date('2026-10-21T12:00:00Z');
 const profile={operators:[{name:'Alex',evaluationDate:'2023-11-01'}]};
 const docs=[{active:true,filename:'inspection.pdf',expires_on:'2026-10-19'}, {active:false,filename:'old.pdf',expires_on:'2020-01-01'}];
 const alerts=renewalAlerts(profile,docs,{validUntil:'2026-11-02'},now);
 assert.deepEqual(alerts.map(x=>x.label),['inspection.pdf','Practical evaluation — Alex','Verified insurance coverage / provider clearance']);
 assert.equal(alerts[0].severity,'urgent');
 assert.equal(alerts[1].severity,'soon');
 assert.equal(alerts[1].step,'operators');
});

test('clear machine radius, save, return renders the persisted fallback and does not block agreement preflight',async()=>{
 const [{equipmentView},{extraProfileErrors,providerSlots},{renewalIssues}]=await Promise.all([
  import('../src/onboarding-ui.js'),import('../src/provider-ui.js'),import('../src/operator-data.js')
 ]);
 const profile={
  business:{legalName:'Synthetic Forklift LLC',entityType:'LLC',formationState:'TX',address:'Synthetic address',city:'Austin',state:'TX',zip:'78701',contactName:'Synthetic Person',email:'synthetic@example.com',phone:'555-0100',radiusMiles:'70',emergencyName:'Dispatch',emergencyPhone:'555-0101',availability:'Weekdays'},
  equipment:[{id:'machine-1',category:'Warehouse forklift',make:'Synthetic',model:'Forklift',serial:'SYN-1',ownership:'Owned',capacity:'5000',loadCenter:'24',liftHeight:'15',fuel:'Propane',tires:'Smooth',attachments:'None',transport:'Third-party hauler',inspectionDate:'2026-10-01',baseZip:'78701',availability:'Weekdays',replacementValue:'75000',widthIn:'44',heightIn:'90',weightLb:'9000',hourlyRate:'125',fourHourRate:'425',dailyRate:'750',radiusMilesOverride:''}],
  operators:[{id:'operator-1',name:'Synthetic Operator',relationship:'Employee',trainingDate:'2026-05-01',trainer:'Trainer',evaluationDate:'2026-05-01',evaluator:'Evaluator',adult:'yes',equipmentIds:['machine-1']}],
  insurance:{inputMode:'packet'}
 };
 const displayed=equipmentView(profile);
 assert.match(displayed,/data-field="equipment\.0\.radiusMilesOverride"[^>]*value="70"/);
 assert.deepEqual(extraProfileErrors(profile).filter(s=>/radius/i.test(s)),['Enter a service radius for each machine between 1 and 3,000 miles']);
 assert.equal(normalizeMachineRadiusFallbacks(profile),true);
 assert.equal(profile.equipment[0].radiusMilesOverride,'70');
 assert.equal(businessRadiusForMachines(profile),70);
 // Synthetic DB save/return round trip; no live database or user records.
 const saved=JSON.parse(JSON.stringify(profile));
 const returned=JSON.parse(JSON.stringify(saved));
 assert.equal(returned.equipment[0].radiusMilesOverride,'70');
 assert.match(equipmentView(returned),/data-field="equipment\.0\.radiusMilesOverride"[^>]*value="70"/);
 assert.equal(normalizeMachineRadiusFallbacks(returned),false);
 assert.deepEqual(extraProfileErrors(returned),[]);
 const documents=providerSlots(returned).map(([kind,id,title],index)=>({active:true,kind,entity_id:id,filename:'synthetic-'+index+'.pdf'}));
 const missing=providerSlots(returned).filter(([kind,id])=>!documents.some(d=>d.active&&d.kind===kind&&d.entity_id===id));
 assert.equal(missing.length,0);
 assert.deepEqual(renewalIssues(returned,documents),[]);
});
test('radius normalization respects explicit invalid values and missing legacy defaults',()=>{
 const missing={business:{radiusMiles:'85'},equipment:[{radiusMilesOverride:undefined},{radiusMilesOverride:null},{radiusMilesOverride:'   '} ]};
 assert.equal(defaultMachineRadius(missing),'85');
 assert.equal(normalizeMachineRadiusFallbacks(missing),true);
 assert.deepEqual(missing.equipment.map(e=>e.radiusMilesOverride),['85','85','85']);
 const invalid={business:{radiusMiles:'85'},equipment:[{radiusMilesOverride:'0'},{radiusMilesOverride:'20000'}]};
 assert.equal(normalizeMachineRadiusFallbacks(invalid),false);
 assert.deepEqual(invalid.equipment.map(e=>e.radiusMilesOverride),['0','20000']);
 assert.equal(defaultMachineRadius({business:{radiusMiles:''}}),'25');
});
test('draft load saves normalized radius before contract preparation',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('../src/operators.js',import.meta.url),'utf8');
 assert(code.includes('const normalized=normalizeMachineRadiusFallbacks(p)'));
 const load=code.slice(code.indexOf('async function load(){'),code.indexOf('async function save(){'));
 const start=load.indexOf('step=restoreDraftStep(app.id);dirty=false;');
 const save=load.indexOf('await save();',start);
 const refreshedClearance=load.indexOf("clearance=check(await db.rpc('provider_clearance',{p_application_id:app.id}));",save);
 const preflight=load.indexOf('await prepareWhenComplete();',start);
 assert(start>=0&&save>start&&refreshedClearance>save&&preflight>refreshedClearance);
 assert(!load.slice(0,save).includes('clearance=check(await db.rpc('));
});
