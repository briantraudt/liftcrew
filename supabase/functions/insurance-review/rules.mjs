export const RULES_VERSION = 'schedule-a-v2-2026-10-12';
export const INSURANCE_KINDS = ['coi','declarations','endorsements','handling','owner_coverage','equipment_coverage'];
export const POLICY_KINDS = ['cgl','auto','wc','employers','umbrella','handling','equipment'];
const money = n => '$' + Number(n).toLocaleString('en-US');
const normalize = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
export function requirements(profile = {}) {
 const load = Number(profile.insurance?.maximumLoadValue);
 const equipmentValue = (profile.equipment || []).reduce((sum,e) => sum + (Number(e.replacementValue) || 0),0);
 const numeric = [
  ['cgl_occurrence','CGL each occurrence',1000000],['cgl_aggregate','CGL general aggregate',2000000],['cgl_completed','CGL products / completed operations aggregate',2000000],
  ['auto_csl','Auto combined single limit',1000000],['el_accident','Employers liability each accident',1000000],['el_disease_policy','Employers liability disease policy limit',1000000],['el_disease_employee','Employers liability disease each employee',1000000],
  ['umbrella_occurrence','Umbrella each occurrence',2000000],['umbrella_aggregate','Umbrella aggregate',2000000],['handling_limit','Property being handled',Math.max(250000,load || 0)],['equipment_limit','Equipment physical damage / scheduled replacement values',equipmentValue]
 ].map(([key,label,min])=>({key,label,min,type:'number',requirement:`At least ${money(min)}`}));
 const boolean = [
  ['cgl_occurrence_form','CGL is on an occurrence form'],['cgl_operations','Actual forklift operations, insured-contract liability, independent contractors and separation of insureds are covered'],
  ['auto_scope','Owned, hired and nonowned autos and actual hauler are covered'],['auto_loading','Auto/CGL loading and unloading coverage has no identified gap'],
  ['wc_statutory','Statutory workers compensation covers assigned personnel'],['working_owners','All working owners are covered; an occupational accident policy is not a substitute'],
  ['umbrella_scope','Umbrella follows CGL, auto and employers liability and required additional insureds'],
  ['handling_operations','Handling terms explicitly cover loading, unloading, lifting, moving and positioning'],['handling_sublimits','No care/custody/control, loading, overload or subcontracting limitation defeats the required handling coverage'],
  ['equipment_scope','Owned, leased/rented equipment and attachments have appropriate transit, overnight storage, theft and overturn coverage'],
  ['additional_insured_ongoing','Actual additional-insured endorsement covers LiftCrew exact legal entity for ongoing operations'],['additional_insured_completed','Actual additional-insured endorsement covers LiftCrew exact legal entity for completed operations'],
  ['additional_insured_auto_excess','Auto and excess extend the appropriate insured status'],['primary_noncontributory','Required additional-insured coverage is primary and noncontributory'],
  ['waiver_cgl_auto_wc','Required lawful insurer-approved subrogation waivers are provided on CGL, auto and workers compensation'],
  ['equipment_waiver','Equipment subrogation waiver is provided where available; otherwise requires a signed exception'],
  ['blanket_conditions','Any blanket additional-insured endorsement conditions are actually satisfied']
 ].map(([key,label])=>({key,label,type:'boolean',requirement:'Supported by actual policy wording / endorsement, not a certificate checkbox'}));
 return [...numeric,...boolean,{key:'maximum_retention',label:'Largest deductible / retention',type:'maximum',max:10000,requirement:'No more than $10,000 without a written risk exception'}];
}
const evidenceSchema = {type:'array',items:{type:'object',additionalProperties:false,properties:{documentId:{type:'string'},page:{type:'integer'},quote:{type:'string'}},required:['documentId','page','quote']}};
export const extractionSchema = {type:'object',additionalProperties:false,properties:{
 documents:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:{type:'string'},readable:{type:'boolean'},insuranceDocument:{type:'boolean'}},required:['id','readable','insuranceDocument']}},
 policies:{type:'array',items:{type:'object',additionalProperties:false,properties:{coverage:{type:'string',enum:POLICY_KINDS},carrier:{type:['string','null']},policyNumber:{type:['string','null']},namedInsured:{type:['string','null']},effectiveDate:{type:['string','null']},expirationDate:{type:['string','null']},confidence:{type:'number'},evidence:evidenceSchema},required:['coverage','carrier','policyNumber','namedInsured','effectiveDate','expirationDate','confidence','evidence']}},
 findings:{type:'array',items:{type:'object',additionalProperties:false,properties:{key:{type:'string'},value:{type:['number','boolean','string','null']},confidence:{type:'number'},evidence:evidenceSchema},required:['key','value','confidence','evidence']}},
 warnings:{type:'array',items:{type:'string'}}
},required:['documents','policies','findings','warnings']};
export function validDate(s) {
 if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
 const d = new Date(s + 'T00:00:00Z');
 return Number.isFinite(+d) && d.toISOString().slice(0,10) === s;
}
function cited(row,ids) {
 return Number.isFinite(row?.confidence) && row.confidence >= .95 && row.confidence <= 1 && Array.isArray(row.evidence) && row.evidence.length > 0 && row.evidence.every(e => ids.has(e.documentId) && Number.isInteger(e.page) && e.page >= 1 && e.page <= 500 && typeof e.quote === 'string' && e.quote.trim().length >= 8 && e.quote.length <= 1500);
}
export function evaluateInsurance(extraction,profile,manifest,today = new Date().toISOString().slice(0,10)) {
 if (!validDate(today)) throw Error('Invalid review date');
 const packet = Array.isArray(manifest) ? manifest.filter(d=>INSURANCE_KINDS.includes(d.kind)) : [];
 const ids = new Set(packet.map(d=>d.id));
 const checks = []; const expiries = [];
 const add=(key,label,status,message,evidence=[])=>checks.push({key,label,status,message,evidence});
 for(const kind of INSURANCE_KINDS) if(!packet.some(d=>d.kind===kind)) add('document_'+kind,kind.replaceAll('_',' '),'fail','Upload this required insurance section. A combined packet can be uploaded in the relevant sections.');
 for(const doc of packet) {
  const matches = extraction?.documents?.filter(d=>d.id===doc.id) || [];
  if(matches.length!==1 || !matches[0].readable || !matches[0].insuranceDocument) add('readable_'+doc.id,doc.filename,'unknown','This file could not be confidently read as an insurance document. Upload a clear, complete PDF or request manual review.');
 }
 for(const kind of POLICY_KINDS) {
  const matches = extraction?.policies?.filter(p=>p.coverage===kind) || [];
  const p = matches[0];
  if(matches.length!==1 || !cited(p,ids) || !p.carrier || !p.policyNumber || !p.namedInsured || !validDate(p.effectiveDate) || !validDate(p.expirationDate)) {
   add('policy_'+kind,kind.toUpperCase()+' policy','unknown','Provide clear declarations showing legal insured, carrier, policy number, effective date and expiration. Conflicting policies require manual review.'); continue;
  }
  let status='pass',message=`${p.carrier}: effective ${p.effectiveDate}; expires ${p.expirationDate}.`;
  if(p.expirationDate<=today || p.effectiveDate>today || p.expirationDate<=p.effectiveDate) {status='fail';message='The documented policy is expired, not yet effective, or has inconsistent dates. Upload current coverage.';}
  if(normalize(p.namedInsured)!==normalize(profile.business?.legalName)) {status='unknown';message='The named insured does not exactly match your legal business name. Supply the legal-name/DBA endorsement or request broker verification.';}
  const declared=profile.insurance?.[kind];
  if(declared?.policy && normalize(declared.policy)!==normalize(p.policyNumber)) {status='unknown';message='The uploaded policy number differs from your application. Correct the policy details or upload the matching declarations.';}
  if(declared?.expiry && declared.expiry!==p.expirationDate) {status='unknown';message='The uploaded expiration differs from the date you entered. Correct the date or upload the current policy.';}
  // A name mismatch never hides an objectively expired policy.
  if(p.expirationDate<=today || p.effectiveDate>today || p.expirationDate<=p.effectiveDate) {status='fail';message='Current coverage is required. This policy is expired, not yet active, or has invalid dates.';}
  expiries.push(p.expirationDate);add('policy_'+kind,kind.toUpperCase()+' policy',status,message,p.evidence);
 }
 if(!(Number(profile.insurance?.maximumLoadValue)>0)) add('load_value','Maximum property value','unknown','Enter the maximum total replacement value exposed on a single job.');
 if(!(profile.equipment?.length) || profile.equipment.some(e=>!(Number(e.replacementValue)>0))) add('equipment_value','Equipment replacement value','unknown','Enter a replacement value for every machine.');
 for(const rule of requirements(profile)) {
  const rows=extraction?.findings?.filter(f=>f.key===rule.key)||[];const f=rows[0];
  if(rows.length!==1 || !cited(f,ids) || f.value===null) {add(rule.key,rule.label,'unknown',rule.requirement+'. Evidence is missing, unclear or conflicting; upload the actual terms or request manual review.');continue;}
  let ok;
  if(rule.type==='boolean') ok=typeof f.value==='boolean'?f.value:null;
  else ok=typeof f.value==='number' && Number.isFinite(f.value) && f.value>=0 ? (rule.type==='maximum'?f.value<=rule.max:f.value>=rule.min) : null;
  add(rule.key,rule.label,ok===null?'unknown':ok?'pass':'fail',`${rule.requirement}. ${ok===true?'Documented requirement met.':ok===false?'The document does not meet this requirement. Ask your broker to correct the coverage; exceptions need separate written approval.':'A clear numeric limit or explicit policy term is required.'}`,f.evidence);
 }
 if(extraction?.warnings?.length) add('packet_warnings','Policy restrictions / discrepancies','unknown',extraction.warnings.slice(0,10).map(String).join(' ').slice(0,3000));
 const outcome=checks.some(c=>c.status==='fail')?'needs_changes':checks.some(c=>c.status==='unknown')?'manual_review':'document_pass';
 return {rulesVersion:RULES_VERSION,outcome,checks,validUntil:expiries.length===POLICY_KINDS.length?expiries.sort()[0]:null,reviewedAt:new Date().toISOString(),independentVerificationRequired:true,
  message:outcome==='needs_changes'?'Not approved yet. Correct the items below and resubmit.':outcome==='manual_review'?'A person needs to verify the unclear items. This is not a denial.':'Insurance document checks passed. LiftCrew must complete independent verification and countersign before work is enabled.',
  manualChecks:['Confirm the policy is genuine and remains in force directly with the broker/insurer using an independently verified contact.','Verify insurer authorization, current AM Best A-/VII or written exception, depleted aggregates, exclusions, retentions and required notices.','Verify working-owner arrangements, any claims-made retroactive date/tail, completed-operations duration and specialty exceptions.','Before each work order confirm client/site insured names, actual load value, machine capacity/configuration and any required crane/specialty rider.']};
}
