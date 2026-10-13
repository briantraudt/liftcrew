-- ZIP-center radius matching. Reference data stays private; no runtime geocoding calls.
create table private.us_zip_centroids (
 zip text primary key check (zip ~ '^[0-9]{5}$'),
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 city text not null, state text not null,
 source text not null default 'US-Zip-Codes-JSON/a8964849d0ea3d3fa9eb18e57f20ac2cc41571f3',
 imported_at timestamptz not null default now()
);
revoke all on private.us_zip_centroids from public,anon,authenticated;
alter table private.us_zip_centroids enable row level security;
create index us_zip_centroids_lat_idx on private.us_zip_centroids(latitude);

-- Import a pinned, MIT-licensed public reference dataset and verify its Git blob hash.
-- The HTTP extension is removed afterward if this migration installed it.
do $seed$
declare existed boolean; response record; body jsonb; imported integer;
begin
 select exists(select 1 from pg_extension where extname='http') into existed;
 if not existed then execute 'create extension http with schema extensions'; end if;
 select * into response from extensions.http_get('https://raw.githubusercontent.com/millbj92/US-Zip-Codes-JSON/a8964849d0ea3d3fa9eb18e57f20ac2cc41571f3/USCities.json');
 if response.status<>200 then raise exception 'ZIP reference data download failed'; end if;
 if encode(extensions.digest(convert_to('blob '||octet_length(response.content)::text,'UTF8')||decode('00','hex')||convert_to(response.content,'UTF8'),'sha1'),'hex')<>'440ac52ba8150cd1f57126c4a6db0994a7b04c5f' then raise exception 'ZIP reference checksum mismatch'; end if;
 body:=response.content::jsonb;
 if jsonb_typeof(body)<>'array' or jsonb_array_length(body) not between 30000 and 60000 then raise exception 'Invalid ZIP reference dataset'; end if;
 insert into private.us_zip_centroids(zip,latitude,longitude,city,state)
 select distinct on (lpad(x->>'zip_code',5,'0')) lpad(x->>'zip_code',5,'0'),(x->>'latitude')::double precision,(x->>'longitude')::double precision,x->>'city',x->>'state'
 from jsonb_array_elements(body) x
 where x->>'zip_code' ~ '^[0-9]{1,5}$' and jsonb_typeof(x->'latitude')='number' and jsonb_typeof(x->'longitude')='number'
 and (x->>'latitude')::double precision between -90 and 90 and (x->>'longitude')::double precision between -180 and 180
 and not ((x->>'latitude')::double precision=0 and (x->>'longitude')::double precision=0)
 and nullif(x->>'city','') is not null and nullif(x->>'state','') is not null
 order by lpad(x->>'zip_code',5,'0'),x->>'city';
 get diagnostics imported=row_count;
 if imported<30000 then raise exception 'ZIP reference import is incomplete'; end if;
 if not existed then execute 'drop extension http'; end if;
end $seed$;

create function private.zip_distance_miles(lat1 double precision,lon1 double precision,lat2 double precision,lon2 double precision)
returns double precision language sql immutable strict set search_path='' as $$
 select 3958.7613*2*asin(sqrt(least(1.0,greatest(0.0,power(sin(radians(lat2-lat1)/2),2)+cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2)))));
$$;
revoke all on function private.zip_distance_miles(double precision,double precision,double precision,double precision) from public,anon,authenticated;

create function public.provider_service_area(p_zip text,p_radius numeric) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare home private.us_zip_centroids; covered jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to calculate coverage'; end if;
 if p_zip is null or p_zip !~ '^[0-9]{5}$' or p_radius is null or not (p_radius>0 and p_radius<=3000) then raise exception 'Enter a five-digit ZIP and a radius greater than zero, up to 3,000 miles'; end if;
 select * into home from private.us_zip_centroids where zip=p_zip;
 if home.zip is null then raise exception 'This ZIP is not in our location reference. Check your home ZIP or contact LiftCrew'; end if;
 select coalesce(jsonb_agg(z.zip order by z.zip),'[]'::jsonb) into covered from private.us_zip_centroids z
 where abs(z.latitude-home.latitude)<=p_radius::double precision/68.0
 and private.zip_distance_miles(home.latitude,home.longitude,z.latitude,z.longitude)<=p_radius;
 return jsonb_build_object('zip',home.zip,'city',home.city,'state',home.state,'radiusMiles',p_radius,'count',jsonb_array_length(covered),'zips',covered,'basis','Approximate straight-line distance between ZIP centers; not driving distance or a guarantee of coverage for every address.');
end; $$;
revoke all on function public.provider_service_area(text,numeric) from public,anon,authenticated;
grant execute on function public.provider_service_area(text,numeric) to authenticated;

create or replace function public.match_provider_equipment(p_zip text,p_capacity numeric,p_height numeric,p_category text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; destination private.us_zip_centroids;
begin
 if not private.is_operator_reviewer() then raise exception 'Reviewer access required'; end if;
 if p_zip is null or p_zip !~ '^[0-9]{5}$' or p_capacity is null or p_capacity<=0 or p_height is null or p_height<=0 then raise exception 'Enter ZIP, positive load weight and lift height'; end if;
 select * into destination from private.us_zip_centroids where zip=p_zip;
 if destination.zip is null then raise exception 'Job ZIP is not in the location reference; verify it before matching'; end if;
 select coalesce(jsonb_agg(t),'[]'::jsonb) into rows from (
  select a.id as application_id,a.profile->'business'->>'legalName' as provider,a.profile->'business'->>'contactName' as contact,a.profile->'business'->>'phone' as phone,e.value as equipment,
   round(distance.miles::numeric,1) as distance_miles,private.provider_number(a.profile->'business'->>'radiusMiles') as radius_miles,
   'ZIP-center radius estimate. Verify authorized operator, load chart, attachments, actual site access, availability, coverage values and work order before dispatch.' as next_check
  from public.operator_applications a
  join private.us_zip_centroids home on home.zip=a.profile->'business'->>'zip'
  cross join lateral jsonb_array_elements(a.profile->'equipment') e
  cross join lateral (select private.zip_distance_miles(home.latitude,home.longitude,destination.latitude,destination.longitude) as miles) distance
  where a.status='approved' and (public.provider_clearance(a.id)->>'eligible')::boolean
   and distance.miles<=private.provider_number(a.profile->'business'->>'radiusMiles')
   and e.value->>'category'<>'Crane' and (p_category is null or e.value->>'category'=p_category)
   and private.provider_number(e.value->>'capacity')>=p_capacity and private.provider_number(e.value->>'liftHeight')>=p_height
   and exists(select 1 from jsonb_array_elements(a.profile->'operators') o where jsonb_typeof(o->'equipmentIds')='array' and (o->'equipmentIds') ? (e.value->>'id') and o->>'adult'='yes' and private.provider_date(o->>'evaluationDate') between (current_date-interval '3 years')::date and current_date)
  order by distance.miles,a.id,e.value->>'id' limit 100
 ) t;
 return rows;
end; $$;
