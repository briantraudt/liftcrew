import { recommendEquipment } from '../src/equipment.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const {service,location,date,durationDays,loadDescription,loadWeight,liftHeight,surface,space,loadLengthIn,loadWidthIn,entryWidth,siteNotes,name,company,email,phone,website}=req.body||{};
  if(website) return res.status(200).json({ok:true});
  const days=Number(durationDays);
  const dateParts=typeof date==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)?date.split('-').map(Number):null;
  const start=dateParts?new Date(Date.UTC(dateParts[0],dateParts[1]-1,dateParts[2])):null;
  const validDate=start&&start.toISOString().slice(0,10)===date;
  const endDate=validDate&&Number.isInteger(days)&&days>=1&&days<=30?new Date(start.getTime()+(days-1)*86400000).toISOString().slice(0,10):null;
  if(![service,location,date,durationDays,loadDescription,loadWeight,liftHeight,surface,space,name,email,phone].every(v=>typeof v==='string'&&v.trim())||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[0-9]{5}$/.test(location)||!endDate||!Number.isFinite(Number(loadWeight))||Number(loadWeight)<=0||Number(loadWeight)>100000||!Number.isFinite(Number(liftHeight))||Number(liftHeight)<0||Number(liftHeight)>100||Object.values(req.body||{}).some(v=>typeof v==='string'&&v.length>3000))return res.status(400).json({error:'Please check the required fields.'});
  if(!process.env.RESEND_API_KEY||!process.env.QUOTE_TO_EMAIL||!process.env.QUOTE_FROM_EMAIL)return res.status(503).json({error:'Quote requests are not configured yet. Please try again later.'});
  const match=recommendEquipment({loadWeight,liftHeight,surface,space,loadLengthIn,loadWidthIn,entryWidth});
  if(!match)return res.status(400).json({error:'Please complete the equipment details.'});
  const fields={Service:service,Location:location,'Date':date,'Number of days':durationDays,'Last day':endDate,'Load or task':loadDescription,'Heaviest load (lb)':loadWeight,'Lift height (ft)':liftHeight,Surface:surface,'Working space':space,'Load length (in)':loadLengthIn,'Load width (in)':loadWidthIn,'Narrowest entry width (in)':entryWidth,'Site access and details':siteNotes,'Suggested equipment':match.title,'Example model':match.example,'Catalog source':match.sourceUrl,'Match rationale':match.reason,Name:name,Company:company,Email:email,Phone:phone};
  const html='<h2>New LiftCrew quote request</h2>'+Object.entries(fields).map(([key,value])=>`<p><strong>${escape(key)}:</strong> ${escape(value||'—')}</p>`).join('');
  try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.QUOTE_FROM_EMAIL,to:[process.env.QUOTE_TO_EMAIL],reply_to:email,subject:`LiftCrew quote request — ${location.slice(0,100)}`,html})});if(!response.ok)throw new Error('Delivery failed');return res.status(200).json({ok:true})}catch{return res.status(502).json({error:'We could not send your request. Please try again shortly.'})}
}
