-- Publication attribution is separate from a party's signature or professional review.
-- Production v2 terms were published on the owner's explicit instruction on 2026-10-13.
-- The immutable business-data record is not seeded into unrelated/new environments.
-- Production body SHA-256: 3bfcb54a0f0a62d0268507e5c3002f4124f18a435914314918177ddc424d820b
-- Source: the complete October 12 simplified Provider Agreement, all operative terms
-- and Schedule A preserved; company fields, electronic cover sheet, and venue completed.
alter table public.provider_contract_versions alter column published_by drop not null;
alter table public.provider_contract_versions add column publication_authorization jsonb not null default '{}'::jsonb;
alter table public.provider_contract_versions add constraint provider_publication_attribution check(published_by is not null or coalesce(publication_authorization->>'source'='owner_instruction' and length(publication_authorization->>'authorized_by')>=2 and publication_authorization->>'professional_review_status'='not_verified',false));

create function public.current_provider_agreement() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',v.version,'legal_entity',v.legal_entity,'notice_address',v.notice_address,'notice_email',v.notice_email,'body',v.body,'sha256',v.sha256,'published_at',v.published_at)
 from public.provider_contract_versions v order by v.published_at desc,v.id desc limit 1;
$$;
revoke all on function public.current_provider_agreement() from public;
grant execute on function public.current_provider_agreement() to anon,authenticated;
comment on function public.current_provider_agreement() is 'Public read of published agreement terms only; excludes publication audit, private applications and signatures.';
