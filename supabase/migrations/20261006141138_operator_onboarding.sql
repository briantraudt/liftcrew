-- Operator onboarding. No change to equipment_catalog or existing authentication settings.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table private.operator_reviewers (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
revoke all on private.operator_reviewers from public, anon, authenticated;
create function private.is_operator_reviewer() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.operator_reviewers r join auth.users u on u.id=r.user_id where r.user_id=(select auth.uid()) and u.email_confirmed_at is not null);
$$;
revoke all on function private.is_operator_reviewer() from public, anon;
grant execute on function private.is_operator_reviewer() to authenticated;
create function public.is_operator_reviewer() returns boolean language sql stable security invoker set search_path = '' as $$ select private.is_operator_reviewer(); $$;
revoke all on function public.is_operator_reviewer() from public, anon;
grant execute on function public.is_operator_reviewer() to authenticated;

create table public.operator_applications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 profile jsonb not null default '{}'::jsonb check(jsonb_typeof(profile)='object' and octet_length(profile::text)<131072),
 status text not null default 'draft' check(status in ('draft','submitted','changes_requested','approved','declined')),
 revision integer not null default 0,
 feedback text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), submitted_at timestamptz
);
alter table public.operator_applications enable row level security;
revoke all on public.operator_applications from anon, authenticated;
grant select on public.operator_applications to authenticated;
grant insert(user_id,profile),update(profile) on public.operator_applications to authenticated;
create policy application_read on public.operator_applications for select to authenticated using(user_id=(select auth.uid()) or (select private.is_operator_reviewer()));
create policy application_create on public.operator_applications for insert to authenticated with check(user_id=(select auth.uid()) and status='draft');
create policy application_edit on public.operator_applications for update to authenticated using(user_id=(select auth.uid()) and status in ('draft','changes_requested')) with check(user_id=(select auth.uid()) and status in ('draft','changes_requested'));
create function private.touch_operator_application() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
create trigger touch_operator_application before update on public.operator_applications for each row execute function private.touch_operator_application();

