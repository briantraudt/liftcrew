-- Close two review findings without changing public function grants or reviewer-only APIs.
-- Secret-gated quote RPC retains its existing EXECUTE ACL; clearance remains owner/reviewer-only.
do $patch$
declare definition text; needle text;
begin
 definition:=pg_get_functiondef('public.quote_nearest_provider_equipment(text,text,text,numeric,numeric,integer)'::regprocedure);
 needle:=$old$and (public.provider_clearance(a.id)->>'eligible')::boolean is true$old$;
 if position(needle in definition)=0 then
  raise exception 'Unexpected pricing function: reviewer-only clearance call not found';
 end if;
 definition:=replace(definition,needle,$new$and (
    select r.decision='approved'
     and r.evidence_fingerprint=private.provider_fingerprint(a.id)
     and r.valid_until>current_date
    from public.operator_reviews r
    where r.application_id=a.id
    order by r.revision desc,r.created_at desc,r.id desc limit 1
   ) is true
   and coalesce((
    select e.liftcrew_signed_at is not null
    from public.provider_contract_envelopes e
    where e.application_id=a.id
     and e.business_hash=private.provider_hash((a.profile->'business')::text)
     and e.provider_signed_at is not null
    order by e.created_at desc limit 1
   ),false)
   and not exists(
    select 1 from public.operator_documents d
    where d.application_id=a.id and d.active and d.expires_on<=current_date
   )
   and not exists(
    select 1 from jsonb_array_elements(coalesce(a.profile->'operators','[]'::jsonb)) o
    where private.provider_date(o->>'evaluationDate') is null
     or private.provider_date(o->>'evaluationDate')<(current_date-interval '3 years')::date
   )$new$);
 execute definition;
end $patch$;

-- Once declared, a higher property-handling exposure survives a provider's edits.
-- The historical sources are non-applicant-writable submission and review snapshots.
create function private.preserve_provider_handling_disclosure() returns trigger
language plpgsql security definer set search_path='' as $guard$
declare highest numeric;
begin
 select greatest(
  coalesce(private.provider_number(old.profile->'insurance'->>'maximumLoadValue'),0),
  coalesce(private.provider_number(new.profile->'insurance'->>'maximumLoadValue'),0),
  coalesce((
   select max(private.provider_number(s.profile_snapshot->'insurance'->>'maximumLoadValue'))
   from public.operator_submissions s where s.application_id=old.id
  ),0),
  coalesce((
   select max(private.provider_number(r.profile_snapshot->'insurance'->>'maximumLoadValue'))
   from public.provider_insurance_reviews r where r.application_id=old.id
  ),0)
 ) into highest;
 if highest>0 then
  new.profile:=jsonb_set(
   new.profile,'{insurance}',
   (case when jsonb_typeof(new.profile->'insurance')='object'
     then new.profile->'insurance' else '{}'::jsonb end)
     || jsonb_build_object('maximumLoadValue',highest),
   true
  );
 end if;
 return new;
end; $guard$;
revoke all on function private.preserve_provider_handling_disclosure() from public,anon,authenticated;
create trigger preserve_provider_handling_disclosure
 before update of profile on public.operator_applications
 for each row execute function private.preserve_provider_handling_disclosure();

-- Recover an already-edited disclosure from durable historical snapshots, if any.
-- The normal profile fingerprint then requires the usual fresh review after restoration.
with recorded as (
 select a.id,
 greatest(
  coalesce(private.provider_number(a.profile->'insurance'->>'maximumLoadValue'),0),
  coalesce((
   select max(private.provider_number(s.profile_snapshot->'insurance'->>'maximumLoadValue'))
   from public.operator_submissions s where s.application_id=a.id
  ),0),
  coalesce((
   select max(private.provider_number(r.profile_snapshot->'insurance'->>'maximumLoadValue'))
   from public.provider_insurance_reviews r where r.application_id=a.id
  ),0)
 ) as highest
 from public.operator_applications a
)
update public.operator_applications a
set profile=jsonb_set(
 a.profile,'{insurance}',
 (case when jsonb_typeof(a.profile->'insurance')='object'
    then a.profile->'insurance' else '{}'::jsonb end)
    || jsonb_build_object('maximumLoadValue',recorded.highest),
 true
)
from recorded where recorded.id=a.id
 and recorded.highest>coalesce(private.provider_number(a.profile->'insurance'->>'maximumLoadValue'),0);
