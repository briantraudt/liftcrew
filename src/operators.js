import {db,check,uploadDocument,downloadDocument,removeDocument} from './operator-api.js';
import {emptyProfile,editable,escapeHtml as h,renewalIssues,renderRecord,validateFile} from './operator-data.js';
import {providerSlots,extraProfileErrors,reviewHTML,saveAgreement} from './provider-ui.js';
import {businessView,equipmentView,operatorsView,insuranceView,documentsView} from './onboarding-ui.js';
import {stepIds,stepLabels,insuranceKinds,hasInsurancePacket,removeEquipmentAssignments,restoredStep,persistStep,validateInsuranceBatch} from './onboarding-model.js';
import {CONFIRMATION_URL,OPERATOR_LOGIN_URL} from './operator-auth.js';
import {onboardingStages,stageForStep,ratePreviewMarkup,renewalAlerts,businessRadiusForMachines,normalizeMachineRadiusFallbacks} from './onboarding-experience.js';
import {validatePublishedAgreement} from './published-agreement-format.js';
import {renderAgreementPreview} from './agreement-preview.js';
import './operator-flow.css';
import './onboarding-compact.css';
import './operator-experience.css';
import './select.js';

const root=document.querySelector('#app');
const headerSignout=document.querySelector('#portal-signout');
function setHeaderSignedIn(signedIn){if(headerSignout)headerSignout.hidden=!signedIn;}
const certifications={accurate:'These details and documents are accurate and current. I will report changes and coverage lapses.',authority:'I am authorized to represent this provider and submit its personnel and business records.',safety:'Operators must be qualified for the machine and workplace. We will follow capacity limits, inspect equipment and stop unsafe work.',privacy:'I have read the application privacy notice and authorize LiftCrew to verify these records with my broker and other appropriate sources.',terms:'I signed the provider agreement. Work requires LiftCrew approval, both signatures, current coverage and an accepted work order. Crane/specialty work requires a separate signed rider.',electronic:'I intend to certify this application electronically under my typed name and can download and retain my agreement and records.'};
let user=null,app=null,p=null,docs=[],clearance=null,envelope=null,published=null,publishedAgreement=null,agreementPreviewError='',step=0;
let mode=new URLSearchParams(location.search).get('mode')==='signin'?'signin':'signup';
let recovering=false,reviewer=false,busy=false,dirty=false,aiConsent=false,pollTimer=null,pollEpoch=0;
let message='',errorMessage='',authEmail='',areaTimer=null,areaVersion=0;
const areaCache=new Map();
const notice=()=>`<div id="provider-message" role="status" aria-live="polite">${message?`<p class="notice success">${h(message)}</p>`:''}</div><div id="provider-error" role="alert">${errorMessage?`<p class="notice error">${h(errorMessage)}</p>`:''}</div>`;
function markDirty(){dirty=true;if(clearance)clearance.reviewCurrent=false;root.querySelectorAll('.save-state').forEach(element=>element.textContent='Unsaved changes');}
function set(path,value){const parts=path.split('.');let object=p;for(const key of parts.slice(0,-1))object=object[key]??={};object[parts.at(-1)]=value;markDirty();}
function fail(error){errorMessage=error.message||'Unable to complete this action. Your saved information is retained.';const target=root.querySelector('#provider-error');if(target){target.innerHTML=`<p class="notice error">${h(errorMessage)}</p>`;target.scrollIntoView({block:'center'});}else authView();}
async function run(action){if(busy)return;busy=true;message='';errorMessage='';const buttons=[...root.querySelectorAll('button')].map(button=>[button,button.disabled]);buttons.forEach(([button])=>button.disabled=true);try{await action();}catch(error){fail(error);}finally{busy=false;buttons.forEach(([button,disabled])=>{if(button.isConnected)button.disabled=disabled;});}}

