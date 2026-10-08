import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCraneRequest,CRANE_SERVICE} from '../src/crane-fields.js';
import handler from '../api/crane-quote.js';
export const validRequest={service:CRANE_SERVICE,location:'78701',date:'2099-10-12',durationDays:'2',craneClass:'',loadDescription:'HVAC unit',loadWeight:'6000',weightBasis:'Manufacturer / shipping documents',loadLengthFt:'8',loadWidthFt:'6',loadHeightFt:'6',liftCount:'2',riggingWeight:'150',liftingPoints:'Rated lifting points available',pickupHeight:'4',liftHeight:'40',pickupRadius:'20',setRadius:'50',maxPathRadius:'50',obstructionHeight:'35',riggingHeadroom:'10',travelWithLoad:'No',liftPath:'Flatbed to rooftop',siteAddress:'Synthetic test site, Austin TX',environment:'Outdoors',surface:'Concrete',setupWidth:'40',setupLength:'60',accessWidth:'14',accessHeight:'18',groundAssessment:'Yes — report available',undergroundHazards:'None identified',powerLines:'No',riggingSupply:'Provide with crane',crewSupport:'Provide with crane',permits:'Not needed',liftPlan:'Please prepare',name:'Integration Test',company:'Synthetic test',email:'test@example.com',phone:'2025550148',startTime:'08:00',hoursPerDay:'8'};
const now=new Date('2026-10-08T15:00:00Z');
test('crane request preserves the measurements needed for an actual lift review',()=>{
 const {data,error}=validateCraneRequest(validRequest,now);assert(!error);assert.equal(data.loadWeight,6000);assert.equal(data.setRadius,50);assert.equal(data.endDate,'2099-10-13');assert.equal(data.service,CRANE_SERVICE);
});
test('unknown measurements are explicit nulls, never guessed zero values',()=>{
 const {data,error}=validateCraneRequest({...validRequest,loadWeight:'',loadWeightUnknown:'yes',pickupRadius:'',pickupRadiusUnknown:'yes'},now);assert(!error);assert.equal(data.loadWeight,null);assert.equal(data.loadWeightUnknown,true);assert.equal(data.pickupRadius,null);
});
test('server rejects invalid, incomplete, forged and inconsistent inputs',()=>{
 for(const patch of [{service:'Forklift only'},{date:'2026-02-30'},{date:'2000-01-01'},{durationDays:'1.5'},{loadWeight:'NaN'},{loadWeight:'-1'},{loadWeight:'Infinity'},{pickupRadius:''},{maxPathRadius:'10'},{powerLines:'whatever'},{siteAddress:''},{email:'not an email'},{phone:'1'},{documentUrl:'javascript:alert(1)'},{craneClass:'170-9050 OR 1=1'},{loadDescription:[]},{startTime:'99:99'}]) assert(validateCraneRequest({...validRequest,...patch},now).error,JSON.stringify(patch));
 assert(validateCraneRequest(null).error);
});
test('page-one seed includes exactly the 25 crane classes and distinct specification meanings',()=>{
 const rows=JSON.parse(readFileSync(new URL('../data/cranes-page-1.json',import.meta.url)));assert.equal(rows.length,25);assert.equal(new Set(rows.map(r=>r.source_class_code)).size,25);assert(!rows.some(r=>r.source_class_code==='170-9050'||r.source_class_code.startsWith('330-')));assert.equal(rows.find(r=>r.source_class_code==='170-6075').max_tip_height_ft,230.75);assert.equal(rows.find(r=>r.source_class_code==='170-6075').vertical_reach_ft,null);assert.equal(rows.find(r=>r.source_class_code==='170-4250').boom_length_max_ft,136);
});
const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('API stores the normalized inquiry before reporting success, even without email configuration',async()=>{
 const original=global.fetch;const calls=[];
 global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>[]};};
 try{const res=response();await handler({method:'POST',body:{...validRequest,forgedAdmin:'true'}},res);assert.equal(res.code,200);assert(res.body.reference);const save=calls.find(c=>c.url.endsWith('/crane_quote_requests'));assert(save);const body=JSON.parse(save.options.body);assert.equal(body.details.loadWeight,6000);assert.equal(body.details.forgedAdmin,undefined);assert.equal(save.options.headers.Prefer,'return=minimal');}finally{global.fetch=original;}
});
test('API never reports success when saving fails and rejects absent catalog classes',async()=>{
 const original=global.fetch;
 try{global.fetch=async()=>({ok:false});let res=response();await handler({method:'POST',body:validRequest},res);assert.equal(res.code,503);assert(!res.body.ok);
 global.fetch=async()=>({ok:true,json:async()=>[]});res=response();await handler({method:'POST',body:{...validRequest,craneClass:'170-9050'}},res);assert.equal(res.code,400);
 res=response();await handler({method:'GET'},res);assert.equal(res.code,405);
 }finally{global.fetch=original;}
});
