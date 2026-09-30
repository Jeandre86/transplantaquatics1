create or replace function public.admin_find_swimmers(p_query text, p_country text default null)
returns table(id uuid, first_name text, last_name text, country text, gender text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  if length(trim(coalesce(p_query,''))) < 2 then return; end if;
  return query select sp.id,sp.first_name,sp.last_name,sp.country,sp.gender
    from public.swimmer_profiles sp
    where concat_ws(' ',sp.first_name,sp.last_name) ilike '%'||trim(p_query)||'%'
      and (p_country is null or sp.country ilike p_country)
    order by case when lower(concat_ws(' ',sp.first_name,sp.last_name))=lower(trim(p_query)) then 0 else 1 end,sp.last_name
    limit 12;
end; $$;
revoke all on function public.admin_find_swimmers(text,text) from public;
grant execute on function public.admin_find_swimmers(text,text) to authenticated;

create or replace function public.admin_create_import_swimmer(p_staged_swimmer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare swimmer public.admin_import_swimmers%rowtype; new_profile_id uuid;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  select * into swimmer from public.admin_import_swimmers where id=p_staged_swimmer_id for update;
  if not found then raise exception 'Staged swimmer not found.'; end if;
  if swimmer.country is null then raise exception 'A country is required before an unclaimed athlete profile can be created.'; end if;
  if swimmer.resolution='create_profile' and swimmer.resolved_swimmer_id is not null then return swimmer.resolved_swimmer_id; end if;
  insert into public.swimmer_profiles(account_id,first_name,last_name,date_of_birth,gender,transplant_type,country,country_code,is_account_holder)
  values(null,swimmer.first_name,swimmer.last_name,null,swimmer.gender,null,swimmer.country,swimmer.country_code,false)
  returning id into new_profile_id;
  update public.admin_import_swimmers set resolved_swimmer_id=new_profile_id,resolution='create_profile',reviewer_id=auth.uid(),reviewed_at=now() where id=p_staged_swimmer_id;
  update public.admin_import_results set linked_swimmer_id=new_profile_id where batch_id=swimmer.batch_id and swimmer_source_key=swimmer.source_key;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,batch_id,details)
  values(auth.uid(),'unclaimed_profile_created','swimmer_profile',new_profile_id::text,swimmer.batch_id,jsonb_build_object('staged_swimmer_id',p_staged_swimmer_id,'source_identifier',swimmer.source_identifier));
  return new_profile_id;
end; $$;
revoke all on function public.admin_create_import_swimmer(uuid) from public;
grant execute on function public.admin_create_import_swimmer(uuid) to authenticated;

create or replace function public.admin_link_import_swimmer(p_staged_swimmer_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare swimmer public.admin_import_swimmers%rowtype;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  select * into swimmer from public.admin_import_swimmers where id=p_staged_swimmer_id for update;
  if not found or not exists(select 1 from public.swimmer_profiles where id=p_profile_id) then raise exception 'Staged or existing swimmer profile not found.'; end if;
  update public.admin_import_swimmers set resolved_swimmer_id=p_profile_id,resolution='link_existing',reviewer_id=auth.uid(),reviewed_at=now() where id=p_staged_swimmer_id;
  update public.admin_import_results set linked_swimmer_id=p_profile_id where batch_id=swimmer.batch_id and swimmer_source_key=swimmer.source_key;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,batch_id,details)
  values(auth.uid(),'import_swimmer_linked','swimmer_profile',p_profile_id::text,swimmer.batch_id,jsonb_build_object('staged_swimmer_id',p_staged_swimmer_id,'human_reviewed',true));
end; $$;
revoke all on function public.admin_link_import_swimmer(uuid,uuid) from public;
grant execute on function public.admin_link_import_swimmer(uuid,uuid) to authenticated;

create or replace function public.admin_review_import_result(p_result_id uuid, p_action text, p_swimmer_id uuid default null, p_issue text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.admin_import_results%rowtype;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  if p_action not in ('publish','skip') then raise exception 'Review action must be publish or skip.'; end if;
  select * into r from public.admin_import_results where id=p_result_id for update;
  if not found then raise exception 'Staged result not found.'; end if;
  if p_action='publish' and (p_swimmer_id is null or not exists(select 1 from public.swimmer_profiles where id=p_swimmer_id)) then raise exception 'Link a verified existing or newly-created swimmer profile before approving publication.'; end if;
    if p_action='publish' and (r.validation_state <> 'valid' or r.race_status <> 'OK' or r.is_relay or r.time_ms is null or r.course is null or r.gender is null or r.age_group is null or r.country is null or r.competition_category is null) then
    raise exception 'Only complete, valid individual swim results can be published to swimmer profiles. Keep relays and incomplete rows in the official meet history.';
  end if;
  update public.admin_import_results set review_action=p_action,linked_swimmer_id=p_swimmer_id,
    validation_issues=case when p_issue is null then validation_issues else validation_issues || jsonb_build_array(p_issue) end where id=p_result_id;
end; $$;
revoke all on function public.admin_review_import_result(uuid,text,uuid,text) from public;
grant execute on function public.admin_review_import_result(uuid,text,uuid,text) to authenticated;

create or replace function public.admin_time_to_ms(p_time text)
returns integer language plpgsql immutable set search_path = '' as $$
declare m text[]; mins integer; secs integer; frac integer;
begin
  m:=regexp_match(trim(coalesce(p_time,'')),'^(?:(\d+):)?(\d{1,2})(?:\.(\d{1,3}))?$');
  if m is null then return null; end if;
  mins:=coalesce(nullif(m[1],''),'0')::integer; secs:=m[2]::integer;
  if m[1] is not null and secs>=60 then return null; end if;
  frac:=coalesce(nullif(rpad(coalesce(m[3],''),3,'0'),''),'0')::integer;
  return (mins*60+secs)*1000+frac;
end; $$;

create or replace function public.admin_check_wtg_records(p_meet_catalog_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare meet_row public.meet_catalog%rowtype; perf record; baseline_id text; baseline_ms integer; new_ms integer; candidate_status text; n integer:=0;
begin
  if not public.has_admin_permission('confirm_records') then raise exception 'Record review permission required.' using errcode='42501'; end if;
  select * into meet_row from public.meet_catalog where id=p_meet_catalog_id;
  if not found or meet_row.category <> 'World Transplant Games' then raise exception 'Select a World Transplant Games meet.'; end if;
  if meet_row.status <> 'completed' then raise exception 'Record checks are available after the meet is marked completed.'; end if;
  if not exists(select 1 from public.imported_official_performances p join public.admin_import_batches b on b.id=p.batch_id where p.meet_catalog_id=p_meet_catalog_id and b.status='published') then
    raise exception 'No published official results are available for this meet.';
  end if;
  for perf in select p.* from public.imported_official_performances p join public.admin_import_batches b on b.id=p.batch_id
    where p.meet_catalog_id=p_meet_catalog_id and b.status='published' and p.race_status='OK' and p.time_original is not null loop
    new_ms:=coalesce(perf.time_ms,public.admin_time_to_ms(perf.time_original));
    baseline_id:=null; baseline_ms:=null;
    if new_ms is null or perf.course is null or perf.gender is null or perf.age_group is null or perf.event is null or perf.source_metadata->>'competition_category' is null or (perf.is_relay and coalesce(perf.relay_team,'')='') then
      candidate_status:='needs_review';
    else
      select wr.id,public.admin_time_to_ms(wr.time) as time_ms into baseline_id,baseline_ms from public.world_records wr
      where wr.record_type ilike '%World Transplant Games Record%'
        and lower(trim(wr.event))=lower(trim(perf.event)) and lower(trim(wr.age_group))=lower(trim(perf.age_group))
        and lower(trim(wr.gender))=lower(trim(perf.gender)) and lower(trim(wr.course))=lower(trim(perf.course))
        and lower(coalesce(wr.category,''))=lower(perf.source_metadata->>'competition_category')
      limit 1;
      if baseline_id is null then candidate_status:='needs_review';
      else
        if baseline_ms is null then candidate_status:='needs_review'; elsif new_ms<baseline_ms then candidate_status:='potential_record'; elsif new_ms=baseline_ms then candidate_status:='equalled'; else continue; end if;
      end if;
    end if;
    if not exists(select 1 from public.admin_record_candidates c where c.imported_performance_id=perf.id and c.baseline_record_id is not distinct from baseline_id) then
      insert into public.admin_record_candidates(imported_performance_id,baseline_record_id,status,old_time_ms,new_time_ms,improvement_ms)
      values(perf.id,baseline_id,candidate_status,baseline_ms,new_ms,case when baseline_ms is null then null else baseline_ms-new_ms end);
      n:=n+1;
    end if;
  end loop;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'wtg_record_check','meet',p_meet_catalog_id::text,jsonb_build_object('new_candidates',n,'checked_at',now()));
  return n;
end; $$;
revoke all on function public.admin_check_wtg_records(uuid) from public;
grant execute on function public.admin_check_wtg_records(uuid) to authenticated;
