create unique index if not exists admin_import_batch_source_sha_unique
  on public.admin_import_batches(meet_catalog_id,source_sha256) where source_sha256 is not null;

create or replace function public.admin_stage_import_rows(p_batch_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare r jsonb; result_count integer:=0; batch_owner uuid; batch_status text; was_duplicate boolean;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  select created_by,status into batch_owner,batch_status from public.admin_import_batches where id=p_batch_id for update;
  if batch_owner is null then raise exception 'Import batch not found.'; end if;
  if batch_owner<>auth.uid() and not public.has_admin_permission('publish_results') then raise exception 'Only the importer or an administrator can stage rows.' using errcode='42501'; end if;
  if batch_status in ('published','rolled_back') then raise exception 'This source has already been published or rolled back. Start a new batch to intentionally reprocess it.'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>20000 then raise exception 'Import must be an array of at most 20,000 rows.'; end if;
  update public.admin_import_batches set status='parsing',progress='Saving staged result rows',error_message=null,updated_at=now() where id=p_batch_id;
  for r in select value from jsonb_array_elements(p_rows) loop
    select exists(select 1 from public.admin_import_results old where old.batch_id=p_batch_id and old.source_row_key<>coalesce(nullif(r->>'source_row_key',''),md5(r::text))
      and lower(old.swimmer_name)=lower(coalesce(nullif(r->>'swimmer_name',''),'Unknown swimmer'))
      and lower(old.event)=lower(coalesce(nullif(r->>'event',''),'Unknown event'))
      and coalesce(old.round_name,'')=coalesce(nullif(r->>'round_name',''),'')
      and coalesce(old.time_original,'')=coalesce(nullif(r->>'time_original',''),'')
      and old.race_status=coalesce(nullif(r->>'race_status',''),'OK')) into was_duplicate;
    insert into public.admin_import_results(batch_id,source_row_key,swimmer_source_key,swimmer_name,country,country_code,gender,event,distance_m,stroke,age_group,competition_category,course,round_name,time_original,time_ms,"placing",race_status,is_relay,relay_team,relay_members,raw_data,source_references,validation_state,validation_issues)
    values(p_batch_id,coalesce(nullif(r->>'source_row_key',''),md5(r::text)),nullif(r->>'swimmer_source_key',''),coalesce(nullif(r->>'swimmer_name',''),'Unknown swimmer'),nullif(r->>'country',''),nullif(r->>'country_code',''),nullif(r->>'gender',''),coalesce(nullif(r->>'event',''),'Unknown event'),nullif(r->>'distance_m','')::smallint,nullif(r->>'stroke',''),nullif(r->>'age_group',''),nullif(r->>'competition_category',''),nullif(r->>'course',''),nullif(r->>'round_name',''),nullif(r->>'time_original',''),nullif(r->>'time_ms','')::integer,nullif(r->>'placing',''),coalesce(nullif(r->>'race_status',''),'OK'),coalesce((r->>'is_relay')::boolean,false),nullif(r->>'relay_team',''),coalesce(r->'relay_members','[]'::jsonb),coalesce(r->'raw_data',r),coalesce(r->'source_references','[]'::jsonb),
      case when was_duplicate then 'duplicate' when nullif(r->>'swimmer_name','') is null or nullif(r->>'event','') is null then 'invalid'
        when nullif(r->>'course','') is null or nullif(r->>'gender','') is null or nullif(r->>'age_group','') is null then 'uncertain'
        when coalesce(nullif(r->>'race_status',''),'OK')='OK' and nullif(r->>'time_ms','') is null then 'invalid' else 'valid' end,
      case when was_duplicate then jsonb_build_array('Repeated swimmer/event/round/time row in this source')
        when nullif(r->>'swimmer_name','') is null or nullif(r->>'event','') is null then jsonb_build_array('Missing swimmer name or event')
        when nullif(r->>'course','') is null or nullif(r->>'gender','') is null or nullif(r->>'age_group','') is null then jsonb_build_array('Missing event eligibility details; manual review required')
        when coalesce(nullif(r->>'race_status',''),'OK')='OK' and nullif(r->>'time_ms','') is null then jsonb_build_array('Swim time is missing or could not be parsed') else '[]'::jsonb end)
    on conflict(batch_id,source_row_key) do update set raw_data=excluded.raw_data,source_references=excluded.source_references;
    result_count:=result_count+1;
    if nullif(r->>'swimmer_source_key','') is not null and nullif(r->>'swimmer_name','') is not null then
      insert into public.admin_import_swimmers(batch_id,source_key,source_identifier,first_name,last_name,country,country_code,gender,age_group_at_meet,raw_data,source_references)
      values(p_batch_id,r->>'swimmer_source_key',nullif(r->>'swimmer_source_key',''),coalesce(nullif(r->>'first_name',''),split_part(r->>'swimmer_name',' ',1)),coalesce(nullif(r->>'last_name',''),nullif(trim(substr(r->>'swimmer_name',length(split_part(r->>'swimmer_name',' ',1))+1)),''),'(unknown)'),nullif(r->>'country',''),nullif(r->>'country_code',''),nullif(r->>'gender',''),nullif(r->>'age_group',''),coalesce(r->'swimmer_raw_data','{}'::jsonb),coalesce(r->'source_references','[]'::jsonb))
      on conflict(batch_id,source_key) do nothing;
    end if;
  end loop;
  update public.admin_import_batches set status='review',stage_count=(select count(*) from public.admin_import_results where batch_id=p_batch_id),progress='Review staged results',updated_at=now() where id=p_batch_id;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,batch_id,details) values(auth.uid(),'import_staged','import_batch',p_batch_id::text,p_batch_id,jsonb_build_object('rows',result_count));
  return result_count;
end; $$;
revoke all on function public.admin_stage_import_rows(uuid,jsonb) from public;
grant execute on function public.admin_stage_import_rows(uuid,jsonb) to authenticated;
