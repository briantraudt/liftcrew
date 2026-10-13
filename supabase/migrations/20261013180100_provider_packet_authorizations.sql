-- Single insurance packet and stable equipment-to-operator authorizations.
-- Preserve all approval, signature, ownership and evidence-fingerprint gates.
alter table public.operator_documents drop constraint operator_documents_kind_check;
alter table public.operator_documents add constraint operator_documents_kind_check check(kind in ('insurance_packet','w9','coi','declarations','endorsements','handling','owner_coverage','equipment_coverage','equipment_photo','capacity_plate','inspection','lease','training','evaluation','transport','other','final_agreement'));

do $migration$
declare definition text; expected text; replacement text; signature text;
begin
 definition:=pg_get_functiondef('private.provider_profile_errors(jsonb,boolean)'::regprocedure);
 expected:=$old$'phone','serviceArea','serviceZipCodes','radiusMiles'$old$;
 if position(expected in definition)=0 then raise exception 'Unexpected business validation definition'; end if;
 definition:=replace(definition,expected,$new$'phone','radiusMiles'$new$);
 expected:=$old$ if coalesce(p->'business'->>'serviceZipCodes','') !~ '^[0-9]{5}(\s*,\s*[0-9]{5}){0,99}$' then errors:=array_append(errors,'Enter up to 100 service ZIP codes separated by commas'); end if;$old$;
 if position(expected in definition)=0 then raise exception 'Unexpected service ZIP validation'; end if;
 definition:=replace(definition,expected,$new$ if not exists(select 1 from private.us_zip_centroids z where z.zip=p->'business'->>'zip') then errors:=array_append(errors,'Check the home ZIP; it is not in the location reference'); end if;$new$);
 definition:=replace(definition,$old$ if coalesce(private.provider_number(p->'business'->>'radiusMiles'),0)<=0 then errors:=array_append(errors,'Service radius must be positive'); end if;$old$,$new$ if not (coalesce(private.provider_number(p->'business'->>'radiusMiles'),0)>0 and private.provider_number(p->'business'->>'radiusMiles')<=3000) then errors:=array_append(errors,'Service radius must be greater than zero and no more than 3,000 miles'); end if;$new$);
 definition:=replace(definition,$old$'relationship','equipmentTypes','trainingDate'$old$,$new$'relationship','trainingDate'$new$);
 expected:=$old$  if item->>'adult' is distinct from 'yes'$old$;
 replacement:=$new$  if jsonb_typeof(item->'equipmentIds') is distinct from 'array' then
   errors:=array_append(errors,'Select authorized equipment for each operator');
  else
   if jsonb_array_length(item->'equipmentIds') not between 1 and 20 or exists(select 1 from jsonb_array_elements_text(item->'equipmentIds') chosen(id) where not exists(select 1 from jsonb_array_elements(p->'equipment') machine where machine->>'id'=chosen.id)) then errors:=array_append(errors,'Operator authorizations must reference equipment in this application'); end if;
  end if;
  if item->>'adult' is distinct from 'yes'$new$;
 if position(expected in definition)=0 then raise exception 'Unexpected operator validation'; end if;
 definition:=replace(definition,expected,replacement);
 expected:=$old$ if full_check then
  foreach k in array array['brokerName','brokerEmail','brokerPhone','workingOwners','exceptions','maximumLoadValue'] loop
   if nullif(trim(p->'insurance'->>k),'') is null then errors:=array_append(errors,'Insurance: '||k); end if;
  end loop;
  if coalesce(private.provider_number(p->'insurance'->>'maximumLoadValue'),0)<=0 then errors:=array_append(errors,'Enter the maximum total property value you intend to handle per job'); end if;
  foreach k in array array['cgl','auto','wc','employers','umbrella','handling','equipment'] loop
   item:=p->'insurance'->k;
   if nullif(item->>'carrier','') is null or nullif(item->>'policy','') is null or nullif(item->>'limit','') is null then errors:=array_append(errors,'Complete policy details: '||k); end if;
   if private.provider_date(item->>'expiry') is null or private.provider_date(item->>'expiry')<=current_date then errors:=array_append(errors,'Current policy expiration required: '||k); end if;
  end loop;
 end if;$old$;
 if position(expected in definition)=0 then raise exception 'Unexpected policy field validation'; end if;
 definition:=replace(definition,expected,$new$ if full_check and coalesce(private.provider_number(p->'insurance'->>'maximumLoadValue'),0)<=0 then errors:=array_append(errors,'Enter the maximum total property value you intend to handle per job'); end if;$new$);
 execute definition;

 foreach signature in array array['public.begin_provider_insurance_review(uuid,boolean,boolean)','private.provider_fingerprint(uuid)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  expected:=$old$d.kind in ('coi','declarations','endorsements','handling','owner_coverage','equipment_coverage')$old$;
  if position(expected in definition)=0 then raise exception 'Unexpected insurance manifest definition: %',signature; end if;
  execute replace(definition,expected,$new$d.kind in ('insurance_packet','coi','declarations','endorsements','handling','owner_coverage','equipment_coverage')$new$);
 end loop;

 definition:=pg_get_functiondef('private.submit_operator_application(uuid,text,text,jsonb)'::regprocedure);
 expected:=$old$ foreach k in array array['w9','coi','declarations','endorsements','handling','owner_coverage','equipment_coverage'] loop
  if not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind=k) then errors:=array_append(errors,'Upload '||k); end if;
 end loop;$old$;
 if position(expected in definition)=0 then raise exception 'Unexpected submission document validation'; end if;
 definition:=replace(definition,expected,$new$ if not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind='w9') then errors:=array_append(errors,'Upload W-9'); end if;
 if not exists(select 1 from public.operator_documents d join storage.objects o on o.bucket_id='operator-documents' and o.name=d.object_path where d.application_id=a.id and d.active and d.kind in ('insurance_packet','coi','declarations','endorsements','handling','owner_coverage','equipment_coverage')) then errors:=array_append(errors,'Upload your insurance policy packet'); end if;$new$);
 execute definition;

 definition:=pg_get_functiondef('private.review_operator_application(uuid,integer,text,text,jsonb)'::regprocedure);
 expected:=$old$  foreach k in array array['cgl','auto','wc','employers','umbrella','handling','equipment'] loop
   until_date:=least(until_date,private.provider_date(a.profile->'insurance'->k->>'expiry'));
  end loop;$old$;
 if position(expected in definition)=0 then raise exception 'Unexpected insurance date validation'; end if;
 definition:=replace(definition,expected,$new$  if a.profile->'insurance'->>'inputMode' is distinct from 'packet' then
   foreach k in array array['cgl','auto','wc','employers','umbrella','handling','equipment'] loop
    until_date:=least(until_date,private.provider_date(a.profile->'insurance'->k->>'expiry'));
   end loop;
  end if;$new$);
 execute definition;
end $migration$;
