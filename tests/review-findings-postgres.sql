\set ON_ERROR_STOP on
-- Disposable Postgres only: synthetic UUIDs, ZIPs, policy snapshots, no external services.
begin;
create role anon;
create role authenticated;
create schema private;
create table public.operator_applications(id uuid primary key,status text not null,profile jsonb not null);
create table public.operator_submissions(application_id uuid not null,profile_snapshot jsonb not null);
create table public.provider_insurance_reviews(application_id uuid not null,profile_snapshot jsonb not null);
create table public.provider_contract_envelopes(
 application_id uuid not null,business_hash text not null,provider_signed_at timestamptz,
 liftcrew_signed_at timestamptz,created_at timestamptz not null default now()
);
create table public.operator_reviews(application_id uuid not null,decision text not null,
 evidence_fingerprint text,valid_until date,created_at timestamptz not null default now());
create table public.operator_documents(application_id uuid not null,active boolean not null,expires_on date);
create table private.us_zip_centroids(zip text primary key,latitude double precision,longitude double precision);
create function private.provider_number(value text) returns numeric language plpgsql immutable as $$
begin
 if value !~ '^[0-9]+(\.[0-9]+)?$' then return null; end if;
 return value::numeric;
exception when others then return null;
end; $$;
create function private.provider_date(value text) returns date language plpgsql immutable as $$
begin return value::date; exception when others then return null; end; $$;
create function private.provider_hash(value text) returns text language sql immutable as $$
 select md5(value); $$;
