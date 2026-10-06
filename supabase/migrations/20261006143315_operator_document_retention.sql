-- Final signed agreements remain as legal records even if an approval is withdrawn.
drop policy document_delete on public.operator_documents;
create policy document_delete on public.operator_documents for delete to authenticated using(
 kind<>'final_agreement' and owner_id=(select auth.uid()) and exists(select 1 from public.operator_applications a where a.id=application_id and a.user_id=(select auth.uid()) and a.status in ('draft','changes_requested') and a.revision=0)
);
drop policy operator_storage_delete on storage.objects;
create policy operator_storage_delete on storage.objects for delete to authenticated using(
 bucket_id='operator-documents' and exists(select 1 from public.operator_documents d join public.operator_applications a on a.id=d.application_id where d.object_path=name and d.kind<>'final_agreement' and d.owner_id=(select auth.uid()) and a.status in ('draft','changes_requested') and a.revision=0)
);
-- Recheck editability after taking a parent lock, to serialize document edits with submission.
create or replace function private.limit_operator_documents() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.operator_applications;
begin
 select * into a from public.operator_applications where id=new.application_id for update;
 if new.kind='final_agreement' then
  if not private.is_operator_reviewer() or a.status not in ('submitted','approved') then raise exception 'A reviewer may attach a final agreement to a submitted application'; end if;
 elsif a.user_id is distinct from auth.uid() or a.status not in ('draft','changes_requested') then raise exception 'This application is not editable';
 end if;
 if (select count(*) from public.operator_documents where application_id=new.application_id)>=150 then raise exception 'Document limit reached; contact LiftCrew'; end if;
 return new;
end; $$;
create function private.guard_operator_document_update() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.operator_applications;
begin
 select * into a from public.operator_applications where id=old.application_id for update;
 if a.user_id is distinct from auth.uid() or a.status not in ('draft','changes_requested') or old.kind='final_agreement' then raise exception 'This application is not editable'; end if;
 return new;
end; $$;
revoke all on function private.guard_operator_document_update() from public,anon,authenticated;
create trigger guard_operator_document_update before update on public.operator_documents for each row execute function private.guard_operator_document_update();