create table public.operator_documents (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.operator_applications(id) on delete cascade,
 owner_id uuid not null references auth.users(id), kind text not null check(kind in ('w9','coi','endorsements','handling','equipment_photo','capacity_plate','inspection','lease','training','evaluation','transport','other','final_agreement')),
 entity_id text not null default '', filename text not null check(length(filename) between 1 and 200),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 bytes integer not null check(bytes between 1 and 10485760), object_path text not null unique,
 active boolean not null default true, expires_on date, created_at timestamptz not null default now(),
 check(object_path = owner_id::text || '/' || application_id::text || '/' || id::text || case mime_type when 'application/pdf' then '.pdf' when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end)
);
create index operator_documents_application_idx on public.operator_documents(application_id);
create index operator_documents_owner_idx on public.operator_documents(owner_id);
alter table public.operator_documents enable row level security;
revoke all on public.operator_documents from anon, authenticated;
grant select,insert,delete on public.operator_documents to authenticated;
grant update(active) on public.operator_documents to authenticated;
create policy document_read on public.operator_documents for select to authenticated using(owner_id=(select auth.uid()) or (select private.is_operator_reviewer()));
create policy document_create on public.operator_documents for insert to authenticated with check(
 exists(select 1 from public.operator_applications a where a.id=application_id and a.user_id=owner_id and ((a.user_id=(select auth.uid()) and a.status in ('draft','changes_requested') and kind<>'final_agreement') or ((select private.is_operator_reviewer()) and kind='final_agreement')))
);
create policy document_delete on public.operator_documents for delete to authenticated using(
 exists(select 1 from public.operator_applications a where a.id=application_id and ((a.user_id=(select auth.uid()) and a.status in ('draft','changes_requested') and a.revision=0 and kind<>'final_agreement') or ((select private.is_operator_reviewer()) and kind='final_agreement' and a.status<>'approved')))
);
create policy document_archive on public.operator_documents for update to authenticated using(owner_id=(select auth.uid()) and kind<>'final_agreement' and exists(select 1 from public.operator_applications a where a.id=application_id and a.status in ('draft','changes_requested'))) with check(owner_id=(select auth.uid()) and kind<>'final_agreement');
-- Snapshot documents cannot be replaced: the path contains a fresh immutable UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('operator-documents','operator-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy operator_storage_read on storage.objects for select to authenticated using(bucket_id='operator-documents' and exists(select 1 from public.operator_documents d where d.object_path=name and (d.owner_id=(select auth.uid()) or (select private.is_operator_reviewer()))));
create policy operator_storage_insert on storage.objects for insert to authenticated with check(bucket_id='operator-documents' and exists(select 1 from public.operator_documents d join public.operator_applications a on a.id=d.application_id where d.object_path=name and ((d.owner_id=(select auth.uid()) and a.status in ('draft','changes_requested') and d.kind<>'final_agreement') or ((select private.is_operator_reviewer()) and d.kind='final_agreement'))));
create policy operator_storage_delete on storage.objects for delete to authenticated using(bucket_id='operator-documents' and exists(select 1 from public.operator_documents d join public.operator_applications a on a.id=d.application_id where d.object_path=name and ((d.owner_id=(select auth.uid()) and a.status in ('draft','changes_requested') and a.revision=0 and d.kind<>'final_agreement') or ((select private.is_operator_reviewer()) and d.kind='final_agreement' and a.status<>'approved'))));

create table public.operator_submissions (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.operator_applications(id), revision integer not null,
 user_id uuid not null references auth.users(id), profile_snapshot jsonb not null, document_snapshot jsonb not null,
 typed_name text not null, title text not null, acknowledgements jsonb not null,
 agreement_version text not null, agreement_sha256 text not null,
 created_at timestamptz not null default now(), unique(application_id,revision)
);
create index operator_submissions_user_idx on public.operator_submissions(user_id);
alter table public.operator_submissions enable row level security;
revoke all on public.operator_submissions from anon,authenticated;
grant select on public.operator_submissions to authenticated;
create policy submission_read on public.operator_submissions for select to authenticated using(user_id=(select auth.uid()) or (select private.is_operator_reviewer()));
create table public.operator_reviews (
 id uuid primary key default gen_random_uuid(),application_id uuid not null references public.operator_applications(id),reviewer_id uuid not null references auth.users(id),revision integer not null, decision text not null, feedback text not null, checks jsonb not null,created_at timestamptz not null default now()
);
create index operator_reviews_application_idx on public.operator_reviews(application_id);
create index operator_reviews_reviewer_idx on public.operator_reviews(reviewer_id);
alter table public.operator_reviews enable row level security;
revoke all on public.operator_reviews from anon,authenticated;
grant select on public.operator_reviews to authenticated;
create policy reviews_read on public.operator_reviews for select to authenticated using((select private.is_operator_reviewer()));

create function private.submit_operator_application(application_id uuid, typed_name text, signer_title text, acknowledgements jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; p jsonb; item jsonb; k text; missing text[]:='{}'; docs jsonb; sid uuid; today date:=current_date;
begin
 select * into a from public.operator_applications where id=application_id for update;
 if a.id is null or a.user_id is distinct from auth.uid() then raise exception 'Application not found'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email before submitting'; end if;
 if a.status not in ('draft','changes_requested') then raise exception 'This application is not editable'; end if;
 p:=a.profile;
 foreach k in array array['legalName','entityType','formationState','address','contactName','phone','serviceArea','emergencyName','emergencyPhone','availability'] loop
  if length(trim(coalesce(p->'business'->>k,'')))<2 then missing:=array_append(missing,'Business: '||k); end if;
 end loop;
 if jsonb_typeof(p->'equipment') is distinct from 'array' or jsonb_array_length(p->'equipment') not between 1 and 20 then raise exception 'Add between 1 and 20 machines'; end if;
 if jsonb_typeof(p->'operators') is distinct from 'array' or jsonb_array_length(p->'operators') not between 1 and 20 then raise exception 'Add between 1 and 20 operators'; end if;
 for item in select value from jsonb_array_elements(p->'equipment') loop
  foreach k in array array['id','make','model','serial','ownership','capacity','loadCenter','liftHeight','fuel','tires','attachments','transport','inspectionDate'] loop
   if nullif(trim(item->>k),'') is null then missing:=array_append(missing,'Equipment: '||k); end if;
  end loop;
  if coalesce(item->>'capacity','') !~ '^[0-9]+(\.[0-9]+)?$' or coalesce(item->>'loadCenter','') !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Enter numeric capacity and load center'; end if;
  if (item->>'capacity')::numeric<=0 or (item->>'loadCenter')::numeric<=0 then raise exception 'Equipment capacity and load center must be positive'; end if;
  if (item->>'inspectionDate')::date>today then raise exception 'Inspection date cannot be in the future'; end if;
  foreach k in array array['equipment_photo','capacity_plate','inspection'] loop
   if not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind=k and d.entity_id=item->>'id') then missing:=array_append(missing,'Upload '||k||' for '||(item->>'model')); end if;
  end loop;
  if item->>'ownership'<>'Owned' and not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind='lease' and d.entity_id=item->>'id') then missing:=array_append(missing,'Lease/rental permission'); end if;
 end loop;
 for item in select value from jsonb_array_elements(p->'operators') loop
  foreach k in array array['id','name','relationship','equipmentTypes','trainingDate','evaluationDate','trainer','evaluator'] loop
   if nullif(trim(item->>k),'') is null then missing:=array_append(missing,'Operator: '||k); end if;
  end loop;
  if item->>'adult' is distinct from 'yes' then missing:=array_append(missing,'18+ confirmation'); end if;
  if (item->>'trainingDate')::date>today or (item->>'evaluationDate')::date>today then raise exception 'Training/evaluation dates cannot be in the future'; end if;
  if (item->>'evaluationDate')::date<(today-interval '3 years')::date then raise exception 'A current practical evaluation is required (at least every three years, sooner when required)'; end if;
  foreach k in array array['training','evaluation'] loop
   if not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind=k and d.entity_id=item->>'id') then missing:=array_append(missing,'Upload '||k||' for '||(item->>'name')); end if;
  end loop;
 end loop;
 foreach k in array array['brokerName','brokerEmail','brokerPhone','workingOwners','exceptions'] loop
  if nullif(trim(p->'insurance'->>k),'') is null then missing:=array_append(missing,'Insurance: '||k); end if;
 end loop;
 foreach k in array array['cgl','auto','wc','employers','umbrella','handling','equipment'] loop
  item:=p->'insurance'->k;
  if nullif(item->>'carrier','') is null or nullif(item->>'policy','') is null or nullif(item->>'limit','') is null or nullif(item->>'expiry','') is null then missing:=array_append(missing,'Coverage details: '||k); end if;
  if coalesce(item->>'expiry','')<>'' and (item->>'expiry')::date<today then missing:=array_append(missing,'Expired policy: '||k); end if;
 end loop;
 foreach k in array array['w9','coi','endorsements','handling'] loop
  if not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind=k) then missing:=array_append(missing,'Upload '||k); end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p->'equipment') e where e->>'transport'='Self-delivery') and not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind='transport') then missing:=array_append(missing,'Transport qualifications'); end if;
 if exists(select 1 from public.operator_documents where operator_documents.application_id=a.id and active and expires_on<today) then missing:=array_append(missing,'Replace expired documents'); end if;
 if cardinality(missing)>0 then raise exception 'Complete these items: %',array_to_string(missing,', '); end if;
 if length(trim(typed_name)) not between 2 and 200 or length(trim(signer_title)) not between 2 and 100 then raise exception 'Enter your full name and title'; end if;
 foreach k in array array['accurate','authority','safety','privacy','terms','electronic'] loop
  if acknowledgements->k is distinct from 'true'::jsonb then raise exception 'Complete all application certifications'; end if;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) into docs from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active;
 insert into public.operator_submissions(application_id,revision,user_id,profile_snapshot,document_snapshot,typed_name,title,acknowledgements,agreement_version,agreement_sha256)
 values(a.id,a.revision+1,a.user_id,p,docs,trim(typed_name),trim(signer_title),acknowledgements,'provider-v1-draft-2026-10-06','d7e1bf0b2fcdf37ab3f4ab9c45d917032f595fb1ab1ea8021f809da216933fc4') returning id into sid;
 update public.operator_applications set status='submitted',revision=a.revision+1,submitted_at=now(),feedback='' where id=a.id;
 return sid;
