// Isolated UI regression: mocked auth and mutations never affect real applications.
import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright-core';
import chromium from '@sparticuz/chromium';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
for(const width of [320,390,768,1440]){
 const browser=await playwright.launch({args:chromium.args.filter(a=>a!=='--single-process'),executablePath:await chromium.executablePath(),headless:true});
 try{
 const context=await browser.newContext({viewport:{width,height:900}});
 const user={id:'11111111-1111-4111-a111-111111111111',email:'staff@example.invalid',email_confirmed_at:'2026-10-13',aud:'authenticated',role:'authenticated'};
 const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const token=enc({alg:'HS256'})+'.'+enc({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test';
 await context.addInitScript(s=>localStorage.setItem('sb-exokcxcxmmsnqejzhxwf-auth-token',JSON.stringify(s)),{access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,user});
 let status='submitted',signed=false,history=[];const decisions=[];
 const app=()=>({id:'22222222-2222-4222-a222-222222222222',status,revision:1,updated_at:'2026-10-21',profile:{business:{legalName:'TEST ONLY Provider',email:'qa@example.invalid',contactName:'TEST ONLY',serviceArea:'Never dispatch'},equipment:[{make:'TEST ONLY',model:'QA',capacity:5000}],operators:[{name:'TEST ONLY'}]}});
 const envelope=()=>({id:'33333333-3333-4333-a333-333333333333',provider_name:'TEST ONLY Operator',provider_title:'QA',provider_signed_at:'2026-10-21',body:'TEST ONLY exact agreement',sha256:'f'.repeat(64),liftcrew_signed_at:signed?'2026-10-21':null,liftcrew_name:'TEST ONLY Reviewer',liftcrew_title:'QA'});
 await context.route('https://exokcxcxmmsnqejzhxwf.supabase.co/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;let data;
 if(path.endsWith('/auth/v1/user'))data=user;
 else if(path.endsWith('/rpc/is_operator_reviewer'))data=true;
 else if(path.endsWith('/operator_applications'))data=req.headers().accept?.includes('object')?app():[app()];
 else if(path.endsWith('/operator_documents'))data=[{id:'doc',kind:'insurance_packet',filename:'test-only.pdf',active:true}];
 else if(path.endsWith('/operator_submissions'))data=[];
 else if(path.endsWith('/operator_reviews'))data=history;
 else if(path.endsWith('/rpc/provider_clearance'))data={eligible:status==='approved',blockers:[],envelope:envelope(),review:null};
 else if(path.endsWith('/rpc/countersign_provider_contract')){signed=true;data=null;}
 else if(path.endsWith('/rpc/review_operator_application')){const body=req.postDataJSON();decisions.push(body);status=body.decision;history=[{decision:status,feedback:body.feedback,checks:body.checks,created_at:'2026-10-21'}];data=null;}
 else if(path.endsWith('/auth/v1/logout'))data={};
 else throw Error('Unexpected route '+path);
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/operator-review.html');await page.getByRole('button',{name:/TEST ONLY Provider/}).click();
 await page.getByRole('navigation',{name:'Application sections'}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Staff sign in',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Sign out',exact:true}).count(),1);
 assert.equal(await page.locator('#approval-checks').isVisible(),false);
 assert.equal(await page.locator('.profile-group[open]').count(),0);
 await page.locator('[name=decision]').selectOption('approved');assert.equal(await page.locator('#record-decision').isDisabled(),true);
 await page.getByLabel('Your full legal name').fill('TEST ONLY Reviewer');await page.getByLabel('Your title / authority').fill('QA TEST ONLY');await page.locator('[name=consent]').check();await page.getByRole('button',{name:'Countersign agreement',exact:true}).click();
 await page.getByText(/LiftCrew: TEST ONLY Reviewer/).waitFor();
 await page.locator('[name=decision]').selectOption('approved');
 for(const c of await page.locator('#approval-checks input[type=checkbox]').all())await c.check();
 await page.locator('[name=verificationReference]').fill('TEST ONLY simulated verification');await page.locator('[name=insuranceValidUntil]').fill('2027-01-01');await page.locator('[name=feedback]').fill('TEST ONLY approval');
 assert.equal(await page.locator('#record-decision').isEnabled(),true);await page.locator('#record-decision').click();await page.getByText('Currently eligible for forklift matching',{exact:true}).waitFor();
 assert.equal(decisions[0].decision,'approved');assert.equal(decisions[0].checks.independentVerification,true);
 await page.locator('[name=feedback]').fill('TEST ONLY suspend');await page.locator('#record-decision').click();await page.getByText(/Suspended · changes requested · revision/).waitFor();assert.equal(decisions[1].decision,'changes_requested');
 await page.reload();await page.getByRole('button',{name:/TEST ONLY Provider/}).click();await page.getByRole('heading',{name:'Decision & submission history'}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 for(const group of await page.locator('.profile-group>summary').all())await group.click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 const badge=await page.locator('.account-bar .tag').boundingBox();assert(badge.height<70);
 await page.screenshot({path:`../../outputs/liftcrew-admin-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);
 console.log(`PASS ${width}px: signed-in nav, sections, badges, countersign, approval gating, approval, suspension, reload and no horizontal overflow`);
 }finally{await browser.close();}
}
