create or replace function public.admin_save_meet(
  p_meet_id uuid,
  p_catalog_key text,
  p_category text,
  p_series_id text,
  p_series_name text,
  p_name text,
  p_year smallint,
  p_edition_number smallint,
  p_host_city text,
  p_host_country text,
  p_meet_date date,
  p_end_date date,
  p_status text,
  p_source_url text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_before jsonb; v_category_order smallint;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Meet management permission required.' using errcode = '42501'; end if;
  if p_category not in ('World Transplant Games','National Transplant Games') then raise exception 'Choose a supported Games category.'; end if;
  if p_status not in ('completed','in_progress','upcoming','cancelled','date_unconfirmed') then raise exception 'Choose a supported meet status.'; end if;
  if nullif(trim(coalesce(p_catalog_key,'')),'') is null or nullif(trim(coalesce(p_series_id,'')),'') is null or nullif(trim(coalesce(p_series_name,'')),'') is null or nullif(trim(coalesce(p_name,'')),'') is null then
    raise exception 'Add the meet name and series details.';
  end if;
  if p_year < 1900 or p_year > 2200 then raise exception 'Enter a valid meet year.'; end if;
  if p_end_date is not null and p_meet_date is not null and p_end_date < p_meet_date then raise exception 'The end date must be on or after the start date.'; end if;
  if nullif(trim(coalesce(p_source_url,'')),'') is not null and trim(p_source_url) !~* '^https?://' then raise exception 'The source URL must begin with http:// or https://.'; end if;
  v_category_order := case when p_category='World Transplant Games' then 1 else 2 end;

  if p_meet_id is null then
    insert into public.meet_catalog(catalog_key,category,category_order,series_id,series_name,name,year,edition_number,host_city,host_country,meet_date,end_date,status,source_url,source_metadata)
    values(trim(p_catalog_key),p_category,v_category_order,trim(p_series_id),trim(p_series_name),trim(p_name),p_year,p_edition_number,nullif(trim(coalesce(p_host_city,'')),''),nullif(trim(coalesce(p_host_country,'')),''),p_meet_date,p_end_date,p_status,nullif(trim(coalesce(p_source_url,'')),''),jsonb_build_object('managed_in_admin',true,'created_by',auth.uid()))
    returning id into v_id;
  else
    select to_jsonb(m) into v_before from public.meet_catalog m where m.id=p_meet_id for update;
    if not found then raise exception 'Meet not found.' using errcode = 'P0002'; end if;
    update public.meet_catalog set catalog_key=trim(p_catalog_key),category=p_category,category_order=v_category_order,series_id=trim(p_series_id),series_name=trim(p_series_name),name=trim(p_name),year=p_year,edition_number=p_edition_number,host_city=nullif(trim(coalesce(p_host_city,'')),''),host_country=nullif(trim(coalesce(p_host_country,'')),''),meet_date=p_meet_date,end_date=p_end_date,status=p_status,source_url=nullif(trim(coalesce(p_source_url,'')),''),updated_at=now()
    where id=p_meet_id returning id into v_id;
  end if;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,before_data,after_data)
  values(auth.uid(),case when p_meet_id is null then 'meet_created' else 'meet_updated' end,'meet',v_id::text,v_before,
    jsonb_build_object('name',trim(p_name),'category',p_category,'year',p_year,'status',p_status,'host_city',p_host_city,'host_country',p_host_country));
  return v_id;
end;
$$;
revoke all on function public.admin_save_meet(uuid,text,text,text,text,text,smallint,smallint,text,text,date,date,text,text) from public,anon;
grant execute on function public.admin_save_meet(uuid,text,text,text,text,text,smallint,smallint,text,text,date,date,text,text) to authenticated;

create or replace function public.admin_set_submitted_result_status(p_result_id uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_result public.swimmer_results%rowtype;
begin
  if not public.has_admin_permission('publish_results') then raise exception 'Result review permission required.' using errcode = '42501'; end if;
  if p_status not in ('verified','rejected','swimmer_submitted') then raise exception 'Choose a supported result status.'; end if;
  select * into v_result from public.swimmer_results where id=p_result_id for update;
  if not found then raise exception 'Submitted result not found.' using errcode = 'P0002'; end if;
  v_before:=jsonb_build_object('status',v_result.status,'record_candidate_status',v_result.record_candidate_status);
  update public.swimmer_results set status=p_status,
    record_candidate_status=case when p_status='rejected' and record_candidate then 'rejected' when p_status='swimmer_submitted' and record_candidate then 'pending_verification' else record_candidate_status end,
    updated_at=now()
  where id=p_result_id;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,before_data,after_data,details)
  values(auth.uid(),'submitted_result_status_changed','swimmer_result',p_result_id::text,v_before,
    jsonb_build_object('status',p_status,'record_candidate_status',case when p_status='rejected' and v_result.record_candidate then 'rejected' when p_status='swimmer_submitted' and v_result.record_candidate then 'pending_verification' else v_result.record_candidate_status end),
    jsonb_build_object('note',nullif(trim(coalesce(p_note,'')),''),'event',v_result.event,'swimmer',v_result.swimmer_name));
end;
$$;
revoke all on function public.admin_set_submitted_result_status(uuid,text,text) from public,anon;
grant execute on function public.admin_set_submitted_result_status(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
