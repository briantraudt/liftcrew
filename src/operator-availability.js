// Local-time weekly availability for each provider. Persist both structured windows
// and a readable legacy field while existing server validation migrates gradually.
export const weekDays=[
  ['mon','Monday'],['tue','Tuesday'],['wed','Wednesday'],
  ['thu','Thursday'],['fri','Friday'],['sat','Saturday'],['sun','Sunday']
];
const timeRE=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const make=day=>({day,start:'08:00',end:'17:00'});
export function readWeeklyAvailability(business={}){
  if(Array.isArray(business.weeklyAvailability)){
    return business.weeklyAvailability.filter(x=>x&&weekDays.some(d=>d[0]===x.day))
      .map(x=>({day:x.day,start:String(x.start||'08:00'),end:String(x.end||'17:00')}));
  }
  // Free-text historical schedules can contain uncommon hours, exceptions or
  // timezones. Never fabricate 08:00–17:00 from 'Weekdays' or drop extra notes.
  // Ask the provider to explicitly select and confirm new day/time windows.
  return [];
}
export function setWeeklyAvailability(business,day,change){
  if(!weekDays.some(([id])=>id===day))return false;
  if(!Array.isArray(business.weeklyAvailability)&&business.availability&&!business.availabilityNotes){
    business.availabilityNotes=String(business.availability);
  }
  const items=readWeeklyAvailability(business);
  const existing=items.find(item=>item.day===day);
  if(change.enabled===true && !existing)items.push(make(day));
  if(change.enabled===false && existing)items.splice(items.indexOf(existing),1);
  const next=items.find(item=>item.day===day);
  if(next && (change.start!==undefined || change.end!==undefined)){
    if(change.start!==undefined)next.start=String(change.start);
    if(change.end!==undefined)next.end=String(change.end);
  }
  const order=new Map(weekDays.map(([id],i)=>[id,i]));
  items.sort((a,b)=>order.get(a.day)-order.get(b.day));
  business.weeklyAvailability=items;
  business.availability=items.map(item=>item.day.toUpperCase()+' '+item.start+'–'+item.end).join('; ');
  return true;
}
export function weeklyAvailabilityErrors(business={}){
  if(!Array.isArray(business.weeklyAvailability))return []; // Existing legacy text remains valid
  const days=business.weeklyAvailability;
  if(!days.length)return ['Choose at least one standard availability day'];
  if(new Set(days.map(x=>x.day)).size!==days.length)return ['Duplicate availability day'];
  return days.flatMap(item=>!weekDays.some(([id])=>id===item.day)||!timeRE.test(item.start)||!timeRE.test(item.end)||item.end<=item.start
    ?['Check standard availability hours for '+(weekDays.find(([id])=>id===item.day)?.[1]||'selected day')]:[]);
}
export function weeklyAvailabilityMarkup(business={},esc=value=>String(value)){
  const days=readWeeklyAvailability(business);
  return '<section class="availability-editor" aria-label="Standard availability"><h3>Standard availability</h3>'+
    '<div class="availability-day-list">'+weekDays.map(([day,name])=>{
      const item=days.find(x=>x.day===day),checked=Boolean(item);
      return '<div class="availability-day"><label class="availability-day-toggle"><input type="checkbox" data-availability-day="'+day+'" '+(checked?'checked':'')+'><span>'+name+'</span></label>'+
        '<div class="availability-hours"><label><span>From</span><input type="time" data-availability-time="'+day+'" data-time-part="start" value="'+esc(item?.start||'08:00')+'" '+(!checked?'disabled':'')+'></label>'+
        '<label><span>To</span><input type="time" data-availability-time="'+day+'" data-time-part="end" value="'+esc(item?.end||'17:00')+'" '+(!checked?'disabled':'')+'></label></div></div>';
    }).join('')+'</div>'+
    (business.availabilityNotes||(!Array.isArray(business.weeklyAvailability)?business.availability:'')?'<p class="availability-legacy">Saved availability notes: '+esc(business.availabilityNotes||business.availability)+'</p>':'')+
    '<p class="availability-note">Use your local operating hours.</p></section>';
}
