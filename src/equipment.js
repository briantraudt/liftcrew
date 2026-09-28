import { catalogItem } from './equipment-catalog.js';

// A family suggestion only. The supplier must verify the actual truck's data plate.
export function recommendEquipment({loadWeight,liftHeight,surface,space,loadLengthIn,loadWidthIn,entryWidth}) {
  const weight=Number(loadWeight),height=Number(liftHeight),length=Number(loadLengthIn),width=Number(loadWidthIn);
  if(!loadWeight||!liftHeight||!Number.isFinite(weight)||weight<=0||!Number.isFinite(height)||height<0||!surface||!space)return null;
  let id;
  if(weight>17500||height>30)id='heavy-capacity';
  else if(surface==='Outdoor gravel or uneven')id='rough-terrain';
  else if(space==='Narrow aisles'&&surface==='Indoor smooth concrete'&&weight<=4500&&height<=25)id='reach-truck';
  else if(surface==='Indoor smooth concrete')id=weight<=6500?'electric-counterbalance':weight>=8000&&weight<=12000?'large-electric':'heavy-capacity';
  else if(surface==='Mixed indoor and outdoor')id=weight<=17500?'electric-pneumatic':'heavy-capacity';
  else id=weight<=6500?'ic-pneumatic':weight>=13500&&weight<=17500?'large-ic-pneumatic':'electric-pneumatic';
  const item=catalogItem(id);
  const oversized=(Number.isFinite(length)&&length>48)||(Number.isFinite(width)&&width>48);
  const flags=[
    oversized?'The load exceeds a standard 48-inch pallet footprint, so its center of gravity needs review.':null,
    entryWidth&&Number(entryWidth)<90?'The entry width needs a machine dimension check.':null,
    'Confirm capacity at the actual load center and lift height, attachments, site access, and the specific truck’s data plate.'
  ].filter(Boolean);
  return {id,title:item.name+' candidate',reason:'For a '+weight.toLocaleString()+' lb load lifted '+height+' ft on '+surface.toLowerCase()+'. '+flags.join(' '),example:item.example,sourceUrl:item.sourceUrl,requiresReview:true};
}
