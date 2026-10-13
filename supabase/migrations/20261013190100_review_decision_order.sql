-- Decisions for a newer submitted revision must win, including transactions that
-- record more than one decision. Transaction-start timestamps alone can tie.
alter table public.operator_reviews alter column created_at set default clock_timestamp();
do $$ declare definition text; expected text:='from public.operator_reviews where application_id=a.id order by created_at desc limit 1;'; begin
 definition:=pg_get_functiondef('public.provider_clearance(uuid)'::regprocedure);
 if position(expected in definition)=0 then raise exception 'Unexpected clearance definition; review before migrating'; end if;
 execute replace(definition,expected,'from public.operator_reviews where application_id=a.id order by revision desc,created_at desc,id desc limit 1;');
end $$;
