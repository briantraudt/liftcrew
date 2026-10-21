import {intakeRPC} from '../lib/customer-delivery.js';

export function validatePriceRequest(input) {
 if(!input||typeof input!=='object'||Array.isArray(input))return 'Check the pricing request.';
 if(!['Forklift with operator','Crane with operator'].includes(input.service))return 'Choose a service.';
 if(!/^\d{5}$/.test(input.location||''))return 'Enter a five-digit ZIP code.';
 const days=Number(input.durationDays);
 if(!(days===0.5||(Number.isInteger(days)&&days>=1&&days<=30)))return 'Choose a half-day or 1–30 days.';
 if(input.service==='Forklift with operator'){
  const weight=Number(input.loadWeight),height=Number(input.liftHeight);
  if(!Number.isFinite(weight)||weight<=0||weight>100000||!Number.isFinite(height)||height<=0||height>100)return 'Enter a valid load weight and lift height.';
 }
 return null;
}

export function createPricingHandler({fetcher=fetch,env=process.env}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  const origin=req.headers?.origin;
  if(origin&&!['https://myliftcrew.com','https://www.myliftcrew.com',env.VERCEL_URL&&'https://'+env.VERCEL_URL].includes(origin))return res.status(403).json({error:'Please use the LiftCrew website.'});
  if(!req.body||typeof req.body!=='object'||JSON.stringify(req.body).length>1500)return res.status(400).json({error:'Check the pricing request.'});
  const error=validatePriceRequest(req.body);if(error)return res.status(400).json({error});
  if(!env.CUSTOMER_INTAKE_KEY)return res.status(503).json({error:'Pricing is temporarily unavailable. You can still request a quote.'});
  const q=req.body;
  try{
   const quote=await intakeRPC('quote_nearest_provider_equipment',{
    p_key:env.CUSTOMER_INTAKE_KEY,
    p_zip:q.location,
    p_service:q.service,
    p_capacity:q.service==='Forklift with operator'?Number(q.loadWeight):null,
    p_height:q.service==='Forklift with operator'?Number(q.liftHeight):null,
    p_duration_days:Math.ceil(Number(q.durationDays))
   },fetcher);
   const selected=Number(q.durationDays)===0.5&&quote?.status==='matched'?{...quote,durationDays:0.5,billingPeriod:'halfDay',selectedTotal:quote.totals?.fourHour}:quote;
   return res.status(200).json({ok:true,quote:selected});
  }catch{
   return res.status(503).json({error:'Pricing is temporarily unavailable. You can still request a quote.'});
  }
 };
}
export default createPricingHandler();