function authView(){
 setHeaderSignedIn(false);
 const signin=mode==='signin'&&!recovering,reset=mode==='reset';
 root.removeAttribute('aria-busy');
 root.innerHTML=`<section class="op-welcome"><section class="auth-card"><h1>${recovering?'New password':reset?'Reset password':signin?'Operator log in':'Operator signup'}</h1>${notice()}<form id="auth-form">${!recovering?`<label class="field"><span>Email address</span><input name="email" type="email" required maxlength="254" autocomplete="email" value="${h(authEmail)}"></label>`:''}${!reset?`<label class="field"><span>${signin?'Password':'Password (12+ characters)'}</span><input name="password" type="password" required ${signin?'':'minlength="12"'} maxlength="128" autocomplete="${signin?'current-password':'new-password'}"></label>`:''}${mode==='signup'&&!recovering?'<label class="check"><input name="privacy" type="checkbox" required><span>I have read the <a href="/operator-privacy.html" target="_blank" rel="noopener">privacy notice</a>.</span></label>':''}<button class="btn wide">${recovering?'Update password':reset?'Send reset link':signin?'Log in':'Create account'}</button></form>${!recovering?`<p class="auth-switch"><button class="text-btn" data-mode="${signin?'signup':'signin'}">${signin?'Create an account':'Log in to an existing account'}</button></p>${signin?'<div class="auth-links"><button class="text-btn" data-mode="reset">Forgot password?</button><button class="text-btn" data-resend>Resend confirmation</button></div>':''}`:''}</section></section>`;
 root.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{authEmail=root.querySelector('[name=email]')?.value.trim()||authEmail;mode=button.dataset.mode;message='';errorMessage='';authView();});
 root.querySelector('#auth-form').onsubmit=event=>{event.preventDefault();const form=new FormData(event.target),email=String(form.get('email')||'').trim(),password=String(form.get('password')||'');authEmail=email;run(async()=>{
  if(recovering){check(await db.auth.updateUser({password}));recovering=false;await load();return;}
  if(reset){check(await db.auth.resetPasswordForEmail(email,{redirectTo:OPERATOR_LOGIN_URL}));message='If an account exists, a reset link will be sent. Check your inbox and spam folder.';authView();return;}
  if(signin){check(await db.auth.signInWithPassword({email,password}));await load();return;}
  const data=check(await db.auth.signUp({email,password,options:{emailRedirectTo:CONFIRMATION_URL}}));
  if(data.session){await load();return;}
  mode='signin';message='Check your inbox to confirm your email. Then log in to finish your business profile, equipment list and onboarding.';authView();
 });};
 root.querySelector('[data-resend]')?.addEventListener('click',()=>{const email=root.querySelector('[name=email]')?.value.trim();run(async()=>{if(!email)throw Error('Enter your email first.');authEmail=email;check(await db.auth.resend({type:'signup',email,options:{emailRedirectTo:CONFIRMATION_URL}}));message='Confirmation requested. Check your inbox; delivery depends on account status.';authView();});});
}

async function load(){
 stopPoll();user=check(await db.auth.getUser()).user;if(!user)throw Error('Log in again to continue.');
 app=check(await db.from('operator_applications').select('*').eq('user_id',user.id).maybeSingle());
 if(!app){const result=await db.from('operator_applications').insert({user_id:user.id,profile:emptyProfile()}).select().single();app=result.error?.code==='23505'?check(await db.from('operator_applications').select('*').eq('user_id',user.id).single()):check(result);}
 p=structuredClone(app.profile);p.business??={};p.equipment??=[];p.operators??=[];p.insurance??={};
 docs=check(await db.from('operator_documents').select('*').eq('application_id',app.id).order('created_at'));
 reviewer=check(await db.rpc('is_operator_reviewer'))===true;
 published=check(await db.from('provider_contract_versions').select('id,version').order('published_at',{ascending:false}).limit(1))[0]||null;
 // The complete published terms are public, read-only, and viewable before any application fields are completed.
 publishedAgreement=null;agreementPreviewError='';
 try{
  const candidate=validatePublishedAgreement(check(await db.rpc('current_provider_agreement')));
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(candidate.body)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==candidate.sha256)throw Error('Published agreement integrity verification failed');
  publishedAgreement=candidate;
 }catch{agreementPreviewError='The full agreement preview could not be verified here. Open the published agreement page instead.';}
 step=restoredStep(sessionStorage,app.id);dirty=false;
 // Repair legacy blank machine radii before the agreement preflight reads this draft.
 await save();
 // Refresh the server fingerprint and review status *after* any normalization save.
 // Never show a superseded insurance review as current.
 clearance=check(await db.rpc('provider_clearance',{p_application_id:app.id}));envelope=clearance.envelope;
 await prepareWhenComplete();
 render();
 if(clearance.review&&['queued','reading'].includes(clearance.review.state))pollReview(clearance.review.id);
}
async function save(){
 if(!app||!editable(app))return;
 const normalized=normalizeMachineRadiusFallbacks(p);
 if(!dirty&&!normalized)return;
 p.business.radiusMiles=businessRadiusForMachines(p);
 app=check(await db.from('operator_applications').update({profile:p}).eq('id',app.id).eq('status',app.status).select().single());
 dirty=false;
}
async function move(next){
 await save();
 step=Math.max(0,Math.min(stepIds.length-1,next));
 persistStep(sessionStorage,app.id,step);
 await prepareWhenComplete();
 render();
 root.querySelector('.application-card h2, .onboarding-title')?.scrollIntoView({block:'start',behavior:'smooth'});
}

