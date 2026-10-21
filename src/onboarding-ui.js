import {coverage,escapeHtml as h} from './operator-data.js';
import {categories,insuranceSlots,providerSlots,reviewHTML} from './provider-ui.js';
import {equipmentLabel,insuranceFiles} from './onboarding-model.js';
import {defaultMachineRadius} from './onboarding-experience.js';
import {weeklyAvailabilityMarkup} from './operator-availability.js';

export function field(profile,path,label,type='text',options=null,optional=false){
 let value=path.split('.').reduce((object,key)=>object?.[key],profile)??'';
 if(path.endsWith('.radiusMilesOverride') && !String(value).trim())value=defaultMachineRadius(profile);
 const zip=path==='business.zip'||path.endsWith('.baseZip');
 const priceField=/\.(hourlyRate|fourHourRate|dailyRate)$/.test(path);
 const attributes=type==='number'?(priceField?'min="0.01" step="0.01" inputmode="decimal"':`min="0" step="any" ${path==='business.radiusMiles'?'max="3000"':''}`):zip?'inputmode="numeric" pattern="[0-9]{5}" maxlength="5"':'maxlength="300"';
 return `<label class="field"><span>${h(label)}${optional?' (optional)':''}</span>${options?`<select data-field="${path}"><option value="">Select…</option>${options.map(option=>`<option ${value===option?'selected':''}>${h(option)}</option>`).join('')}</select>`:type==='textarea'?`<textarea data-field="${path}" rows="3" maxlength="3000">${h(value)}</textarea>`:`<input data-field="${path}" type="${type}" value="${h(value)}" ${attributes}>`}</label>`;
}

export function businessView(profile){
 const f=(...args)=>field(profile,...args);
 return '<div class="form-grid">'+
 f('business.legalName','Legal business name')+
 f('business.dba','DBA / trade name','text',null,true)+
 f('business.entityType','Business structure','text',['Sole proprietor','LLC','Corporation','Partnership','Other'])+
 (profile.business.entityType==='Other'?f('business.entityTypeOther','Describe your business structure'):'')+
 f('business.formationState','State of formation / registration')+
 f('business.contactName','Primary contact full name')+
 f('business.email','Business / notices email','email')+
 f('business.phone','Business phone','tel')+
 f('business.address','Street address')+
 f('business.city','City')+
 f('business.state','State')+
 f('business.zip','Business ZIP code')+
 f('business.emergencyName','Emergency / dispatch contact')+
 f('business.emergencyPhone','Emergency / dispatch phone','tel')+
 f('business.website','Website','url',null,true)+
 '</div><div class="business-wide-field">'+f('business.serviceArea','Travel restrictions / service notes','textarea',null,true)+'</div>'+
 weeklyAvailabilityMarkup(profile.business,h);
}

