// Run against `npm run preview -- --port 4173` after npm run build.
// Optional test dependencies: playwright-core and @sparticuz/chromium.
// Requires system nss, nspr and a fallback font (e.g. DejaVu Sans).
// Supabase is fully mocked: no production accounts, documents or AI requests are created.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';

const base=process.argv[2]||process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const demoAgreementBody='Synthetic test contract. '+('This is an inert test clause with no legal force. ').repeat(65);
const demoPublished={body:demoAgreementBody,version:'synthetic-preview',sha256:createHash('sha256').update(demoAgreementBody).digest('hex')};
const user={id:'11111111-1111-4111-8111-111111111111',email:'synthetic@example.com',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-10-13T00:00:00Z'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.synthetic-signature';
const session={access_token:token,refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const fixture=()=>({id:'22222222-2222-4222-8222-222222222222',user_id:user.id,status:'draft',revision:0,profile:{business:{zip:'78703',radiusMiles:50,legalName:'Synthetic Test LLC'},equipment:[{id:'machine-one',make:'Toyota',model:'8FGU25',category:'Warehouse forklift',serial:'TEST-1'},{id:'machine-two',make:'JLG',model:'G6',category:'Telehandler',serial:'TEST-2'}],operators:[{id:'operator-one',name:'Synthetic Operator',equipmentIds:[]}],insurance:{inputMode:'packet',maximumLoadValue:250000}}});
const completeProfile={business:{legalName:'Example Lift LLC',entityType:'LLC',formationState:'TX',address:'Synthetic test address',contactName:'Test Operator',phone:'555-0100',emergencyName:'Test Dispatch',emergencyPhone:'555-0101',availability:'Weekdays',city:'Austin',state:'TX',zip:'78701',email:'test@example.com',radiusMiles:'50'},equipment:[{id:'machine-1',category:'Warehouse forklift',make:'Example',model:'Model',serial:'TEST',ownership:'Owned',fuel:'Propane',tires:'Paved',attachments:'None',transport:'Third-party hauler',inspectionDate:'2026-10-01',capacity:5000,liftHeight:15,loadCenter:24,baseZip:'78701',hourlyRate:125,fourHourRate:440,dailyRate:725,availability:'Weekdays',replacementValue:90000,widthIn:42,heightIn:85,weightLb:9000}],operators:[{id:'operator-1',name:'Example Operator',relationship:'Employee',trainingDate:'2026-01-01',trainer:'Example Trainer',evaluationDate:'2026-01-01',evaluator:'Example Evaluator',adult:'yes',equipmentIds:['machine-1']}],insurance:{inputMode:'packet'}};
const originalFixture=fixture;
const completeFixture=()=>{const a=originalFixture();a.profile.business={...completeProfile.business,legalName:'Synthetic Test LLC'};a.profile.equipment=a.profile.equipment.map(e=>({...completeProfile.equipment[0],...e}));a.profile.operators=a.profile.operators.map(o=>({...completeProfile.operators[0],...o}));return a;};
let assertions=0;
for(const viewport of [{width:320,height:640},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1440,height:1000}]){
 const browser=await playwright.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true});
 try{
  let application=completeFixture(),failNextSave=false,documents=[],review=null,prepared=null,loggedIn=false,logouts=0,saves=0;const errors=[];
  const context=await browser.newContext({viewport});

  await context.route('https://exokcxcxmmsnqejzhxwf.supabase.co/**',async route=>{
   const request=route.request(),url=new URL(request.url());let data=null,status=200;
   if(url.pathname==='/auth/v1/token'){loggedIn=true;data=session;}
   else if(url.pathname==='/auth/v1/user'){data=loggedIn?user:{message:'Not authenticated'};status=loggedIn?200:401;}
   else if(url.pathname==='/auth/v1/logout'){loggedIn=false;logouts++;status=204;}
   else if(url.pathname==='/rest/v1/operator_applications'){
    if(request.method()==='PATCH'){if(failNextSave){failNextSave=false;status=409;data={code:'SAVE_REJECTED',message:'Synthetic save failed'};}else{application={...application,...request.postDataJSON()};saves++;data=application;}}
    else data=[application];
   }else if(url.pathname==='/rest/v1/operator_documents'){if(request.method()==='POST'){const doc={...request.postDataJSON(),active:true};documents.push(doc);data=doc;}else data=documents;}
   else if(url.pathname.startsWith('/storage/v1/object/'))data={Key:'synthetic'};
   else if(url.pathname==='/rest/v1/provider_contract_versions')data=[{id:'version-test',version:'synthetic'}];
   else if(url.pathname==='/rest/v1/rpc/is_operator_reviewer')data=false;
   else if(url.pathname==='/rest/v1/rpc/provider_clearance')data={eligible:false,blockers:['Verification required'],envelope:prepared,review,reviewCurrent:true};
   else if(url.pathname==='/rest/v1/rpc/sign_provider_contract'){const body=request.postDataJSON();assert.equal(body.p_name,'Synthetic Operator');assert.equal(body.p_read,true);assert.equal(body.p_consent,true);prepared={...prepared,provider_signed_at:new Date().toISOString()};data=prepared;}
   else if(url.pathname==='/rest/v1/rpc/submit_operator_application'){const body=request.postDataJSON();assert(Object.values(body.acknowledgements).every(Boolean));assert.equal(body.typed_name,'Synthetic Operator');application={...application,status:'submitted',revision:1};data=application.id;}
   else if(url.pathname==='/rest/v1/rpc/provider_status')data={status:application.status};
   else if(url.pathname==='/rest/v1/rpc/current_provider_agreement')data=demoPublished;
   else if(url.pathname==='/rest/v1/rpc/provider_service_area')data={count:163,city:'Austin',state:'TX',zips:['78701','78702','78703']};
   else throw Error('Unexpected mocked request: '+request.method()+' '+url.pathname);
   await route.fulfill({status,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:status===204?'':JSON.stringify(data)});
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  const login=async()=>{await page.getByRole('heading',{name:'Operator log in',exact:true}).waitFor();await page.locator('[name=email]').fill(user.email);await page.locator('[name=password]').fill('Synthetic-test-password-123');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.locator('#provider-form').waitFor();};
  const roundtrip=async heading=>{const previous=structuredClone(application.profile);await page.locator('#portal-signout').click();await page.getByRole('heading',{name:'Operator log in',exact:true}).waitFor();assert.equal(loggedIn,false);await page.reload();await login();await page.getByRole('heading',{name:heading,exact:true}).waitFor();assert.deepEqual(application.profile,previous);assert.equal(loggedIn,true);for(const control of await page.locator('[data-field]').all()){const path=await control.getAttribute('data-field');const saved=path.split('.').reduce((obj,key)=>obj?.[key],application.profile)??'';assert.equal(await control.inputValue(),String(saved),'Restored field '+path);}};
  const layout=async()=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const header=await page.locator('.op-header').boundingBox(),nav=await page.locator('.step-sidebar').boundingBox();await page.locator('#provider-form').evaluate(el=>el.scrollTop=el.scrollHeight);assert.deepEqual(await page.locator('.op-header').boundingBox(),header);assert.deepEqual(await page.locator('.step-sidebar').boundingBox(),nav);assert.equal(await page.evaluate(()=>scrollY),0);await page.locator('#provider-form').evaluate(el=>el.scrollTop=0);};
  await page.goto(base+'/operators.html?mode=signin');await login();await page.getByRole('heading',{name:'Join the LiftCrew family',exact:true}).waitFor();await layout();
  await page.locator('[data-field="business.dba"]').fill('Saved mobile trade name');
  failNextSave=true;await page.locator('#portal-signout').click();await page.getByRole('alert').getByText('Synthetic save failed').waitFor();assert.equal(loggedIn,true);assert.equal(await page.locator('[data-field="business.dba"]').inputValue(),'Saved mobile trade name');
  await page.locator('#portal-signout').click();await login();assert.equal(application.profile.business.dba,'Saved mobile trade name');assert.equal(await page.locator('[data-field="business.dba"]').inputValue(),'Saved mobile trade name');
  await page.locator('[data-field="business.legalName"]').fill('');
  assert.equal(await page.locator('[data-save-complete]').isDisabled(),true);assertions++;
  await page.locator('[data-field="business.legalName"]').fill('Synthetic Test LLC');
  assert.equal(await page.locator('[data-save-complete]').isEnabled(),true);assertions++;
  assert.equal(await page.locator('.op-header').getByText('For clients',{exact:true}).count(),0);assertions++;
  assert.equal(await page.locator('#service-area-result').count(),0);assertions++;
  assert.equal(await page.locator('.account-bar').count(),0);assertions++;
  await page.locator('.op-header').getByRole('button',{name:'Sign out'}).waitFor();assertions++;
  assert.equal(await page.locator('.stage-link').count(),4);assertions++;
  await page.locator('[data-availability-day="mon"]').check();
  await page.locator('[data-availability-time="mon"][data-time-part="start"]').fill('07:00');
  await page.locator('[data-availability-time="mon"][data-time-part="end"]').fill('15:00');
  assert.equal(await page.locator('[data-save]').count(),0);assertions++;
  assert.equal(await page.locator('[data-next]').count(),0);assertions++;
  assert.equal(await page.locator('[data-save-complete]').count(),1);assertions++;
  await page.getByRole('button',{name:'Save & Complete',exact:true}).click();
  await page.getByRole('heading',{name:'Your equipment',exact:true}).waitFor();
  assert(application.profile.business.weeklyAvailability?.some(item=>item.day==='mon'&&item.start==='07:00'&&item.end==='15:00'));assertions++;
  await roundtrip('Your equipment');await layout();
  // A new browser tab has no sessionStorage; resume from localStorage and reload
  // all actual form values from the mocked database (not copied from DOM state).
  const reopened=await context.newPage();reopened.setDefaultTimeout(10000);
  await reopened.goto(base+'/operators.html');
  await reopened.getByRole('heading',{name:'Your equipment',exact:true}).waitFor();assertions++;
  await reopened.locator('[data-step="0"]').click();
  assert.equal(await reopened.locator('[data-availability-day="mon"]').isChecked(),true);assertions++;
  assert.equal(await reopened.locator('[data-availability-time="mon"][data-time-part="start"]').inputValue(),'07:00');assertions++;
  assert.equal(await reopened.locator('[data-availability-time="mon"][data-time-part="end"]').inputValue(),'15:00');assertions++;
  await reopened.close();
  const box=await page.locator('.application-card').boundingBox();assert(box, 'Application card missing after save; URL='+page.url()+' BODY='+JSON.stringify((await page.locator('body').innerText()).slice(0,1800))+' JS_ERRORS='+JSON.stringify(errors));assert(box.y<(viewport.width>720?270:380));assertions++;
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assertions++;
  await page.locator('[data-step="1"]').click();await page.getByRole('heading',{name:'Your equipment',exact:true}).waitFor();
  assert.equal(await page.locator('[data-equipment-permission]').count(),0);assertions++;
  const heading=await page.locator('.equipment-heading').boundingBox(),add=await page.locator('[data-add="equipment"]').boundingBox();
  assert(add.x+add.width>heading.x+heading.width-2);assertions++;
  await page.locator('[data-field="equipment.0.make"]').fill('');
  assert.equal(await page.locator('[data-save-complete]').isDisabled(),true);assertions++;
  await page.locator('[data-field="equipment.0.make"]').fill('Toyota');
  assert.equal(await page.locator('[data-save-complete]').isEnabled(),true);assertions++;
  const select=page.locator('[data-field="equipment.0.category"]');
  await select.selectOption('Other');
  await page.locator('[data-field="equipment.0.categoryOther"]').fill('Specialty lift');
  assert.equal(await page.locator('.lc-select-trigger').count(),0);assertions++;
  await page.locator('[data-field="equipment.0.category"]').selectOption('Warehouse forklift');
  await page.locator('[data-remove="equipment:1"]').click();
  await page.getByRole('dialog').getByRole('heading',{name:'Remove machine?'}).waitFor();
  assert.equal(await page.locator('dialog.lc-confirm-dialog').count(),1);assertions++;
  await page.getByRole('dialog').getByRole('button',{name:'Cancel'}).click();
  assert.equal(await page.locator('[data-remove="equipment:1"]').count(),1);assertions++;
  // Failed database save must not advance or falsely report a successful save.
  await page.locator('[data-field="equipment.0.make"]').fill('Synthetic modified machine');
  failNextSave=true;
  await page.getByRole('button',{name:'Save & Complete',exact:true}).click();
  await page.getByRole('alert').getByText('Synthetic save failed').waitFor();assertions++;
  assert.equal(await page.getByRole('heading',{name:'Your equipment',exact:true}).count(),1);assertions++;
  assert.notEqual(application.profile.equipment[0].make,'Synthetic modified machine');assertions++;
  await page.getByRole('button',{name:'Save & Complete',exact:true}).click();
  await page.getByRole('heading',{name:'Your operators',exact:true}).waitFor();
  assert.equal(application.profile.equipment[0].make,'Synthetic modified machine');assertions++;
  await roundtrip('Your operators');await layout();
  assert.equal(await page.locator('[data-equipment-permission]').count(),2);assertions++;
  assert.equal(await page.locator('[data-field="operators.0.equipmentTypes"]').count(),0);assertions++;
  assert.equal(await page.locator('[data-save-complete]').isDisabled(),true);assertions++;
  await page.locator('[data-equipment-permission][value="machine-one"]').check();
  assert.equal(await page.locator('[data-save-complete]').isEnabled(),true);assertions++;
  await page.getByRole('button',{name:'Save & Complete',exact:true}).click();
  await page.getByRole('heading',{name:'Insurance Requirements',exact:true}).waitFor();
  assert.deepEqual(application.profile.operators[0].equipmentIds,['machine-one']);assertions++;
  await roundtrip('Insurance Requirements');await layout();
  await page.locator('[data-step="3"]').click();await page.getByRole('heading',{name:'Insurance Requirements',exact:true}).waitFor();
  assert((await page.locator('.insurance-packet').boundingBox()).y < (await page.locator('.insurance-consent').boundingBox()).y);assertions++;
  if(viewport.width<=600){assert((await page.locator('.insurance-consent span').boundingBox()).width>=160,'Consent text must remain readable on phones');}
  if(process.env.AUDIT_SCREENSHOTS&&viewport.width===320){await page.locator('.insurance-submit-row').scrollIntoViewIfNeeded();await page.screenshot({path:'work/mobile-insurance-320.png'});}
  assert.equal(await page.locator('[data-review-insurance]').innerText(),'Submit');assertions++;
  assert.equal(await page.locator('[data-review-insurance]').isDisabled(),true);assertions++;
  assert.equal(await page.locator('[data-save-complete]').isDisabled(),true);assertions++;
  assert.equal(await page.locator('input[type=file]').count(),1);assertions++;
  assert.equal(await page.locator('[data-field^="insurance.cgl"]').count(),0);assertions++;
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assertions++;
  await page.locator('.stage-link').last().click();await page.getByRole('heading',{name:'Review & sign',exact:true}).waitFor();
  assert(await page.locator('.agreement-preview').textContent().then(s=>s.includes('Synthetic test contract.')));assertions++;
  assert.equal(await page.locator('[data-sign-contract]').count(),0);assertions++;
  await page.locator('[data-step="3"]').click();await page.getByRole('heading',{name:'Insurance Requirements',exact:true}).waitFor();
  await page.locator('input[type=file]').setInputFiles({name:'synthetic-insurance.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 Synthetic inert upload for UI testing')});
  await page.locator('[data-upload-button="insurance"]').click();await page.getByText('Documents uploaded securely.',{exact:true}).waitFor();
  assert(documents.some(d=>d.filename==='synthetic-insurance.pdf'));await roundtrip('Insurance Requirements');await page.locator('.stage-link').last().click();await page.getByRole('heading',{name:'Review & sign',exact:true}).waitFor();
  documents=[{kind:'insurance_packet',entity_id:''},{kind:'w9',entity_id:''},...application.profile.equipment.flatMap(e=>['equipment_photo','capacity_plate','inspection'].map(kind=>({kind,entity_id:e.id}))),...application.profile.operators.flatMap(o=>['training','evaluation'].map(kind=>({kind,entity_id:o.id})))].map((d,i)=>({...d,id:'doc-'+i,active:true,filename:'synthetic.pdf'}));
  const resume=async stage=>{await page.evaluate(({id,stage})=>{sessionStorage.setItem('provider-step-v2-'+id,stage);localStorage.setItem('provider-step-v2-'+id,stage);},{id:application.id,stage});await page.reload();await page.locator('#provider-form').waitFor();};
  await resume('insurance');
  assert.equal(await page.locator('[data-save-complete]').isDisabled(),true);
  assert.equal(await page.locator('[data-review-insurance]').isDisabled(),true);
  await page.locator('[data-ai-consent]').check();
  assert.equal(await page.locator('[data-review-insurance]').isEnabled(),true);
  review={state:'complete',result:{outcome:'document_pass'}};
  await resume('insurance');assert.equal(await page.locator('[data-save-complete]').isEnabled(),true);
  await resume('documents');await layout();await roundtrip('Supporting documents');assert.equal(await page.locator('[data-save-complete]').isEnabled(),true);
  const missingDoc=documents.pop();await page.reload();await page.locator('#provider-form').waitFor();assert.equal(await page.locator('[data-save-complete]').isDisabled(),true);documents.push(missingDoc);
  prepared={body:demoAgreementBody,version:'synthetic-personal-version',sha256:demoPublished.sha256,provider_name:'Synthetic Operator',provider_title:'Owner'};
  await resume('agreement');await layout();await roundtrip('Review & sign');assert.equal(await page.locator('.agreement-view-meta').count(),0);assert.equal(await page.locator('[data-save-complete]').isDisabled(),true);
  await page.locator('#contract-text').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});
  await page.locator('[name=read-contract]').check();await page.locator('[name=esign-consent]').check();
  assert.equal(await page.locator('[data-sign-contract]').isDisabled(),true);
  await page.locator('[name=signature]').fill('Synthetic Operator');await page.locator('[name=signature-title]').fill('Owner');assert.equal(await page.locator('[data-sign-contract]').isEnabled(),true);
  await page.locator('[data-sign-contract]').click();await page.getByRole('heading',{name:'Submit application',exact:true}).waitFor();assert(prepared.provider_signed_at);await resume('finish');await layout();await roundtrip('Submit application');
  assert.equal(await page.locator('button[type=submit]').isDisabled(),true);
  for(const checkbox of await page.locator('[name^="ack-"]').all())await checkbox.check();
  assert.equal(await page.locator('button[type=submit]').isEnabled(),true);
  await page.locator('[name=typed-name]').fill('');assert.equal(await page.locator('button[type=submit]').isDisabled(),true);
  await page.locator('[name=typed-name]').fill('Synthetic Operator');await page.locator('button[type=submit]').click();await page.getByRole('heading',{name:'Provider dashboard',exact:true}).waitFor();assert.equal(application.status,'submitted');
  await page.locator('#portal-signout').click();await page.reload();await page.getByRole('heading',{name:'Operator log in',exact:true}).waitFor();await page.locator('[name=email]').fill(user.email);await page.locator('[name=password]').fill('Synthetic-test-password-123');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('heading',{name:'Provider dashboard',exact:true}).waitFor();assert.equal(application.status,'submitted');
  await page.goto(base+'/operator-confirmed.html?case=direct');await page.getByRole('heading',{name:'Continue your onboarding',exact:true}).waitFor();assertions++;
  await page.goto(base+'/operator-confirmed.html?case=expired#error=expired');await page.getByRole('heading',{name:'Let’s get you back on track.',exact:true}).waitFor();assertions++;
  assert.equal(new URL(page.url()).hash,'');assertions++;
  await page.goto(base+'/operator-confirmed.html?case=valid#access_token='+token+'&refresh_token=synthetic-refresh&type=signup');await page.getByRole('heading',{name:'Email confirmed.',exact:true}).waitFor();assertions++;
  assert.equal(await page.locator('#confirmation-login').getAttribute('href'),'/operators.html?mode=signin');assertions++;
  assert.equal(new URL(page.url()).hash,'');assertions++;
  assert.deepEqual(errors,[]);assertions++;assert(logouts>=7);assert(saves>0);console.log('Logout/login cycles: '+logouts+'; saved updates: '+saves);
  console.log(`PASS ${viewport.width}px: layout, equipment selections, single packet upload, confirmation states`);
 }finally{await browser.close();}
}
console.log(`Browser assertions passed: ${assertions}`);
