-- Allow an explicitly requested four-hour half-day without changing whole-day
-- pricing, eligibility, quotation authority or existing customer request records.
do $migration$
declare
  definition text;
  needle text;
begin
  definition:=pg_get_functiondef('public.create_customer_request(text,uuid,text,jsonb)'::regprocedure);
  needle:=$fragment$coalesce(private.provider_number(p_details->>'durationDays'),0) not between 1 and 30 or (p_details->>'durationDays')::numeric<>trunc((p_details->>'durationDays')::numeric)$fragment$;
  if position('0.5' in definition)>0 then raise exception 'Half-day customer validation already installed: inspect before reapplying'; end if;
  if position(needle in definition)=0 then raise exception 'Unexpected customer request duration validation'; end if;
  definition:=replace(definition,needle,
   $fragment$(coalesce(private.provider_number(p_details->>'durationDays'),0)<>0.5 and (coalesce(private.provider_number(p_details->>'durationDays'),0) not between 1 and 30 or (p_details->>'durationDays')::numeric<>trunc((p_details->>'durationDays')::numeric)))$fragment$);
  execute definition;

  definition:=pg_get_functiondef('public.create_priced_customer_request(text,uuid,text,jsonb)'::regprocedure);
  needle:=$fragment$(p_details->>'durationDays')::integer$fragment$;
  if position('billingPeriod' in definition)>0 then raise exception 'Half-day price snapshot already installed: inspect before reapplying'; end if;
  if position(needle in definition)=0 then raise exception 'Unexpected pricing snapshot duration conversion'; end if;
  definition:=replace(definition,needle,$fragment$ceil(private.provider_number(p_details->>'durationDays'))::integer$fragment$);
  needle:=$fragment$  snapshot:=public.quote_nearest_provider_equipment($fragment$;
  if position(needle in definition)=0 then raise exception 'Expected trusted pricing RPC call missing'; end if;
  needle:=$fragment$  );
 exception when others then$fragment$;
  if position(needle in definition)=0 then raise exception 'Unexpected snapshot exception boundary'; end if;
  definition:=replace(definition,needle,
   $fragment$  );
  if private.provider_number(p_details->>'durationDays')=0.5
     and snapshot->>'status'='matched' then
    snapshot:=snapshot||jsonb_build_object('durationDays',0.5,'billingPeriod','halfDay',
       'selectedTotal',snapshot#>'{totals,fourHour}');
  end if;
 exception when others then$fragment$);
  execute definition;
end $migration$;