export function equipmentView(profile){
 const f=(...args)=>field(profile,...args);
 return `<h2>Your equipment</h2>${profile.equipment.map((equipment,index)=>{const prefix=`equipment.${index}`;const ef=(key,...args)=>f(prefix+'.'+key,...args);const specKeys=['capacity','liftHeight','widthIn','heightIn','weightLb','fuel','tires','attachments','transport','inspectionDate','availability','replacementValue'];const specsComplete=specKeys.every(key=>String(equipment[key]??'').trim())&&String(equipment[equipment.category==='Crane'?'workingRadiusFt':'loadCenter']??'').trim();return `<section class="record"><div class="record-heading"><h3>Machine ${index+1}</h3><button type="button" class="text-btn danger" data-remove="equipment:${index}">Remove</button></div><div class="form-grid">${ef('category','Equipment category','text',categories)}${equipment.category==='Other'?ef('categoryOther','Describe this equipment category'):''}${ef('make','Manufacturer')}${ef('model','Model')}${ef('serial','Serial number')}${ef('year','Model year','number',null,true)}${ef('ownership','Ownership','text',['Owned','Leased','Rented'])}</div><details class="equipment-details" ${specsComplete?'':'open'}><summary>Equipment specifications &amp; safety details · required</summary><p class="field-hint">Capacity, inspection and equipment readiness must be supported by records. A registration does not replace daily pre-use checks or job-specific assessment.</p><div class="form-grid">${ef('capacity','Rated capacity with stated configuration (lb)','number')}${equipment.category==='Crane'?ef('workingRadiusFt','Working radius for stated crane capacity (ft)','number'):ef('loadCenter','Load center for stated capacity (in)','number')}${ef('liftHeight','Maximum lift height (ft)','number')}${ef('reachFt','Maximum forward reach (ft)','number',null,true)}${ef('widthIn','Machine width (in)','number')}${ef('heightIn','Travel / stowed height (in)','number')}${ef('weightLb','Machine operating weight (lb)','number')}${ef('fuel','Fuel / power','text',['Diesel','Propane','Electric','Gasoline','Other'])}${equipment.fuel==='Other'?ef('fuelOther','Describe fuel / power source'):''}${ef('tires','Tires and suitable surfaces')}${ef('attachments','Attachments / configuration (or None)')}${ef('replacementValue','Replacement value including attachments ($)','number')}${ef('availability','Availability and notice required')}${ef('inspectionDate','Last inspection date','date')}${ef('nextInspectionDue','Next scheduled inspection / service date','date',null,true)}${ef('transport','Delivery arrangement','text',['Self-delivery','Third-party hauler','LiftCrew coordination requested'])}${ef('transportDetails','Delivery / hauler details','textarea',null,true)}${ef('limitations','Access, terrain and load restrictions','textarea',null,true)}</div></details><div class="equipment-rate-heading"><h3>Machine location &amp; pricing</h3></div><div class="form-grid">${ef('baseZip','Machine ZIP code')}<div class="machine-radius-field">${ef('radiusMilesOverride','Service radius for this machine (miles)','number')}<p class="field-hint">From this machine’s ZIP (ZIP-center estimate). First 25 miles included; beyond that, $2 per excess round-trip mile. Driving distance is confirmed before dispatch.</p></div>${ef('hourlyRate','Hourly rate ($)','number')}${ef('fourHourRate','4-hour rate ($)','number')}${ef('dailyRate','Daily rate ($)','number')}</div>${equipment.category==='Crane'?'<div class="provider-callout">Crane inventory can be registered. Crane assignments require a separate specialty agreement and lift-specific review; the forklift agreement does not authorize crane work.</div>':''}${equipment.category==='Other'?'<div class="provider-callout">Other equipment requires specialty review and is excluded from automatic forklift matching.</div>':''}</section>`;}).join('')}<button type="button" class="btn secondary" data-add="equipment">${profile.equipment.length?'Add another machine':'Add equipment'}</button>`;
}

export function equipmentOptions(profile,index){
 const operator=profile.operators[index],selected=new Set(operator.equipmentIds||[]);
 if(!profile.equipment.length)return '<p class="notice">Add equipment in the previous step before assigning operators.</p>';
 return `<fieldset class="equipment-permissions"><legend>Equipment this operator is authorized to use</legend><p class="field-hint">Select all applicable machines. Training and practical evaluation records must support these selections.</p>${profile.equipment.map((equipment,i)=>`<label class="check"><input type="checkbox" data-equipment-permission="${index}" value="${h(equipment.id)}" ${selected.has(equipment.id)?'checked':''}><span><strong>${h(equipmentLabel(equipment,i))}</strong><small>${h([equipment.category,equipment.serial?'Serial '+equipment.serial:''].filter(Boolean).join(' · '))}</small></span></label>`).join('')}${operator.equipmentTypes&&!operator.equipmentIds?.length?'<p class="field-hint">Replace your previous equipment description with the machine selections above.</p>':''}</fieldset>`;
}

