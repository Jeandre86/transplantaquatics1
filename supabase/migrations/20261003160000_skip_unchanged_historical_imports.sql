-- Historical archive imports are repeatable without rewriting unchanged rows.
-- Claimed and non-archive profiles remain protected; deleted archive keys remain excluded.
-- Skip no-op updates for meet metadata that already matches the archive.
create or replace function public.admin_import_historical_meets(p_meets jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare m jsonb; processed integer:=0;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  for m in select value from jsonb_array_elements(coalesce(p_meets,'[]'::jsonb)) loop
    insert into public.submitted_meets(name,meet_date,location,course,is_world_transplant_games,source_meet_key,meet_year,created_by)
    values(m->>'name',nullif(m->>'meet_date','')::date,nullif(m->>'location',''),coalesce(nullif(m->>'course',''),'LCM'),coalesce((m->>'is_world_transplant_games')::boolean,false),m->>'source_meet_key',nullif(m->>'meet_year','')::integer,null)
    on conflict(source_meet_key) where source_meet_key is not null do update set
      name=excluded.name,
      location=coalesce(excluded.location,public.submitted_meets.location),
      meet_year=excluded.meet_year
    where public.submitted_meets.name is distinct from excluded.name
      or public.submitted_meets.location is distinct from coalesce(excluded.location,public.submitted_meets.location)
      or public.submitted_meets.meet_year is distinct from excluded.meet_year;
    processed:=processed+1;
  end loop;
  return processed;
end $$;
revoke all on function public.admin_import_historical_meets(jsonb) from public;
grant execute on function public.admin_import_historical_meets(jsonb) to authenticated;

create or replace function public.admin_import_historical_swimmers(p_swimmers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s jsonb; v_source_key text; source_keys text[]; existing_ids uuid[]; profile_id uuid;
  duplicate_id uuid; inserted integer:=0; merged integer:=0; alias_count integer:=0;
  skipped_protected integer:=0; skipped_excluded integer:=0; updated integer:=0; unchanged integer:=0;
  changed_current boolean:=false; created_current boolean:=false;
begin
  if not public.has_admin_permission('import_results') then
    raise exception 'Import permission required.' using errcode='42501';
  end if;
  for s in select value from jsonb_array_elements(coalesce(p_swimmers,'[]'::jsonb)) loop
    source_keys := array(select distinct key from jsonb_array_elements_text(
      coalesce(s->'source_keys',jsonb_build_array(s->>'source_key'))
    ) as keys(key) where key is not null and key<>'');
    if cardinality(source_keys)=0 then continue; end if;
    if exists(select 1 from public.swimmer_profile_archive_exclusions x where x.source_key=any(source_keys)) then
      skipped_excluded:=skipped_excluded+1; continue;
    end if;
    changed_current:=false; created_current:=false;

    -- Never claim or rewrite a manually created profile through an archive key.
    if exists (
      select 1 from public.swimmer_profiles sp
      where sp.source_key=any(source_keys) and not sp.archive_imported
    ) or exists (
      select 1 from public.swimmer_profile_source_aliases aliases
      join public.swimmer_profiles sp on sp.id=aliases.swimmer_profile_id
      where aliases.source_key=any(source_keys) and not sp.archive_imported
    ) then
      skipped_protected:=skipped_protected+1;
      continue;
    end if;

    select array_agg(distinct candidate.profile_id) into existing_ids from (
      select sp.id as profile_id from public.swimmer_profiles sp
      where sp.source_key=any(source_keys) and sp.archive_imported
      union all
      select aliases.swimmer_profile_id as profile_id
      from public.swimmer_profile_source_aliases aliases
      join public.swimmer_profiles sp on sp.id=aliases.swimmer_profile_id
      where aliases.source_key=any(source_keys) and sp.archive_imported
    ) candidate;

    -- Claimed archive profiles and pending claims keep their identity intact.
    -- Skipping this swimmer lets the remaining chunk proceed safely.
    if coalesce(cardinality(existing_ids),0)>0 and (
      exists(select 1 from public.swimmer_profiles sp where sp.id=any(existing_ids) and (sp.account_id is not null or sp.is_claimed))
      or exists(select 1 from public.profile_claims pc where pc.swimmer_profile_id=any(existing_ids))
    ) then
      skipped_protected:=skipped_protected+1;
      continue;
    end if;

    select sp.id into profile_id from public.swimmer_profiles sp
    where sp.id=any(coalesce(existing_ids,'{}'::uuid[])) and sp.archive_imported
    order by (sp.source_key=s->>'source_key') desc, sp.created_at asc limit 1;
    if profile_id is null then
      insert into public.swimmer_profiles(source_key,archive_imported,first_name,last_name,country,country_code,gender,transplant_type,date_of_birth,account_id,is_account_holder,is_claimed,identity_review_required)
      values(s->>'source_key',true,coalesce(nullif(s->>'first_name',''),'Unknown'),coalesce(nullif(s->>'last_name',''),'Swimmer'),nullif(s->>'country',''),nullif(s->>'country_code',''),nullif(s->>'gender',''),nullif(s->>'transplant_type',''),nullif(s->>'date_of_birth','')::date,null,false,false,coalesce((s->>'identity_review_required')::boolean,false))
      returning id into profile_id;
      inserted:=inserted+1; created_current:=true;
    else
      update public.swimmer_profiles sp set
        first_name=coalesce(nullif(s->>'first_name',''),sp.first_name),
        last_name=coalesce(nullif(s->>'last_name',''),sp.last_name),
        country=coalesce(nullif(s->>'country',''),sp.country),
        country_code=coalesce(sp.country_code,nullif(s->>'country_code','')),
        gender=coalesce(sp.gender,nullif(s->>'gender','')),
        transplant_type=coalesce(sp.transplant_type,nullif(s->>'transplant_type','')),
        date_of_birth=coalesce(nullif(s->>'date_of_birth','')::date,sp.date_of_birth),
        identity_review_required=coalesce((s->>'identity_review_required')::boolean,false),
        updated_at=now()
      where sp.id=profile_id and sp.archive_imported and sp.account_id is null and not sp.is_claimed
        and (sp.first_name is distinct from coalesce(nullif(s->>'first_name',''),sp.first_name)
          or sp.last_name is distinct from coalesce(nullif(s->>'last_name',''),sp.last_name)
          or sp.country is distinct from coalesce(nullif(s->>'country',''),sp.country)
          or sp.country_code is distinct from coalesce(sp.country_code,nullif(s->>'country_code',''))
          or sp.gender is distinct from coalesce(sp.gender,nullif(s->>'gender',''))
          or sp.transplant_type is distinct from coalesce(sp.transplant_type,nullif(s->>'transplant_type',''))
          or sp.date_of_birth is distinct from coalesce(nullif(s->>'date_of_birth','')::date,sp.date_of_birth)
          or sp.identity_review_required is distinct from coalesce((s->>'identity_review_required')::boolean,false));
      if found then updated:=updated+1; changed_current:=true; end if;
      for duplicate_id in
        select existing_id from unnest(coalesce(existing_ids,'{}'::uuid[])) as ids(existing_id)
        join public.swimmer_profiles sp on sp.id=existing_id
        where existing_id<>profile_id and sp.archive_imported and sp.account_id is null and not sp.is_claimed
          and not exists(select 1 from public.profile_claims pc where pc.swimmer_profile_id=sp.id)
      loop
        insert into public.transplant_medals(swimmer_id,result_id,competition,year,medal)
        select profile_id,keeper.id,medal.competition,medal.year,medal.medal
        from public.transplant_medals medal
        join public.swimmer_results duplicate_result on duplicate_result.id=medal.result_id and duplicate_result.swimmer_id=duplicate_id
        join public.swimmer_results keeper on keeper.swimmer_id=profile_id
          and keeper.meet_id is not distinct from duplicate_result.meet_id
          and lower(trim(keeper.event))=lower(trim(duplicate_result.event))
          and coalesce(keeper.age_group,'')=coalesce(duplicate_result.age_group,'')
          and coalesce(keeper.gender,'')=coalesce(duplicate_result.gender,'')
          and coalesce(keeper.course,'')=coalesce(duplicate_result.course,'')
        on conflict(result_id) do nothing;
        delete from public.transplant_medals medal
        using public.swimmer_results duplicate_result,public.swimmer_results keeper
        where medal.result_id=duplicate_result.id and duplicate_result.swimmer_id=duplicate_id
          and keeper.swimmer_id=profile_id
          and keeper.meet_id is not distinct from duplicate_result.meet_id
          and lower(trim(keeper.event))=lower(trim(duplicate_result.event))
          and coalesce(keeper.age_group,'')=coalesce(duplicate_result.age_group,'')
          and coalesce(keeper.gender,'')=coalesce(duplicate_result.gender,'')
          and coalesce(keeper.course,'')=coalesce(duplicate_result.course,'');
        delete from public.swimmer_results duplicate_result
        using public.swimmer_results keeper
        where duplicate_result.swimmer_id=duplicate_id and keeper.swimmer_id=profile_id
          and keeper.meet_id is not distinct from duplicate_result.meet_id
          and lower(trim(keeper.event))=lower(trim(duplicate_result.event))
          and coalesce(keeper.age_group,'')=coalesce(duplicate_result.age_group,'')
          and coalesce(keeper.gender,'')=coalesce(duplicate_result.gender,'')
          and coalesce(keeper.course,'')=coalesce(duplicate_result.course,'');
        update public.swimmer_results set swimmer_id=profile_id,athlete_id=profile_id where swimmer_id=duplicate_id;
        update public.transplant_medals set swimmer_id=profile_id where swimmer_id=duplicate_id;
        update public.swimmer_profile_source_aliases set swimmer_profile_id=profile_id where swimmer_profile_id=duplicate_id;
        delete from public.swimmer_profiles where id=duplicate_id and archive_imported and account_id is null and not is_claimed;
        merged:=merged+1; changed_current:=true;
      end loop;
    end if;

    foreach v_source_key in array source_keys loop
      insert into public.swimmer_profile_source_aliases(source_key,swimmer_profile_id)
      values(v_source_key,profile_id)
      on conflict(source_key) do update set swimmer_profile_id=excluded.swimmer_profile_id
      where public.swimmer_profile_source_aliases.swimmer_profile_id is distinct from excluded.swimmer_profile_id
        and exists(select 1 from public.swimmer_profiles owner_profile where owner_profile.id=excluded.swimmer_profile_id and owner_profile.archive_imported and owner_profile.account_id is null and not owner_profile.is_claimed);
      if found then changed_current:=true; alias_count:=alias_count+1; end if;
    end loop;
    if not created_current and not changed_current then unchanged:=unchanged+1; end if;
  end loop;
  return jsonb_build_object('created',inserted,'updated',updated,'unchanged',unchanged,'merged',merged,'source_keys_added',alias_count,'skipped_protected',skipped_protected,'skipped_excluded',skipped_excluded);
end $$;
revoke all on function public.admin_import_historical_swimmers(jsonb) from public;
grant execute on function public.admin_import_historical_swimmers(jsonb) to authenticated;
notify pgrst, 'reload schema';

-- Compare source-keyed results as well. Only archive-imported, unverified rows
-- are refreshed; reviewed or swimmer-submitted results are never overwritten.
create or replace function public.admin_import_historical_results(p_results jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; sp public.swimmer_profiles%rowtype; meet_row public.submitted_meets%rowtype;
  existing_result public.swimmer_results%rowtype; v_result_id uuid;
  processed integer:=0; created integer:=0; updated integer:=0; unchanged integer:=0;
  protected integer:=0; medals integer:=0; relinked integer:=0;
  safe_to_sync_medal boolean:=false;
  requested_points integer; requested_placing integer; requested_course text;
begin
  if not public.has_admin_permission('import_results') then
    raise exception 'Import permission required.' using errcode='42501';
  end if;
  for r in select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb)) loop
    safe_to_sync_medal:=false;
    select profile.* into sp from public.swimmer_profiles as profile
    where profile.archive_imported and (profile.source_key=r->>'swimmer_source_key' or exists (
      select 1 from public.swimmer_profile_source_aliases as aliases
      where aliases.source_key=r->>'swimmer_source_key' and aliases.swimmer_profile_id=profile.id
    )) limit 1;
    select * into meet_row from public.submitted_meets where source_meet_key=r->>'meet_source_key';
    if sp.id is null or meet_row.id is null then continue; end if;

    requested_points:=nullif(r->>'points','')::integer;
    requested_placing:=nullif(r->>'placing','')::integer;
    requested_course:=coalesce(nullif(r->>'course',''),'LCM');
    select sr.* into existing_result
    from public.swimmer_results as sr
    where sr.source_result_key=r->>'source_result_key'
      or (sr.meet_id=meet_row.id and sr.swimmer_id=sp.id
        and lower(trim(sr.event))=lower(trim(r->>'event'))
        and coalesce(sr.gender,'')=coalesce(r->>'gender','')
        and coalesce(sr.age_group,'')=coalesce(r->>'age_group','')
        and coalesce(sr.course,'')=requested_course)
    order by (sr.source_result_key=r->>'source_result_key') desc
    limit 1 for update;

    if existing_result.id is null then
      insert into public.swimmer_results(meet_id,swimmer_id,athlete_id,submitted_by,swimmer_name,country,country_code,gender,transplant_type,event,time,age_group,points,status,course,"placing",round_name,source_result_key,source_data,record_candidate,record_candidate_status)
      values(meet_row.id,sp.id,sp.id,null,r->>'swimmer_name',nullif(r->>'country',''),nullif(r->>'country_code',''),nullif(r->>'gender',''),nullif(r->>'transplant_type',''),r->>'event',r->>'time_original',nullif(r->>'age_group',''),requested_points,'imported_unverified',requested_course,requested_placing,r->>'round_name',r->>'source_result_key',coalesce(r->'source_data','{}'::jsonb),false,'not_candidate')
      on conflict do nothing returning id into v_result_id;
      if v_result_id is not null then
        created:=created+1;
        safe_to_sync_medal:=true;
      else
        select sr.* into existing_result from public.swimmer_results as sr
        where sr.source_result_key=r->>'source_result_key'
          or (sr.meet_id=meet_row.id and sr.swimmer_id=sp.id
            and lower(trim(sr.event))=lower(trim(r->>'event'))
            and coalesce(sr.gender,'')=coalesce(r->>'gender','')
            and coalesce(sr.age_group,'')=coalesce(r->>'age_group','')
            and coalesce(sr.course,'')=requested_course)
        order by (sr.source_result_key=r->>'source_result_key') desc limit 1;
      end if;
    end if;

    if v_result_id is null and existing_result.id is not null then
      v_result_id:=existing_result.id;
      if existing_result.status='imported_unverified'
        and (existing_result.source_result_key is null or existing_result.source_result_key=r->>'source_result_key') then
        safe_to_sync_medal:=true;
        update public.swimmer_results as sr set
          swimmer_id=sp.id, athlete_id=sp.id, swimmer_name=r->>'swimmer_name',
          country=nullif(r->>'country',''), country_code=nullif(r->>'country_code',''),
          gender=nullif(r->>'gender',''), transplant_type=nullif(r->>'transplant_type',''),
          event=r->>'event', time=r->>'time_original', age_group=nullif(r->>'age_group',''),
          points=requested_points, course=requested_course, "placing"=requested_placing,
          round_name=r->>'round_name', source_result_key=r->>'source_result_key',
          source_data=coalesce(r->'source_data','{}'::jsonb), updated_at=now()
        where sr.id=v_result_id and sr.status='imported_unverified'
          and row(sr.swimmer_id,sr.athlete_id,sr.swimmer_name,sr.country,sr.country_code,sr.gender,sr.transplant_type,sr.event,sr.time,sr.age_group,sr.points,sr.course,sr."placing",sr.round_name,sr.source_result_key,sr.source_data)
              is distinct from
              row(sp.id,sp.id,r->>'swimmer_name',nullif(r->>'country',''),nullif(r->>'country_code',''),nullif(r->>'gender',''),nullif(r->>'transplant_type',''),r->>'event',r->>'time_original',nullif(r->>'age_group',''),requested_points,requested_course,requested_placing,r->>'round_name',r->>'source_result_key',coalesce(r->'source_data','{}'::jsonb));
        if found then
          updated:=updated+1;
          if existing_result.swimmer_id is null then relinked:=relinked+1; end if;
        else
          unchanged:=unchanged+1;
        end if;
      else
        protected:=protected+1;
      end if;
    end if;

    if v_result_id is not null and safe_to_sync_medal and meet_row.is_world_transplant_games and requested_placing between 1 and 3 then
      insert into public.transplant_medals(swimmer_id,result_id,competition,year,medal)
      values(sp.id,v_result_id,meet_row.name,coalesce(meet_row.meet_year,extract(year from now())::integer),case requested_placing when 1 then 'Gold' when 2 then 'Silver' else 'Bronze' end)
      on conflict(result_id) do update set swimmer_id=excluded.swimmer_id,competition=excluded.competition,year=excluded.year,medal=excluded.medal
      where row(public.transplant_medals.swimmer_id,public.transplant_medals.competition,public.transplant_medals.year,public.transplant_medals.medal)
        is distinct from row(excluded.swimmer_id,excluded.competition,excluded.year,excluded.medal);
      if found then medals:=medals+1; end if;
    elsif v_result_id is not null and safe_to_sync_medal then
      delete from public.transplant_medals where result_id=v_result_id;
    end if;
    processed:=processed+1;
    v_result_id:=null;
    existing_result:=null;
  end loop;
  return jsonb_build_object('processed',processed,'created',created,'updated',updated,'unchanged',unchanged,'protected',protected,'medals',medals,'relinked',relinked);
end $$;
revoke all on function public.admin_import_historical_results(jsonb) from public;
grant execute on function public.admin_import_historical_results(jsonb) to authenticated;
notify pgrst, 'reload schema';
