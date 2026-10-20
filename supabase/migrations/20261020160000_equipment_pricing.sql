-- Per-machine commercial rates and privacy-safe customer price discovery.
-- Distances use existing ZIP centroids, not road directions. Dispatch must verify
-- driving distance, load center, equipment configuration and actual availability.
-- A machine does not become eligible merely because an application was saved.

do $migration$
declare definition text; needle text;
begin
 definition:=pg_get_functiondef('private.provider_profile_errors(jsonb,boolean)'::regprocedure);
 needle:=$anchor$  if private.provider_date(item->>'inspectionDate') is null or private.provider_date(item->>'inspectionDate')>current_date then errors:=array_append(errors,'Enter a valid inspection date, not in the future'); end if;$anchor$;
 if position(needle in definition)=0 then raise exception 'Unexpected provider validation definition: pricing was NOT installed'; end if;
 definition:=replace(definition,needle,$replacement$  foreach k in array array['hourlyRate','fourHourRate','dailyRate'] loop
   if coalesce(item->>k,'') !~ '^[0-9]+(\.[0-9]{1,2})?$' or coalesce(private.provider_number(item->>k),0) not between 0.01 and 100000 then
    errors:=array_append(errors,'Equipment '||k||' must be between $0.01 and $100,000 with at most two decimals');
   end if;
  end loop;
  if not exists(select 1 from private.us_zip_centroids z where z.zip=item->>'baseZip') then errors:=array_append(errors,'Equipment ZIP not found in location reference'); end if;
$replacement$||needle);
 execute definition;

 -- Existing reviewer matcher previously used business ZIP instead of each machine's ZIP.
 definition:=pg_get_functiondef('public.match_provider_equipment(text,numeric,numeric,text)'::regprocedure);
 needle:=$anchor$  join private.us_zip_centroids home on home.zip=a.profile->'business'->>'zip'
  cross join lateral jsonb_array_elements(a.profile->'equipment') e$anchor$;
 if position(needle in definition)=0 then raise exception 'Unexpected equipment matcher definition'; end if;
 execute replace(definition,needle,$replacement$  cross join lateral jsonb_array_elements(a.profile->'equipment') e
  join private.us_zip_centroids home on home.zip=e.value->>'baseZip'$replacement$);
end $migration$;

