-- Applied to LiftCrew production as 20261021160651.
-- Preserve insurance, reviewer, and authorization boundaries while allowing descriptive
-- "Other" entries outside automated forklift matching.
do $migration$
declare
  definition text;
  needle text;
  replacement text;
begin
  definition:=pg_get_functiondef('private.provider_profile_errors(jsonb,boolean)'::regprocedure);
  if position('categoryOther' in definition)>0 then
    raise exception 'Other category handling already installed; inspect before reapplying';
  end if;
  needle:=$s$if category not in ('Warehouse forklift','Rough-terrain forklift','Telehandler','Crane') then$s$;
  replacement:=$s$if category not in ('Warehouse forklift','Rough-terrain forklift','Telehandler','Crane','Other') then$s$;
  if position(needle in definition)=0 then raise exception 'Unexpected equipment category validation'; end if;
  definition:=replace(definition,needle,replacement);

  needle:=$s$if category='Crane' then$s$;
  replacement:=$s$if category='Other' and nullif(trim(coalesce(item->>'categoryOther','')),'') is null then
    errors:=array_append(errors,'Describe the other equipment category');
  end if;
  if item->>'fuel'='Other' and nullif(trim(coalesce(item->>'fuelOther','')),'') is null then
    errors:=array_append(errors,'Describe the other equipment fuel or power source');
  end if;
  if category='Crane' then$s$;
  if position(needle in definition)=0 then raise exception 'Unexpected crane category validation'; end if;
  definition:=replace(definition,needle,replacement);

  needle:=$s$elsif coalesce(private.provider_number(item->>'loadCenter'),0)<=0 then$s$;
  replacement:=$s$elsif category<>'Other' and coalesce(private.provider_number(item->>'loadCenter'),0)<=0 then$s$;
  if position(needle in definition)=0 then raise exception 'Unexpected load center validation'; end if;
  definition:=replace(definition,needle,replacement);

  needle:=$s$if jsonb_typeof(p->'equipment') is distinct from 'array'$s$;
  replacement:=$s$if p->'business'->>'entityType'='Other'
     and nullif(trim(coalesce(p->'business'->>'entityTypeOther','')),'') is null then
    errors:=array_append(errors,'Describe the other business structure');
  end if;
  if jsonb_typeof(p->'equipment') is distinct from 'array'$s$;
  if position(needle in definition)=0 then raise exception 'Unexpected business validation'; end if;
  definition:=replace(definition,needle,replacement);
  execute definition;

  definition:=pg_get_functiondef('public.match_provider_equipment(text,numeric,numeric,text)'::regprocedure);
  if position('Reviewer access required' in definition)=0 then raise exception 'Reviewer guard missing; refusing patch'; end if;
  needle:=$s$e.value->>'category'<>'Crane'$s$;
  replacement:=$s$e.value->>'category' in ('Warehouse forklift','Rough-terrain forklift','Telehandler')$s$;
  if position(needle in definition)=0 then raise exception 'Expected reviewer match exclusion not found'; end if;
  definition:=replace(definition,needle,replacement);
  execute definition;
end $migration$;