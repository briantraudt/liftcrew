-- Align a whitespace-only difference in the hosted function before the guarded patch.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('private.review_operator_application(uuid,integer,text,text,jsonb)'::regprocedure);
 definition:=replace(definition,$old$  foreach k in array array['cgl','auto','wc','employers','umbrella','handling','equipment'] loop until_date:=least(until_date,private.provider_date(a.profile->'insurance'->k->>'expiry')); end loop;$old$,$new$  foreach k in array array['cgl','auto','wc','employers','umbrella','handling','equipment'] loop
   until_date:=least(until_date,private.provider_date(a.profile->'insurance'->k->>'expiry'));
  end loop;$new$);
 execute definition;
end $$;
