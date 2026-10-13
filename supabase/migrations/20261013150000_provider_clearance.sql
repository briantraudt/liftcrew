-- Provider onboarding v2: immutable signatures, document-review jobs and live work eligibility.
-- No applicant can assign approval, write an AI result, or act as a LiftCrew signer.
create extension if not exists pgcrypto with schema extensions;
alter table public.operator_documents drop constraint operator_documents_kind_check;
alter table public.operator_documents add constraint operator_documents_kind_check check(kind in ('w9','coi','declarations','endorsements','handling','owner_coverage','equipment_coverage','equipment_photo','capacity_plate','inspection','lease','training','evaluation','transport','other','final_agreement'));

create table public.provider_contract_versions (
 id uuid primary key default gen_random_uuid(), version text not null unique,
 legal_entity text not null, notice_address text not null, notice_email text not null,
 body text not null check(length(body) between 2000 and 100000), sha256 text not null,
 published_by uuid not null references auth.users(id), published_at timestamptz not null default now()
);
create table public.provider_contract_envelopes (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.operator_applications(id),
 version_id uuid not null references public.provider_contract_versions(id), business_hash text not null,
 body text not null, sha256 text not null, created_at timestamptz not null default now(),
 provider_user_id uuid references auth.users(id), provider_name text, provider_title text, provider_signed_at timestamptz,
 consent_version text, read_confirmed_at timestamptz,
 liftcrew_user_id uuid references auth.users(id), liftcrew_name text, liftcrew_title text, liftcrew_signed_at timestamptz
);
create index provider_envelopes_application_idx on public.provider_contract_envelopes(application_id,created_at desc);
create table public.provider_insurance_reviews (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.operator_applications(id),
 fingerprint text not null, manifest jsonb not null, profile_snapshot jsonb not null,
 state text not null default 'queued' check(state in ('queued','reading','complete','manual_review','stale')),
 result jsonb not null default '{}'::jsonb check(octet_length(result::text)<200000),
 consent_version text not null, requested_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), completed_at timestamptz
);
create index provider_insurance_application_idx on public.provider_insurance_reviews(application_id,created_at desc);
alter table public.operator_reviews add column evidence_fingerprint text;
alter table public.operator_reviews add column valid_until date;
alter table public.provider_contract_versions enable row level security;
alter table public.provider_contract_envelopes enable row level security;
alter table public.provider_insurance_reviews enable row level security;
revoke all on public.provider_contract_versions,public.provider_contract_envelopes,public.provider_insurance_reviews from public,anon,authenticated;
grant select on public.provider_contract_versions,public.provider_contract_envelopes,public.provider_insurance_reviews to authenticated;
grant all on public.provider_contract_versions,public.provider_contract_envelopes,public.provider_insurance_reviews to service_role;
create policy provider_contract_read on public.provider_contract_versions for select to authenticated using(true);
create policy provider_envelope_read on public.provider_contract_envelopes for select to authenticated using(exists(select 1 from public.operator_applications a where a.id=application_id and (a.user_id=(select auth.uid()) or (select private.is_operator_reviewer()))));
create policy provider_insurance_read on public.provider_insurance_reviews for select to authenticated using(exists(select 1 from public.operator_applications a where a.id=application_id and (a.user_id=(select auth.uid()) or (select private.is_operator_reviewer()))));

create function private.provider_hash(value text) returns text language sql immutable set search_path='' as $$ select encode(extensions.digest(value,'sha256'),'hex'); $$;
create function private.provider_date(value text) returns date language plpgsql immutable set search_path='' as $$ begin return value::date; exception when others then return null; end; $$;
create function private.provider_number(value text) returns numeric language plpgsql immutable set search_path='' as $$ begin if value !~ '^[0-9]+(\.[0-9]+)?$' then return null; end if; return value::numeric; exception when others then return null; end; $$;
create function private.provider_fingerprint(p_id uuid) returns text language sql stable security definer set search_path='' as $$
 select private.provider_hash(a.profile::text || coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'path',d.object_path,'kind',d.kind,'expiry',d.expires_on) order by d.id)::text from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind<>'final_agreement'),'[]')) from public.operator_applications a where a.id=p_id;
