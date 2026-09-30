create index if not exists wtg_record_history_current_baseline_idx
  on public.wtg_record_history(baseline_record_id,confirmed_at desc) where superseded_at is null;

create or replace function public.admin_check_wtg_records(p_meet_catalog_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare meet_row public.meet_catalog%rowtype; perf record; baseline_id text; baseline_ms integer; new_ms integer; candidate_status text; n integer:=0;
begin
  if not public.has_admin_permission('confirm_records') then raise exception 'Record review permission required.' using errcode='42501'; end if;
  select * into meet_row from public.meet_catalog where id=p_meet_catalog_id;
  if not found or meet_row.category<>'World Transplant Games' then raise exception 'Select a World Transplant Games meet.'; end if;
  if meet_row.status<>'completed' then raise exception 'Record checks are available after the meet is marked completed.'; end if;
  if not exists(select 1 from public.imported_official_performances p join public.admin_import_batches b on b.id=p.batch_id where p.meet_catalog_id=p_meet_catalog_id and b.status='published') then raise exception 'No published official results are available for this meet.'; end if;
  for perf in select p.* from public.imported_official_performances p join public.admin_import_batches b on b.id=p.batch_id
    where p.meet_catalog_id=p_meet_catalog_id and b.status='published' and p.race_status='OK' and p.time_original is not null loop
    new_ms:=coalesce(perf.time_ms,public.admin_time_to_ms(perf.time_original));baseline_id:=null;baseline_ms:=null;
    if new_ms is null or perf.course is null or perf.gender is null or perf.age_group is null or perf.event is null or perf.source_metadata->>'competition_category' is null or (perf.is_relay and coalesce(perf.relay_team,'')='') then candidate_status:='needs_review';
    else
      select wr.id,coalesce((select h.time_ms from public.wtg_record_history h where h.baseline_record_id=wr.id and h.superseded_at is null order by h.confirmed_at desc limit 1),public.admin_time_to_ms(wr.time))
      into baseline_id,baseline_ms from public.world_records wr
      where wr.record_type ilike '%World Transplant Games Record%'
        and lower(trim(wr.event))=lower(trim(perf.event)) and lower(trim(wr.age_group))=lower(trim(perf.age_group))
        and lower(trim(wr.gender))=lower(trim(perf.gender)) and lower(trim(wr.course))=lower(trim(perf.course))
        and lower(coalesce(wr.category,''))=lower(perf.source_metadata->>'competition_category') limit 1;
      if baseline_id is null then candidate_status:='needs_review';
      elsif baseline_ms is null then candidate_status:='needs_review';
      elsif new_ms<baseline_ms then candidate_status:='potential_record';
      elsif new_ms=baseline_ms then candidate_status:='equalled';
      else continue; end if;
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
