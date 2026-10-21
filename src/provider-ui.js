import {escapeHtml as h,documentSlots} from './operator-data.js';
import {authorizationErrors} from './onboarding-model.js';
import {weeklyAvailabilityErrors} from './operator-availability.js';
export const insuranceSlots=[['insurance_packet','','Insurance policy packet','Upload current insurance policies, certificates and required endorsements.']];
export const categories=['Warehouse forklift','Rough-terrain forklift','Telehandler','Crane','Other'];
export function providerSlots(profile){return [...insuranceSlots,...documentSlots(profile).filter(([kind])=>!['coi','endorsements','handling'].includes(kind))];}
export function extraProfileErrors(profile,section=null){
 const errors=[];
 const required=(object,keys,label)=>keys.forEach(key=>{if(!String(object?.[key]??'').trim())errors.push(`${label}: ${key.replace(/[A-Z]/g,letter=>' '+letter.toLowerCase())}`);});
 if(!section||section==='business'){
 required(profile.business,['legalName','entityType','formationState','address','city','state','zip','contactName','email','phone','radiusMiles','emergencyName','emergencyPhone','availability'],'Business');
 if(!/^\d{5}$/.test(profile.business?.zip||''))errors.push('Enter a five-digit home / business ZIP');
 if(!(Number(profile.business?.radiusMiles)>0&&Number(profile.business.radiusMiles)<=3000))errors.push('Enter a service radius greater than zero and no more than 3,000 miles');
 if(profile.business?.entityType==='Other'&&!String(profile.business.entityTypeOther??'').trim())errors.push('Describe your other business structure');
 errors.push(...weeklyAvailabilityErrors(profile.business));
 }
 if(!section||section==='equipment'){
 if(!profile.equipment?.length)errors.push('Add your equipment');
 for(const equipment of profile.equipment||[]){
  required(equipment,['category','make','model','serial','ownership','fuel','tires','attachments','transport','inspectionDate','baseZip','availability','replacementValue','widthIn','heightIn','weightLb'],'Equipment');
  if(equipment.category==='Other'&&!String(equipment.categoryOther??'').trim())errors.push('Describe the other equipment category');
  if(equipment.fuel==='Other'&&!String(equipment.fuelOther??'').trim())errors.push('Describe the other fuel or power source');
  for(const key of ['capacity','liftHeight','replacementValue','widthIn','heightIn','weightLb'])if(!(Number(equipment[key])>0))errors.push(`Equipment ${key} must be positive`);
  if(!/^\d{5}$/.test(equipment.baseZip||''))errors.push('Enter a five-digit equipment ZIP code');
  const radius=String(equipment.radiusMilesOverride??profile.business?.radiusMiles??'').trim();if(!/^\d+(\.\d+)?$/.test(radius)||Number(radius)<=0||Number(radius)>3000)errors.push('Enter a service radius for each machine between 1 and 3,000 miles');
  if(equipment.inspectionDate&&equipment.inspectionDate>new Date().toISOString().slice(0,10))errors.push('Equipment inspection date cannot be in the future');
  if(equipment.nextInspectionDue&&equipment.inspectionDate&&equipment.nextInspectionDue<equipment.inspectionDate)errors.push('Next scheduled equipment inspection cannot be before the last inspection');
  for(const key of ['hourlyRate','fourHourRate','dailyRate']){const rate=String(equipment[key]??'').trim();if(!/^\d+(\.\d{1,2})?$/.test(rate)||Number(rate)<=0||Number(rate)>100000)errors.push('Enter a valid '+key.replace(/[A-Z]/g,c=>' '+c.toLowerCase())+' between $0.01 and $100,000');}
  if(['Warehouse forklift','Rough-terrain forklift','Telehandler'].includes(equipment.category)&&!(Number(equipment.loadCenter)>0))errors.push('Forklift load center must be positive');
  if(equipment.category==='Crane'&&!(Number(equipment.workingRadiusFt)>0))errors.push('Crane working radius must be positive');
 }
 }
 if(!section||section==='operators'){
 if(!profile.operators?.length)errors.push('Add an operator');
 for(const operator of profile.operators||[]){required(operator,['name','relationship','trainingDate','trainer','evaluationDate','evaluator'],'Operator');if(operator.adult!=='yes')errors.push('Confirm each operator is at least 18');for(const key of ['trainingDate','evaluationDate'])if(operator[key]&&operator[key]>new Date().toISOString().slice(0,10))errors.push('Operator '+key+' cannot be in the future');}
 errors.push(...authorizationErrors(profile));
 }
 return [...new Set(errors)];
}
export function reviewHTML(review,current=true){
 if(!review)return '<p class="notice">Upload your insurance packet to start the document review.</p>';
 if(!current||review.state==='stale')return '<p class="notice">The application or insurance packet changed. Run a new review of the current records.</p>';
 if(['queued','reading'].includes(review.state)){
  const late=Date.now()-Date.parse(review.created_at)>180000;
  return `<div class="review-progress" role="status"><span class="${late?'':'review-spinner'}" aria-hidden="true"></span><div><strong>${late?'Review needs assistance':'Reviewing your insurance'}</strong><p>${late?'This review did not finish in time. Your uploads are saved. Retry or submit for manual review; no denial was issued.':'Checking the actual documents, coverage dates, limits and endorsements. You may stay here; this screen updates automatically.'}</p></div></div>`;
 }
 const result=review.result||{},all=result.checks||[],attention=all.filter(check=>check.status!=='pass');
 const row=check=>`<div class="review-check ${h(check.status)}"><strong>${h(check.label)}</strong><span class="tag">${check.status==='pass'?'Documented':check.status==='fail'?'Needs correction':'Needs verification'}</span><p>${h(check.message)}</p>${check.evidence?.length?`<details><summary>Document evidence</summary>${check.evidence.map(evidence=>`<p>Page ${h(evidence.page)} · document ${h(evidence.documentId.slice(0,8))}<br>“${h(evidence.quote)}”</p>`).join('')}</details>`:''}</div>`;
 return `<div class="notice ${result.outcome==='needs_changes'?'error':result.outcome==='document_pass'?'success':''}" role="status"><strong>${result.outcome==='needs_changes'?'Not approved yet — updates needed':result.outcome==='document_pass'?'Insurance document checks passed':'Manual verification needed'}</strong><p>${h(result.message||'LiftCrew will review your documents. This is not an automatic denial.')}</p></div>${attention.map(row).join('')}${all.some(check=>check.status==='pass')?`<details><summary>${all.filter(check=>check.status==='pass').length} documented checks passed</summary>${all.filter(check=>check.status==='pass').map(row).join('')}</details>`:''}${result.manualChecks?.length?`<details><summary>What LiftCrew still verifies</summary>${result.manualChecks.map(text=>`<p>${h(text)}</p>`).join('')}</details>`:''}<p class="field-hint">${h(result.rulesVersion||'')} · ${review.completed_at?h(new Date(review.completed_at).toLocaleString()):''}. Document review is not an insurer authenticity check or authorization to dispatch.</p>`;
}
export function envelopeRecord(envelope){return `${envelope.body}\n\nSIGNATURE AUDIT\nDocument SHA-256: ${envelope.sha256}\nEnvelope: ${envelope.id}\nProvider: ${envelope.provider_name||'Not signed'}, ${envelope.provider_title||''}\nProvider signed: ${envelope.provider_signed_at||'Not signed'}\nAuthenticated provider account: ${envelope.provider_user_id||''}\nElectronic consent: ${envelope.consent_version||''}\nLiftCrew: ${envelope.liftcrew_name||'Not signed'}, ${envelope.liftcrew_title||''}\nLiftCrew signed: ${envelope.liftcrew_signed_at||'Not signed'}\nAuthenticated LiftCrew account: ${envelope.liftcrew_user_id||''}\n`;}
export function saveAgreement(envelope){const url=URL.createObjectURL(new Blob([envelopeRecord(envelope)],{type:'text/plain;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download=`LiftCrew-Agreement-${envelope.id}.txt`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
