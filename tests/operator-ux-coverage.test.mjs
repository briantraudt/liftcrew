import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weekDays,readWeeklyAvailability,setWeeklyAvailability,weeklyAvailabilityErrors,weeklyAvailabilityMarkup} from '../src/operator-availability.js';
import {insurancePrecheck} from '../src/insurance-precheck.js';
import {insuranceView,businessView} from '../src/onboarding-ui.js';
import {extraProfileErrors} from '../src/provider-ui.js';
import {validateBooking} from '../src/booking-fields.js';
import {validatePriceRequest} from '../api/equipment-pricing.js';

test('standard availability supports all seven days and independent operating hours',()=>{
 const b={},html=weeklyAvailabilityMarkup(b);
 assert.equal(weekDays.length,7);
 assert.equal((html.match(/data-availability-day=/g)||[]).length,7);
 assert.equal((html.match(/data-availability-time=/g)||[]).length,14);
 assert.equal(setWeeklyAvailability(b,'mon',{enabled:true}),true);
 setWeeklyAvailability(b,'mon',{start:'07:30'});setWeeklyAvailability(b,'mon',{end:'16:30'});setWeeklyAvailability(b,'sat',{enabled:true});
 assert.deepEqual(b.weeklyAvailability,[{day:'mon',start:'07:30',end:'16:30'},{day:'sat',start:'08:00',end:'17:00'}]);
 assert.match(b.availability,/MON 07:30–16:30/);
 assert.deepEqual(weeklyAvailabilityErrors(b),[]);
 setWeeklyAvailability(b,'sat',{enabled:false});
 assert.equal(b.weeklyAvailability.length,1);
});
test('structured availability validates days and valid ranges while retaining older records',()=>{
 const b={};setWeeklyAvailability(b,'mon',{enabled:true});setWeeklyAvailability(b,'mon',{end:'06:00'});
 assert(weeklyAvailabilityErrors(b).some(s=>/Monday/.test(s)));
 setWeeklyAvailability(b,'mon',{enabled:false});
 assert(weeklyAvailabilityErrors(b).some(s=>/at least one/.test(s)));
 const legacy={availability:'Weekdays'};
 assert.equal(readWeeklyAvailability(legacy).length,0);
 assert.deepEqual(weeklyAvailabilityErrors(legacy),[]);
 assert(businessView({business:legacy}).includes('Standard availability'));
 assert(!businessView({business:legacy}).includes('Usual availability / scheduling restrictions'));
 assert(extraProfileErrors({business:b,equipment:[],operators:[]}).some(s=>/availability/.test(s)));
});
test('insurance precheck allows only a current document-check pass and never grants dispatch approval',()=>{
 const docs=[{active:true,kind:'insurance_packet'}];
 const pass={reviewCurrent:true,review:{state:'complete',result:{outcome:'document_pass'}}};
 assert.equal(insurancePrecheck(docs,pass).ready,true);
 for(const c of [{...pass,reviewCurrent:false},{reviewCurrent:true,review:{state:'reading'}},{reviewCurrent:true,review:{state:'manual_review',result:{outcome:'manual_review'}}},{reviewCurrent:true,review:{state:'complete',result:{outcome:'needs_changes'}}}]){
  assert.equal(insurancePrecheck(docs,c).ready,c.review?.state==='manual_review');
 }
 assert.equal(insurancePrecheck([],pass).ready,false);
 assert.match(insurancePrecheck(docs,pass).message,/Final coverage verification/);
 const manual=insurancePrecheck(docs,{reviewCurrent:true,review:{state:'manual_review',result:{outcome:'manual_review'}}});
 assert.equal(manual.kind,'manual_pending');assert.equal(manual.ready,true);assert.match(manual.message,/does not approve/);
});
test('insurance page uploads documents before consent and displays a single review action',()=>{
 const html=insuranceView({docs:[],aiConsent:false,clearance:null});
 assert(html.includes('<h2>Insurance Requirements</h2>'));
 assert(!html.includes('Minimum insurance requirements'));
 assert(!html.includes('Required policy terms and endorsements'));
 assert(!html.includes('data-manual-review'));
 assert(html.indexOf('class="insurance-packet"')<html.indexOf('data-ai-consent'));
 assert(html.indexOf('data-ai-consent')<html.indexOf('data-review-insurance'));
});
test('operator portal uses native select, branded confirmation and 24-hour receipt',()=>{
 const src=readFileSync(new URL('../src/operators.js',import.meta.url),'utf8');
 const dlg=readFileSync(new URL('../src/operator-confirmation.js',import.meta.url),'utf8');
 assert(!src.includes("import './select.js'"));
 assert(!src.includes('if(!confirm('));
 assert(src.includes('confirmOperatorAction'));
 assert(src.includes('setWeeklyAvailability'));
 assert(src.includes('insurancePrecheck(docs,clearance)'));
 assert(src.includes('within 24 hours'));
 assert(src.includes('Thank you for joining the LiftCrew family!'));
 assert(!src.includes('Read the complete published agreement in a new tab'));
 assert(dlg.includes('dialog.showModal()'));
});
test('half-day booking accepted at 4 hours but unsupported fractional days rejected',()=>{
 const base={service:'Forklift with operator',location:'78701',date:'2026-10-22',durationDays:'0.5'};
 assert.equal(validateBooking(base,new Date(2026,9,21)),null);
 assert.equal(validatePriceRequest({...base,loadWeight:'5000',liftHeight:'12'}),null);
 for(const days of ['0.25','1.5','-1','0','31']){
  assert(validateBooking({...base,durationDays:days},new Date(2026,9,21)));
  assert(validatePriceRequest({...base,loadWeight:'5000',liftHeight:'12',durationDays:days}));
 }
 const details=readFileSync(new URL('../src/booking-details.js',import.meta.url),'utf8');
 const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(home.includes('<option value="0.5">1/2 day (4 hours)</option>'));
 assert(details.includes('<option value="0.5">1/2 day (4 hours)</option>'));
 const sql=readFileSync(new URL('../supabase/migrations/20261021180000_customer_half_day.sql',import.meta.url),'utf8');
 assert(sql.includes("p_details->>'durationDays'"));
 assert(sql.includes('billingPeriod'));
});