$$;
create function private.provider_profile_errors(p jsonb, full_check boolean default true) returns text[] language plpgsql stable set search_path='' as $$
declare errors text[]:='{}'; k text; item jsonb; category text;
begin
 foreach k in array array['legalName','entityType','formationState','address','city','state','zip','contactName','email','phone','serviceArea','serviceZipCodes','radiusMiles','emergencyName','emergencyPhone','availability'] loop
  if length(trim(coalesce(p->'business'->>k,'')))<1 then errors:=array_append(errors,'Business: '||k); end if;
 end loop;
 if coalesce(p->'business'->>'zip','') !~ '^[0-9]{5}$' then errors:=array_append(errors,'Business ZIP must have five digits'); end if;
 if coalesce(p->'business'->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then errors:=array_append(errors,'Business email is invalid'); end if;
 if coalesce(p->'business'->>'serviceZipCodes','') !~ '^[0-9]{5}(\s*,\s*[0-9]{5}){0,99}$' then errors:=array_append(errors,'Enter up to 100 service ZIP codes separated by commas'); end if;
 if coalesce(private.provider_number(p->'business'->>'radiusMiles'),0)<=0 then errors:=array_append(errors,'Service radius must be positive'); end if;
 if jsonb_typeof(p->'equipment') is distinct from 'array' or jsonb_typeof(p->'operators') is distinct from 'array' then return array_append(errors,'Add equipment and operators'); end if;
 if jsonb_array_length(p->'equipment') not between 1 and 20 or jsonb_array_length(p->'operators') not between 1 and 20 then errors:=array_append(errors,'Add between 1 and 20 machines and operators'); end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p->'equipment'))<>jsonb_array_length(p->'equipment') or (select count(distinct value->>'id') from jsonb_array_elements(p->'operators'))<>jsonb_array_length(p->'operators') then errors:=array_append(errors,'Each equipment/operator entry needs a unique identifier'); end if;
 for item in select value from jsonb_array_elements(p->'equipment') loop
  foreach k in array array['id','category','make','model','serial','ownership','capacity','liftHeight','fuel','tires','attachments','transport','inspectionDate','baseZip','availability','replacementValue','widthIn','heightIn','weightLb'] loop
   if nullif(trim(item->>k),'') is null then errors:=array_append(errors,'Equipment: '||k); end if;
  end loop;
  category:=item->>'category';
  if category not in ('Warehouse forklift','Rough-terrain forklift','Telehandler','Crane') then errors:=array_append(errors,'Select an equipment category'); end if;
  foreach k in array array['capacity','liftHeight','replacementValue','widthIn','heightIn','weightLb'] loop
   if coalesce(private.provider_number(item->>k),0)<=0 then errors:=array_append(errors,'Equipment '||k||' must be positive'); end if;
  end loop;
  if category='Crane' then
   if coalesce(private.provider_number(item->>'workingRadiusFt'),0)<=0 then errors:=array_append(errors,'Crane working radius is required'); end if;
  elsif coalesce(private.provider_number(item->>'loadCenter'),0)<=0 then errors:=array_append(errors,'Forklift load center is required'); end if;
  if coalesce(item->>'baseZip','') !~ '^[0-9]{5}$' then errors:=array_append(errors,'Equipment base ZIP must have five digits'); end if;
  if private.provider_date(item->>'inspectionDate') is null or private.provider_date(item->>'inspectionDate')>current_date then errors:=array_append(errors,'Enter a valid inspection date, not in the future'); end if;
  if item->>'ownership' not in ('Owned','Leased','Rented') then errors:=array_append(errors,'Select equipment ownership'); end if;
 end loop;
 for item in select value from jsonb_array_elements(p->'operators') loop
  foreach k in array array['id','name','relationship','equipmentTypes','trainingDate','evaluationDate','trainer','evaluator'] loop
   if nullif(trim(item->>k),'') is null then errors:=array_append(errors,'Operator: '||k); end if;
  end loop;
  if item->>'adult' is distinct from 'yes' then errors:=array_append(errors,'Confirm every operator is at least 18'); end if;
  if private.provider_date(item->>'trainingDate') is null or private.provider_date(item->>'trainingDate')>current_date then errors:=array_append(errors,'Enter a valid training date'); end if;
  if private.provider_date(item->>'evaluationDate') is null or private.provider_date(item->>'evaluationDate')>current_date or private.provider_date(item->>'evaluationDate')<(current_date-interval '3 years')::date then errors:=array_append(errors,'A current practical evaluation is required'); end if;
 end loop;
 if full_check then
  foreach k in array array['brokerName','brokerEmail','brokerPhone','workingOwners','exceptions','maximumLoadValue'] loop
   if nullif(trim(p->'insurance'->>k),'') is null then errors:=array_append(errors,'Insurance: '||k); end if;
  end loop;
  if coalesce(private.provider_number(p->'insurance'->>'maximumLoadValue'),0)<=0 then errors:=array_append(errors,'Enter the maximum total property value you intend to handle per job'); end if;
  foreach k in array array['cgl','auto','wc','employers','umbrella','handling','equipment'] loop
   item:=p->'insurance'->k;
   if nullif(item->>'carrier','') is null or nullif(item->>'policy','') is null or nullif(item->>'limit','') is null then errors:=array_append(errors,'Complete policy details: '||k); end if;
   if private.provider_date(item->>'expiry') is null or private.provider_date(item->>'expiry')<=current_date then errors:=array_append(errors,'Current policy expiration required: '||k); end if;
  end loop;
 end if;
 return errors;
