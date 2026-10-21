import {hasInsurancePacket} from './onboarding-model.js';
// Document screening is not clearance or authority to dispatch.
export function insurancePrecheck(docs=[],clearance=null){
  if(!hasInsurancePacket(docs))return {ready:false,kind:'missing',message:'Upload your insurance policy packet first.'};
  const review=clearance?.review;
  if(!review||clearance?.reviewCurrent!==true)return {ready:false,kind:'unreviewed',message:'Submit your current insurance documents for review before continuing.'};
  if(['queued','reading'].includes(review.state))return {ready:false,kind:'pending',message:'Your insurance review is still running. Please wait for the result.'};
  if(review.state==='complete'&&review.result?.outcome==='document_pass')
    return {ready:true,kind:'document_pass',message:'Your insurance document checks passed. Final coverage verification is completed by LiftCrew.'};
  if(review.result?.outcome==='needs_changes')return {ready:false,kind:'needs_changes',message:'Your insurance documents do not yet show the required coverage. Please update them and run a new review.'};
  return {ready:false,kind:'manual_review',message:'Your insurance needs specialist verification. LiftCrew must resolve the outstanding checks before onboarding can continue.'};
}
