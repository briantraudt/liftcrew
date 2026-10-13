import {customerHandler} from '../lib/customer-delivery.js';
import {validateCraneRequest} from '../src/crane-fields.js';
import {SUPABASE_URL,SUPABASE_KEY} from '../src/operator-config.js';
export function createCraneHandler({fetcher=fetch,env=process.env}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return customerHandler(validateCraneRequest,{fetcher,env})(req,res);
  const normalized=validateCraneRequest(req.body);
  if(!normalized.error&&normalized.data.craneClass){
   try{
    const result=await fetcher(`${SUPABASE_URL}/rest/v1/crane_catalog?select=title&source_class_code=eq.${encodeURIComponent(normalized.data.craneClass)}&source_page=eq.1`,{headers:{apikey:SUPABASE_KEY},signal:AbortSignal.timeout(8000)});
    if(!result.ok)throw Error('Catalog unavailable');
    const rows=await result.json();
    if(rows.length!==1)return res.status(400).json({error:'Choose a listed crane or Help me choose.'});
    normalized.data.cranePreference=rows[0].title;
   }catch{return res.status(503).json({error:'We could not verify your crane preference. Please try again or choose Help me choose.'});}
  }
  return customerHandler(()=>normalized,{fetcher,env})(req,res);
 };
}
export default createCraneHandler();
