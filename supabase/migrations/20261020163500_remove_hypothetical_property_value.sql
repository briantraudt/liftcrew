-- Remove the redundant pre-application guess for future customer property value.
-- Insurance review still validates the actual policy's property-handling coverage
-- at the $250,000 minimum (and any higher legacy disclosure), with a
-- job-specific property-value/coverage comparison required before dispatch.
do $migration$
declare definition text; obsolete text;
begin
 definition:=pg_get_functiondef('private.provider_profile_errors(jsonb,boolean)'::regprocedure);
 obsolete:=$old$ if full_check and coalesce(private.provider_number(p->'insurance'->>'maximumLoadValue'),0)<=0 then errors:=array_append(errors,'Enter the maximum total property value you intend to handle per job'); end if;$old$;
 if position(obsolete in definition)=0 then raise exception 'Unexpected provider profile validator: job value rule was not removed'; end if;
 execute replace(definition,obsolete,'');
end $migration$;
