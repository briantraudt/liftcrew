import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_KEY} from '../src/operator-config.js';
import {notifyCustomerRequest} from '../lib/customer-delivery.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 const token=String(req.headers?.authorization||'').replace(/^Bearer /i,'');
 if(!token)return res.status(401).json({error:'Sign in to continue'});
 const db=createClient(SUPABASE_URL,SUPABASE_KEY,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const user=await db.auth.getUser(token);
 if(user.error||!user.data.user?.email_confirmed_at)return res.status(401).json({error:'Verified staff account required'});
 const role=await db.rpc('is_operator_reviewer');if(role.error||role.data!==true)return res.status(403).json({error:'Reviewer access required'});
 const id=req.body?.id;if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Select a customer request'});
 try{const result=await notifyCustomerRequest(id);return res.status(200).json({ok:true,...result});}
 catch{return res.status(503).json({error:'The saved request is safe. Email could not be retried right now.'});}
}