end; $$;

create function public.publish_provider_contract(p_version text,p_entity text,p_address text,p_email text,p_body text,p_reviewed boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if not private.is_operator_reviewer() then raise exception 'Reviewer access required'; end if;
 if p_reviewed is distinct from true then raise exception 'Confirm counsel and insurance-broker review before publishing'; end if;
 if length(trim(p_version)) not between 3 and 120 or length(trim(p_entity))<3 or length(trim(p_address))<10 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Complete version and LiftCrew legal details'; end if;
 if length(p_body) not between 2000 and 100000 or p_body ~* '(review draft|\[[A-Z _/]+\]|_{3,}|\{\{)' then raise exception 'Publish a complete final agreement, including Schedule A, with no draft labels or blank placeholders'; end if;
 if p_body !~* 'Schedule A' then raise exception 'Include the complete insurance schedule'; end if;
 insert into public.provider_contract_versions(version,legal_entity,notice_address,notice_email,body,sha256,published_by) values(trim(p_version),trim(p_entity),trim(p_address),trim(p_email),p_body,private.provider_hash(p_body),auth.uid()) returning id into new_id;
 return new_id;
end; $$;
create function public.prepare_provider_contract(p_application_id uuid) returns public.provider_contract_envelopes language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; v public.provider_contract_versions; e public.provider_contract_envelopes; bh text; txt text; errors text[];
begin
 select * into a from public.operator_applications where id=p_application_id for update;
 if a.user_id is distinct from auth.uid() or a.status not in ('draft','changes_requested') then raise exception 'Editable application required'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Confirm your email first'; end if;
 errors:=private.provider_profile_errors(a.profile,false); if cardinality(errors)>0 then raise exception '%',array_to_string(errors,', '); end if;
 bh:=private.provider_hash((a.profile->'business')::text);
 select * into e from public.provider_contract_envelopes where application_id=a.id and business_hash=bh and provider_signed_at is not null order by created_at desc limit 1;
 if e.id is not null then return e; end if;
 select * into v from public.provider_contract_versions order by published_at desc limit 1;
 if v.id is null then raise exception 'LiftCrew is finalizing the provider agreement. Save your profile and continue uploading documents; signing is not enabled yet.'; end if;
 select * into e from public.provider_contract_envelopes where application_id=a.id and business_hash=bh and version_id=v.id order by created_at desc limit 1;
 if e.id is not null then return e; end if;
 txt:='PROVIDER AGREEMENT | '||v.version||E'\nPrepared: '||current_date||E'\nLiftCrew contracting entity: '||v.legal_entity||E'\nLiftCrew notice address: '||v.notice_address||E'\nLiftCrew notice email: '||v.notice_email||E'\nProvider legal name: '||(a.profile->'business'->>'legalName')||E'\nProvider structure / formation state: '||(a.profile->'business'->>'entityType')||' / '||(a.profile->'business'->>'formationState')||E'\nProvider notice address: '||(a.profile->'business'->>'address')||', '||(a.profile->'business'->>'city')||', '||(a.profile->'business'->>'state')||' '||(a.profile->'business'->>'zip')||E'\nProvider notice email: '||(a.profile->'business'->>'email')||E'\n\n' || v.body || E'\n\nExecution record: each party signs electronically below. Effective when both parties have signed, unless the agreement expressly states otherwise.';
 insert into public.provider_contract_envelopes(application_id,version_id,business_hash,body,sha256) values(a.id,v.id,bh,txt,private.provider_hash(txt)) returning * into e;
 return e;
end; $$;
create function public.sign_provider_contract(p_envelope_id uuid,p_name text,p_title text,p_read boolean,p_consent boolean) returns public.provider_contract_envelopes language plpgsql security definer set search_path='' as $$
declare e public.provider_contract_envelopes; a public.operator_applications;
begin
 select * into e from public.provider_contract_envelopes where id=p_envelope_id;
 select * into a from public.operator_applications where id=e.application_id for update;
 if a.user_id is distinct from auth.uid() or a.status not in ('draft','changes_requested') or e.business_hash is distinct from private.provider_hash((a.profile->'business')::text) then raise exception 'The business details changed. Reload your agreement'; end if;
 if p_read is distinct from true or p_consent is distinct from true or length(trim(p_name)) not between 2 and 200 or length(trim(p_title)) not between 2 and 100 then raise exception 'Read the agreement and confirm signature, consent and authority'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verified account required'; end if;
 if e.provider_signed_at is not null then return e; end if;
 update public.provider_contract_envelopes set provider_user_id=auth.uid(),provider_name=trim(p_name),provider_title=trim(p_title),provider_signed_at=now(),read_confirmed_at=now(),consent_version='provider-esign-v1-2026-10-13' where id=e.id returning * into e;
 return e;
end; $$;
create function public.countersign_provider_contract(p_envelope_id uuid,p_name text,p_title text,p_consent boolean) returns void language plpgsql security definer set search_path='' as $$
declare e public.provider_contract_envelopes; a public.operator_applications;
begin
 if not private.is_operator_reviewer() then raise exception 'Reviewer access required'; end if;
 select * into e from public.provider_contract_envelopes where id=p_envelope_id;
 select * into a from public.operator_applications where id=e.application_id for update;
 if e.provider_signed_at is null or e.business_hash is distinct from private.provider_hash((a.profile->'business')::text) then raise exception 'A current provider signature is required'; end if;
 if p_consent is distinct from true or length(trim(p_name))<2 or length(trim(p_title))<2 then raise exception 'Confirm your authority and electronic signature'; end if;
 if e.liftcrew_signed_at is not null then raise exception 'Already countersigned'; end if;
 update public.provider_contract_envelopes set liftcrew_user_id=auth.uid(),liftcrew_name=trim(p_name),liftcrew_title=trim(p_title),liftcrew_signed_at=now() where id=e.id;
end; $$;

create function public.begin_provider_insurance_review(p_application_id uuid,p_consent boolean,p_retry boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; r public.provider_insurance_reviews; fp text; docs jsonb; rid uuid;
begin
 select * into a from public.operator_applications where id=p_application_id for update;
 if a.user_id is distinct from auth.uid() or a.status not in ('draft','changes_requested','submitted') then raise exception 'Application not available for review'; end if;
 if p_consent is distinct from true then raise exception 'Authorize automated processing of your insurance documents'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verified account required'; end if;
 fp:=private.provider_fingerprint(a.id);
 select * into r from public.provider_insurance_reviews where application_id=a.id and fingerprint=fp order by created_at desc limit 1;
 if r.id is not null and ((r.state in ('queued','reading') and r.created_at>now()-interval '3 minutes') or (r.state='complete') or (r.state='manual_review' and not p_retry)) then return r.id; end if;
 if (select count(*) from public.provider_insurance_reviews where application_id=a.id and created_at>now()-interval '1 hour')>=5 then raise exception 'Review limit reached. Please wait an hour or contact LiftCrew'; end if;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) into docs from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind in ('coi','declarations','endorsements','handling','owner_coverage','equipment_coverage');
 if jsonb_array_length(docs)=0 then raise exception 'Upload your insurance documents first'; end if;
 insert into public.provider_insurance_reviews(application_id,fingerprint,manifest,profile_snapshot,consent_version,requested_by) values(a.id,fp,docs,a.profile,'insurance-ai-v1-2026-10-13',auth.uid()) returning id into rid;
 return rid;
end; $$;
create function public.claim_provider_insurance_review(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin update public.provider_insurance_reviews set state='reading' where id=p_id and state='queued'; return found; end; $$;
create function public.finish_provider_insurance_review(p_id uuid,p_result jsonb,p_manual boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.provider_insurance_reviews;
begin
 select * into r from public.provider_insurance_reviews where id=p_id;
 perform 1 from public.operator_applications where id=r.application_id for update;
 update public.provider_insurance_reviews set result=p_result,state=case when r.fingerprint is distinct from private.provider_fingerprint(r.application_id) then 'stale' when p_manual then 'manual_review' else 'complete' end,completed_at=now() where id=p_id and state in ('queued','reading');
end; $$;

create or replace function private.submit_operator_application(application_id uuid,typed_name text,signer_title text,acknowledgements jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; e public.provider_contract_envelopes; item jsonb; k text; errors text[]; docs jsonb; sid uuid;
begin
 select * into a from public.operator_applications where id=application_id for update;
 if a.user_id is distinct from auth.uid() or a.status not in ('draft','changes_requested') then raise exception 'Editable application required'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email'; end if;
 errors:=private.provider_profile_errors(a.profile,true);
 foreach k in array array['w9','coi','declarations','endorsements','handling','owner_coverage','equipment_coverage'] loop
  if not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind=k) then errors:=array_append(errors,'Upload '||k); end if;
 end loop;
 for item in select value from jsonb_array_elements(a.profile->'equipment') loop
  foreach k in array array['equipment_photo','capacity_plate','inspection'] loop
   if not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind=k and d.entity_id=item->>'id') then errors:=array_append(errors,'Upload '||k||' for '||(item->>'model')); end if;
  end loop;
  if item->>'ownership'<>'Owned' and not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind='lease' and d.entity_id=item->>'id') then errors:=array_append(errors,'Upload equipment lease/permission'); end if;
 end loop;
 for item in select value from jsonb_array_elements(a.profile->'operators') loop
  foreach k in array array['training','evaluation'] loop
   if not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind=k and d.entity_id=item->>'id') then errors:=array_append(errors,'Upload '||k||' for '||(item->>'name')); end if;
  end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(a.profile->'equipment') x where x->>'transport'='Self-delivery') and not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind='transport') then errors:=array_append(errors,'Upload transport qualifications'); end if;
 if exists(select 1 from public.operator_documents d where d.application_id=a.id and d.active and d.expires_on<=current_date) then errors:=array_append(errors,'Replace expired documents'); end if;
 select * into e from public.provider_contract_envelopes where application_id=a.id and business_hash=private.provider_hash((a.profile->'business')::text) and provider_signed_at is not null order by created_at desc limit 1;
 if e.id is null then errors:=array_append(errors,'Sign the finalized provider agreement'); end if;
 if cardinality(errors)>0 then raise exception '%',array_to_string(errors,', '); end if;
 if length(trim(typed_name)) not between 2 and 200 or length(trim(signer_title)) not between 2 and 100 then raise exception 'Enter your name and authority'; end if;
 foreach k in array array['accurate','authority','safety','privacy','terms','electronic'] loop
  if acknowledgements->k is distinct from 'true'::jsonb then raise exception 'Complete every certification'; end if;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) into docs from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active;
 insert into public.operator_submissions(application_id,revision,user_id,profile_snapshot,document_snapshot,typed_name,title,acknowledgements,agreement_version,agreement_sha256) values(a.id,a.revision+1,a.user_id,a.profile,docs,trim(typed_name),trim(signer_title),acknowledgements,(select version from public.provider_contract_versions where id=e.version_id),e.sha256) returning id into sid;
 update public.operator_applications set status='submitted',revision=a.revision+1,submitted_at=now(),feedback='' where id=a.id;
 return sid;
