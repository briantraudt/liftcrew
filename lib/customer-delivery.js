import {randomUUID,createHmac} from 'node:crypto';
import {SUPABASE_URL,SUPABASE_KEY} from '../src/operator-config.js';
import {validateBooking,forkliftSections} from '../src/booking-fields.js';
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateForklift(input){
 const bookingError=validateBooking(input);if(bookingError)return {error:bookingError};
 if(input.service!=='Forklift with operator')return {error:'Choose Forklift + Operator.'};
 const data={};for(const k of ['service','location','date','durationDays',...forkliftSections.flatMap(s=>s.fields.map(f=>f.name))]){
  const value=input[k]??'';if(typeof value!=='string'||value.length>3000)return {error:'Please check the request fields.'};data[k]=value.trim();
 }
 for(const f of forkliftSections.flatMap(s=>s.fields)){
  const v=data[f.name];if(f.required&&!v)return {error:'Please complete '+f.label+'.'};
  if(f.options&&v&&!f.options.includes(v))return {error:'Please check '+f.label+'.'};
  if(f.type==='number'&&v&&(!Number.isFinite(Number(v))||Number(v)<f.min||Number(v)>f.max))return {error:'Please check '+f.label+'.'};
 }
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)||/[\r\n]/.test(data.email))return {error:'Enter a valid email address.'};
 return {data};
}
export async function intakeRPC(name,args,fetcher=fetch){
 const response=await fetcher(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});
 const result=await response.json().catch(()=>null);
 if(!response.ok){const e=Error('Unable to save request');e.code=result?.code;throw e;}
 return result;
}
export async function notifyCustomerRequest(id,{fetcher=fetch,env=process.env}={}){
 const key=env.CUSTOMER_INTAKE_KEY;
 const configured=Boolean(env.RESEND_API_KEY&&env.QUOTE_TO_EMAIL&&env.QUOTE_FROM_EMAIL);
 const request=await intakeRPC('claim_customer_notification',{p_key:key,p_id:id,p_configured:configured},fetcher);
 if(!request)return {configured};
 const data=request.details;
 const fields=Object.entries(data).map(([k,v])=>`<p><strong>${html(k.replace(/[A-Z]/g,c=>' '+c.toLowerCase()))}:</strong> ${html(v)}</p>`).join('');
 const body={from:env.QUOTE_FROM_EMAIL,to:[env.QUOTE_TO_EMAIL],reply_to:data.email,subject:`LiftCrew ${data.service==='Crane with operator'?'crane':'forklift'} request — ${data.location}`,html:`<h2>New LiftCrew request</h2><p>Reference: ${html(id)}</p>${fields}<p><a href="https://www.myliftcrew.com/customer-requests.html">Open the LiftCrew staff inbox</a></p><p>This is an inquiry, not a confirmed booking.</p>`};
 let status='delivery_unknown',providerId=null;
 try{
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'liftcrew-inquiry/'+id},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const result=await response.json().catch(()=>null);
  if(response.ok&&typeof result?.id==='string'){status='accepted';providerId=result.id;}else status='failed';
 }catch{/* Timeout may occur after provider acceptance; the same idempotency key is reused. */}
 await intakeRPC('finish_customer_notification',{p_key:key,p_id:id,p_status:status,p_provider_id:providerId},fetcher);
 return {configured,status};
}
export function customerHandler(validate,{fetcher=fetch,env=process.env}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  const origin=req.headers?.origin;
  if(origin&&!['https://myliftcrew.com','https://www.myliftcrew.com',env.VERCEL_URL&&'https://'+env.VERCEL_URL].includes(origin))return res.status(403).json({error:'Please submit from the LiftCrew website.'});
  if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||JSON.stringify(req.body).length>50000)return res.status(400).json({error:'Please check the request fields.'});
  if(req.body.website)return res.status(400).json({error:'Please check the request fields.'});
  const {data,error}=validate(req.body);if(error)return res.status(400).json({error});
  if(!env.CUSTOMER_INTAKE_KEY)return res.status(503).json({error:'We could not save your request. Your details are still here—please try again.'});
  const supplied=req.body.requestId;
  if(supplied&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied))return res.status(400).json({error:'Please reload the booking form and try again.'});
  const reference=supplied||randomUUID();
  const ip=String(req.headers?.['x-vercel-forwarded-for']||req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,200);
  const rateKey=createHmac('sha256',env.CUSTOMER_INTAKE_KEY).update(ip).digest('hex');
  try{await intakeRPC('create_customer_request',{p_key:env.CUSTOMER_INTAKE_KEY,p_id:reference,p_rate_key:rateKey,p_details:data},fetcher);}
  catch(e){const limited=e.code==='P0429',conflict=e.code==='23505';return res.status(limited?429:conflict?409:503).json({error:limited?'Too many requests. Please wait or contact LiftCrew.':conflict?'This reference was already received with different details. Start a new request to change them.':'We could not save your request. Your details are still here—please try again.'});}
  // Email is secondary. Once saved, an email outage must never ask the customer to resubmit.
  try{await notifyCustomerRequest(reference,{fetcher,env});}catch{console.warn('customer_notification_pending',reference);}
  return res.status(200).json({ok:true,reference});
 };
}
