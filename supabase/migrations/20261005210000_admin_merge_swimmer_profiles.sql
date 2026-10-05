create or replace function public.admin_merge_swimmer_profiles(
  p_duplicate_swimmer_id uuid,
  p_primary_swimmer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  duplicate_profile public.swimmer_profiles%rowtype;
  primary_profile public.swimmer_profiles%rowtype;
  merged_result_count integer := 0;
  merged_source_keys text[] := '{}';
begin
  if not public.has_admin_permission('merge_swimmers') then
    raise exception 'Swimmer management permission required.' using errcode = '42501';
  end if;
  if p_duplicate_swimmer_id is null or p_primary_swimmer_id is null or p_duplicate_swimmer_id = p_primary_swimmer_id then
    raise exception 'Choose two different swimmer profiles.' using errcode = '22023';
  end if;

  select * into primary_profile from public.swimmer_profiles where id = p_primary_swimmer_id for update;
  if not found then raise exception 'The profile to keep was not found.' using errcode = 'P0002'; end if;
  select * into duplicate_profile from public.swimmer_profiles where id = p_duplicate_swimmer_id for update;
  if not found then raise exception 'The duplicate profile was not found.' using errcode = 'P0002'; end if;

  if lower(trim(primary_profile.first_name)) <> lower(trim(duplicate_profile.first_name))
    or lower(trim(primary_profile.last_name)) <> lower(trim(duplicate_profile.last_name)) then
    raise exception 'Profiles must have the same first and last name to merge.' using errcode = '23514';
  end if;
  if duplicate_profile.account_id is not null and duplicate_profile.account_id is distinct from primary_profile.account_id then
    raise exception 'These profiles are linked to different accounts. Resolve account ownership before merging.' using errcode = '23514';
  end if;
  if exists(select 1 from public.profile_claims where swimmer_profile_id in (p_duplicate_swimmer_id, p_primary_swimmer_id)) then
    raise exception 'A profile claim is attached to one of these profiles. Resolve the claim before merging.' using errcode = '23514';
  end if;

  -- Refuse to silently discard a different time for the same meet/event/age.
  if exists (
    select 1
    from public.swimmer_results duplicate_result
    join public.swimmer_results primary_result
      on primary_result.swimmer_id = p_primary_swimmer_id
     and primary_result.meet_id is not distinct from duplicate_result.meet_id
     and lower(trim(primary_result.event)) = lower(trim(duplicate_result.event))
     and coalesce(primary_result.age_group, '') = coalesce(duplicate_result.age_group, '')
     and coalesce(primary_result.gender, '') = coalesce(duplicate_result.gender, '')
     and coalesce(primary_result.course, '') = coalesce(duplicate_result.course, '')
    where duplicate_result.swimmer_id = p_duplicate_swimmer_id
      and primary_result.time is distinct from duplicate_result.time
  ) then
    raise exception 'The profiles contain conflicting times for the same event. Review those results before merging.' using errcode = '23514';
  end if;

  update public.swimmer_profiles set
    country = coalesce(nullif(trim(country), ''), duplicate_profile.country),
    country_code = coalesce(nullif(trim(country_code), ''), duplicate_profile.country_code),
    gender = coalesce(gender, duplicate_profile.gender),
    transplant_type = coalesce(nullif(trim(transplant_type), ''), duplicate_profile.transplant_type),
    date_of_birth = coalesce(date_of_birth, duplicate_profile.date_of_birth),
    club_id = coalesce(club_id, duplicate_profile.club_id),
    club_name = coalesce(nullif(trim(club_name), ''), duplicate_profile.club_name),
    is_claimed = is_claimed or duplicate_profile.is_claimed,
    updated_at = now()
  where id = p_primary_swimmer_id;

  select coalesce(array_agg(distinct source_key), '{}') into merged_source_keys
  from (
    select duplicate_profile.source_key as source_key where duplicate_profile.source_key is not null
    union all
    select aliases.source_key from public.swimmer_profile_source_aliases aliases
      where aliases.swimmer_profile_id = p_duplicate_swimmer_id
  ) keys;

  if exists (
    select 1 from public.swimmer_profile_source_aliases aliases
    where aliases.source_key = any(merged_source_keys)
      and aliases.swimmer_profile_id not in (p_duplicate_swimmer_id, p_primary_swimmer_id)
  ) then
    raise exception 'A source identifier is already attached to another profile. Resolve that identity before merging.' using errcode = '23514';
  end if;

  -- Preserve the duplicate's historical source identifiers on the canonical
  -- profile while tombstoning them so archive imports cannot recreate it.
  insert into public.swimmer_profile_source_aliases(source_key, swimmer_profile_id)
  select keys.source_key, p_primary_swimmer_id from unnest(merged_source_keys) as keys(source_key)
  on conflict (source_key) do update set swimmer_profile_id = excluded.swimmer_profile_id;

  if cardinality(merged_source_keys) > 0 then
    insert into public.swimmer_profile_archive_exclusions(source_key, swimmer_name, deleted_by)
    select keys.source_key, concat_ws(' ', duplicate_profile.first_name, duplicate_profile.last_name), auth.uid()
    from unnest(merged_source_keys) as keys(source_key)
    on conflict (source_key) do update set
      swimmer_name = excluded.swimmer_name,
      deleted_by = excluded.deleted_by,
      deleted_at = now();
  end if;

  -- Transfer WTG medals for duplicate event rows to the matching canonical row.
  insert into public.transplant_medals(swimmer_id, result_id, competition, year, medal)
  select p_primary_swimmer_id, primary_result.id, duplicate_medal.competition, duplicate_medal.year, duplicate_medal.medal
  from public.transplant_medals duplicate_medal
  join public.swimmer_results duplicate_result on duplicate_result.id = duplicate_medal.result_id
  join public.swimmer_results primary_result
    on primary_result.swimmer_id = p_primary_swimmer_id
   and primary_result.meet_id is not distinct from duplicate_result.meet_id
   and lower(trim(primary_result.event)) = lower(trim(duplicate_result.event))
   and coalesce(primary_result.age_group, '') = coalesce(duplicate_result.age_group, '')
   and coalesce(primary_result.gender, '') = coalesce(duplicate_result.gender, '')
   and coalesce(primary_result.course, '') = coalesce(duplicate_result.course, '')
  where duplicate_result.swimmer_id = p_duplicate_swimmer_id
  on conflict (result_id) do nothing;

  -- Same race in the same age group is one result. Remove only exact duplicate
  -- rows; all other age groups and events are reassigned below.
  delete from public.swimmer_results duplicate_result
  using public.swimmer_results primary_result
  where duplicate_result.swimmer_id = p_duplicate_swimmer_id
    and primary_result.swimmer_id = p_primary_swimmer_id
    and primary_result.meet_id is not distinct from duplicate_result.meet_id
    and lower(trim(primary_result.event)) = lower(trim(duplicate_result.event))
    and coalesce(primary_result.age_group, '') = coalesce(duplicate_result.age_group, '')
    and coalesce(primary_result.gender, '') = coalesce(duplicate_result.gender, '')
    and coalesce(primary_result.course, '') = coalesce(duplicate_result.course, '')
    and primary_result.time is not distinct from duplicate_result.time;
  get diagnostics merged_result_count = row_count;

  update public.swimmer_results
    set swimmer_id = p_primary_swimmer_id, athlete_id = p_primary_swimmer_id
    where swimmer_id = p_duplicate_swimmer_id;
  update public.transplant_medals set swimmer_id = p_primary_swimmer_id where swimmer_id = p_duplicate_swimmer_id;
  update public.wtg_record_history set swimmer_id = p_primary_swimmer_id where swimmer_id = p_duplicate_swimmer_id;
  update public.admin_import_results set linked_swimmer_id = p_primary_swimmer_id where linked_swimmer_id = p_duplicate_swimmer_id;
  update public.admin_import_swimmers set resolved_swimmer_id = p_primary_swimmer_id where resolved_swimmer_id = p_duplicate_swimmer_id;
  update public.imported_official_performances set swimmer_id = p_primary_swimmer_id where swimmer_id = p_duplicate_swimmer_id;

  delete from public.swimmer_profiles where id = p_duplicate_swimmer_id;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, after_data)
  values(auth.uid(), 'swimmer_profiles_merged', 'swimmer_profile', p_primary_swimmer_id::text,
    jsonb_build_object('duplicate_swimmer_id', p_duplicate_swimmer_id, 'duplicate_name', concat_ws(' ', duplicate_profile.first_name, duplicate_profile.last_name), 'duplicate_transplant_type', duplicate_profile.transplant_type, 'merged_duplicate_results', merged_result_count, 'source_keys', merged_source_keys));

  return jsonb_build_object('merged', true, 'primary_swimmer_id', p_primary_swimmer_id, 'duplicate_swimmer_id', p_duplicate_swimmer_id, 'duplicate_results_removed', merged_result_count, 'source_keys', merged_source_keys);
end;
$$;

revoke all on function public.admin_merge_swimmer_profiles(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_swimmer_profiles(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