function beforeAgreementIssues(){
 return [
  ...extraProfileErrors(p),
  ...providerSlots(p).filter(([kind,id])=>!(kind==='insurance_packet'
    ?hasInsurancePacket(docs)
    :docs.some(doc=>doc.active&&doc.kind===kind&&doc.entity_id===id)))
   .map(([, ,title])=>'Upload '+title),
  ...renewalIssues(p,docs)
 ];
}
async function prepareWhenComplete(){
 if(stepIds[step]!=='agreement'||envelope||!published||beforeAgreementIssues().length)return;
 try{
  // Prepare a personalized reading copy only. No consent or signature is recorded here.
  envelope=check(await db.rpc('prepare_provider_contract',{p_application_id:app.id}));
 }catch{
  // Keep the complete read-only published text visible. Preparation can be retried.
  message='The published agreement is available to read. Personalized signing is temporarily unavailable.';
 }
}
function contract(){
 const issues=beforeAgreementIssues(),signed=Boolean(envelope?.provider_signed_at);
 const preview=envelope?.body?envelope:publishedAgreement;
 const previewMarkup=renderAgreementPreview(preview,{personalized:Boolean(envelope)});
 const fullAgreementLink='<a class="agreement-full-link" href="/operator-agreement.html" target="_blank" rel="noopener">Read the complete published agreement in a new tab</a>';
 const title=signed?'Agreement signed':'Review & sign';
 const heading='<h2>'+title+'</h2>';
 const visibleTerms=previewMarkup+fullAgreementLink;
 if(!preview)return heading+'<div class="notice" role="status">'+h(agreementPreviewError||'The published agreement is temporarily unavailable.')+'</div>'+fullAgreementLink;
 if(signed)return heading+visibleTerms+`<div class="notice success">Signed by ${h(envelope.provider_name)} on ${h(new Date(envelope.provider_signed_at).toLocaleString())}. ${envelope.liftcrew_signed_at?'LiftCrew has countersigned.':'Awaiting LiftCrew countersignature.'}</div><button type="button" class="btn secondary" data-agreement-download>Download signed agreement & audit</button>`;
 if(issues.length)return heading+visibleTerms+`<div class="agreement-signing-status" role="status"><strong>Available to read now. Signing is locked until the application is complete.</strong><p>${issues.length} required item${issues.length===1?'':'s'} remain. Finish your business, equipment, personnel, insurance and document details before signing.</p></div>`;
 if(!envelope)return heading+visibleTerms+'<button type="button" class="btn" data-prepare>Prepare personalized agreement for signing</button>';
 return heading+visibleTerms+`<div class="signature-box"><p id="scroll-status" role="status">Review the agreement above and scroll to the end before signing.</p><label class="check"><input type="checkbox" name="read-contract"><span>I have read the complete agreement, including Schedule A, and am authorized to bind this provider.</span></label><label class="check"><input type="checkbox" name="esign-consent"><span>I consent to electronic records and signatures. Typing my name and selecting Sign agreement constitutes my signature. I can download a copy and can request a paper process before signing.</span></label><div class="form-grid"><label class="field"><span>Full legal name</span><input name="signature" autocomplete="name" maxlength="200"></label><label class="field"><span>Title / signing authority</span><input name="signature-title" maxlength="100"></label></div><button type="button" class="btn" data-sign-contract disabled>Sign agreement</button></div><p class="signature-audit">Document SHA-256: ${h(envelope.sha256)}</p>`;
}
async function prepareContract(){await save();if(beforeAgreementIssues().length)throw Error('Complete all business, machine, operator, insurance and supporting records before preparing the agreement.');envelope=check(await db.rpc('prepare_provider_contract',{p_application_id:app.id}));render();}
function applicationSummary(){return `<div class="summary-grid"><section><h3>Business</h3><p>${h(p.business.legalName||'Not entered')}<br>${h(p.business.contactName)} · ${h(p.business.phone)}<br>${h(p.business.city)}, ${h(p.business.state)} ${h(p.business.zip)}</p></section><section><h3>Equipment & people</h3><p>${p.equipment.length} machine(s) · ${p.operators.length} operator(s)</p><p>${p.equipment.map(equipment=>h([equipment.make,equipment.model].filter(Boolean).join(' '))).join('<br>')}</p></section><section><h3>Records</h3><p>${docs.filter(doc=>doc.active).length} uploads<br>${envelope?.provider_signed_at?'Agreement signed':'Agreement signature required'}</p></section></div>`;}
function finish(){
 const issues=[
  ...extraProfileErrors(p).map(message=>({message,step:/operator|evaluation|training|authorized equipment/i.test(message)?'operators':/business|service radius|home.*zip/i.test(message)?'business':'equipment'})),
  ...providerSlots(p).filter(([kind,id])=>!(kind==='insurance_packet'?hasInsurancePacket(docs):docs.some(doc=>doc.active&&doc.kind===kind&&doc.entity_id===id))).map(([kind,id,title])=>({message:'Upload '+title,step:kind==='insurance_packet'?'insurance':'documents'})),
  ...renewalIssues(p,docs).map(message=>({message,step:/operator|evaluation/i.test(message)?'operators':/insurance|coverage/i.test(message)?'insurance':'documents'}))
 ];
 if(!envelope?.provider_signed_at)issues.push({message:'Sign the finalized provider agreement',step:'agreement'});
 const missing=issues.length>0;
 return `<h2>Submit application</h2>
 ${applicationSummary()}
 ${missing?`<div class="notice error"><strong>${issues.length} item${issues.length===1?'':'s'} to finish before submitting</strong><ul class="issue-list">${issues.map(issue=>`<li><button type="button" class="issue-link" data-fix="${stepIds.indexOf(issue.step)}">→ ${h(issue.message)}</button></li>`).join('')}</ul></div>`:'<div class="notice success"><strong>Ready to submit for LiftCrew verification.</strong> Your application is complete for submission, not yet approved or work-eligible.</div>'}
 <details><summary>Review all saved business, machine and personnel details</summary>${renderRecord(p)}</details>
 <div class="form-section-title">Certify your application</div>
 ${Object.entries(certifications).map(([key,text])=>`<label class="check"><input type="checkbox" name="ack-${key}" required><span>${h(text)}</span></label>`).join('')}
 <div class="form-grid"><label class="field"><span>Full legal name — application certification</span><input name="typed-name" maxlength="200" value="${h(envelope?.provider_name||'')}" required></label><label class="field"><span>Title / authority</span><input name="signer-title" maxlength="100" value="${h(envelope?.provider_title||'')}" required></label></div>
 <button class="btn wide" type="submit" ${missing?'disabled aria-disabled="true"':''}>Submit for provider approval</button><p class="field-hint">Final approval requires verified insurance and qualifications, independent staff review, both signatures and an accepted work order. Crane or specialty work needs separate authorization.</p>`;
}
function statusPage(){
 const eligible=clearance?.eligible===true;
 const alerts=renewalAlerts(p,docs,clearance);
 const title=eligible?'Approved for job matching':app.status==='declined'?'Not approved':app.status==='changes_requested'?'Corrections required':app.status==='submitted'?'Under review':'Your provider account';
 return `<div class="dashboard-hero"><span class="dashboard-kicker">LiftCrew provider portal</span><h2>${h(title)}</h2><p>${eligible?'Your profile is eligible for matching while your verified records remain current. Each job still requires site checks and an accepted work order.':'Your records are safely stored. LiftCrew verifies qualifications, insurance and signatures separately before work becomes eligible.'}</p></div>
 <div class="dashboard-metrics"><article><strong>${p.equipment.length}</strong><span>Registered machines</span></article><article><strong>${p.operators.length}</strong><span>Listed operators</span></article><article><strong>${docs.filter(doc=>doc.active).length}</strong><span>Active documents</span></article></div>
 <section class="dashboard-section"><h3>Approval &amp; next steps</h3>
 ${eligible?`<div class="notice success">Provider clearance currently valid${clearance.validUntil?' through '+h(clearance.validUntil):''}. Final suitability, work order and any specialty authorization are verified for each job.</div>`:`<div class="notice"><strong>Not yet eligible for work.</strong>${(clearance?.blockers||[]).map(value=>'<p>• '+h(value)+'</p>').join('')||'<p>LiftCrew will review the submitted application.</p>'}</div>`}
 ${app.feedback?`<div class="provider-callout"><strong>Message from LiftCrew</strong><p>${h(app.feedback)}</p></div>`:''}
 </section>
 <section class="dashboard-section"><h3>Renewal &amp; readiness</h3>
 ${alerts.length?alerts.map(alert=>`<div class="dashboard-notice"><div><strong>${h(alert.days<=0?'Overdue or due today':alert.days+' days remaining')}</strong><div>${h(alert.label)}</div></div><span>${h(alert.date)}</span></div>`).join(''):'<p class="muted">No renewal dates are due in the next 45 days based on the records available here. Continue daily equipment checks and notify LiftCrew of relevant changes.</p>'}
 <p class="field-hint">Reminders are shown here; automated emails are not yet active. Review dates and coverage independently before dispatch.</p></section>
 <section class="dashboard-section"><h3>Manage your provider profile</h3><p class="muted">Keep details, rates and qualifications current. Reopening a submitted or approved application pauses eligibility until the changes are reviewed again.</p>
 <div class="dashboard-actions"><button class="btn secondary" type="button" data-reopen-step="business">Business &amp; service area</button><button class="btn secondary" type="button" data-reopen-step="equipment">Equipment &amp; rates</button><button class="btn secondary" type="button" data-reopen-step="operators">Operators</button><button class="btn secondary" type="button" data-reopen-step="insurance">Insurance &amp; records</button></div></section>
 <section class="dashboard-section"><h3>Insurance document review</h3><div id="insurance-review-status">${reviewHTML(clearance?.review,clearance?.reviewCurrent)}</div></section>
 <div class="provider-actions"><button type="button" class="btn secondary" data-refresh>Refresh approval status</button>${envelope?'<button type="button" class="btn secondary" data-agreement-download>Download signed agreement</button>':''}</div>
 <details class="dashboard-section"><summary>Your submitted application and files</summary>${renderRecord(p)}${docs.filter(doc=>doc.active).map(doc=>`<p><button type="button" class="text-btn" data-download="${h(doc.id)}">${h(doc.filename)}</button></p>`).join('')}</details>`;
}
function render(){
 if(!user||!app){authView();return;}
 root.removeAttribute('aria-busy');setHeaderSignedIn(true);
 const edit=editable(app),stage=stageForStep(stepIds[step]);
 const views={business:()=>businessView(p),equipment:()=>equipmentView(p),operators:()=>operatorsView(p),insurance:()=>insuranceView({docs,aiConsent,clearance}),documents:()=>documentsView(p,docs),agreement:contract,finish};
 const status=clearance?.eligible?'Approved':app.status==='declined'?'Not approved':app.status==='submitted'?'Verification pending':app.status==='changes_requested'?'Updates needed':'In progress';
 root.innerHTML=`${edit?(reviewer?'<div class="reviewer-link"><a href="/operator-review.html">Provider management</a></div>':''):`<div class="portal-heading"><h1>Provider dashboard</h1>${reviewer?'<a href="/operator-review.html" class="text-btn">Provider management</a>':''}</div>`}${notice()}
 ${edit?`<div class="application-layout"><aside class="step-sidebar"><nav class="stage-nav" aria-label="Onboarding categories">
 ${onboardingStages.map((group,stageIndex)=>`<button type="button" class="stage-link ${stageIndex===stage?'active':''}" data-step="${stepIds.indexOf(group.steps[0])}" ${stageIndex===stage?'aria-current="step"':''}>${h(group.label)}</button>`).join('')}
 </nav></aside>
 <form id="provider-form" class="application-card" novalidate>${stepIds[step]==='business'?'<h1 class="onboarding-title">Join the LiftCrew family</h1>':''}${views[stepIds[step]]()}<div class="form-actions"><button type="button" class="text-btn" data-back ${step===0?'disabled':''}>Back</button><div><span class="save-state">${dirty?'Unsaved changes':'Saved'}</span><button type="button" class="btn secondary" data-save>Save</button>${step<stepIds.length-1&&(stepIds[step]!=='agreement'||Boolean(envelope?.provider_signed_at))?'<button type="button" class="btn" data-next>'+(stepIds[step]==='agreement'?'Continue to submit':'Save &amp; continue')+'</button>':''}</div></div></form></div>`:statusPage()}`;
 bind();
}
function bind(){
 scheduleServiceArea();
 root.querySelectorAll('[data-field]').forEach(element=>element.oninput=()=>{set(element.dataset.field,element.value);if(element.dataset.field.startsWith('business.'))envelope=null;if(['business.entityType'].includes(element.dataset.field)||element.dataset.field.endsWith('.category')||element.dataset.field.endsWith('.fuel')){render();return;}const rateMatch=/^equipment\.(\d+)\.(hourlyRate|fourHourRate|dailyRate|radiusMilesOverride)$/.exec(element.dataset.field);if(rateMatch){const preview=root.querySelector('#rate-preview-'+rateMatch[1]);if(preview)preview.innerHTML=ratePreviewMarkup(p.equipment[Number(rateMatch[1])],p.business.radiusMiles);}if(element.dataset.field==='business.radiusMiles')root.querySelectorAll('.rate-preview').forEach((preview,index)=>preview.innerHTML=ratePreviewMarkup(p.equipment[index],p.business.radiusMiles));});
 root.querySelectorAll('[data-equipment-permission]').forEach(element=>element.onchange=()=>{const index=Number(element.dataset.equipmentPermission);p.operators[index].equipmentIds=[...root.querySelectorAll(`[data-equipment-permission="${index}"]:checked`)].map(input=>input.value);delete p.operators[index].equipmentTypes;markDirty();});
 root.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>run(()=>move(Number(button.dataset.step))));
 root.querySelectorAll('[data-fix]').forEach(button=>button.onclick=()=>run(()=>move(Number(button.dataset.fix))));
 root.querySelector('[data-back]')?.addEventListener('click',()=>run(()=>move(step-1)));
 root.querySelector('[data-next]')?.addEventListener('click',()=>run(()=>move(step+1)));
 root.querySelector('[data-save]')?.addEventListener('click',()=>run(async()=>{await save();message='Saved. You can return to complete onboarding.';render();}));
 root.querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>{const key=button.dataset.add;if(p[key].length>=20){fail(Error('Contact LiftCrew for fleets with more than 20 entries.'));return;}p[key].push({id:crypto.randomUUID(),...(key==='equipment'?{baseZip:p.business.zip||'',radiusMilesOverride:p.business.radiusMiles||25}:{equipmentIds:[]})});markDirty();render();});
 root.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{if(!confirm('Remove this entry? Its uploaded records are retained for audit.'))return;const [key,index]=button.dataset.remove.split(':');if(key==='equipment')removeEquipmentAssignments(p,p.equipment[Number(index)].id);p[key].splice(Number(index),1);markDirty();render();});
 root.querySelector('[data-prepare]')?.addEventListener('click',()=>run(prepareContract));
 root.querySelectorAll('[data-agreement-download]').forEach(button=>button.onclick=()=>saveAgreement(envelope));
 bindSignature();
 root.querySelector('[data-ai-consent]')?.addEventListener('change',event=>{aiConsent=event.target.checked;});
 root.querySelectorAll('[data-upload-button]').forEach(button=>button.onclick=()=>run(async()=>{
  const index=button.dataset.uploadButton,input=root.querySelector(`[data-upload="${index}"]`),files=[...input.files];
  if(!files.length)throw Error('Choose a file first.');files.forEach(validateFile);
  const packet=insuranceKinds.includes(input.dataset.kind);
  if(packet){validateInsuranceBatch(docs,files);p.insurance.inputMode='packet';markDirty();}
  await save();
  try{for(const file of files)docs.push(await uploadDocument(app,file,input.dataset.kind,input.dataset.entity,root.querySelector('#expiry-'+index)?.value||null));}finally{render();}
  message='Documents uploaded securely.';render();if(packet&&aiConsent)await startReview(false);
 }));
 root.querySelectorAll('[data-download]').forEach(button=>button.onclick=()=>run(()=>downloadDocument(docs.find(doc=>doc.id===button.dataset.download))));
 root.querySelectorAll('[data-delete]').forEach(button=>button.onclick=()=>run(async()=>{if(!confirm('Remove this document from the current application?'))return;const doc=docs.find(item=>item.id===button.dataset.delete);await removeDocument(app,doc);docs=docs.filter(item=>item.id!==doc.id);clearance=check(await db.rpc('provider_clearance',{p_application_id:app.id}));render();}));
 root.querySelector('[data-review-insurance]')?.addEventListener('click',()=>run(()=>startReview(true)));
 root.querySelector('[data-manual-review]')?.addEventListener('click',()=>{message='Your documents are saved. Complete the remaining steps and submit for LiftCrew review.';render();});
 root.querySelector('[data-refresh]')?.addEventListener('click',()=>run(load));
 root.querySelectorAll('[data-reopen-step]').forEach(button=>button.addEventListener('click',()=>run(async()=>{if(!confirm('Reopening will pause approval and job eligibility until LiftCrew reviews the changes again. Continue?'))return;check(await db.rpc('reopen_provider_application',{p_application_id:app.id}));const index=stepIds.indexOf(button.dataset.reopenStep);persistStep(sessionStorage,app.id,index<0?0:index);await load();})));
 root.querySelector('[data-reopen]')?.addEventListener('click',()=>run(async()=>{if(!confirm('Updating your application pauses work eligibility until the new details are approved. Continue?'))return;check(await db.rpc('reopen_provider_application',{p_application_id:app.id}));step=0;persistStep(sessionStorage,app.id,0);await load();}));

 root.querySelector('#provider-form')?.addEventListener('submit',event=>{event.preventDefault();if(stepIds[step]!=='finish')return;const form=new FormData(event.target);run(async()=>{const acknowledgements=Object.fromEntries(Object.keys(certifications).map(key=>[key,form.get('ack-'+key)==='on']));if(Object.values(acknowledgements).some(value=>!value))throw Error('Complete every application certification.');await save();check(await db.rpc('submit_operator_application',{application_id:app.id,typed_name:String(form.get('typed-name')||'').trim(),signer_title:String(form.get('signer-title')||'').trim(),acknowledgements}));await load();message='Application submitted. Your status will update here.';render();if(aiConsent)await startReview(false);});});
}
function bindSignature(){
 const scroller=root.querySelector('#contract-text'),sign=root.querySelector('[data-sign-contract]');if(!scroller||!sign)return;
 let reachedEnd=false;
 const update=()=>{reachedEnd||=scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-12;sign.disabled=!(reachedEnd&&root.querySelector('[name=read-contract]').checked&&root.querySelector('[name=esign-consent]').checked);root.querySelector('#scroll-status').textContent=reachedEnd?'End of agreement reached. Confirm your review and signing consent below.':'Scroll through the agreement to enable signing.';};
 scroller.onscroll=update;root.querySelector('[name=read-contract]').onchange=update;root.querySelector('[name=esign-consent]').onchange=update;requestAnimationFrame(update);
 sign.onclick=()=>run(async()=>{if(beforeAgreementIssues().length)throw Error('Complete the required information and documents before signing.');if(!reachedEnd)throw Error('Read the complete agreement first.');const name=root.querySelector('[name=signature]').value.trim(),title=root.querySelector('[name=signature-title]').value.trim();envelope=check(await db.rpc('sign_provider_contract',{p_envelope_id:envelope.id,p_name:name,p_title:title,p_read:root.querySelector('[name=read-contract]').checked,p_consent:root.querySelector('[name=esign-consent]').checked}));step=stepIds.indexOf('finish');persistStep(sessionStorage,app.id,step);message='Agreement signed. Review the final certifications and submit your application.';render();});
}

