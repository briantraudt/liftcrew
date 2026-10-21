// Run against `npm run preview -- --port 4173` after npm run build.
// Optional test dependencies: playwright-core and @sparticuz/chromium.
// Requires system nss, nspr and a fallback font (e.g. DejaVu Sans).
// Supabase is fully mocked: no production accounts, documents or AI requests are created.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const demoAgreementBody='Synthetic test contract. '+('This is an inert test clause with no legal force. ').repeat(65);
const demoPublished={body:demoAgreementBody,version:'synthetic-preview',sha256:createHash('sha256').update(demoAgreementBody).digest('hex')};
const user={id:'11111111-1111-4111-8111-111111111111',email:'synthetic@example.com',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-10-13T00:00:00Z'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.synthetic-signature';
const session={access_token:token,refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const fixture=()=>({id:'22222222-2222-4222-8222-222222222222',user_id:user.id,status:'draft',revision:0,profile:{business:{zip:'78703',radiusMiles:50,legalName:'Synthetic Test LLC'},equipment:[{id:'machine-one',make:'Toyota',model:'8FGU25',category:'Warehouse forklift',serial:'TEST-1'},{id:'machine-two',make:'JLG',model:'G6',category:'Telehandler',serial:'TEST-2'}],operators:[{id:'operator-one',name:'Synthetic Operator',equipmentIds:[]}],insurance:{inputMode:'packet',maximumLoadValue:250000}}});
let assertions=0;
for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const browser=await playwright.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true});
 try{
  let application=fixture();const errors=[];
  const context=await browser.newContext({viewport});
  await context.addInitScript(value=>localStorage.setItem('sb-exokcxcxmmsnqejzhxwf-auth-token',JSON.stringify(value)),session);
  await context.route('https://exokcxcxmmsnqejzhxwf.supabase.co/**',async route=>{
   const request=route.request(),url=new URL(request.url());let data=null,status=200;
   if(url.pathname==='/auth/v1/user')data=user;
   else if(url.pathname==='/auth/v1/logout')status=204;
   else if(url.pathname==='/rest/v1/operator_applications'){
    if(request.method()==='PATCH'){application={...application,...request.postDataJSON()};data=application;}
    else data=[application];
   }else if(url.pathname==='/rest/v1/operator_documents')data=[];
   else if(url.pathname==='/rest/v1/provider_contract_versions')data=[{id:'version-test',version:'synthetic'}];
   else if(url.pathname==='/rest/v1/rpc/is_operator_reviewer')data=false;
   else if(url.pathname==='/rest/v1/rpc/provider_clearance')data={eligible:false,blockers:['Verification required'],envelope:null,review:null,reviewCurrent:true};
   else if(url.pathname==='/rest/v1/rpc/current_provider_agreement')data=demoPublished;
   else if(url.pathname==='/rest/v1/rpc/provider_service_area')data={count:163,city:'Austin',state:'TX',zips:['78701','78702','78703']};
   else throw Error('Unexpected mocked request: '+request.method()+' '+url.pathname);
   await route.fulfill({status,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:status===204?'':JSON.stringify(data)});
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/operators.html');await page.getByRole('heading',{name:'Join the LiftCrew family',exact:true}).waitFor();
  assert.equal(await page.locator('.op-header').getByText('For clients',{exact:true}).count(),0);assertions++;
  assert.equal(await page.locator('#service-area-result').count(),0);assertions++;
  assert.equal(await page.locator('.account-bar').count(),0);assertions++;
  await page.locator('.op-header').getByRole('button',{name:'Sign out'}).waitFor();assertions++;
  assert.equal(await page.locator('.stage-link').count(),4);assertions++;
  await page.locator('[data-availability-day="mon"]').check();
  await page.locator('[data-availability-time="mon"][data-time-part="start"]').fill('07:00');
  await page.locator('[data-availability-time="mon"][data-time-part="end"]').fill('15:00');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  assert(application.profile.business.weeklyAvailability?.some(item=>item.day==='mon'&&item.start==='07:00'&&item.end==='15:00'));assertions++;
  const box=await page.locator('.application-card').boundingBox();assert(box.y<(viewport.width>720?270:380));assertions++;
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assertions++;
  await page.locator('[data-step="1"]').click();await page.getByRole('heading',{name:'Your equipment',exact:true}).waitFor();
  assert.equal(await page.locator('[data-equipment-permission]').count(),0);assertions++;
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
  await page.locator('[data-next]').click();await page.getByRole('heading',{name:'Your operators',exact:true}).waitFor();
  assert.equal(await page.locator('[data-equipment-permission]').count(),2);assertions++;
  assert.equal(await page.locator('[data-field="operators.0.equipmentTypes"]').count(),0);assertions++;
  await page.locator('[data-equipment-permission][value="machine-one"]').check();
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByText('Saved. You can return to complete onboarding.',{exact:true}).waitFor();
  assert.deepEqual(application.profile.operators[0].equipmentIds,['machine-one']);assertions++;
  await page.locator('[data-step="3"]').click();await page.getByRole('heading',{name:'Insurance Requirements',exact:true}).waitFor();
  assert((await page.locator('.insurance-packet').boundingBox()).y < (await page.locator('.insurance-consent').boundingBox()).y);assertions++;
  assert.equal(await page.locator('input[type=file]').count(),1);assertions++;
  assert.equal(await page.locator('[data-field^="insurance.cgl"]').count(),0);assertions++;
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assertions++;
  await page.locator('.stage-link').last().click();await page.getByRole('heading',{name:'Review & sign',exact:true}).waitFor();
  assert(await page.locator('.agreement-preview').textContent().then(s=>s.includes('Synthetic test contract.')));assertions++;
  assert.equal(await page.locator('[data-sign-contract]').count(),0);assertions++;
  await page.goto(base+'/operator-confirmed.html?case=direct');await page.getByRole('heading',{name:'Continue your onboarding',exact:true}).waitFor();assertions++;
  await page.goto(base+'/operator-confirmed.html?case=expired#error=expired');await page.getByRole('heading',{name:'Let’s get you back on track.',exact:true}).waitFor();assertions++;
  assert.equal(new URL(page.url()).hash,'');assertions++;
  await page.goto(base+'/operator-confirmed.html?case=valid#access_token='+token+'&refresh_token=synthetic-refresh&type=signup');await page.getByRole('heading',{name:'Email confirmed.',exact:true}).waitFor();assertions++;
  assert.equal(await page.locator('#confirmation-login').getAttribute('href'),'/operators.html?mode=signin');assertions++;
  assert.equal(new URL(page.url()).hash,'');assertions++;
  assert.deepEqual(errors,[]);assertions++;
  console.log(`PASS ${viewport.width}px: layout, equipment selections, single packet upload, confirmation states`);
 }finally{await browser.close();}
}
console.log(`Browser assertions passed: ${assertions}`);
