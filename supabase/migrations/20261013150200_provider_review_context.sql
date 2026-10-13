-- Bind policy review to the legal entity in this provider's current contract.
create function private.provider_contract_context(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('versionId',v.id,'version',v.version,'legalEntity',v.legal_entity)
 from public.provider_contract_versions v where v.id=coalesce(
  (select e.version_id from public.provider_contract_envelopes e join public.operator_applications a on a.id=e.application_id where a.id=p_id and e.business_hash=private.provider_hash((a.profile->'business')::text) and e.provider_signed_at is not null order by e.created_at desc limit 1),
  (select id from public.provider_contract_versions order by published_at desc limit 1))), '{}'::jsonb);
$$;
create or replace function private.provider_fingerprint(p_id uuid) returns text language sql stable security definer set search_path='' as $$
 select private.provider_hash(a.profile::text || private.provider_contract_context(a.id)::text || coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'path',d.object_path,'kind',d.kind,'expiry',d.expires_on) order by d.id)::text from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind in ('coi','declarations','endorsements','handling','owner_coverage','equipment_coverage')),'[]')) from public.operator_applications a where a.id=p_id;
$$;
do $$ declare definition text; expected text:='values(a.id,fp,docs,a.profile,''insurance-ai-v1-2026-10-13'',auth.uid())'; begin
 definition:=pg_get_functiondef('public.begin_provider_insurance_review(uuid,boolean,boolean)'::regprocedure);
 if position(expected in definition)=0 then raise exception 'Unexpected review request function'; end if;
 execute replace(definition,expected,'values(a.id,fp,docs,a.profile||jsonb_build_object(''_reviewContext'',private.provider_contract_context(a.id)),''insurance-ai-v1-2026-10-13'',auth.uid())');
end $$;
revoke all on function private.provider_contract_context(uuid) from public,anon,authenticated;
-- The AI service cannot publish contracts, fabricate signatures or directly write review rows.
revoke all on public.provider_contract_versions,public.provider_contract_envelopes,public.provider_insurance_reviews from service_role;
grant select on public.provider_contract_versions,public.provider_contract_envelopes,public.provider_insurance_reviews to service_role;

create function public.provider_status() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',a.id,'status',a.status,'revision',a.revision,'feedback',a.feedback,'eligible',c.value->'eligible','blockers',c.value->'blockers','validUntil',c.value->'validUntil')
 from public.operator_applications a cross join lateral (select public.provider_clearance(a.id) as value) c where a.user_id=(select auth.uid()) limit 1;
$$;
revoke all on function public.provider_status() from public,anon;
grant execute on function public.provider_status() to authenticated;

-- An authorized reviewer can correct an AI error only with an explicit, auditable
-- declaration and independent evidence, never an automatic override.
do $$ declare definition text; expected text:='if r.result->>''outcome''=''needs_changes'' then raise exception ''Resolve the documented insurance failures and re-run review before approval''; end if;'; begin
 definition:=pg_get_functiondef('private.review_operator_application(uuid,integer,text,text,jsonb)'::regprocedure);
 if position(expected in definition)=0 then raise exception 'Unexpected approval function'; end if;
 definition:=replace(definition,expected,'if r.result->>''outcome''=''needs_changes'' and (coalesce(checks->>''verificationReference'','''') not like ''AI_CORRECTION:%'' or length(trim(checks->>''verificationReference''))<100) then raise exception ''Resolve the flagged insurance items. To record an independently verified AI correction or signed risk exception, start the verification reference with AI_CORRECTION: and document each finding, policy/page evidence, verification date and any authorized exception (at least 100 characters). Mandatory coverage cannot be waived.''; end if;');
 definition:=replace(definition,'if private.provider_date(r.result->>''validUntil'') is not null then until_date:=least(until_date,private.provider_date(r.result->>''validUntil'')); end if;','if r.result->>''outcome'' is distinct from ''needs_changes'' and private.provider_date(r.result->>''validUntil'') is not null then until_date:=least(until_date,private.provider_date(r.result->>''validUntil'')); end if; if until_date<=current_date then raise exception ''Verified coverage must be current''; end if;');
 execute definition;
end $$;
