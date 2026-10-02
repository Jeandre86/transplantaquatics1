-- Fix the PL/pgSQL variable/column name collision in the repeatable history importer.
create or replace function public.admin_import_historical_results(p_results jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; sp public.swimmer_profiles%rowtype; meet_row public.submitted_meets%rowtype; v_result_id uuid; n integer:=0; medals integer:=0;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  for r in select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb)) loop
    select * into sp from public.swimmer_profiles where source_key=r->>'swimmer_source_key';
    select * into meet_row from public.submitted_meets where source_meet_key=r->>'meet_source_key';
    if sp.id is null or meet_row.id is null then continue; end if;
    insert into public.swimmer_results(meet_id,swimmer_id,athlete_id,submitted_by,swimmer_name,country,country_code,gender,transplant_type,event,time,age_group,points,status,course,"placing",round_name,source_result_key,source_data,record_candidate,record_candidate_status)
    values(meet_row.id,sp.id,sp.id,null,r->>'swimmer_name',nullif(r->>'country',''),nullif(r->>'country_code',''),nullif(r->>'gender',''),nullif(r->>'transplant_type',''),r->>'event',r->>'time_original',nullif(r->>'age_group',''),nullif(r->>'points','')::integer,'imported_unverified',coalesce(nullif(r->>'course',''),'LCM'),nullif(r->>'placing','')::integer,r->>'round_name',r->>'source_result_key',coalesce(r->'source_data','{}'::jsonb),false,'not_candidate')
    on conflict do nothing
    returning id into v_result_id;
    if v_result_id is null then
      select sr.id into v_result_id from public.swimmer_results as sr where sr.source_result_key=r->>'source_result_key'
        or (sr.meet_id=meet_row.id and sr.swimmer_id=sp.id and lower(trim(sr.event))=lower(trim(r->>'event'))
          and coalesce(sr.gender,'')=coalesce(r->>'gender','') and coalesce(sr.age_group,'')=coalesce(r->>'age_group','')
          and coalesce(sr.course,'')=coalesce(r->>'course','LCM')) limit 1;
    end if;
    if v_result_id is not null and meet_row.is_world_transplant_games and nullif(r->>'placing','')::integer between 1 and 3 then
      insert into public.transplant_medals(swimmer_id,result_id,competition,year,medal)
      values(sp.id,v_result_id,meet_row.name,coalesce(meet_row.meet_year,extract(year from now())::integer),case nullif(r->>'placing','')::integer when 1 then 'Gold' when 2 then 'Silver' else 'Bronze' end)
      on conflict(result_id) do nothing;
      medals:=medals+1;
    end if;
    n:=n+1;
  end loop;
  return jsonb_build_object('processed',n,'medals',medals);
end $$;

revoke all on function public.admin_import_historical_results(jsonb) from public;
grant execute on function public.admin_import_historical_results(jsonb) to authenticated;
notify pgrst, 'reload schema';