end; $$;

create or replace function private.review_operator_application(application_id uuid,expected_revision integer,decision text,feedback text,checks jsonb) returns void language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; k text; until_date date; r public.provider_insurance_reviews; fp text;
begin
 if not private.is_operator_reviewer() then raise exception 'Reviewer access required'; end if;
 select * into a from public.operator_applications where id=application_id for update;
 if a.id is null or a.revision<>expected_revision then raise exception 'Application changed; refresh'; end if;
 if decision not in ('changes_requested','approved','declined') or a.status not in ('submitted','approved') then raise exception 'Invalid review transition'; end if;
 if length(trim(feedback)) not between 2 and 4000 then raise exception 'Provide a clear reason for the applicant'; end if;
 fp:=private.provider_fingerprint(a.id);
 if decision='approved' then
  foreach k in array array['business','qualifications','equipment','insurance','tax','contract','exceptions','independentVerification'] loop
   if checks->k is distinct from 'true'::jsonb then raise exception 'Complete every approval check, including independent broker verification'; end if;
  end loop;
  if length(trim(coalesce(checks->>'verificationReference','')))<10 then raise exception 'Record independent verification method, date and reference'; end if;
  if cardinality(private.provider_profile_errors(a.profile,true))>0 then raise exception 'Profile or qualifications need correction'; end if;
  if not exists(select 1 from public.provider_contract_envelopes e where e.application_id=a.id and e.business_hash=private.provider_hash((a.profile->'business')::text) and e.provider_signed_at is not null and e.liftcrew_signed_at is not null) then raise exception 'Both parties must sign the current agreement'; end if;
  until_date:=private.provider_date(checks->>'insuranceValidUntil');
  if until_date is null or until_date<=current_date then raise exception 'Enter the independently verified earliest policy expiration'; end if;
  foreach k in array array['cgl','auto','wc','employers','umbrella','handling','equipment'] loop
   until_date:=least(until_date,private.provider_date(a.profile->'insurance'->k->>'expiry'));
  end loop;
  if exists(select 1 from public.operator_documents d where d.application_id=a.id and d.active and d.expires_on<=current_date) then raise exception 'An uploaded document has expired'; end if;
  select * into r from public.provider_insurance_reviews where provider_insurance_reviews.application_id=a.id and fingerprint=fp order by created_at desc limit 1;
  if r.state in ('queued','reading') and r.created_at>now()-interval '3 minutes' then raise exception 'Wait for the active document review'; end if;
  if r.result->>'outcome'='needs_changes' then raise exception 'Resolve the documented insurance failures and re-run review before approval'; end if;
  if private.provider_date(r.result->>'validUntil') is not null then until_date:=least(until_date,private.provider_date(r.result->>'validUntil')); end if;
 end if;
 insert into public.operator_reviews(application_id,reviewer_id,revision,decision,feedback,checks,evidence_fingerprint,valid_until) values(a.id,auth.uid(),a.revision,decision,trim(feedback),checks,fp,until_date);
 update public.operator_applications set status=decision,feedback=trim(review_operator_application.feedback) where id=a.id;