test('legacy availability is not overwritten with invented 8–5 hours',()=>{
 const b={availability:'Weekdays 7:00–15:00; call first'};
 const html=weeklyAvailabilityMarkup(b);
 assert(html.includes('Weekdays 7:00–15:00; call first'));
 assert.equal((html.match(/data-availability-day="mon" checked/g)||[]).length,0);
 assert.equal(readWeeklyAvailability(b).length,0);
 assert.equal(b.availability,'Weekdays 7:00–15:00; call first');
 setWeeklyAvailability(b,'mon',{enabled:true});
 assert.equal(b.availabilityNotes,'Weekdays 7:00–15:00; call first');
 setWeeklyAvailability(b,'mon',{start:'07:00'});
 setWeeklyAvailability(b,'mon',{end:'15:00'});
 assert.match(b.availability,/MON 07:00–15:00/);
 assert(weeklyAvailabilityMarkup(b).includes('Weekdays 7:00–15:00; call first'));
});
test('staff request inbox displays four-hour selected total instead of day price',()=>{
 const code=readFileSync(new URL('../src/customer-inbox.js',import.meta.url),'utf8');
 assert(code.includes("q.billingPeriod==='halfDay'"));
 assert(code.includes('q.selectedTotal??q.totals?.fourHour'));
 assert(code.includes('Half-day (4 hours)'));
});

// The Save & Complete button is a draft-only state transition. The submit and
// legal signature RPCs remain separate explicit actions.
test('draft footer has one Save & Complete action without duplicate Save/Continue buttons',()=>{
 const code=readFileSync(new URL('../src/operators.js',import.meta.url),'utf8');
 assert(code.includes('data-save-complete>Save &amp; Complete'));
 assert(!code.includes('data-save>Save'));
 assert(!code.includes('data-next>'));
 assert(!code.includes('class="save-state"'));
 const start=code.indexOf("root.querySelector('[data-save-complete]')");
 const end=code.indexOf("root.querySelectorAll('[data-add]')",start);
 const callback=code.slice(start,end);
 assert(start>0&&callback.includes('await move(step+1)'));
 assert(callback.includes("await save()"));
 assert(!callback.includes('submit_operator_application'));
 assert(!callback.includes('sign_provider_contract'));
 assert(code.includes('restoreDraftStep(app.id)'));
 assert(code.includes('persistDraftStep(app.id,step)'));
});
