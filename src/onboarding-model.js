export const stepIds=['business','equipment','operators','insurance','documents','agreement','finish'];
export const stepLabels=['Your business','Equipment','Operators','Insurance','Supporting documents','Read & sign','Finish onboarding'];
export const insuranceKinds=['insurance_packet','coi','declarations','endorsements','handling','owner_coverage','equipment_coverage'];
export const insuranceFiles=docs=>docs.filter(d=>d.active&&insuranceKinds.includes(d.kind));
export const hasInsurancePacket=docs=>insuranceFiles(docs).length>0;
export const equipmentLabel=(equipment,index)=>`Machine ${index+1}${[equipment.make,equipment.model].filter(Boolean).length?' · '+[equipment.make,equipment.model].filter(Boolean).join(' '):''}`;
export function removeEquipmentAssignments(profile,id){
 for(const operator of profile.operators||[])operator.equipmentIds=(operator.equipmentIds||[]).filter(value=>value!==id);
}
export function authorizationErrors(profile){
 const ids=new Set((profile.equipment||[]).map(e=>e.id));
 return (profile.operators||[]).flatMap((o,i)=>!Array.isArray(o.equipmentIds)||!o.equipmentIds.length||o.equipmentIds.some(id=>typeof id!=='string'||!ids.has(id))?[`Select valid equipment for ${o.name||'Operator '+(i+1)}`]:[]);
}
export function restoredStep(storage,applicationId){
 const current=storage.getItem('provider-step-v2-'+applicationId);
 if(current!==null)return Math.max(0,stepIds.indexOf(current));
 const legacy=storage.getItem('provider-step-'+applicationId);
 if(legacy===null)return 0;
 const prior=['business','equipment','agreement','insurance','documents','finish'][Number(legacy)]||'business';
 return Math.max(0,stepIds.indexOf(prior));
}
export function persistStep(storage,applicationId,step){storage.setItem('provider-step-v2-'+applicationId,stepIds[step]||stepIds[0]);}
export function validateInsuranceBatch(existing,incoming){
 const files=[...insuranceFiles(existing),...incoming];
 if(files.length>12||files.reduce((sum,file)=>sum+(file.bytes??file.size),0)>24*1048576)throw Error('Insurance packets support up to 12 files / 24 MB combined. Remove older files or compress the PDFs first.');
}
