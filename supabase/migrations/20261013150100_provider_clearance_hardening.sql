-- Keep review reuse scoped to insurance + declared profile. Other records cannot change
-- while approved: application/document RLS requires draft or changes_requested first.
create or replace function private.provider_fingerprint(p_id uuid) returns text language sql stable security definer set search_path='' as $$
 select private.provider_hash(a.profile::text || coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'path',d.object_path,'kind',d.kind,'expiry',d.expires_on) order by d.id)::text from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind in ('coi','declarations','endorsements','handling','owner_coverage','equipment_coverage')),'[]')) from public.operator_applications a where a.id=p_id;
$$;
-- Qualify the column that shares a name with the legacy RPC argument.
do $$ declare definition text; expected text:='from public.provider_contract_envelopes where application_id=a.id and business_hash='; begin
 definition:=pg_get_functiondef('private.submit_operator_application(uuid,text,text,jsonb)'::regprocedure);
 if position(expected in definition)=0 then raise exception 'Unexpected submit function; review migration before applying'; end if;
 execute replace(definition,expected,'from public.provider_contract_envelopes pe where pe.application_id=a.id and business_hash=');
end $$;

alter table public.provider_contract_envelopes add constraint provider_signature_complete check(provider_signed_at is null or (provider_user_id is not null and provider_name is not null and length(trim(provider_name)) between 2 and 200 and provider_title is not null and length(trim(provider_title)) between 2 and 100 and consent_version is not null and read_confirmed_at is not null));
alter table public.provider_contract_envelopes add constraint liftcrew_signature_complete check(liftcrew_signed_at is null or (provider_signed_at is not null and liftcrew_user_id is not null and liftcrew_name is not null and length(trim(liftcrew_name)) between 2 and 200 and liftcrew_title is not null and length(trim(liftcrew_title)) between 2 and 100));
create function private.guard_provider_signature() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.body is distinct from old.body or new.sha256 is distinct from old.sha256 or new.business_hash is distinct from old.business_hash or new.version_id is distinct from old.version_id or new.application_id is distinct from old.application_id then raise exception 'Contract content is immutable'; end if;
 if old.provider_signed_at is not null and row(new.provider_user_id,new.provider_name,new.provider_title,new.provider_signed_at,new.consent_version,new.read_confirmed_at) is distinct from row(old.provider_user_id,old.provider_name,old.provider_title,old.provider_signed_at,old.consent_version,old.read_confirmed_at) then raise exception 'Provider signature is immutable'; end if;
 if old.liftcrew_signed_at is not null and row(new.liftcrew_user_id,new.liftcrew_name,new.liftcrew_title,new.liftcrew_signed_at) is distinct from row(old.liftcrew_user_id,old.liftcrew_name,old.liftcrew_title,old.liftcrew_signed_at) then raise exception 'LiftCrew signature is immutable'; end if;
 if old.provider_signed_at is null and new.provider_signed_at is not null and new.version_id is distinct from (select id from public.provider_contract_versions order by published_at desc limit 1) then raise exception 'A newer agreement is available. Reload before signing'; end if;
 return new;
end; $$;
create trigger provider_signature_immutability before update on public.provider_contract_envelopes for each row execute function private.guard_provider_signature();
create function private.limit_provider_review_records() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='provider_contract_envelopes' then
  perform 1 from public.operator_applications where id=new.application_id for update;
  if (select count(*) from public.provider_contract_envelopes where application_id=new.application_id)>=100 then raise exception 'Agreement preparation limit reached; contact LiftCrew'; end if;
 else
  -- Transaction advisory lock prevents parallel requests from exceeding the shared ceiling.
  perform pg_advisory_xact_lock(20261013,1);
  if (select count(*) from public.provider_insurance_reviews where created_at>now()-interval '24 hours')>=200 then raise exception 'Review service daily limit reached; request human review'; end if;
 end if;
 return new;
end; $$;
create trigger provider_envelope_limit before insert on public.provider_contract_envelopes for each row execute function private.limit_provider_review_records();
create trigger provider_review_global_limit before insert on public.provider_insurance_reviews for each row execute function private.limit_provider_review_records();
revoke all on function private.guard_provider_signature(),private.limit_provider_review_records() from public,anon,authenticated;

-- Operational health stores no credential value and is readable only by reviewers.
create table public.provider_service_status(name text primary key,state jsonb not null,checked_at timestamptz not null default now());
alter table public.provider_service_status enable row level security;
revoke all on public.provider_service_status from public,anon,authenticated;
grant select on public.provider_service_status to authenticated;
grant all on public.provider_service_status to service_role;
create policy provider_service_status_review on public.provider_service_status for select to authenticated using((select private.is_operator_reviewer()));
