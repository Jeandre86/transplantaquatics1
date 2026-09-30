alter table public.wtg_record_history add column if not exists swimmer_id uuid references public.swimmer_profiles(id) on delete set null;
alter table public.wtg_record_history add column if not exists baseline_record_id text references public.world_records(id) on delete set null;
alter table public.wtg_record_history add column if not exists country text;
alter table public.wtg_record_history add column if not exists country_code text;
alter table public.wtg_record_history add column if not exists meet_name text;
alter table public.wtg_record_history add column if not exists meet_year integer;

create or replace function public.admin_confirm_record_candidate(p_candidate_id uuid,p_evidence text,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.admin_record_candidates%rowtype; perf public.imported_official_performances%rowtype; meet_row public.meet_catalog%rowtype; event_key_value text; holder text;
begin
  if not public.has_admin_permission('confirm_records') then raise exception 'Record confirmation permission required.' using errcode='42501'; end if;
  if length(trim(coalesce(p_evidence,'')))<12 then raise exception 'Attach official confirmation evidence.'; end if;
  select * into c from public.admin_record_candidates where id=p_candidate_id for update;
  if not found or c.status not in ('potential_record','equalled') then raise exception 'Only a potential or equalled record can be confirmed.'; end if;
  select * into perf from public.imported_official_performances where id=c.imported_performance_id;
  select * into meet_row from public.meet_catalog where id=perf.meet_catalog_id;
  if perf.race_status<>'OK' or perf.time_ms is null then raise exception 'Non-finish rows cannot be confirmed as records.'; end if;
  holder:=coalesce(perf.relay_team,perf.swimmer_name);
  event_key_value:=lower(concat_ws('|',trim(perf.event),trim(coalesce(perf.age_group,'')),trim(coalesce(perf.gender,'')),trim(coalesce(perf.source_metadata->>'competition_category','')),trim(coalesce(perf.course,'')),case when perf.is_relay then 'relay' else 'individual' end));
  update public.admin_record_candidates set status='confirmed',reviewed_by=auth.uid(),confirmation_evidence=trim(p_evidence),reviewer_note=p_note,reviewed_at=now() where id=c.id;
  if c.status='potential_record' then
    update public.wtg_record_history set superseded_at=now() where event_key=event_key_value and superseded_at is null;
  end if;
  insert into public.wtg_record_history(candidate_id,event_key,event,age_group,gender,competition_category,course,holder_name,time_ms,meet_catalog_id,source_evidence,confirmed_by,swimmer_id,baseline_record_id,country,country_code,meet_name,meet_year)
  values(c.id,event_key_value,perf.event,perf.age_group,perf.gender,perf.source_metadata->>'competition_category',perf.course,holder,c.new_time_ms,perf.meet_catalog_id,trim(p_evidence),auth.uid(),perf.swimmer_id,c.baseline_record_id,perf.country,
    (select sp.country_code from public.swimmer_profiles sp where sp.id=perf.swimmer_id),meet_row.name,meet_row.year);
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'record_confirmed','record_candidate',c.id::text,jsonb_build_object('evidence',p_evidence,'note',p_note,'meet',meet_row.name));
end; $$;
revoke all on function public.admin_confirm_record_candidate(uuid,text,text) from public;
grant execute on function public.admin_confirm_record_candidate(uuid,text,text) to authenticated;
