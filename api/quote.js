const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const {service,location,date,endDate,duration,name,company,email,phone,details,website}=req.body||{};
  if(website) return res.status(200).json({ok:true});
  if(![service,location,date,name,email,phone].every(v=>typeof v==='string'&&v.trim())||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||Object.values(req.body||{}).some(v=>typeof v==='string'&&v.length>3000))return res.status(400).json({error:'Please check the required fields.'});
  if(!process.env.RESEND_API_KEY||!process.env.QUOTE_TO_EMAIL||!process.env.QUOTE_FROM_EMAIL)return res.status(503).json({error:'Quote requests are not configured yet. Please try again later.'});
  const fields={Service:service,Location:location,'Start date':date,'End date':endDate,Duration:duration,Name:name,Company:company,Email:email,Phone:phone,Details:details};
  const html='<h2>New LiftCrew quote request</h2>'+Object.entries(fields).map(([key,value])=>`<p><strong>${escape(key)}:</strong> ${escape(value||'—')}</p>`).join('');
  try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.QUOTE_FROM_EMAIL,to:[process.env.QUOTE_TO_EMAIL],reply_to:email,subject:`LiftCrew quote request — ${location.slice(0,100)}`,html})});if(!response.ok)throw new Error('Delivery failed');return res.status(200).json({ok:true})}catch{return res.status(502).json({error:'We could not send your request. Please try again shortly.'})}
}
