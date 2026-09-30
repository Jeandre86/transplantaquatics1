create or replace function public.admin_review_import_result(p_result_id uuid,p_action text,p_swimmer_id uuid default null,p_issue text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.admin_import_results%rowtype;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  if p_action not in ('publish','skip') then raise exception 'Review action must be publish or skip.'; end if;
  select * into r from public.admin_import_results where id=p_result_id for update;
  if not found then raise exception 'Staged result not found.'; end if;
  if p_action='publish' and r.validation_state='invalid' then raise exception 'Resolve the invalid source row before approving it.'; end if;
  if p_action='publish' and r.race_status='OK' and not r.is_relay and r.time_ms is not null and p_swimmer_id is null then
    raise exception 'Link a reviewed swimmer profile before publishing an individual swim time.';
  end if;
  if p_swimmer_id is not null and not exists(select 1 from public.swimmer_profiles where id=p_swimmer_id) then raise exception 'Swimmer profile not found.'; end if;
  update public.admin_import_results set review_action=p_action,linked_swimmer_id=p_swimmer_id,
    validation_issues=case when p_issue is null then validation_issues else validation_issues || jsonb_build_array(p_issue) end where id=p_result_id;
end; $$;
revoke all on function public.admin_review_import_result(uuid,text,uuid,text) from public;
grant execute on function public.admin_review_import_result(uuid,text,uuid,text) to authenticated;

create table if not exists public.wtg_record_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.admin_record_candidates(id) on delete restrict,
  event_key text not null,
  event text not null,
  age_group text not null,
  gender text not null,
  competition_category text not null,
  course text not null,
  holder_name text not null,
  time_ms integer not null,
  meet_catalog_id uuid references public.meet_catalog(id),
  source_evidence text not null,
  confirmed_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now(),
  superseded_at timestamptz,
  superseded_by uuid references public.wtg_record_history(id),
  created_at timestamptz not null default now()
);
create index if not exists wtg_record_history_current_idx on public.wtg_record_history(event_key,confirmed_at desc) where superseded_at is null;
alter table public.wtg_record_history enable row level security;
drop policy if exists "Confirmed WTG records are public" on public.wtg_record_history;
create policy "Confirmed WTG records are public" on public.wtg_record_history for select to anon,authenticated using (true);
grant select on public.wtg_record_history to anon,authenticated;

create or replace function public.admin_confirm_record_candidate(p_candidate_id uuid,p_evidence text,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.admin_record_candidates%rowtype; perf public.imported_official_performances%rowtype; meet_row public.meet_catalog%rowtype; event_key_value text; holder text;
begin
  if not public.has_admin_permission('confirm_records') then raise exception 'Record confirmation permission required.' using errcode='42501'; end if;
  if length(trim(coalesce(p_evidence,''))) < 12 then raise exception 'Attach official confirmation evidence.'; end if;
  select * into c from public.admin_record_candidates where id=p_candidate_id for update;
  if not found or c.status not in ('potential_record','equalled') then raise exception 'Only a potential or equalled record can be confirmed.'; end if;
  select * into perf from public.imported_official_performances where id=c.imported_performance_id;
  select * into meet_row from public.meet_catalog where id=perf.meet_catalog_id;
  if perf.race_status<>'OK' or perf.time_ms is null then raise exception 'Non-finish rows cannot be confirmed as records.'; end if;
  holder:=coalesce(perf.relay_team,perf.swimmer_name);
  event_key_value:=lower(concat_ws('|',trim(perf.event),trim(coalesce(perf.age_group,'')),trim(coalesce(perf.gender,'')),trim(coalesce(perf.source_metadata->>'competition_category','')),trim(coalesce(perf.course,'')),case when perf.is_relay then 'relay' else 'individual' end));
  update public.admin_record_candidates set status='confirmed',reviewed_by=auth.uid(),confirmation_evidence=trim(p_evidence),reviewer_note=p_note,reviewed_at=now() where id=c.id;
  update public.wtg_record_history set superseded_at=now() where event_key=event_key_value and superseded_at is null;
  insert into public.wtg_record_history(candidate_id,event_key,event,age_group,gender,competition_category,course,holder_name,time_ms,meet_catalog_id,source_evidence,confirmed_by)
  values(c.id,event_key_value,perf.event,perf.age_group,perf.gender,perf.source_metadata->>'competition_category',perf.course,holder,c.new_time_ms,perf.meet_catalog_id,trim(p_evidence),auth.uid());
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'record_confirmed','record_candidate',c.id::text,jsonb_build_object('evidence',p_evidence,'note',p_note,'meet',meet_row.name));
end; $$;
revoke all on function public.admin_confirm_record_candidate(uuid,text,text) from public;
grant execute on function public.admin_confirm_record_candidate(uuid,text,text) to authenticated;
