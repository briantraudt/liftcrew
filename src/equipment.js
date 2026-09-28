export function recommendEquipment({loadWeight,liftHeight,surface,space}) {
  const weight=Number(loadWeight),height=Number(liftHeight);
  if(!loadWeight||!liftHeight||!Number.isFinite(weight)||weight<=0||!Number.isFinite(height)||height<0||!surface||!space)return null;
  if(weight>15000||height>30)return {title:'Specialized equipment review',reason:'This load or lift height is outside our standard forklift guide. Our team will review the job.'};
  if(surface==='Outdoor gravel or uneven')return {title:'Rough terrain forklift',reason:'Uneven ground calls for a rough terrain unit. Rated capacity at the actual load center and lift height must be confirmed.'};
  if(space==='Narrow aisles'&&surface==='Indoor smooth concrete'&&weight<=5000&&height<=25)return {title:'Electric reach truck or narrow aisle forklift',reason:'Smooth indoor floors and tight aisles may favor a compact electric unit. Aisle width and racking need confirmation.'};
  const capacity=weight<=4000?'5,000':weight<=6500?'8,000':weight<=8500?'10,000':weight<=12000?'15,000':'heavy capacity';
  const type=surface==='Indoor smooth concrete'?'electric cushion tire forklift':surface==='Mixed indoor and outdoor'?'pneumatic tire forklift (site review)':'pneumatic tire forklift';
  return {title:capacity==='heavy capacity'?'Heavy capacity forklift review':capacity+' lb class '+type,reason:'Based on your '+weight.toLocaleString()+' lb load, '+height+' ft lift, and '+surface.toLowerCase()+' surface. Capacity at the load center, mast height, entry width, and ground conditions must be checked.'};
}