end; $$;
create function public.reopen_provider_application(p_application_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.operator_applications set status='changes_requested',feedback='Application reopened for updates. Work eligibility is paused until the updated records are approved.' where id=p_application_id and user_id=auth.uid() and status in ('submitted','approved','declined');
 if not found then raise exception 'No submitted application to reopen'; end if;
end; $$;
create function public.provider_clearance(p_application_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.operator_applications; r public.operator_reviews; e public.provider_contract_envelopes; ir public.provider_insurance_reviews; blockers text[]:='{}'; item jsonb;
begin
 select * into a from public.operator_applications where id=p_application_id;
 if a.id is null or (a.user_id is distinct from auth.uid() and not private.is_operator_reviewer()) then raise exception 'Application not found'; end if;
 if a.status<>'approved' then blockers:=array_append(blockers,'LiftCrew approval is required before receiving work'); end if;
 select * into e from public.provider_contract_envelopes where application_id=a.id and business_hash=private.provider_hash((a.profile->'business')::text) and provider_signed_at is not null order by created_at desc limit 1;
 if e.id is null then blockers:=array_append(blockers,'Provider agreement signature required'); elsif e.liftcrew_signed_at is null then blockers:=array_append(blockers,'LiftCrew countersignature required'); end if;
 select * into r from public.operator_reviews where application_id=a.id order by created_at desc limit 1;
 if r.decision is distinct from 'approved' or r.evidence_fingerprint is distinct from private.provider_fingerprint(a.id) then blockers:=array_append(blockers,'Current documents and qualifications require verification'); end if;
 if r.valid_until is null or r.valid_until<=current_date then blockers:=array_append(blockers,'Current independently verified insurance required'); end if;
 if exists(select 1 from public.operator_documents d where d.application_id=a.id and d.active and d.expires_on<=current_date) then blockers:=array_append(blockers,'A document has expired'); end if;
 for item in select value from jsonb_array_elements(coalesce(a.profile->'operators','[]'::jsonb)) loop
  if private.provider_date(item->>'evaluationDate') is null or private.provider_date(item->>'evaluationDate')<(current_date-interval '3 years')::date then blockers:=array_append(blockers,'Operator evaluation renewal required'); end if;
 end loop;
 select * into ir from public.provider_insurance_reviews where application_id=a.id order by created_at desc limit 1;
 return jsonb_build_object('eligible',cardinality(blockers)=0,'blockers',to_jsonb(blockers),'validUntil',r.valid_until,'envelope',to_jsonb(e),'review',to_jsonb(ir),'reviewCurrent',ir.fingerprint=private.provider_fingerprint(a.id));
end; $$;
create function public.match_provider_equipment(p_zip text,p_capacity numeric,p_height numeric,p_category text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;
begin
 if not private.is_operator_reviewer() then raise exception 'Reviewer access required'; end if;
 if p_zip !~ '^[0-9]{5}$' or p_capacity<=0 or p_height<=0 then raise exception 'Enter ZIP, positive load weight and lift height'; end if;
 select coalesce(jsonb_agg(t),'[]'::jsonb) into rows from (
  select a.id as application_id,a.profile->'business'->>'legalName' as provider,a.profile->'business'->>'contactName' as contact,a.profile->'business'->>'phone' as phone,e.value as equipment,'Candidate only: verify actual load chart, load center, attachments, site, availability, insurance values and work order before dispatch.' as next_check
  from public.operator_applications a cross join lateral jsonb_array_elements(a.profile->'equipment') e
  where a.status='approved' and (public.provider_clearance(a.id)->>'eligible')::boolean
   and p_zip=any(regexp_split_to_array(a.profile->'business'->>'serviceZipCodes','\s*,\s*'))
   and e.value->>'category'<>'Crane' and (p_category is null or e.value->>'category'=p_category)
   and private.provider_number(e.value->>'capacity')>=p_capacity and private.provider_number(e.value->>'liftHeight')>=p_height
  order by a.id,e.value->>'id' limit 100
 ) t;
 return rows;
end; $$;

-- Explicit grants: every new function defaults closed, including private helpers.
revoke all on function private.provider_hash(text),private.provider_date(text),private.provider_number(text),private.provider_fingerprint(uuid),private.provider_profile_errors(jsonb,boolean) from public,anon,authenticated;
revoke all on function public.publish_provider_contract(text,text,text,text,text,boolean),public.prepare_provider_contract(uuid),public.sign_provider_contract(uuid,text,text,boolean,boolean),public.countersign_provider_contract(uuid,text,text,boolean),public.begin_provider_insurance_review(uuid,boolean,boolean),public.provider_clearance(uuid),public.reopen_provider_application(uuid),public.match_provider_equipment(text,numeric,numeric,text),public.claim_provider_insurance_review(uuid),public.finish_provider_insurance_review(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.publish_provider_contract(text,text,text,text,text,boolean),public.prepare_provider_contract(uuid),public.sign_provider_contract(uuid,text,text,boolean,boolean),public.countersign_provider_contract(uuid,text,text,boolean),public.begin_provider_insurance_review(uuid,boolean,boolean),public.provider_clearance(uuid),public.reopen_provider_application(uuid),public.match_provider_equipment(text,numeric,numeric,text) to authenticated;
grant execute on function public.claim_provider_insurance_review(uuid),public.finish_provider_insurance_review(uuid,jsonb,boolean) to service_role;
