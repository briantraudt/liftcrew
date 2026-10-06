export const coverage = [
 ['cgl','General liability','$1M occurrence / $2M aggregate'],['auto','Auto liability','$1M combined single limit'],['wc','Workers’ compensation','Statutory; disclose working-owner exclusions'],['employers','Employers’ liability','$1M each accident / disease'],['umbrella','Umbrella / excess','$2M occurrence and aggregate'],['handling','Property being handled','Greater of $250K or maximum exposed replacement value'],['equipment','Equipment physical damage','Adequate equipment replacement values']
];
export const acknowledgements = {
 accurate:'The information and documents I provide are accurate and current. I will promptly report changes, incidents, coverage lapses and disqualifying conditions.',
 authority:'I am authorized to apply for this business and share the personnel and business records included here.',
 safety:'Our operators must be qualified for the equipment and workplace, follow capacity limits and inspection requirements, and stop unsafe work. Approval never replaces site-specific assessment or employer duties.',
 privacy:'I have read the application privacy notice and authorize LiftCrew to verify these records with the contacts I identify for application review.',
 terms:'I have received and reviewed the provider agreement draft and its proposed insurance requirements. This application does not execute that draft, guarantee work or authorize dispatch. A completed agreement, required approvals and an accepted work order are required before work.',
 electronic:'I agree to submit this application and its certifications electronically under my typed name. I can access, download and retain the linked documents and print this application.'
};
export const emptyProfile=()=>({business:{},equipment:[{id:crypto.randomUUID()}],operators:[{id:crypto.randomUUID()}],insurance:{}});
export const editable=a=>['draft','changes_requested'].includes(a?.status);
export const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function documentSlots(p){
 const slots=[['w9','','Business W-9','Upload the signed tax form here only.'],['coi','','Insurance certificate + declarations','Include named insured, policy numbers, limits and dates.'],['endorsements','','Insurance endorsements','Additional insured, primary/noncontributory and waiver of subrogation forms; disclose unavailable items.'],['handling','','Handling coverage policy sections','Include coverage, exclusions, deductibles and relevant sublimits.']];
 for(const e of p.equipment||[]){const n=[e.make,e.model,e.serial].filter(Boolean).join(' · ')||'Machine';for(const [k,l,h] of [['equipment_photo','Equipment photos','Show the machine and attachments.'],['capacity_plate','Capacity plate','A legible plate for the actual attachment configuration.'],['inspection','Inspection / maintenance records','Most recent inspection and maintenance evidence.']])slots.push([k,e.id,n+' — '+l,h]);if(e.ownership&&e.ownership!=='Owned')slots.push(['lease',e.id,n+' — Lease / permission','Include authorization to subcontract and use the equipment.']);}
 for(const o of p.operators||[]){const n=o.name||'Operator';slots.push(['training',o.id,n+' — Training record','Identify the operator, training date and trainer.'],['evaluation',o.id,n+' — Practical evaluation','Include evaluation date, evaluator and equipment type. A training card alone is insufficient.']);}
 if(p.equipment?.some(e=>e.transport==='Self-delivery'))slots.push(['transport','','Transport qualifications','Applicable driver/hauler credentials, registration and permits. Redact unnecessary personal identifiers.']);
 return slots;
}
export function missingItems(p,docs=[]){
 const items=[];const need=(obj,keys,label)=>keys.forEach(k=>{if(!String(obj?.[k]??'').trim())items.push(label+' — '+k.replace(/[A-Z]/g,c=>' '+c.toLowerCase()));});
 need(p.business,['legalName','entityType','formationState','address','contactName','phone','serviceArea','emergencyName','emergencyPhone','availability'],'Business');
 if(!p.equipment?.length)items.push('Add a machine');
 for(const e of p.equipment||[])need(e,['make','model','serial','ownership','capacity','loadCenter','liftHeight','fuel','tires','attachments','transport','inspectionDate'],e.model||'Equipment');
 if(!p.operators?.length)items.push('Add an operator');
 for(const o of p.operators||[]){need(o,['name','relationship','equipmentTypes','trainingDate','evaluationDate','trainer','evaluator'],'Operator');if(o.adult!=='yes')items.push('Confirm each operator is at least 18');}
 need(p.insurance,['brokerName','brokerEmail','brokerPhone','workingOwners','exceptions'],'Insurance');
 for(const [k,l] of coverage)need(p.insurance?.[k],['carrier','policy','limit','expiry'],l);
 for(const [kind,id,title] of documentSlots(p))if(!docs.some(d=>d.active&&d.kind===kind&&d.entity_id===id))items.push(title);
 return [...new Set(items)];
}
export function renewalIssues(p,docs=[]){
 const today=new Date().toISOString().slice(0,10), cutoff=new Date();cutoff.setUTCFullYear(cutoff.getUTCFullYear()-3);
 const issues=[];
 for(const [k,l] of coverage)if(p.insurance?.[k]?.expiry&&p.insurance[k].expiry<today)issues.push(l+' has expired');
 for(const o of p.operators||[])if(o.evaluationDate&&o.evaluationDate<cutoff.toISOString().slice(0,10))issues.push((o.name||'Operator')+' needs a current evaluation');
 for(const d of docs)if(d.active&&d.expires_on&&d.expires_on<today)issues.push(d.filename+' has expired');
 return issues;
}
export function validateFile(file){
 const types={'application/pdf':['pdf'],'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp']};
 if(!types[file.type]?.includes(file.name.split('.').pop().toLowerCase()))throw Error('Choose a PDF, JPG, PNG or WebP file.');
 if(!file.size||file.size>10*1024*1024)throw Error('Files must be between 1 byte and 10 MB.');
 if(file.name.length>200)throw Error('Use a filename shorter than 200 characters.');
 return {'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
}
export function renderRecord(value){
 if(Array.isArray(value))return value.map((v,i)=>`<section class="record"><h3>Entry ${i+1}</h3>${renderRecord(v)}</section>`).join('');
 if(value&&typeof value==='object')return `<div class="table-scroll"><table>${Object.entries(value).filter(([k])=>k!=='id').map(([k,v])=>`<tr><th scope="row">${escapeHtml(({dba:'DBA',wc:'Workers’ compensation',cgl:'General liability',auto:'Auto liability',employers:'Employers’ liability',umbrella:'Umbrella / excess',handling:'Property being handled',adult:'At least 18 years old',capacity:'Rated capacity (lb)',loadCenter:'Load center (in)',liftHeight:'Maximum lift height (ft)'})[k]||k.replace(/[A-Z]/g,c=>' '+c.toLowerCase()).replace(/^./,c=>c.toUpperCase()))}</th><td>${v&&typeof v==='object'?renderRecord(v):escapeHtml(typeof v==='boolean'?(v?'Yes':'No'):v||'—')}</td></tr>`).join('')}</table></div>`;
 return escapeHtml(value);
}