async function startReview(retry){
 if(!aiConsent)throw Error('Authorize AI processing above, or choose human review.');
 if(!hasInsurancePacket(docs))throw Error('Upload your insurance policy packet first.');
 await save();const {data,error}=await db.functions.invoke('insurance-review',{body:{applicationId:app.id,consent:true,retry}});
 if(error||!data?.reviewId)throw Error('Automated review could not start. Your documents are saved. Try again later or complete onboarding for human review.');
 clearance=check(await db.rpc('provider_clearance',{p_application_id:app.id}));const element=root.querySelector('#insurance-review-status');if(element)element.innerHTML=reviewHTML(clearance.review,clearance.reviewCurrent);pollReview(data.reviewId);
}
function stopPoll(){pollEpoch++;clearTimeout(pollTimer);pollTimer=null;}
function pollReview(id){
 stopPoll();const epoch=pollEpoch,applicationId=app.id,started=Date.now();
 const tick=async()=>{if(epoch!==pollEpoch||!user||app?.id!==applicationId)return;try{const result=check(await db.rpc('provider_clearance',{p_application_id:applicationId}));if(epoch!==pollEpoch||app?.id!==applicationId)return;clearance=result;envelope=result.envelope||envelope;const element=root.querySelector('#insurance-review-status');if(element)element.innerHTML=reviewHTML(result.review,result.reviewCurrent);if(!['queued','reading'].includes(result.review?.state)||Date.now()-started>180000)return;}catch{if(Date.now()-started>180000)return;}pollTimer=setTimeout(tick,2500);};
 pollTimer=setTimeout(tick,800);
}
function scheduleServiceArea(){
 clearTimeout(areaTimer);const version=++areaVersion,target=root.querySelector('#service-area-result');if(!target)return;
 const zip=String(p?.business?.zip||'').trim(),radius=Number(p?.business?.radiusMiles);
 if(!/^\d{5}$/.test(zip)||!Number.isFinite(radius)||radius<=0||radius>3000){target.textContent='Enter your home ZIP and a radius of up to 3,000 miles to calculate coverage.';return;}
 target.textContent='Calculating your service area…';
 areaTimer=setTimeout(async()=>{try{const key=zip+':'+radius;let result=areaCache.get(key);if(!result){result=check(await db.rpc('provider_service_area',{p_zip:zip,p_radius:radius}));areaCache.set(key,result);}if(version!==areaVersion||!target.isConnected)return;target.innerHTML=`<strong>${h(result.count)} ZIP codes within ${h(radius)} miles of ${h(result.city)}, ${h(result.state)}.</strong><details><summary>View covered ZIP codes</summary><p>${result.zips.map(h).join(', ')}</p></details>`;}catch(error){if(version===areaVersion&&target.isConnected)target.textContent=error.message||'Coverage could not be calculated. Check your ZIP or try again.';}},350);
}
function clearState(){stopPoll();clearTimeout(areaTimer);areaVersion++;areaCache.clear();user=null;app=null;p=null;docs=[];envelope=null;clearance=null;publishedAgreement=null;agreementPreviewError='';aiConsent=false;dirty=false;}
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{stopPoll();clearTimeout(areaTimer);areaVersion++;});
db.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){recovering=true;user=session?.user;mode='signup';queueMicrotask(authView);}if(event==='SIGNED_OUT'){clearState();queueMicrotask(authView);}});
headerSignout?.addEventListener('click',()=>run(async()=>{await save();check(await db.auth.signOut());clearState();mode='signin';authView();}));
try{const session=check(await db.auth.getSession());if(location.hash.includes('error_description'))throw Error(new URLSearchParams(location.hash.slice(1)).get('error_description'));if(!recovering&&session.session)await load();else authView();}catch(error){errorMessage=error.message;authView();}finally{root.removeAttribute('aria-busy');}
