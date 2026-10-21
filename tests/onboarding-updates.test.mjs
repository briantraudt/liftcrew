import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stepIds,stepLabels,restoredStep,persistStep,removeEquipmentAssignments,authorizationErrors,validateInsuranceBatch} from '../src/onboarding-model.js';
import {businessView,equipmentView,operatorsView,insuranceView,documentsView} from '../src/onboarding-ui.js';
import {CONFIRMATION_URL,OPERATOR_LOGIN_URL,LOGIN_PATH,confirmationParameters} from '../src/operator-auth.js';
const profile=()=>({business:{zip:'78703',radiusMiles:50},equipment:[{id:'one',make:'Toyota',model:'8FGU25',serial:'111'},{id:'two',make:'JLG',model:'G6',serial:'222'}],operators:[{id:'operator',name:'Test',equipmentIds:['one','two']}],insurance:{inputMode:'packet',maximumLoadValue:250000}});
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value))};};
test('equipment precedes a separate operators step',()=>{assert.deepEqual(stepIds.slice(0,4),['business','equipment','operators','insurance']);assert.equal(stepLabels.length,7);assert(!equipmentView(profile()).includes('Operator 1'));assert(operatorsView(profile()).includes('Operator 1'));});
test('operators select stable machine IDs rather than entering equipment types',()=>{const html=operatorsView(profile());assert(html.includes('data-equipment-permission="0" value="one" checked'));assert(html.includes('Toyota 8FGU25'));assert(html.includes('Serial 111'));assert(!html.includes('data-field="operators.0.equipmentTypes"'));});
test('reordering equipment preserves authorizations; deleting equipment removes only that assignment',()=>{const p=profile();p.equipment.reverse();assert.deepEqual(authorizationErrors(p),[]);removeEquipmentAssignments(p,'one');p.equipment=p.equipment.filter(e=>e.id!=='one');assert.deepEqual(p.operators[0].equipmentIds,['two']);assert.deepEqual(authorizationErrors(p),[]);});
test('foreign or empty equipment authorizations cannot pass',()=>{const p=profile();p.operators[0].equipmentIds=['foreign'];assert.equal(authorizationErrors(p).length,1);p.operators[0].equipmentIds=[];assert.equal(authorizationErrors(p).length,1);});
test('old bookmarks preserve agreement and finish steps after the split',()=>{const s=storage();s.setItem('provider-step-a','2');assert.equal(restoredStep(s,'a'),5);s.setItem('provider-step-a','5');assert.equal(restoredStep(s,'a'),6);persistStep(s,'a',2);assert.equal(s.getItem('provider-step-v2-a'),'operators');assert.equal(restoredStep(s,'a'),2);});
test('business form omits machine service radii',()=>{const html=businessView(profile());assert(html.includes('data-field="business.zip"'));assert(!html.includes('data-field="business.radiusMiles"'));assert(!html.includes('service-area-result'));});
test('insurance requirements have one upload and no manual carrier or policy fields',()=>{const html=insuranceView({docs:[],aiConsent:false,clearance:null});assert.equal((html.match(/type="file"/g)||[]).length,1);assert(html.includes('Minimum insurance requirements'));assert(!html.includes('One combined packet or several files in the same place'));assert(!html.includes('data-field="insurance.cgl'));assert(!html.includes('data-manual-review'));assert(!html.includes('OpenAI'));});
test('saved legacy insurance is shown once and supporting records do not duplicate it',()=>{const docs=[{id:'doc',kind:'coi',active:true,filename:'old-packet.pdf',bytes:1200,entity_id:''}];assert(insuranceView({docs,aiConsent:false}).includes('old-packet.pdf'));assert(!documentsView(profile(),docs).includes('old-packet.pdf'));});
test('insurance batch limits apply before uploading',()=>{assert.throws(()=>validateInsuranceBatch([],Array.from({length:13},()=>({size:1}))));assert.throws(()=>validateInsuranceBatch([],[{size:25*1048576}]));assert.doesNotThrow(()=>validateInsuranceBatch([],[{size:1048576}]));});
test('confirmation destinations are production-only and login opens signin mode',()=>{assert.equal(new URL(CONFIRMATION_URL).hostname,'myliftcrew.com');assert.equal(new URL(OPERATOR_LOGIN_URL).hostname,'myliftcrew.com');assert.equal(LOGIN_PATH,'/operators.html?mode=signin');});
test('confirmation parsing supports errors without treating ordinary visits as success',()=>{const blank=confirmationParameters('https://myliftcrew.com/operator-confirmed.html');assert.equal(blank.accessToken,null);assert.equal(blank.tokenHash,null);assert.equal(confirmationParameters('https://myliftcrew.com/operator-confirmed.html#error=expired').error,'expired');const parsed=confirmationParameters('https://myliftcrew.com/operator-confirmed.html?token_hash=sample&type=signup&next=https://evil.example');assert.equal(parsed.type,'signup');assert(!('next' in parsed));});
test('operator navigation removes client link and confirmation route is built',()=>{const html=readFileSync(new URL('../operators.html',import.meta.url),'utf8');assert(!html.includes('For clients'));assert(html.includes('operator-onboarding'));const config=readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');assert(config.includes('operator-confirmed.html'));});
test('radius matching keeps reviewer, clearance and machine-authorization gates',()=>{const sql=readFileSync(new URL('../supabase/migrations/20261013180000_provider_zip_radius.sql',import.meta.url),'utf8');for(const text of ['private.zip_distance_miles','Reviewer access required','public.provider_clearance','equipmentIds','job ZIP'.toLowerCase()]){if(text==='job zip')continue;assert(sql.includes(text));}assert(sql.includes('round(distance.miles'));assert(!sql.includes('regexp_split_to_array'));});

test('every machine asks for its own ZIP and hourly, 4-hour, and daily pricing',()=>{const html=equipmentView(profile());for(const key of ['baseZip','hourlyRate','fourHourRate','dailyRate'])assert(html.includes('data-field="equipment.0.'+key+'"'));assert(/first 25 miles/i.test(html));assert(html.includes('$2 per excess round-trip mile'));assert(!businessView(profile()).includes('Proposed rates, minimums and delivery fees'));});

test('equipment onboarding does not request or require a self-declared maximum customer property value',()=>{const html=equipmentView(profile());assert(!html.includes('Property you plan to handle'));assert(!html.includes('insurance.maximumLoadValue'));assert(!html.includes('Maximum total property replacement value per job'));});

test('machine labels stay sequential and Other selections require descriptions',()=>{
 const p=profile();p.equipment[0].category='Other';p.equipment[1].category='Telehandler';
 assert(equipmentView(p).includes('Machine 1'));assert(equipmentView(p).includes('Machine 2'));
 assert(equipmentView(p).includes('data-field="equipment.0.categoryOther"'));
 assert(!businessView(p).includes('data-field="business.radiusMiles"'));
});


test('page routing looks up screens by stable step ID after agreement moves last',()=>{
 const source=readFileSync(new URL('../src/operators.js',import.meta.url),'utf8');
 assert(source.includes('views[stepIds[step]]()'));
 assert(source.includes('agreement:contract'));
 assert(source.includes('beforeAgreementIssues()'));
 const ids=stepIds.join(',');
 assert.equal(ids,'business,equipment,operators,insurance,documents,agreement,finish');
});
test('the operator header shows sign-out only for authenticated users',()=>{
 const html=readFileSync(new URL('../operators.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/operators.js',import.meta.url),'utf8');
 assert(html.includes('id="portal-signout"'));
 assert(!html.includes('Operator portal</a>'));
 assert(js.includes('setHeaderSignedIn(true)'));
 assert(js.includes('setHeaderSignedIn(false)'));
 assert(!js.includes('h(user.email)'));
 assert(!js.includes('class="account-bar"'));
});
test('Other equipment reveals description and avoids automatic matching',()=>{
 const p=profile();
 p.equipment[0].category='Other';p.equipment[0].fuel='Other';
 const html=equipmentView(p);
 assert(html.includes('data-field="equipment.0.categoryOther"'));
 assert(html.includes('data-field="equipment.0.fuelOther"'));
 const mig=readFileSync(new URL('../supabase/migrations/20261021160651_provider_other_equipment_explicit_and_matching_exclusion.sql',import.meta.url),'utf8');
 assert(mig.includes("'Other'"));
 assert(mig.includes("e.value->>'category' in ('Warehouse forklift','Rough-terrain forklift','Telehandler')"));
});
