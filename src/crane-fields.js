export const CRANE_SERVICE = 'Crane with operator';
export const craneSections = [
  {title:'The load', fields:[
    {name:'loadDescription',label:'What are we lifting?',type:'textarea',required:true,placeholder:'Rooftop HVAC unit, steel beams, machinery…'},
    {name:'loadWeight',label:'Heaviest item (lb)',type:'number',min:1,max:2000000,unknown:true,required:true},
    {name:'weightBasis',label:'Weight source',options:['Manufacturer / shipping documents','Weighed','Estimated','Not sure'],required:true},
    {name:'loadLengthFt',label:'Load length (ft)',type:'number',min:0.1,max:1000,unknown:true,required:true},
    {name:'loadWidthFt',label:'Load width (ft)',type:'number',min:0.1,max:1000,unknown:true,required:true},
    {name:'loadHeightFt',label:'Load height (ft)',type:'number',min:0.1,max:1000,unknown:true,required:true},
    {name:'liftCount',label:'Number of lifts',type:'number',min:1,max:10000,step:1,required:true},
    {name:'riggingWeight',label:'Rigging weight (lb)',type:'number',min:0,max:100000,unknown:true,required:true},
    {name:'liftingPoints',label:'Lifting points',options:['Rated lifting points available','No rated lifting points','Not sure'],required:true},
    {name:'loadNotes',label:'Center of gravity / handling details',type:'textarea',placeholder:'Off-center weight, fragile load, lifting instructions…'},
  ]},
  {title:'The lift',fields:[
    {name:'pickupHeight',label:'Pickup height (ft)',type:'number',min:0,max:1000,unknown:true,required:true},
    {name:'liftHeight',label:'Set-down height (ft)',type:'number',min:0,max:1000,unknown:true,required:true},
    {name:'pickupRadius',label:'Pickup radius (ft)',type:'number',min:0.1,max:1000,unknown:true,required:true,help:'Horizontal distance from the crane’s center of rotation to the load’s center at pickup.'},
    {name:'setRadius',label:'Set-down radius (ft)',type:'number',min:0.1,max:1000,unknown:true,required:true,help:'Horizontal distance from the crane’s center of rotation to the load’s center at placement.'},
    {name:'maxPathRadius',label:'Farthest radius along lift path (ft)',type:'number',min:0.1,max:1000,unknown:true,required:true},
    {name:'obstructionHeight',label:'Obstacle height to clear (ft)',type:'number',min:0,max:1000,unknown:true,required:true},
    {name:'riggingHeadroom',label:'Rigging height above load (ft)',type:'number',min:0,max:1000,unknown:true,required:true},
    {name:'travelWithLoad',label:'Move the crane with load suspended?',options:['No','Yes','Not sure'],required:true},
    {name:'liftPath',label:'Pickup, placement & lift path',type:'textarea',required:true,placeholder:'From a flatbed to the roof; crane setup in the parking lot…'},
  ]},
  {title:'The site',fields:[
    {name:'siteAddress',label:'Jobsite address',required:true,autocomplete:'street-address',wide:true},
    {name:'environment',label:'Work area',options:['Outdoors','Indoors','Indoor and outdoor'],required:true},
    {name:'surface',label:'Ground surface',options:['Concrete','Asphalt','Compacted gravel','Soil / uneven ground','Elevated slab / structure','Not sure'],required:true},
    {name:'setupWidth',label:'Setup area width (ft)',type:'number',min:0.1,max:10000,unknown:true,required:true},
    {name:'setupLength',label:'Setup area length (ft)',type:'number',min:0.1,max:10000,unknown:true,required:true},
    {name:'accessWidth',label:'Narrowest access width (ft)',type:'number',min:0.1,max:1000,unknown:true,required:true},
    {name:'accessHeight',label:'Lowest access clearance (ft)',type:'number',min:0.1,max:1000,unknown:true,required:true},
    {name:'groundAssessment',label:'Ground bearing capacity verified?',options:['Yes — report available','No','Not sure'],required:true},
    {name:'undergroundHazards',label:'Underground utilities / voids?',options:['None identified','Present','Not sure'],required:true},
    {name:'powerLines',label:'Power lines near lift or access?',options:['No','Yes','Not sure'],required:true},
    {name:'riggingSupply',label:'Rigging equipment',options:['Provide with crane','We will provide','Not sure'],required:true},
    {name:'crewSupport',label:'Qualified rigger & signal person',options:['Provide with crane','We will provide','Not sure'],required:true},
    {name:'permits',label:'Street closures / permits',options:['Not needed','Needed — please coordinate','Already arranged','Not sure'],required:true},
    {name:'liftPlan',label:'Lift plan',options:['Please prepare','Existing plan available','Not sure'],required:true},
    {name:'siteNotes',label:'Access, obstacles & site requirements',type:'textarea',placeholder:'Power-line distances, slope, roof edge / setback, underground services, mats, indoor ventilation, multiple-crane lift…'},
    {name:'documentUrl',label:'Photos / drawings link (optional)',type:'url',placeholder:'https://',wide:true},
  ]},
  {title:'Your details',fields:[
    {name:'name',label:'Name',required:true,autocomplete:'name'},
    {name:'company',label:'Company',autocomplete:'organization'},
    {name:'email',label:'Email',type:'email',required:true,autocomplete:'email'},
    {name:'phone',label:'Phone',type:'tel',required:true,autocomplete:'tel'},
    {name:'startTime',label:'Start time (jobsite local time)',type:'time',required:true},
    {name:'hoursPerDay',label:'Hours per day',type:'number',min:1,max:24,step:0.5,required:true},
  ]},
];
export function validateCraneRequest(input, now = new Date()) {
  if(!input || typeof input !== 'object' || Array.isArray(input)) return {error:'Please check your request.'};
  const fields=[{name:'location',label:'ZIP code',required:true},{name:'date',label:'Date',required:true},{name:'durationDays',label:'Number of days',type:'number',min:1,max:30,step:1,required:true},{name:'craneClass',label:'Crane preference'},...craneSections.flatMap(s=>s.fields)];
  const data={service:CRANE_SERVICE};
  if(input.service!==CRANE_SERVICE)return {error:'Choose Crane + Operator.'};
  for(const field of fields){
    const value=input[field.name]??'';
    if(typeof value!=='string'||value.length>3000)return {error:`Check ${field.label.toLowerCase()}.`};
    const trimmed=value.trim();
    if(field.unknown && input[field.name+'Unknown']==='yes') {data[field.name]=null;data[field.name+'Unknown']=true;continue;}
    if(field.required&&!trimmed)return {error:`Enter ${field.label.toLowerCase()}, or select Not sure.`};
    if(trimmed&&field.type==='number'){
      const number=Number(trimmed);
      if(!Number.isFinite(number)||number<field.min||number>field.max||(field.step===1&&!Number.isInteger(number)))return {error:`Check ${field.label.toLowerCase()}.`};
      data[field.name]=number;
    } else {
      if(field.options&&!field.options.includes(trimmed))return {error:`Choose ${field.label.toLowerCase()}.`};
      data[field.name]=trimmed;
    }
  }
  if(!/^\d{5}$/.test(data.location))return {error:'Enter a five-digit ZIP code.'};
  const date=/^\d{4}-\d{2}-\d{2}$/.test(data.date)?new Date(data.date+'T00:00:00Z'):null;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  if(!date||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==data.date||data.date<today)return {error:'Choose today or a future date.'};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)||data.email.length>254)return {error:'Enter a valid email address.'};
  if(data.phone.replace(/\D/g,'').length<10)return {error:'Enter a valid phone number.'};
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime))return {error:'Choose a valid start time.'};
  if(data.documentUrl){try{if(!['http:','https:'].includes(new URL(data.documentUrl).protocol))throw Error();}catch{return {error:'Enter an http or https link for photos / drawings.'};}}
  if(data.maxPathRadius!==null&&[data.pickupRadius,data.setRadius].some(v=>v!==null&&v>data.maxPathRadius))return {error:'The farthest radius must include both pickup and set-down.'};
  if(data.craneClass&&!/^170-\d{4}$/.test(data.craneClass))return {error:'Choose a listed crane or Help me choose.'};
  data.endDate=new Date(date.getTime()+(data.durationDays-1)*86400000).toISOString().slice(0,10);
  return {data};
}
