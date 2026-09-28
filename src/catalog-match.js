// Class-level shortlist only. Published maximums and example-model dimensions
// cannot replace a data plate, load-center calculation, or site survey.
export function matchCatalog(input, rows) {
  const weight=Number(input.loadWeight), height=Number(input.liftHeight);
  if(!Number.isFinite(weight)||weight<=0||!Number.isFinite(height)||height<0||!input.surface||!input.space)return null;
  const length=Number(input.loadLengthIn), width=Number(input.loadWidthIn), entry=Number(input.entryWidth);
  const oversized=(length>48||width>48), tightEntry=entry>0&&entry<90;
  const rough=input.surface==='Outdoor gravel or uneven';
  if(rough||oversized||weight>50000)return {
    title:'Specialist equipment review',
    reason:rough?'Uneven ground needs a rough-terrain machine and a site review.':oversized?'The load exceeds a 48-inch pallet footprint; its load center and handling method need review.':'This load exceeds the warehouse classes in the catalog.',
    sourceUrl:null,example:null,requiresReview:true
  };
  const indoor=input.surface==='Indoor smooth concrete';
  const narrow=input.space==='Narrow aisles';
  const candidates=rows.filter(row=>{
    if(!Number.isFinite(row.capacity_max_lb)||row.capacity_max_lb<weight)return false;
    if(row.max_fork_height_in!=null&&row.max_fork_height_in<height*12)return false;
    if(indoor&&row.fuel_options.includes('diesel')&&!row.fuel_options.includes('electric'))return false;
    if(!narrow&&row.features?.walk_behind)return false;
    if(!indoor&&!row.tire_options.includes('pneumatic'))return false;
    return true;
  });
  const task=String(input.loadDescription||'').toLowerCase();
  const score=row=>{
    let value=Math.max(0,row.capacity_max_lb-weight)/1000;
    if(indoor)value+=row.fuel_options.includes('electric')?-6:5;
    else if(input.surface==='Mixed indoor and outdoor')value+=row.fuel_options.includes('electric')?-5:row.fuel_options.includes('diesel')?5:1;
    else value+=row.fuel_options.includes('electric')?2:0;
    if(narrow)value+=row.features?.stand_up||row.features?.multidirectional||row.features?.walk_behind?-7:4;
    else if(row.features?.stand_up)value+=4;
    if(/weigh|scale/.test(task))value+=row.features?.scale?-8:2;
    if(/long pipe|long lumber|side.?load/.test(task))value+=row.features?.multidirectional?-8:2;
    if(row.max_fork_height_in==null)value+=3;
    return value;
  };
  candidates.sort((a,b)=>score(a)-score(b));
  const item=candidates[0];
  if(!item)return {title:'Specialist equipment review',reason:'No listed warehouse class meets the entered load and lift height. Our team will find an appropriate machine.',sourceUrl:null,example:null,requiresReview:true};
  const example=item.example_matches_class&&item.example_model;
  const flags=[
    item.use_case?`Listed use: ${item.use_case}.`:null,
    `Listed class capacity is up to ${item.capacity_max_lb.toLocaleString()} lb${item.max_fork_height_in?` and fork height up to ${Math.round(item.max_fork_height_in/12*10)/10} ft`:''}; the actual model varies.`,
    narrow?'Aisle clearance and turning space need checking.':null,
    tightEntry?'The entry width and lowered mast height need checking.':null,
    'Confirm load center, capacity at lift height, attachments, surface, and the delivered truck’s data plate.'
  ].filter(Boolean);
  return {id:item.source_class_code,title:item.title+' candidate',reason:flags.join(' '),example:example?`${example.manufacturer} ${example.model}`:null,sourceUrl:item.source_url,requiresReview:true};
}
