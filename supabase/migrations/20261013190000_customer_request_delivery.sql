-- Durable customer intake. Only the Vercel server's narrowly scoped secret may insert.
create table private.customer_intake_credentials(name text primary key,sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),enabled boolean not null default true);
alter table private.customer_intake_credentials enable row level security;
revoke all on private.customer_intake_credentials from public,anon,authenticated;
create table public.customer_requests(
 id uuid primary key,
 service text not null check(service in ('Forklift with operator','Crane with operator')),
 details jsonb not null check(jsonb_typeof(details)='object' and octet_length(details::text)<50000),
 request_digest text not null,
 rate_key text not null,
 status text not null default 'new' check(status in ('new','in_progress','closed')),
 notification_status text not null default 'pending' check(notification_status in ('pending','sending','accepted','failed','unconfigured','delivery_unknown')),
 notification_id text, notification_attempts integer not null default 0, notification_started_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),updated_by uuid references auth.users(id)
);
alter table public.customer_requests enable row level security;
revoke all on public.customer_requests from public,anon,authenticated;
grant select on public.customer_requests to authenticated;
create policy customer_requests_staff_read on public.customer_requests for select to authenticated using((select private.is_operator_reviewer()));
create index customer_requests_created on public.customer_requests(created_at desc);
create index customer_requests_rate on public.customer_requests(rate_key,created_at desc);
create index customer_requests_email on public.customer_requests(lower(details->>'email'),created_at desc);
create function private.check_customer_intake_key(p_key text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_key is null or length(p_key)<40 or not exists(select 1 from private.customer_intake_credentials where name='vercel-customer-intake' and enabled and sha256=encode(extensions.digest(p_key,'sha256'),'hex')) then raise exception 'Intake authorization required' using errcode='42501'; end if;
end; $$;
create function public.create_customer_request(p_key text,p_id uuid,p_rate_key text,p_details jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.customer_requests; k text; digest text; request_date date;
begin
 perform private.check_customer_intake_key(p_key);
 if p_id is null or p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_details) is distinct from 'object' or octet_length(p_details::text)>=50000 then raise exception 'Invalid request'; end if;
 foreach k in array array['service','location','date','durationDays','loadDescription','name','email','phone'] loop
  if length(trim(coalesce(p_details->>k,''))) not between 1 and 3000 then raise exception 'Incomplete request'; end if;
 end loop;
 if p_details->>'service' not in ('Forklift with operator','Crane with operator') or p_details->>'location' !~ '^[0-9]{5}$' or p_details->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Invalid request'; end if;
 request_date:=private.provider_date(p_details->>'date');
 if request_date is null or request_date<(current_date-1) or coalesce(private.provider_number(p_details->>'durationDays'),0) not between 1 and 30 or (p_details->>'durationDays')::numeric<>trunc((p_details->>'durationDays')::numeric) then raise exception 'Invalid booking dates'; end if;
 digest:=encode(extensions.digest(p_details::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(20261013,1900);
 select * into old from public.customer_requests where id=p_id;
 if old.id is not null then
  if old.request_digest is distinct from digest then raise exception 'Request reference already used for different details' using errcode='23505'; end if;
  return old.id;
 end if;
 if (select count(*) from public.customer_requests where rate_key=p_rate_key and created_at>now()-interval '1 hour')>=10 or (select count(*) from public.customer_requests where lower(details->>'email')=lower(p_details->>'email') and created_at>now()-interval '1 hour')>=10 or (select count(*) from public.customer_requests where created_at>now()-interval '24 hours')>=500 then raise exception 'Request limit reached. Please contact LiftCrew.' using errcode='P0429'; end if;
 insert into public.customer_requests(id,service,details,request_digest,rate_key) values(p_id,p_details->>'service',p_details,digest,p_rate_key);
 return p_id;
end; $$;
create function public.claim_customer_notification(p_key text,p_id uuid,p_configured boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.customer_requests;
begin
 perform private.check_customer_intake_key(p_key);
 select * into r from public.customer_requests where id=p_id for update;
 if r.id is null then raise exception 'Request not found'; end if;
 if r.notification_status='accepted' then return null; end if;
 if p_configured is distinct from true then update public.customer_requests set notification_status='unconfigured' where id=r.id; return null; end if;
 if r.notification_status='sending' and r.notification_started_at>now()-interval '2 minutes' then return null; end if;
 if r.notification_attempts>=5 or (r.notification_attempts>0 and r.created_at<now()-interval '23 hours') then update public.customer_requests set notification_status='delivery_unknown' where id=r.id; return null; end if;
 update public.customer_requests set notification_status='sending',notification_attempts=notification_attempts+1,notification_started_at=now() where id=r.id;
 return jsonb_build_object('id',r.id,'details',r.details);
end; $$;
create function public.finish_customer_notification(p_key text,p_id uuid,p_status text,p_provider_id text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.check_customer_intake_key(p_key);
 if p_status not in ('accepted','failed','delivery_unknown') or (p_status='accepted' and nullif(p_provider_id,'') is null) then raise exception 'Invalid delivery status'; end if;
 update public.customer_requests set notification_status=p_status,notification_id=case when p_status='accepted' then left(p_provider_id,200) else notification_id end where id=p_id and notification_status='sending';
end; $$;
create function public.update_customer_request(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_operator_reviewer() then raise exception 'Reviewer access required'; end if;
 if p_status not in ('new','in_progress','closed') then raise exception 'Invalid status'; end if;
 update public.customer_requests set status=p_status,updated_at=now(),updated_by=auth.uid() where id=p_id;
 if not found then raise exception 'Request not found'; end if;
end; $$;
revoke all on function private.check_customer_intake_key(text) from public,anon,authenticated;
revoke all on function public.create_customer_request(text,uuid,text,jsonb),public.claim_customer_notification(text,uuid,boolean),public.finish_customer_notification(text,uuid,text,text),public.update_customer_request(uuid,text) from public,anon,authenticated;
grant execute on function public.create_customer_request(text,uuid,text,jsonb),public.claim_customer_notification(text,uuid,boolean),public.finish_customer_notification(text,uuid,text,text) to anon;
grant execute on function public.update_customer_request(uuid,text) to authenticated;
-- Preserve pre-existing crane leads in the same staff inbox without changing the originals.
insert into public.customer_requests(id,service,details,request_digest,rate_key,created_at,notification_status)
 select id,'Crane with operator',details,encode(extensions.digest(details::text,'sha256'),'hex'),'legacy-crane',created_at,'delivery_unknown' from public.crane_quote_requests on conflict(id) do nothing;
