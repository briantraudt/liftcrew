-- Add an optional, more restrictive per-machine matching radius while retaining the
-- existing reviewer-only / pricing eligibility checks and the global provider cap.
-- Applied to LiftCrew production on 2026-10-21 (Supabase migration 20261021152548).
-- Does not change existing applications, grant access, or enlarge dispatch eligibility.
do $migration$
declare
  name text;
  signature text;
  definition text;
  needle text := 'private.provider_number(a.profile->''business''->>''radiusMiles'')';
  replacement text;
  found_count int;
  required_count int;
begin
  replacement := 'least(' || needle || ',coalesce(nullif(private.provider_number(e.value->>''radiusMilesOverride''),0),' || needle || '))';
  for name,signature,required_count in
    select * from (values
      ('match_provider_equipment','public.match_provider_equipment(text,numeric,numeric,text)',2),
      ('quote_nearest_provider_equipment','public.quote_nearest_provider_equipment(text,text,text,numeric,numeric,integer)',1)
    ) as functions(name,signature,required_count)
  loop
    definition := pg_get_functiondef(to_regprocedure(signature));
    if definition is null then raise exception 'Required function % not found',signature; end if;
    if position('radiusMilesOverride' in definition)>0 then raise exception 'Machine radius already installed in %',name; end if;
    found_count := (length(definition)-length(replace(definition,needle,'')))/length(needle);
    if found_count<>required_count then
      raise exception 'Unexpected % baseline: expected % occurrences; got %',name,required_count,found_count;
    end if;
    execute replace(definition,needle,replacement);
  end loop;
end $migration$;