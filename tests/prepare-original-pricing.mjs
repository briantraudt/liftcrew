// Extract real prior pricing and intake RPCs for disposable PostgreSQL tests.
import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync(new URL('../supabase/migrations/20261020160000_equipment_pricing.sql',import.meta.url),'utf8');
const ending='end; $function$;';
function extract(name) {
 const start=source.indexOf('create or replace function public.'+name+'(');
 if(start<0)throw Error(name+' function not found');
 const end=source.indexOf(ending,start);
 if(end<0)throw Error(name+' function end not found');
 return source.slice(start,end+ending.length)+'\n';
}
const quote=extract('quote_nearest_provider_equipment');
const intake=extract('create_priced_customer_request');
if(!quote.includes("and (public.provider_clearance(a.id)->>'eligible')::boolean is true"))throw Error('Expected original reviewer-only predicate not found');
if(!intake.includes('exception when others')||!intake.includes('public.quote_nearest_provider_equipment'))throw Error('Expected durable-intake fallback not found');
writeFileSync('/tmp/liftcrew-original-quote.sql',quote+intake);
