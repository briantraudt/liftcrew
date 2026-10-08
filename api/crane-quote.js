import { randomUUID } from 'node:crypto';
import { craneSections, validateCraneRequest } from '../src/crane-fields.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../src/operator-config.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  if(req.body?.website)return res.status(200).json({ok:true});
  const {data,error}=validateCraneRequest(req.body);
  if(error)return res.status(400).json({error});
  // Use a public, read-only catalog; never accept a client-supplied equipment rating.
  if(data.craneClass){
    try{
      const response=await fetch(`${SUPABASE_URL}/rest/v1/crane_catalog?select=title&source_class_code=eq.${encodeURIComponent(data.craneClass)}&source_page=eq.1`,{headers:{apikey:SUPABASE_KEY},signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error();
      const rows=await response.json();
      if(rows.length!==1)return res.status(400).json({error:'Choose a listed crane or Help me choose.'});
      data.cranePreference=rows[0].title;
    }catch{return res.status(503).json({error:'We could not verify your crane preference. Please try again or choose Help me choose.'});}
  }
  const reference=randomUUID();
  try{
    const saved=await fetch(`${SUPABASE_URL}/rest/v1/crane_quote_requests`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({id:reference,details:data}),signal:AbortSignal.timeout(10000)});
    if(!saved.ok)throw Error();
  }catch{return res.status(503).json({error:'We could not save your request. Your details are still here—please try again.'});}
  // Persistence is authoritative. An unconfigured or failed email cannot lose the inquiry.
  if(process.env.RESEND_API_KEY&&process.env.QUOTE_TO_EMAIL&&process.env.QUOTE_FROM_EMAIL){
    const labels={service:'Service',location:'ZIP code',date:'Start date',durationDays:'Days',endDate:'Last day',cranePreference:'Crane preference',...Object.fromEntries(craneSections.flatMap(s=>s.fields).map(f=>[f.name,f.label]))};
    const fields=Object.entries(labels).filter(([key])=>Object.hasOwn(data,key)).map(([key,label])=>`<p><strong>${escape(label)}:</strong> ${escape(data[key]??'Not sure')}</p>`).join('');
    try{
      const notification=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.QUOTE_FROM_EMAIL,to:[process.env.QUOTE_TO_EMAIL],reply_to:data.email,subject:`LiftCrew crane request — ${data.location}`,html:`<h2>Crane + Operator</h2><p>Reference: ${reference}</p>${fields}<p>Unit selection requires load-chart and site review.</p>`}),signal:AbortSignal.timeout(8000)});
      if(!notification.ok)console.error('Crane inquiry saved; notification failed',reference);
    }catch{console.error('Crane inquiry saved; notification unavailable',reference);}
  }
  return res.status(200).json({ok:true,reference});
}