export function operatorsView(profile){
 const f=(...args)=>field(profile,...args);
 return `<h2>Your operators</h2><p class="field-hint">Provide qualification and evaluation records for the machines each operator uses.</p>${profile.operators.map((operator,index)=>{const of=(key,...args)=>f(`operators.${index}.${key}`,...args);return `<section class="record"><div class="record-heading"><h3>Operator ${index+1}</h3><button type="button" class="text-btn danger" data-remove="operators:${index}">Remove</button></div><div class="form-grid">${of('name','Full name')}${of('relationship','Relationship to the business','text',['Working owner','Employee','Proposed subcontractor'])}</div>${equipmentOptions(profile,index)}<div class="form-grid">${of('trainingDate','Training date','date')}${of('trainer','Trainer / organization')}${of('evaluationDate','Practical evaluation date','date')}${of('evaluator','Evaluator / organization')}${of('adult','At least 18 years old?','text',['yes','no'])}${of('restrictions','Equipment qualification limitations','textarea',null,true)}</div></section>`;}).join('')}<button type="button" class="btn secondary" data-add="operators">${profile.operators.length?'Add another operator':'Add an operator'}</button>`;
}

export function uploadSlot(docs,[kind,id,title,hint],index){
 const packet=kind==='insurance_packet';
 const files=packet?insuranceFiles(docs):docs.filter(doc=>doc.active&&doc.kind===kind&&doc.entity_id===id);
 return `<section class="upload-slot"><div class="upload-top"><h3>${h(title)}</h3><span class="tag ${files.length?'good':''}">${files.length?`${files.length} uploaded`:'Required'}</span></div><p class="field-hint">${h(hint)}</p>${files.map(doc=>`<div class="file-row"><button type="button" class="text-btn file-name" data-download="${doc.id}">${h(doc.filename)}</button><span>${(doc.bytes/1048576).toFixed(1)} MB</span><button type="button" class="text-btn danger" data-delete="${doc.id}">Remove</button></div>`).join('')}<div class="upload-inputs"><label class="field"><span>Choose document(s)</span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" data-upload="${index}" data-kind="${kind}" data-entity="${h(id)}"></label>${packet?'':`<label class="field"><span>Expiration (if applicable)</span><input type="date" id="expiry-${index}"></label>`}<button type="button" class="btn secondary" data-upload-button="${index}">Upload</button></div></section>`;
}

export function applicantReviewStatusHTML(review,current=true){
 // Omit stale/no-result notices from the applicant form without changing server review/eligibility.
 if(!review||current===false||review.state==='stale')return '';
 return reviewHTML(review,current);
}

export function insuranceView({docs,aiConsent,clearance}){
 const review=applicantReviewStatusHTML(clearance?.review,clearance?.reviewCurrent);
 return '<h2>Insurance Requirements</h2>'+
  '<div class="insurance-requirements"><dl>'+coverage.map(([key,label,minimum])=>
   '<div><dt>'+h(label)+'</dt><dd>'+h(minimum)+(key==='cgl'?'; $2M completed operations aggregate':'')+'</dd></div>').join('')+
  '</dl></div>'+
  '<div class="insurance-packet">'+uploadSlot(docs,insuranceSlots[0],'insurance')+'</div>'+
  '<label class="check insurance-consent"><input type="checkbox" data-ai-consent '+(aiConsent?'checked':'')+'><span>I authorize LiftCrew to review my insurance documents as described in the <a href="/operator-privacy.html" target="_blank" rel="noopener">privacy notice</a>.</span></label>'+
  '<div class="provider-actions"><button type="button" class="btn" data-review-insurance>Submit insurance for review</button></div>'+
  '<div id="insurance-review-status" aria-live="polite">'+review+'</div>';
}

export function documentsView(profile,docs){
 return `<h2>Supporting documents</h2>${providerSlots(profile).slice(insuranceSlots.length).map((slot,index)=>uploadSlot(docs,slot,index)).join('')}`;
}
