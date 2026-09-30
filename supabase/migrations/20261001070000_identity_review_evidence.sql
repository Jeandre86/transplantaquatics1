alter table public.admin_import_results add column if not exists identity_review_note text;
alter table public.admin_import_swimmers add column if not exists identity_review_note text;

drop function if exists public.admin_link_import_swimmer(uuid,uuid);
create or replace function public.admin_link_import_swimmer(p_staged_swimmer_id uuid,p_profile_id uuid,p_evidence text)
returns void language plpgsql security definer set search_path = '' as $$
declare swimmer public.admin_import_swimmers%rowtype;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  if length(trim(coalesce(p_evidence,'')))<12 then raise exception 'Describe the source evidence used to verify the swimmer identity.'; end if;
  select * into swimmer from public.admin_import_swimmers where id=p_staged_swimmer_id for update;
  if not found or not exists(select 1 from public.swimmer_profiles where id=p_profile_id) then raise exception 'Staged or existing swimmer profile not found.'; end if;
  update public.admin_import_swimmers set resolved_swimmer_id=p_profile_id,resolution='link_existing',reviewer_id=auth.uid(),reviewed_at=now(),identity_review_note=trim(p_evidence) where id=p_staged_swimmer_id;
  update public.admin_import_results set linked_swimmer_id=p_profile_id,identity_review_note=trim(p_evidence) where batch_id=swimmer.batch_id and swimmer_source_key=swimmer.source_key;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,batch_id,details)
  values(auth.uid(),'import_swimmer_linked','swimmer_profile',p_profile_id::text,swimmer.batch_id,jsonb_build_object('staged_swimmer_id',p_staged_swimmer_id,'human_reviewed',true,'evidence',trim(p_evidence)));
end; $$;
revoke all on function public.admin_link_import_swimmer(uuid,uuid,text) from public;
grant execute on function public.admin_link_import_swimmer(uuid,uuid,text) to authenticated;

create or replace function public.admin_review_import_result(p_result_id uuid,p_action text,p_swimmer_id uuid default null,p_issue text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.admin_import_results%rowtype; batch_meet uuid;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  if p_action not in ('publish','skip') then raise exception 'Review action must be publish or skip.'; end if;
  select * into r from public.admin_import_results where id=p_result_id for update;
  if not found then raise exception 'Staged result not found.'; end if;
  if p_action='publish' and r.validation_state='invalid' then raise exception 'Resolve the invalid source row before approving it.'; end if;
  if p_action='publish' and r.race_status='OK' and not r.is_relay and r.time_ms is not null and p_swimmer_id is null then raise exception 'Link a reviewed swimmer profile before publishing an individual swim time.'; end if;
  if p_swimmer_id is not null and not exists(select 1 from public.swimmer_profiles where id=p_swimmer_id) then raise exception 'Swimmer profile not found.'; end if;
  if p_swimmer_id is not null and length(trim(coalesce(p_issue,'')))<12 then raise exception 'Provide the supporting evidence used to link this source result to the swimmer profile.'; end if;
  select b.submitted_meet_id into batch_meet from public.admin_import_batches b where b.id=r.batch_id;
  update public.admin_import_results set review_action=p_action,linked_swimmer_id=p_swimmer_id,
    identity_review_note=case when p_swimmer_id is null then identity_review_note else trim(p_issue) end,
    validation_state=case when p_action='publish' and p_swimmer_id is not null and exists(select 1 from public.swimmer_results sr where sr.meet_id=batch_meet and sr.swimmer_id=p_swimmer_id and lower(trim(sr.event))=lower(trim(r.event)) and sr.time=r.time_original and sr.status='verified') then 'duplicate' else validation_state end,
    validation_issues=case when p_action='publish' and p_swimmer_id is not null and exists(select 1 from public.swimmer_results sr where sr.meet_id=batch_meet and sr.swimmer_id=p_swimmer_id and lower(trim(sr.event))=lower(trim(r.event)) and sr.time=r.time_original and sr.status='verified') then validation_issues||jsonb_build_array('Matching verified time already exists for this swimmer and meet') else validation_issues end
  where id=p_result_id;
end; $$;
revoke all on function public.admin_review_import_result(uuid,text,uuid,text) from public;
grant execute on function public.admin_review_import_result(uuid,text,uuid,text) to authenticated;
