// Browser UI acceptance; identity/data are mocked. Does not prove email delivery.
import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';let assertions=0;
for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const browser=await playwright.launch({args:chromium.args.filter(a=>a!=='--single-process'),executablePath:await chromium.executablePath(),headless:true});
 try{
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/staff-login.html');await page.getByRole('heading',{name:'Staff sign in',exact:true}).waitFor();
  await page.getByRole('button',{name:'Create your staff login'}).click();await page.getByRole('heading',{name:'Create staff login',exact:true}).waitFor();assert.equal(await page.locator('[name=confirm]').count(),1);assert.equal(await page.locator('[name=privacy]').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assertions+=3;
  await page.goto(base+'/customer-requests.html');await page.getByRole('link',{name:'Staff sign in',exact:true}).waitFor();assert.equal(await page.locator('#requests').count(),0);assertions++;
  await page.goto(base+'/staff-login.html?error=expired');await page.getByRole('alert').waitFor();assert.equal(new URL(page.url()).search,'');assert.equal(await page.locator('[name=confirm]').count(),0);assertions+=2;
  assert.deepEqual(errors,[]);assertions++;
  const user={id:'11111111-1111-4111-a111-111111111111',email:'synthetic-staff@example.invalid',email_confirmed_at:'2026-10-13T00:00:00Z',aud:'authenticated',role:'authenticated'};
  const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.synthetic-only';const session={access_token:token,refresh_token:'synthetic-only',expires_at:Math.floor(Date.now()/1000)+3600,user};
  const staff=await browser.newContext({viewport});await staff.addInitScript(s=>localStorage.setItem('sb-exokcxcxmmsnqejzhxwf-auth-token',JSON.stringify(s)),session);
  let status='new',saved=false;
  const row=()=>({id:'22222222-2222-4222-a222-222222222222',service:'Forklift with operator',status,notification_status:'unconfigured',created_at:'2026-10-13T18:00:00Z',details:{name:'Synthetic Customer',company:'Synthetic QA Request',email:'test@example.invalid',phone:'5125550100',date:'2026-10-14',durationDays:'1',location:'78703',loadDescription:'<script>Never execute</script>'}});
  await staff.route('https://exokcxcxmmsnqejzhxwf.supabase.co/**',async route=>{const path=new URL(route.request().url()).pathname;let data;if(path.endsWith('/auth/v1/user'))data=user;else if(path.endsWith('/rpc/is_operator_reviewer'))data=true;else if(path.endsWith('/customer_requests'))data=[row()];else if(path.endsWith('/rpc/update_customer_request')){status=route.request().postDataJSON().p_status;saved=true;data=null;}else throw Error('Unexpected mocked route '+path);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
  const inbox=await staff.newPage();inbox.on('pageerror',e=>errors.push(e.message));await inbox.goto(base+'/customer-requests.html');await inbox.getByRole('button',{name:/Synthetic QA Request/}).click();await inbox.getByRole('heading',{name:'Synthetic QA Request'}).waitFor();assert.equal(await inbox.locator('script').filter({hasText:'Never execute'}).count(),0);await inbox.getByText('<script>Never execute</script>',{exact:true}).waitFor();assertions++;
  await inbox.locator('[name=status]').selectOption('in_progress');await inbox.getByRole('button',{name:'Save status',exact:true}).click();await inbox.waitForTimeout(100);assert(saved);assert.equal(status,'in_progress');assertions+=2;
  assert.equal(await inbox.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);assertions+=2;await staff.close();
  console.log(`PASS ${viewport.width}px: staff signup/signin, expired callback, anonymous inbox gate, authorized inbox/detail, safe rendering and status update`);
 }finally{await browser.close();}
}
console.log('Browser assertions passed: '+assertions);
