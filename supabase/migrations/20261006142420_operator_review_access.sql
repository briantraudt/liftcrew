-- An owner-maintained email allowlist can bootstrap a reviewer only AFTER email verification.
-- No email addresses or passwords are stored in source control.
create table private.operator_reviewer_emails(email text primary key check(email=lower(email)),created_at timestamptz not null default now());
revoke all on private.operator_reviewer_emails from public,anon,authenticated;
create or replace function private.is_operator_reviewer() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.email_confirmed_at is not null and (exists(select 1 from private.operator_reviewers r where r.user_id=u.id) or exists(select 1 from private.operator_reviewer_emails e where e.email=lower(u.email))));
$$;
