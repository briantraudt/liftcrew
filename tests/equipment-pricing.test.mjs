import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPricingHandler,validatePriceRequest} from '../api/equipment-pricing.js';

const data={service:'Forklift with operator',location:'78703',loadWeight:'5000',liftHeight:'12',durationDays:'1'};
const env={CUSTOMER_INTAKE_KEY:'this-is-a-synthetic-secret-for-isolated-tests-123456789'};
const json=(value,code=200)=>new Response(JSON.stringify(value),{status:code,headers:{'Content-Type':'application/json'}});
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.body=data;return this;}};}

test('price preview requires a valid ZIP, capacity, height and duration',()=>{
 assert.equal(validatePriceRequest(data),null);
 for(const changes of [{location:'7870'},{loadWeight:'-10'},{liftHeight:'0'},{durationDays:'0'},{durationDays:'31'},{service:'other'}])assert(validatePriceRequest({...data,...changes}));
 assert.equal(validatePriceRequest({...data,service:'Crane with operator',loadWeight:'',liftHeight:''}),null);
});

test('preview uses the server intake key without exposing provider contact details',async()=>{
 let called=0;
 const handler=createPricingHandler({env,fetcher:async(url,options)=>{
  called++;assert(url.endsWith('/rpc/quote_nearest_provider_equipment'));
  const q=JSON.parse(options.body);
  assert.deepEqual({zip:q.p_zip,capacity:q.p_capacity,height:q.p_height,days:q.p_duration_days}, {zip:'78703',capacity:5000,height:12,days:1});
  assert.equal(q.p_key,env.CUSTOMER_INTAKE_KEY);
  return json({status:'matched',rates:{hourly:100,fourHour:300,daily:600},deliveryFee:60,totals:{hourly:160,fourHour:360,daily:660}});
 }});
 const res=response();await handler({method:'POST',headers:{origin:'https://www.myliftcrew.com'},body:data},res);
 assert.equal(res.code,200);assert.equal(called,1);assert.equal(res.body.quote.deliveryFee,60);
 assert(!JSON.stringify(res.body).includes(env.CUSTOMER_INTAKE_KEY));
});

test('preview enforces origin, method and input restrictions',async()=>{
 const handler=createPricingHandler({env,fetcher:()=>{throw Error('not called');}});
 for(const [request,status] of [
  [{method:'GET',headers:{}},405],
  [{method:'POST',headers:{origin:'https://example.invalid'},body:data},403],
  [{method:'POST',headers:{},body:{...data,loadWeight:''}},400],
  [{method:'POST',headers:{},body:{...data,durationDays:'9999'}},400]
 ]){
  const res=response();await handler(request,res);assert.equal(res.code,status);
 }
});

test('preview gracefully degrades if location reference or match service is unavailable',async()=>{
 const handler=createPricingHandler({env,fetcher:async()=>json({code:'XX000'},500)});
 const res=response();await handler({method:'POST',headers:{},body:data},res);
 assert.equal(res.code,503);assert(res.body.error.includes('still request a quote'));
});

test('database rules match by APPROVED machines and use the free 25-mile radius',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261020160000_equipment_pricing.sql',import.meta.url),'utf8');
 for(const requirement of [
  "a.status='approved'",
  "public.provider_clearance(a.id)",
  "home.zip=e.value->>'baseZip'",
  "o->'equipmentIds'",
  "p_capacity",
  "p_height",
  "greatest(0,nearest.miles::numeric-25)",
  "delivery_fee:=round(excess_miles*2*2,2)",
  "create_priced_customer_request",
  "pricing_snapshot",
  "exception when others"
 ])assert(sql.includes(requirement),requirement);
 const charge=d=>Math.round(Math.max(0,d-25)*2*2*100)/100;
 assert.equal(charge(15),0);assert.equal(charge(25),0);assert.equal(charge(40),60);assert.equal(charge(50.5),102);
});

test('customer form renders price previews, keeps quote submission and does not trust browser pricing',()=>{
 const source=readFileSync(new URL('../src/booking-details.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/customer-pricing-ui.js',import.meta.url),'utf8');
 const intake=readFileSync(new URL('../lib/customer-delivery.js',import.meta.url),'utf8');
 assert(source.includes('attachPricingPreview'));
 assert(source.includes('data-price-preview'));
 assert(source.includes('Request Quote'));
 assert(ui.includes("fetch('/api/equipment-pricing'"));
 assert(ui.includes('Final')||ui.includes('final road mileage'));
 assert(intake.includes("intakeRPC('create_priced_customer_request'"));
 assert(!intake.includes('req.body.deliveryFee'));
});


test('a half-day selects the verified four-hour rate while keeping the trusted server RPC integer',async()=>{
 const q={...data,durationDays:'0.5'};
 assert.equal(validatePriceRequest(q),null);
 const handler=createPricingHandler({env,fetcher:async(url,opts)=>{
  assert(url.endsWith('/rpc/quote_nearest_provider_equipment'));
  const body=JSON.parse(opts.body);
  assert.equal(body.p_duration_days,1);
  return json({status:'matched',distanceMiles:12,deliveryFee:40,rates:{hourly:100,fourHour:320,daily:680},totals:{hourly:140,fourHour:360,daily:720},durationDays:1});
 }});
 const responseObj=response();await handler({method:'POST',headers:{},body:q},responseObj);
 assert.equal(responseObj.code,200);
 assert.equal(responseObj.body.quote.durationDays,0.5);
 assert.equal(responseObj.body.quote.billingPeriod,'halfDay');
 assert.equal(responseObj.body.quote.selectedTotal,360);
 assert.equal(responseObj.body.quote.totals.daily,720);
});
