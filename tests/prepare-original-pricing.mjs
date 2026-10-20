// Extract the actual prior quote function; PostgreSQL tests must patch real SQL,
// not an invented replacement. Everything runs in a disposable CI database.
import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync(new URL('../supabase/migrations/20261020160000_equipment_pricing.sql',import.meta.url),'utf8');
const start=source.indexOf('create or replace function public.quote_nearest_provider_equipment(');
if(start<0)throw Error('Pricing function not found');
const ending='end; $function$;';
const end=source.indexOf(ending,start);
if(end<0)throw Error('Pricing function end not found');
const code=source.slice(start,end+ending.length)+'\n';
if(!code.includes("and (public.provider_clearance(a.id)->>'eligible')::boolean is true"))throw Error('Expected vulnerable predicate not found in original fixture');
writeFileSync('/tmp/liftcrew-original-quote.sql',code);