end; $$;
revoke all on function private.submit_operator_application(uuid,text,text,jsonb) from public,anon;
grant execute on function private.submit_operator_application(uuid,text,text,jsonb) to authenticated;
create function public.submit_operator_application(application_id uuid,typed_name text,signer_title text,acknowledgements jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.submit_operator_application(application_id,typed_name,signer_title,acknowledgements); $$;
revoke all on function public.submit_operator_application(uuid,text,text,jsonb) from public,anon;
grant execute on function public.submit_operator_application(uuid,text,text,jsonb) to authenticated;

create function private.review_operator_application(application_id uuid,expected_revision integer,decision text,feedback text,checks jsonb) returns void language plpgsql security definer set search_path='' as $$
declare a public.operator_applications; k text; item jsonb;
begin
 if not private.is_operator_reviewer() then raise exception 'Reviewer access required'; end if;
 select * into a from public.operator_applications where id=application_id for update;
 if a.id is null or a.revision<>expected_revision then raise exception 'Application changed; refresh before reviewing'; end if;
 if decision not in ('changes_requested','approved','declined') then raise exception 'Invalid decision'; end if;
 if a.status not in ('submitted','approved') then raise exception 'Only submitted or approved applications can be reviewed'; end if;
 if length(trim(feedback)) not between 2 and 4000 then raise exception 'Enter feedback for the applicant'; end if;
 if decision='approved' then
  foreach k in array array['business','qualifications','equipment','insurance','tax','contract','exceptions'] loop
   if checks->k is distinct from 'true'::jsonb then raise exception 'Complete every approval check'; end if;
  end loop;
  if not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind='final_agreement') then raise exception 'Upload the finalized agreement signed by both parties'; end if;
  foreach k in array array['cgl','auto','wc','employers','umbrella','handling','equipment'] loop
   if (a.profile->'insurance'->k->>'expiry')::date<current_date then raise exception 'Insurance has expired'; end if;
  end loop;
  for item in select value from jsonb_array_elements(a.profile->'operators') loop
   if (item->>'evaluationDate')::date<(current_date-interval '3 years')::date then raise exception 'Operator evaluation needs renewal'; end if;
  end loop;
  if exists(select 1 from public.operator_documents d where d.application_id=a.id and d.active and d.expires_on<current_date) then raise exception 'A document has expired'; end if;
 end if;
 insert into public.operator_reviews(application_id,reviewer_id,revision,decision,feedback,checks) values(a.id,auth.uid(),a.revision,decision,trim(feedback),checks);
 update public.operator_applications set status=decision,feedback=trim(review_operator_application.feedback) where id=a.id;
end; $$;
revoke all on function private.review_operator_application(uuid,integer,text,text,jsonb) from public,anon;
grant execute on function private.review_operator_application(uuid,integer,text,text,jsonb) to authenticated;
create function public.review_operator_application(application_id uuid,expected_revision integer,decision text,feedback text,checks jsonb) returns void language sql security invoker set search_path='' as $$ select private.review_operator_application(application_id,expected_revision,decision,feedback,checks); $$;
revoke all on function public.review_operator_application(uuid,integer,text,text,jsonb) from public,anon;
grant execute on function public.review_operator_application(uuid,integer,text,text,jsonb) to authenticated;

-- Limit the amount of document metadata an account can create.
create function private.limit_operator_documents() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.operator_applications where id=new.application_id for update;
 if (select count(*) from public.operator_documents where application_id=new.application_id)>=150 then raise exception 'Document limit reached; contact LiftCrew'; end if;
 return new;
end; $$;
revoke all on function private.limit_operator_documents() from public,anon,authenticated;
create trigger limit_operator_documents before insert on public.operator_documents for each row execute function private.limit_operator_documents();