create function private.provider_fingerprint(p_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select md5(a.profile::text) from public.operator_applications a where a.id=p_id;
$$;
create function private.zip_distance_miles(double precision,double precision,double precision,double precision)
returns double precision language sql immutable as $$
 select abs($4-$2)*69; $$;
create function private.check_customer_intake_key(p_key text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_key is distinct from 'synthetic-test-only-intake-credentials-never-production' then
  raise exception 'No valid test credential';
 end if;
end; $$;
-- Deliberately protected: any erroneous invocation by the anonymous quote will raise.
create function public.provider_clearance(p_application_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin raise exception 'Reviewer-only clearance was invoked'; end; $$;
revoke all on function public.provider_clearance(uuid) from public,anon,authenticated;
grant execute on function public.provider_clearance(uuid) to authenticated;
alter table public.operator_applications enable row level security;
grant select,update(profile) on public.operator_applications to authenticated;
create policy synthetic_owner_edit on public.operator_applications for update to authenticated
 using(true) with check(true);
grant usage on schema private to authenticated;
revoke all on public.operator_submissions,public.provider_insurance_reviews from public,anon,authenticated;
insert into private.us_zip_centroids(zip,latitude,longitude)
 values ('10001',0,0),('10002',0,0.58),('10003',0,0.15);
insert into public.operator_applications(id,status,profile) values
 ('11111111-1111-4111-a111-111111111111','approved',
 '{"business":{"legalName":"Synthetic Company","radiusMiles":"100"},
 "equipment":[{"id":"unit-1","baseZip":"10001","category":"Warehouse forklift","capacity":"10000","liftHeight":"20","hourlyRate":"100","fourHourRate":"300","dailyRate":"700"}],
 "operators":[{"equipmentIds":["unit-1"],"adult":"yes","evaluationDate":"2026-01-01"}],
 "insurance":{"inputMode":"packet","maximumLoadValue":500000}}'::jsonb),
 ('22222222-2222-4222-a222-222222222222','changes_requested',
 '{"business":{"legalName":"Historic Company"},"equipment":[],"operators":[],"insurance":{"inputMode":"packet","maximumLoadValue":250000}}'::jsonb),
 ('33333333-3333-4333-a333-333333333333','draft',
 '{"business":{"legalName":"New Company"},"insurance":{"inputMode":"packet"}}'::jsonb);
insert into public.operator_submissions(application_id,profile_snapshot)
values ('22222222-2222-4222-a222-222222222222',
 '{"insurance":{"maximumLoadValue":900000}}'::jsonb);
insert into public.provider_insurance_reviews(application_id,profile_snapshot)
values ('22222222-2222-4222-a222-222222222222',
 '{"insurance":{"maximumLoadValue":800000}}'::jsonb);
insert into public.provider_contract_envelopes(application_id,business_hash,provider_signed_at,liftcrew_signed_at)
select id,private.provider_hash((profile->'business')::text),now(),now() from public.operator_applications
where id='11111111-1111-4111-a111-111111111111';
insert into public.operator_reviews(application_id,decision,evidence_fingerprint,valid_until)
select id,'approved',private.provider_fingerprint(id),current_date+30
from public.operator_applications where id='11111111-1111-4111-a111-111111111111';
-- Exercise the exact original production quote function, then its real migration patch.
\i /tmp/liftcrew-original-quote.sql
revoke all on function public.quote_nearest_provider_equipment(text,text,text,numeric,numeric,integer)
 from public,anon,authenticated;
grant execute on function public.quote_nearest_provider_equipment(text,text,text,numeric,numeric,integer) to anon;
\ir ../supabase/migrations/20261020205500_review_findings_safety.sql

do $assertions$
declare result jsonb; priced numeric;
begin
 if has_function_privilege('anon','public.provider_clearance(uuid)','EXECUTE')
  or not has_function_privilege('authenticated','public.provider_clearance(uuid)','EXECUTE') then
  raise exception 'Reviewer/owner clearance ACL was changed';
 end if;
 if not has_function_privilege('anon','public.quote_nearest_provider_equipment(text,text,text,numeric,numeric,integer)','EXECUTE')
  or has_function_privilege('authenticated','public.quote_nearest_provider_equipment(text,text,text,numeric,numeric,integer)','EXECUTE') then
  raise exception 'Existing pricing ACL was changed';
 end if;
 if has_function_privilege('anon','private.preserve_provider_handling_disclosure()','EXECUTE')
 or has_function_privilege('authenticated','private.preserve_provider_handling_disclosure()','EXECUTE') then
  raise exception 'Internal disclosure guard is publicly callable';
 end if;
 if (select private.provider_number(profile->'insurance'->>'maximumLoadValue')
     from public.operator_applications where id='22222222-2222-4222-a222-222222222222')<>900000 then
  raise exception 'Historical submission backfill did not retain highest exposure';
 end if;
 -- Approved synthetic inventory must be quoteable without calling the reviewer-only API.
 result:=public.quote_nearest_provider_equipment(
 'synthetic-test-only-intake-credentials-never-production','10002','Forklift with operator',5000,10,1);
 if result->>'status'<>'matched' or (result->>'deliveryFee')::numeric<=0 then
  raise exception 'Approved eligible equipment was not priced: %',result;
 end if;
 if result ? 'contact' or result ? 'email' or result ? 'application_id' then
  raise exception 'Private provider identity leaked in pricing response';
 end if;
 result:=public.quote_nearest_provider_equipment(
 'synthetic-test-only-intake-credentials-never-production','10003','Forklift with operator',5000,10,1);
 if result->>'status'<>'matched' or (result->>'deliveryFee')::numeric<>0 then
  raise exception 'Free 25-mile allowance changed';
 end if;
 result:=public.quote_nearest_provider_equipment(
 'synthetic-test-only-intake-credentials-never-production','10003','Crane with operator',null,null,1);
 if result->>'status'<>'manual' then raise exception 'Crane needs specialty review'; end if;
end; $assertions$;
-- Test RLS-writable direct profile updates under applicant role: no client/UI assumptions.
set role authenticated;
update public.operator_applications set profile=profile#-'{insurance,maximumLoadValue}'
where id='11111111-1111-4111-a111-111111111111';
update public.operator_applications set profile=profile#-'{insurance,maximumLoadValue}'
where id='22222222-2222-4222-a222-222222222222';
update public.operator_applications
 set profile=jsonb_set(profile,'{insurance,maximumLoadValue}','1000000'::jsonb)
where id='22222222-2222-4222-a222-222222222222';
update public.operator_applications set profile=profile#-'{insurance,maximumLoadValue}'
where id='22222222-2222-4222-a222-222222222222';
reset role;
do $assertions$
begin
 if (select private.provider_number(profile->'insurance'->>'maximumLoadValue')
     from public.operator_applications where id='11111111-1111-4111-a111-111111111111')<>500000 then
  raise exception 'Direct edit removed declared handling exposure';
 end if;
 if (select private.provider_number(profile->'insurance'->>'maximumLoadValue')
     from public.operator_applications where id='22222222-2222-4222-a222-222222222222')<>1000000 then
  raise exception 'Reopened provider could lower highest historic exposure';
 end if;
 if (select profile->'insurance' ? 'maximumLoadValue'
     from public.operator_applications where id='33333333-3333-4333-a333-333333333333') then
  raise exception 'New provider was forced to invent a job-property value';
 end if;
end; $assertions$;
-- Approved fingerprints must go stale if the provider changes its profile.
do $assertions$
declare result jsonb;
begin
 result:=public.quote_nearest_provider_equipment(
 'synthetic-test-only-intake-credentials-never-production','10002','Forklift with operator',5000,10,1);
 if result->>'status'<>'unavailable' then raise exception 'Stale approval fingerprint still priced equipment'; end if;
end; $assertions$;
-- Test additional gates after resetting the matching fingerprint.
update public.operator_reviews
 set evidence_fingerprint=private.provider_fingerprint('11111111-1111-4111-a111-111111111111')
where application_id='11111111-1111-4111-a111-111111111111';
insert into public.provider_contract_envelopes(application_id,business_hash,provider_signed_at,liftcrew_signed_at)
select id,private.provider_hash((profile->'business')::text),now()+interval '5 seconds',null
from public.operator_applications where id='11111111-1111-4111-a111-111111111111';
do $assertions$
begin
 if (public.quote_nearest_provider_equipment(
  'synthetic-test-only-intake-credentials-never-production','10002','Forklift with operator',5000,10,1)->>'status')<>'unavailable'
 then raise exception 'Newer un-countersigned agreement was accepted'; end if;
end; $assertions$;
delete from public.provider_contract_envelopes where liftcrew_signed_at is null;
insert into public.operator_documents(application_id,active,expires_on)
values('11111111-1111-4111-a111-111111111111',true,current_date-1);
do $assertions$
begin
 if (public.quote_nearest_provider_equipment(
  'synthetic-test-only-intake-credentials-never-production','10002','Forklift with operator',5000,10,1)->>'status')<>'unavailable'
 then raise exception 'Expired provider document was accepted'; end if;
end; $assertions$;
delete from public.operator_documents;
update public.operator_reviews set valid_until=current_date-1
where application_id='11111111-1111-4111-a111-111111111111';
do $assertions$
begin
 if (public.quote_nearest_provider_equipment(
  'synthetic-test-only-intake-credentials-never-production','10002','Forklift with operator',5000,10,1)->>'status')<>'unavailable'
 then raise exception 'Expired independently verified policy was accepted'; end if;
end; $assertions$;
rollback;
