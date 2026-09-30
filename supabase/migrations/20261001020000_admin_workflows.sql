-- End-to-end admin workflows for the first World Transplant Games importer.
-- This migration intentionally starts with staging; official data is not seeded.

create or replace function public.bootstrap_first_owner()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in before setting up the first Owner.' using errcode = '42501'; end if;
  if exists (select 1 from public.admin_memberships) then raise exception 'An Owner is already configured.' using errcode = '42501'; end if;
  insert into public.admin_memberships(user_id, role, is_active, granted_by)
  values (auth.uid(), 'owner', true, auth.uid());
  insert into public.admin_activity_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'first_owner_bootstrapped', 'admin_membership', auth.uid()::text, '{}'::jsonb);
end; $$;
revoke all on function public.bootstrap_first_owner() from public;
grant execute on function public.bootstrap_first_owner() to authenticated;

create or replace function public.admin_start_meet_import(
  p_meet_catalog_id uuid,
  p_source_type text,
  p_source_url text default null,
  p_file_name text default null,
  p_source_sha256 text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare m public.meet_catalog%rowtype; sm_id uuid; batch_id uuid;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode = '42501'; end if;
  if p_source_type not in ('url','upload','json') then raise exception 'Unsupported source type.'; end if;
  select * into m from public.meet_catalog where id = p_meet_catalog_id for share;
  if not found then raise exception 'Meet not found in the official catalogue.'; end if;
  if p_source_type = 'url' and (p_source_url is null or p_source_url !~ '^https://') then raise exception 'Official source URL must use HTTPS.'; end if;
  -- Reuse a submitted meet row only when it is already linked to this catalogue edition.
  select id into sm_id from public.submitted_meets where catalog_meet_id = m.id order by created_at limit 1;
  if sm_id is null then
    insert into public.submitted_meets(created_by, name, meet_date, opening_ceremony_date, location, course, is_world_transplant_games, catalog_meet_id)
    values (auth.uid(), m.name, coalesce(m.meet_date, make_date(m.year::int,1,1)), m.meet_date,
      concat_ws(', ', m.host_city, m.host_country), 'LCM', m.category = 'World Transplant Games', m.id)
    returning id into sm_id;
  end if;
  if p_source_sha256 is not null then
    select id into batch_id from public.admin_import_batches where meet_catalog_id = m.id and source_sha256 = p_source_sha256 and status <> 'rolled_back' limit 1;
  end if;
  if batch_id is not null then return batch_id; end if;
  insert into public.admin_import_batches(meet_catalog_id, submitted_meet_id, created_by, source_type, source_url, file_name, source_sha256, source_metadata)
  values (m.id, sm_id, auth.uid(), p_source_type, p_source_url, p_file_name, p_source_sha256,
    jsonb_build_object('meet_name',m.name,'meet_year',m.year,'city',m.host_city,'country',m.host_country))
  returning id into batch_id;
  insert into public.admin_activity_log(actor_id, action, target_type, target_id, batch_id, details)
  values (auth.uid(), 'import_started', 'import_batch', batch_id::text, batch_id, jsonb_build_object('meet',m.name,'source_type',p_source_type));
  return batch_id;
end; $$;
revoke all on function public.admin_start_meet_import(uuid,text,text,text,text) from public;
grant execute on function public.admin_start_meet_import(uuid,text,text,text,text) to authenticated;

create or replace function public.admin_stage_import_rows(p_batch_id uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare r jsonb; result_count integer := 0; batch_owner uuid;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode = '42501'; end if;
  select created_by into batch_owner from public.admin_import_batches where id = p_batch_id for update;
  if batch_owner is null then raise exception 'Import batch not found.'; end if;
  if batch_owner <> auth.uid() and not public.has_admin_permission('publish_results') then raise exception 'Only the importer or an administrator can stage rows.' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 20000 then raise exception 'Import must be an array of at most 20,000 rows.'; end if;
  update public.admin_import_batches set status='parsing', progress='Saving staged result rows', error_message=null, updated_at=now() where id=p_batch_id;
  for r in select value from jsonb_array_elements(p_rows) loop
    insert into public.admin_import_results(batch_id, source_row_key, swimmer_source_key, swimmer_name, country, country_code,
      gender, event, distance_m, stroke, age_group, competition_category, course, round_name, time_original, time_ms,
      "placing", race_status, is_relay, relay_team, relay_members, raw_data, source_references, validation_state, validation_issues)
    values (p_batch_id, coalesce(nullif(r->>'source_row_key',''), md5(r::text)), nullif(r->>'swimmer_source_key',''),
      coalesce(nullif(r->>'swimmer_name',''),'Unknown swimmer'), nullif(r->>'country',''), nullif(r->>'country_code',''),
      nullif(r->>'gender',''), coalesce(nullif(r->>'event',''),'Unknown event'), nullif(r->>'distance_m','')::smallint,
      nullif(r->>'stroke',''), nullif(r->>'age_group',''), nullif(r->>'competition_category',''), nullif(r->>'course',''),
      nullif(r->>'round_name',''), nullif(r->>'time_original',''), nullif(r->>'time_ms','')::integer,
      nullif(r->>'placing',''), coalesce(nullif(r->>'race_status',''),'OK'), coalesce((r->>'is_relay')::boolean,false),
      nullif(r->>'relay_team',''), coalesce(r->'relay_members','[]'::jsonb), coalesce(r->'raw_data',r),
      coalesce(r->'source_references','[]'::jsonb),
      case when nullif(r->>'swimmer_name','') is null or nullif(r->>'event','') is null then 'invalid'
           when nullif(r->>'course','') is null or nullif(r->>'gender','') is null or nullif(r->>'age_group','') is null then 'uncertain'
           when coalesce(nullif(r->>'race_status',''),'OK') = 'OK' and nullif(r->>'time_ms','') is null then 'invalid'
           else 'valid' end,
      case when nullif(r->>'swimmer_name','') is null or nullif(r->>'event','') is null then jsonb_build_array('Missing swimmer name or event')
           when nullif(r->>'course','') is null or nullif(r->>'gender','') is null or nullif(r->>'age_group','') is null then jsonb_build_array('Missing event eligibility details; manual review required')
           when coalesce(nullif(r->>'race_status',''),'OK') = 'OK' and nullif(r->>'time_ms','') is null then jsonb_build_array('Swim time is missing or could not be parsed')
           else '[]'::jsonb end)
    on conflict (batch_id, source_row_key) do update set raw_data=excluded.raw_data, source_references=excluded.source_references;
    result_count := result_count + 1;
    if nullif(r->>'swimmer_source_key','') is not null and nullif(r->>'swimmer_name','') is not null then
      insert into public.admin_import_swimmers(batch_id, source_key, source_identifier, first_name, last_name, country, country_code, gender, age_group_at_meet, raw_data, source_references)
      values (p_batch_id, r->>'swimmer_source_key', nullif(r->>'swimmer_source_key',''),
        coalesce(nullif(r->>'first_name',''), split_part(r->>'swimmer_name',' ',1)),
        coalesce(nullif(r->>'last_name',''), nullif(trim(substr(r->>'swimmer_name', length(split_part(r->>'swimmer_name',' ',1))+1)),''), '(unknown)'),
        nullif(r->>'country',''), nullif(r->>'country_code',''), nullif(r->>'gender',''), nullif(r->>'age_group',''),
        coalesce(r->'swimmer_raw_data','{}'::jsonb), coalesce(r->'source_references','[]'::jsonb))
      on conflict (batch_id, source_key) do nothing;
    end if;
  end loop;
  update public.admin_import_batches set status='review', stage_count=(select count(*) from public.admin_import_results where batch_id=p_batch_id), progress='Review staged results', updated_at=now() where id=p_batch_id;
  insert into public.admin_activity_log(actor_id, action, target_type, target_id, batch_id, details)
  values (auth.uid(),'import_staged','import_batch',p_batch_id::text,p_batch_id,jsonb_build_object('rows',result_count));
  return result_count;
end; $$;
revoke all on function public.admin_stage_import_rows(uuid,jsonb) from public;
grant execute on function public.admin_stage_import_rows(uuid,jsonb) to authenticated;

create or replace function public.admin_review_import_result(p_result_id uuid, p_action text, p_swimmer_id uuid default null, p_issue text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.admin_import_results%rowtype;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode = '42501'; end if;
  if p_action not in ('publish','skip') then raise exception 'Review action must be publish or skip.'; end if;
  select * into r from public.admin_import_results where id=p_result_id for update;
  if not found then raise exception 'Staged result not found.'; end if;
  if p_action='publish' and (p_swimmer_id is null or not exists(select 1 from public.swimmer_profiles where id=p_swimmer_id)) then
    raise exception 'Link a verified existing or newly-created swimmer profile before approving publication.';
  end if;
  update public.admin_import_results set review_action=p_action, linked_swimmer_id=p_swimmer_id,
    validation_issues=case when p_issue is null then validation_issues else validation_issues || jsonb_build_array(p_issue) end,
    validation_state=case when p_action='publish' and validation_state='valid' then 'valid' else validation_state end
    where id=p_result_id;
end; $$;
revoke all on function public.admin_review_import_result(uuid,text,uuid,text) from public;
grant execute on function public.admin_review_import_result(uuid,text,uuid,text) to authenticated;

create or replace function public.admin_publish_import_batch(p_batch_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare r public.admin_import_results%rowtype; batch_row public.admin_import_batches%rowtype; published integer:=0; official_id uuid; display_name text;
begin
  if not public.has_admin_permission('publish_results') then raise exception 'Publication permission required.' using errcode = '42501'; end if;
  select * into batch_row from public.admin_import_batches where id=p_batch_id for update;
  if not found or batch_row.status not in ('review','ready_to_publish') then raise exception 'Import batch is not ready for publication.'; end if;
  for r in select * from public.admin_import_results where batch_id=p_batch_id and review_action='publish' loop
    insert into public.imported_official_performances(import_result_id,batch_id,meet_catalog_id,swimmer_id,swimmer_name,country,event,age_group,gender,course,round_name,time_original,time_ms,"placing",race_status,is_relay,relay_team,relay_members,source_metadata,published_by)
    values(r.id,p_batch_id,batch_row.meet_catalog_id,r.linked_swimmer_id,r.swimmer_name,r.country,r.event,r.age_group,r.gender,r.course,r.round_name,r.time_original,r.time_ms,r."placing",r.race_status,r.is_relay,r.relay_team,r.relay_members,
      jsonb_build_object('source_url',batch_row.source_url,'file_name',batch_row.file_name,'source_references',r.source_references,'source_values',r.raw_data,'competition_category',r.competition_category),auth.uid())
    on conflict (import_result_id) do update set source_metadata=excluded.source_metadata returning id into official_id;
    if r.race_status='OK' and not r.is_relay and r.time_original is not null and r.linked_swimmer_id is not null
      and r.review_action='publish' and r.validation_state='valid' and r.time_ms is not null and r.course is not null and r.gender is not null and r.age_group is not null then
      select concat_ws(' ',first_name,last_name) into display_name from public.swimmer_profiles where id=r.linked_swimmer_id;
      insert into public.swimmer_results(meet_id,swimmer_id,athlete_id,submitted_by,swimmer_name,country,country_code,gender,transplant_type,event,time,age_group,status,record_candidate,record_candidate_status)
      select batch_row.submitted_meet_id,sp.id,sp.id,null,coalesce(display_name,r.swimmer_name),coalesce(sp.country,r.country),sp.country_code,coalesce(sp.gender,r.gender),sp.transplant_type,r.event,r.time_original,coalesce(r.age_group, r.age_group), 'verified',false,'not_candidate'
      from public.swimmer_profiles sp where sp.id=r.linked_swimmer_id
      and not exists(select 1 from public.swimmer_results sr where sr.meet_id=batch_row.submitted_meet_id and sr.swimmer_id=sp.id and lower(trim(sr.event))=lower(trim(r.event)) and sr.time=r.time_original and sr.status='verified');
      update public.admin_import_results set published_result_id=(select id from public.swimmer_results where meet_id=batch_row.submitted_meet_id and swimmer_id=r.linked_swimmer_id and lower(trim(event))=lower(trim(r.event)) and time=r.time_original and status='verified' order by created_at desc limit 1) where id=r.id;
    end if;
    published := published + 1;
  end loop;
  update public.admin_import_batches set status='published',published_count=published,published_at=now(),progress='Published',updated_at=now() where id=p_batch_id;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,batch_id,details)
  values(auth.uid(),'import_published','import_batch',p_batch_id::text,p_batch_id,jsonb_build_object('official_rows',published));
  return published;
end; $$;
revoke all on function public.admin_publish_import_batch(uuid) from public;
grant execute on function public.admin_publish_import_batch(uuid) to authenticated;

create or replace function public.admin_rollback_import_batch(p_batch_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.admin_import_batches%rowtype; ri record;
begin
  if not public.has_admin_permission('rollback_imports') then raise exception 'Rollback permission required.' using errcode='42501'; end if;
  select * into b from public.admin_import_batches where id=p_batch_id for update;
  if not found or b.status <> 'published' then raise exception 'Only a published batch can be rolled back.'; end if;
  -- Remove only verified rows that still match their original published values. Anything edited since publication is preserved.
  delete from public.swimmer_results sr using public.admin_import_results ir
  where ir.batch_id=p_batch_id and ir.published_result_id=sr.id and sr.status='verified'
    and sr.time=ir.time_original and sr.event=ir.event and sr.swimmer_id=ir.linked_swimmer_id;
  -- Preserve source provenance. The rolled-back parent batch is hidden by the
  -- public RLS policy, while the original rows remain available to auditors.
  update public.admin_import_batches set status='rolled_back',rolled_back_at=now(),progress='Rolled back',updated_at=now() where id=p_batch_id;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,batch_id,details)
  values(auth.uid(),'import_rolled_back','import_batch',p_batch_id::text,p_batch_id,jsonb_build_object('preserved_independently_changed_rows',true));
end; $$;
revoke all on function public.admin_rollback_import_batch(uuid) from public;
grant execute on function public.admin_rollback_import_batch(uuid) to authenticated;

create or replace function public.admin_confirm_record_candidate(p_candidate_id uuid, p_evidence text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_admin_permission('confirm_records') then raise exception 'Record confirmation permission required.' using errcode='42501'; end if;
  if length(trim(coalesce(p_evidence,''))) < 12 then raise exception 'Attach official confirmation evidence.'; end if;
  update public.admin_record_candidates set status='confirmed',reviewed_by=auth.uid(),confirmation_evidence=trim(p_evidence),reviewer_note=p_note,reviewed_at=now()
  where id=p_candidate_id and status in ('potential_record','equalled','needs_review');
  if not found then raise exception 'Candidate is missing or already reviewed.'; end if;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'record_confirmed','record_candidate',p_candidate_id::text,jsonb_build_object('evidence',p_evidence,'note',p_note));
end; $$;
revoke all on function public.admin_confirm_record_candidate(uuid,text,text) from public;
grant execute on function public.admin_confirm_record_candidate(uuid,text,text) to authenticated;
