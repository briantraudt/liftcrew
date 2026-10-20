import {INSURANCE_KINDS as legacyKinds,evaluateInsurance as evaluateCore} from './rules-core.mjs';
export {POLICY_KINDS,requirements,extractionSchema,validDate} from './rules-core.mjs';
export const RULES_VERSION='schedule-a-v3-single-packet-job-value-at-dispatch-2026-10-20';
export const INSURANCE_KINDS=['insurance_packet',...legacyKinds];

/**
 * Upload classification is not coverage evidence. A combined packet is read once,
 * and all policy, dates, limits, named-insured and endorsement checks still run.
 * Only the old requirement to populate six separate upload slots is replaced.
 */
export function evaluateInsurance(extraction,profile,manifest,today=new Date().toISOString().slice(0,10)){
 const documents=(Array.isArray(manifest)?manifest:[]).filter(doc=>INSURANCE_KINDS.includes(doc.kind));
 const normalized=documents.map(doc=>doc.kind==='insurance_packet'?{...doc,kind:'declarations'}:doc);
 // Packet-based applications do not ask the provider to transcribe policy fields.
 // Current uploaded evidence, not obsolete typed fields, is authoritative.
 const input=profile.insurance?.inputMode==='packet'?{...profile,insurance:{maximumLoadValue:profile.insurance.maximumLoadValue,workingOwners:profile.insurance.workingOwners}}:profile;
 const result=evaluateCore(extraction,input,normalized,today);
 const slotChecks=new Set(legacyKinds.map(kind=>'document_'+kind));
 // The applicant need not estimate hypothetical future job property values.
 // The handling coverage requirement (at least $250K, or any higher legacy disclosure) remains enforced.
 const checks=result.checks.filter(check=>!slotChecks.has(check.key)&&check.key!=='load_value');
 if(!documents.length)checks.unshift({key:'insurance_packet',label:'Insurance policy packet',status:'fail',message:'Upload your insurance policy packet. A combined packet can support multiple coverage requirements.',evidence:[]});
 const outcome=checks.some(check=>check.status==='fail')?'needs_changes':checks.some(check=>check.status==='unknown')?'manual_review':'document_pass';
 const manualChecks=[...result.manualChecks.filter(check=>!check.startsWith('Before each work order')),
  'Before each work order, verify the total customer property replacement value exposed against the independently verified handling limit (at least $250,000), equipment suitability, insured names and any specialty rider. Do not dispatch if coverage is insufficient.'];
 return {...result,rulesVersion:RULES_VERSION,checks,outcome,manualChecks,
  message:outcome==='needs_changes'?'Not approved yet. Correct the items below and upload the missing or updated evidence.':outcome==='manual_review'?'A person needs to verify the unclear items. This is not a denial.':'Insurance document checks passed. LiftCrew must complete independent verification and countersign before work is enabled.'};
}
