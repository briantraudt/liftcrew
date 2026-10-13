-- Preparation defaults only. No agreement is published, signed or approved here.
-- Business values are set privately at deployment time, not committed to source.
create table public.provider_contract_defaults (
  id boolean primary key default true check(id),
  legal_entity text not null check(length(trim(legal_entity)) between 2 and 300),
  notice_address text not null check(length(trim(notice_address)) between 5 and 1000),
  notice_email text not null check(length(notice_email)<=254 and notice_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  updated_at timestamptz not null default now()
);
alter table public.provider_contract_defaults enable row level security;
revoke all on public.provider_contract_defaults from public,anon,authenticated,service_role;
grant select on public.provider_contract_defaults to authenticated;
create policy provider_contract_defaults_reviewers
  on public.provider_contract_defaults for select to authenticated
  using ((select private.is_operator_reviewer()));
comment on table public.provider_contract_defaults is 'Owner-maintained identity defaults for the existing contract publication form; not a published contract or authorization to sign. Existing signed versions remain unchanged.';