create or replace function public.quote_nearest_provider_equipment(
 p_key text, p_zip text, p_service text, p_capacity numeric default null,
 p_height numeric default null, p_duration_days integer default 1
) returns jsonb
language plpgsql stable security definer set search_path='' as $function$
declare destination private.us_zip_centroids; nearest record; delivery_fee numeric; excess_miles numeric;
begin
 perform private.check_customer_intake_key(p_key);
 if p_zip is null or p_zip !~ '^[0-9]{5}$'
    or p_service not in ('Forklift with operator','Crane with operator')
    or p_duration_days is null or p_duration_days not between 1 and 30
 then raise exception 'Invalid pricing request' using errcode='22023'; end if;

 -- Specialty cranes are excluded until a separate rider and clearance process exist.
 if p_service='Crane with operator' then
  return jsonb_build_object('status','manual','message','Crane availability and rates require a specialty review.');
 end if;
 if p_capacity is null or p_capacity<=0 or p_capacity>100000
    or p_height is null or p_height<=0 or p_height>100 then
  raise exception 'Enter a valid load weight and lift height' using errcode='22023'; end if;
 select * into destination from private.us_zip_centroids where zip=p_zip;
 if destination.zip is null then
  return jsonb_build_object('status','unavailable','message','We could not verify that ZIP code. LiftCrew will check the location when reviewing your request.');
 end if;

 select c.equipment,c.miles,c.hourly_rate,c.four_hour_rate,c.daily_rate into nearest
 from (
  select e.value as equipment,
   private.zip_distance_miles(home.latitude,home.longitude,destination.latitude,destination.longitude) as miles,
   private.provider_number(e.value->>'hourlyRate') as hourly_rate,
   private.provider_number(e.value->>'fourHourRate') as four_hour_rate,
   private.provider_number(e.value->>'dailyRate') as daily_rate,
   private.provider_number(a.profile->'business'->>'radiusMiles') as service_radius
  from public.operator_applications a
  cross join lateral jsonb_array_elements(coalesce(a.profile->'equipment','[]'::jsonb)) e
  join private.us_zip_centroids home on home.zip=e.value->>'baseZip'
  where a.status='approved'
   and (public.provider_clearance(a.id)->>'eligible')::boolean is true
   and e.value->>'category' in ('Warehouse forklift','Rough-terrain forklift','Telehandler')
   and private.provider_number(e.value->>'capacity')>=p_capacity
   and private.provider_number(e.value->>'liftHeight')>=p_height
   and exists(
    select 1 from jsonb_array_elements(coalesce(a.profile->'operators','[]'::jsonb)) o
    where jsonb_typeof(o->'equipmentIds')='array'
     and (o->'equipmentIds') ? (e.value->>'id')
     and o->>'adult'='yes'
     and private.provider_date(o->>'evaluationDate') between (current_date-interval '3 years')::date and current_date
   )
 ) c
 where c.miles<=c.service_radius
  and c.hourly_rate between 0.01 and 100000
  and c.four_hour_rate between 0.01 and 100000
  and c.daily_rate between 0.01 and 100000
 order by c.miles,c.hourly_rate,c.four_hour_rate,c.daily_rate
 limit 1;
 if not found then
  return jsonb_build_object('status','unavailable','message','No approved and qualified equipment is listed for these job details yet. LiftCrew can source and quote the job manually.');
 end if;

 excess_miles:=greatest(0,nearest.miles::numeric-25);
 -- Only excess ONE-WAY distance is billable; double for a round trip,
 -- then multiply by $2 per excess round-trip mile.
 delivery_fee:=round(excess_miles*2*2,2);
 return jsonb_build_object(
  'status','matched',
  'equipment',jsonb_build_object('category',nearest.equipment->>'category','make',nearest.equipment->>'make','model',nearest.equipment->>'model'),
  'distanceMiles',round(nearest.miles::numeric,1),
  'freeRadiusMiles',25,
  'excessRoundTripMiles',round(excess_miles*2,1),
  'mileageRatePerMile',2,
  'deliveryFee',delivery_fee,
  'rates',jsonb_build_object('hourly',nearest.hourly_rate,'fourHour',nearest.four_hour_rate,'daily',nearest.daily_rate),
  'totals',jsonb_build_object(
   'hourly',round(nearest.hourly_rate+delivery_fee,2),
   'fourHour',round(nearest.four_hour_rate+delivery_fee,2),
   'daily',round(nearest.daily_rate*p_duration_days+delivery_fee,2)
  ),
  'durationDays',p_duration_days,
  'basis','Approximate straight-line ZIP-center distance. Final driving mileage, equipment suitability, availability and total price require LiftCrew confirmation.'
 );
end; $function$;
revoke all on function public.quote_nearest_provider_equipment(text,text,text,numeric,numeric,integer) from public,anon,authenticated;
grant execute on function public.quote_nearest_provider_equipment(text,text,text,numeric,numeric,integer) to anon;

-- Keep the customer's original request digest unchanged for safe idempotent retries.
-- Store the server-derived pricing result separately; the client cannot submit it.
alter table public.customer_requests add column if not exists pricing_snapshot jsonb;
create or replace function public.create_priced_customer_request(
 p_key text,p_id uuid,p_rate_key text,p_details jsonb
) returns uuid
language plpgsql security definer set search_path='' as $function$
declare saved_id uuid; snapshot jsonb; weight numeric; height numeric;
begin
 perform private.check_customer_intake_key(p_key);
 saved_id:=public.create_customer_request(p_key,p_id,p_rate_key,p_details);
 if (p_details->>'loadWeight') ~ '^[0-9]+(\.[0-9]+)?$' then weight:=(p_details->>'loadWeight')::numeric; end if;
 if (p_details->>'liftHeight') ~ '^[0-9]+(\.[0-9]+)?$' then height:=(p_details->>'liftHeight')::numeric; end if;
 snapshot:=public.quote_nearest_provider_equipment(
  p_key,p_details->>'location',p_details->>'service',weight,height,
  (p_details->>'durationDays')::integer
 );
 update public.customer_requests set pricing_snapshot=snapshot
 where id=saved_id and pricing_snapshot is null;
 return saved_id;
end; $function$;
revoke all on function public.create_priced_customer_request(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_priced_customer_request(text,uuid,text,jsonb) to anon;
