// Presentation-only helpers. Never grant dispatch/approval eligibility here.
export const onboardingStages = [
  {label:'Your business', steps:['business']},
  {label:'Equipment & operators', steps:['equipment','operators']},
  {label:'Agreement & insurance', steps:['agreement','insurance']},
  {label:'Review & submit', steps:['documents','finish']}
];
export const stageForStep = stepId => Math.max(0, onboardingStages.findIndex(stage=>stage.steps.includes(stepId)));

const dollars = value => Number.isFinite(value) ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value) : '—';
const positiveRate = value => {
  if(!/^\d+(\.\d{1,2})?$/.test(String(value??'').trim())) return null;
  const n=Number(value);
  return n>0 && n<=100000?n:null;
};
export function priceWarnings(equipment) {
  const hourly=positiveRate(equipment.hourlyRate), four=positiveRate(equipment.fourHourRate), daily=positiveRate(equipment.dailyRate), notices=[];
  if(hourly!==null && four!==null && four>hourly*4) notices.push('Your 4-hour rate exceeds four individual hours. Check that this is intentional.');
  if(hourly!==null && four!==null && four<hourly) notices.push('Your 4-hour rate is below your single-hour rate. Check that this is intentional.');
  if(four!==null && daily!==null && daily<four) notices.push('Your daily rate is below your 4-hour rate. Check that this is intentional.');
  return notices;
}
export function machineRadius(businessRadius, override) {
  const ceiling=Number(businessRadius), machine=Number(override);
  if(!Number.isFinite(ceiling)||ceiling<=0) return null;
  // Per-machine settings may narrow but never enlarge the business-wide ceiling.
  return String(override??'').trim() && Number.isFinite(machine) && machine>0 ? Math.min(ceiling,machine) : ceiling;
}
export function ratePreviewMarkup(equipment,businessRadius){
  const hourly=positiveRate(equipment.hourlyRate), four=positiveRate(equipment.fourHourRate), daily=positiveRate(equipment.dailyRate);
  const radius=machineRadius(businessRadius,equipment.radiusMilesOverride);
  const warnings=priceWarnings(equipment);
  return '<div class="rate-preview-head"><strong>Rate preview</strong><span>Provider payout rates</span></div>'+
    '<div class="rate-preview-values"><div><small>Hourly</small><strong>'+dollars(hourly)+'</strong></div><div><small>4 hours</small><strong>'+dollars(four)+'</strong></div><div><small>Daily</small><strong>'+dollars(daily)+'</strong></div></div>'+
    '<p class="rate-preview-foot">Up to '+(radius??'—')+' miles from this machine’s ZIP (ZIP-center estimate). 25 miles included; $2 for each round-trip excess mile. Final driving distance and availability require confirmation.</p>'+
    warnings.map(s=>'<p class="rate-warning">'+s+'</p>').join('');
}
const toDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value||'')) ? Date.parse(String(value)+'T00:00:00Z') : NaN;
const daysUntil = (value,now) => Math.ceil((toDate(value)-now)/86400000);
export function renewalAlerts(profile,documents,clearance,now=new Date()){
  const reference=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  const rows=[];
  const add=(label,date,step)=>{
    const days=daysUntil(date,reference);
    if(!Number.isFinite(days)||days>45)return;
    rows.push({label,date,step,days,severity:days<=0?'urgent':days<=14?'soon':'upcoming'});
  };
  if(clearance?.validUntil)add('Verified insurance coverage / provider clearance',clearance.validUntil,'insurance');
  for(const doc of documents||[])if(doc.active&&doc.expires_on)add(doc.filename||'Uploaded document',doc.expires_on,'documents');
  for(const operator of profile?.operators||[]){
    const evaluated=toDate(operator.evaluationDate);
    if(!Number.isFinite(evaluated))continue;
    const dueDate=new Date(evaluated);
    dueDate.setUTCFullYear(dueDate.getUTCFullYear()+3);
    add('Practical evaluation — '+(operator.name||'operator'),dueDate.toISOString().slice(0,10),'operators');
  }
  return rows.sort((a,b)=>a.days-b.days||a.label.localeCompare(b.label));
}
