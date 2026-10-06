-- Allow administrators to remove any swimmer profile and merge duplicates
-- without losing the account link when only one profile is claimed.

create or replace function public.admin_delete_swimmer_profile(
  p_swimmer_id uuid,
  p_confirmation_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  swimmer public.swimmer_profiles%rowtype;
  keys text[];
  full_name text;
  linked_account_id uuid;
  result_count integer := 0;
begin
  if not public.has_admin_permission('merge_swimmers') then
    raise exception 'Swimmer management permission required.' using errcode = '42501';
  end if;

  select * into swimmer
  from public.swimmer_profiles
  where id = p_swimmer_id
  for update;
  if not found then
    raise exception 'Swimmer profile not found.' using errcode = 'P0002';
  end if;

  full_name := trim(concat_ws(' ', swimmer.first_name, swimmer.last_name));
  if lower(trim(coalesce(p_confirmation_name, ''))) <> lower(full_name) then
    raise exception 'Confirmation name does not match this swimmer.' using errcode = '22023';
  end if;

  select array_agg(distinct source_key) into keys
  from (
    select swimmer.source_key as source_key where swimmer.source_key is not null
    union all
    select aliases.source_key
    from public.swimmer_profile_source_aliases aliases
    where aliases.swimmer_profile_id = p_swimmer_id
  ) all_keys;

  if cardinality(coalesce(keys, '{}'::text[])) > 0 then
    insert into public.swimmer_profile_archive_exclusions(source_key, swimmer_name, deleted_by)
    select key, full_name, auth.uid()
    from unnest(keys) as removed(key)
    on conflict (source_key) do update
      set swimmer_name = excluded.swimmer_name,
          deleted_by = excluded.deleted_by,
          deleted_at = now();
  end if;

  -- Keep meet results visible, but remove their swimmer/profile association.
  update public.swimmer_results
  set swimmer_id = null, athlete_id = null
  where swimmer_id = p_swimmer_id or athlete_id = p_swimmer_id;
  get diagnostics result_count = row_count;

  linked_account_id := swimmer.account_id;
  delete from public.swimmer_profiles where id = p_swimmer_id;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data)
  values (
    auth.uid(), 'swimmer_profile_deleted', 'swimmer_profile', p_swimmer_id::text,
    jsonb_build_object(
      'name', full_name,
      'account_id', linked_account_id,
      'is_claimed', swimmer.is_claimed,
      'results_detached', result_count,
      'source_keys', coalesce(keys, '{}'::text[])
    )
  );

  return jsonb_build_object(
    'deleted', true,
    'swimmer_name', full_name,
    'account_id', linked_account_id,
    'results_detached', result_count,
    'source_keys', coalesce(keys, '{}'::text[])
  );
end;
$$;

revoke all on function public.admin_delete_swimmer_profile(uuid, text) from public, anon;
grant execute on function public.admin_delete_swimmer_profile(uuid, text) to authenticated;

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
  keep_id uuid := p_primary_swimmer_id;
  remove_id uuid := p_duplicate_swimmer_id;
  merged_result_count integer := 0;
  merged_source_keys text[] := '{}';
  claims_snapshot jsonb := '[]'::jsonb;
begin
  if not public.has_admin_permission('merge_swimmers') then
    raise exception 'Swimmer management permission required.' using errcode = '42501';
  end if;
  if p_duplicate_swimmer_id is null or p_primary_swimmer_id is null or p_duplicate_swimmer_id = p_primary_swimmer_id then
    raise exception 'Choose two different swimmer profiles.' using errcode = '22023';
  end if;

  -- Select and lock both canonical records before deciding which account link
  -- survives. The linked profile always becomes the canonical profile.
  select * into primary_profile from public.swimmer_profiles where id = p_primary_swimmer_id for update;
  if not found then raise exception 'The profile to keep was not found.' using errcode = 'P0002'; end if;
  select * into duplicate_profile from public.swimmer_profiles where id = p_duplicate_swimmer_id for update;
  if not found then raise exception 'The duplicate profile was not found.' using errcode = 'P0002'; end if;

  if primary_profile.account_id is not null and duplicate_profile.account_id is not null
    and primary_profile.account_id is distinct from duplicate_profile.account_id then
    raise exception 'These profiles belong to two different login accounts. They cannot be combined into one swimmer profile without choosing which account should retain access.' using errcode = '23514';
  end if;

  if primary_profile.account_id is null and duplicate_profile.account_id is not null then
    keep_id := p_duplicate_swimmer_id;
    remove_id := p_primary_swimmer_id;
    primary_profile := duplicate_profile;
    select * into duplicate_profile from public.swimmer_profiles where id = remove_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(claim_row) order by claim_row.created_at), '[]'::jsonb)
  into claims_snapshot
  from public.profile_claims claim_row
  where claim_row.swimmer_profile_id in (keep_id, remove_id);

  -- Refuse to discard competing times for an identical meet/event/age entry.
  if exists (
    select 1
    from public.swimmer_results duplicate_result
    join public.swimmer_results primary_result
      on primary_result.swimmer_id = keep_id
     and primary_result.meet_id is not distinct from duplicate_result.meet_id
     and lower(trim(primary_result.event)) = lower(trim(duplicate_result.event))
     and coalesce(primary_result.age_group, '') = coalesce(duplicate_result.age_group, '')
     and coalesce(primary_result.gender, '') = coalesce(duplicate_result.gender, '')
     and coalesce(primary_result.course, '') = coalesce(duplicate_result.course, '')
    where duplicate_result.swimmer_id = remove_id
      and primary_result.time is distinct from duplicate_result.time
  ) then
    raise exception 'The profiles contain different times for the same event and age group. Review those results before merging so no time is lost.' using errcode = '23514';
  end if;

  -- Avoid the one-account-holder partial unique index while promoting the
  -- surviving profile to account-holder status.
  update public.swimmer_profiles set is_account_holder = false where id = remove_id and is_account_holder;

  update public.swimmer_profiles set
    country = coalesce(nullif(trim(country), ''), duplicate_profile.country),
    country_code = coalesce(nullif(trim(country_code), ''), duplicate_profile.country_code),
    gender = coalesce(gender, duplicate_profile.gender),
    transplant_type = coalesce(nullif(trim(transplant_type), ''), duplicate_profile.transplant_type),
    date_of_birth = coalesce(date_of_birth, duplicate_profile.date_of_birth),
    club_id = coalesce(club_id, duplicate_profile.club_id),
    club_name = coalesce(nullif(trim(club_name), ''), duplicate_profile.club_name),
    account_id = coalesce(account_id, duplicate_profile.account_id),
    is_account_holder = is_account_holder or duplicate_profile.is_account_holder,
    is_claimed = is_claimed or duplicate_profile.is_claimed,
    archive_imported = archive_imported or duplicate_profile.archive_imported,
    updated_at = now()
  where id = keep_id;

  select coalesce(array_agg(distinct source_key), '{}') into merged_source_keys
  from (
    select duplicate_profile.source_key as source_key where duplicate_profile.source_key is not null
    union all
    select aliases.source_key from public.swimmer_profile_source_aliases aliases
    where aliases.swimmer_profile_id = remove_id
  ) keys;

  if exists (
    select 1 from public.swimmer_profile_source_aliases aliases
    where aliases.source_key = any(merged_source_keys)
      and aliases.swimmer_profile_id not in (remove_id, keep_id)
  ) then
    raise exception 'A source identifier is already attached to another profile. Resolve that identity before merging.' using errcode = '23514';
  end if;

  insert into public.swimmer_profile_source_aliases(source_key, swimmer_profile_id)
  select keys.source_key, keep_id from unnest(merged_source_keys) as keys(source_key)
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

  -- Preserve every claim row on the canonical profile. The partial indexes
  -- allow only one active claim per swimmer, so retain the account-matching
  -- claim when possible and close any competing active requests with an audit
  -- note instead of deleting their history.
  with active_claims as (
    select claim_row.id,
      row_number() over (
        order by
          (claim_row.claimant_id = coalesce(primary_profile.account_id, duplicate_profile.account_id)) desc,
          (claim_row.status = 'approved') desc,
          claim_row.created_at asc
      ) as position
    from public.profile_claims claim_row
    where claim_row.swimmer_profile_id in (keep_id, remove_id)
      and claim_row.status in ('pending', 'approved', 'disputed')
  )
  update public.profile_claims claim_row
  set status = 'rejected',
      reviewer_id = auth.uid(),
      reviewer_note = concat_ws(E'\n', nullif(claim_row.reviewer_note, ''),
        'Closed during admin duplicate merge; previous status: ' || claim_row.status),
      reviewed_at = now(),
      updated_at = now()
  from active_claims
  where claim_row.id = active_claims.id and active_claims.position > 1;

  update public.profile_claims set swimmer_profile_id = keep_id where swimmer_profile_id = remove_id;

  insert into public.transplant_medals(swimmer_id, result_id, competition, year, medal)
  select keep_id, primary_result.id, duplicate_medal.competition, duplicate_medal.year, duplicate_medal.medal
  from public.transplant_medals duplicate_medal
  join public.swimmer_results duplicate_result on duplicate_result.id = duplicate_medal.result_id
  join public.swimmer_results primary_result
    on primary_result.swimmer_id = keep_id
   and primary_result.meet_id is not distinct from duplicate_result.meet_id
   and lower(trim(primary_result.event)) = lower(trim(duplicate_result.event))
   and coalesce(primary_result.age_group, '') = coalesce(duplicate_result.age_group, '')
   and coalesce(primary_result.gender, '') = coalesce(duplicate_result.gender, '')
   and coalesce(primary_result.course, '') = coalesce(duplicate_result.course, '')
  where duplicate_result.swimmer_id = remove_id
  on conflict (result_id) do nothing;

  delete from public.swimmer_results duplicate_result
  using public.swimmer_results primary_result
  where duplicate_result.swimmer_id = remove_id
    and primary_result.swimmer_id = keep_id
    and primary_result.meet_id is not distinct from duplicate_result.meet_id
    and lower(trim(primary_result.event)) = lower(trim(duplicate_result.event))
    and coalesce(primary_result.age_group, '') = coalesce(duplicate_result.age_group, '')
    and coalesce(primary_result.gender, '') = coalesce(duplicate_result.gender, '')
    and coalesce(primary_result.course, '') = coalesce(duplicate_result.course, '')
    and primary_result.time is not distinct from duplicate_result.time;
  get diagnostics merged_result_count = row_count;

  update public.swimmer_results set swimmer_id = keep_id, athlete_id = keep_id where swimmer_id = remove_id;
  update public.transplant_medals set swimmer_id = keep_id where swimmer_id = remove_id;
  update public.wtg_record_history set swimmer_id = keep_id where swimmer_id = remove_id;
  update public.admin_import_results set linked_swimmer_id = keep_id where linked_swimmer_id = remove_id;
  update public.admin_import_swimmers set resolved_swimmer_id = keep_id where resolved_swimmer_id = remove_id;
  update public.imported_official_performances set swimmer_id = keep_id where swimmer_id = remove_id;

  delete from public.swimmer_profiles where id = remove_id;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, after_data)
  values (
    auth.uid(), 'swimmer_profiles_merged', 'swimmer_profile', keep_id::text,
    jsonb_build_object(
      'duplicate_swimmer_id', remove_id,
      'duplicate_name', concat_ws(' ', duplicate_profile.first_name, duplicate_profile.last_name),
      'duplicate_transplant_type', duplicate_profile.transplant_type,
      'account_id_retained', primary_profile.account_id,
      'profiles_before_merge', jsonb_build_object(
        'primary', to_jsonb(primary_profile),
        'duplicate', to_jsonb(duplicate_profile)
      ),
      'claims_before_merge', claims_snapshot,
      'merged_duplicate_results', merged_result_count,
      'source_keys', merged_source_keys
    )
  );

  return jsonb_build_object(
    'merged', true,
    'primary_swimmer_id', keep_id,
    'duplicate_swimmer_id', remove_id,
    'account_id_retained', primary_profile.account_id,
    'duplicate_results_removed', merged_result_count,
    'source_keys', merged_source_keys
  );
end;
$$;

revoke all on function public.admin_merge_swimmer_profiles(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_swimmer_profiles(uuid, uuid) to authenticated;

-- Group merges run as one transaction. If any selected profile cannot be
-- safely combined, PostgreSQL rolls the entire group back.
create or replace function public.admin_merge_swimmer_profiles(
  p_swimmer_ids uuid[],
  p_primary_swimmer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  keep_id uuid;
  profile_count integer;
  account_count integer;
  merged_profile_id uuid;
  profile_to_merge record;
  merge_response jsonb;
  keeper_account_id uuid;
  profiles_snapshot jsonb := '[]'::jsonb;
  accounts_snapshot jsonb := '[]'::jsonb;
  unlinked_account_ids uuid[] := '{}';
  merged_profile_ids uuid[] := '{}';
  merged_source_keys text[] := '{}';
begin
  if not public.has_admin_permission('merge_swimmers') then
    raise exception 'Swimmer management permission required.' using errcode = '42501';
  end if;
  if p_swimmer_ids is null or cardinality(p_swimmer_ids) < 2
    or p_primary_swimmer_id is null
    or array_position(p_swimmer_ids, null) is not null then
    raise exception 'Select at least two swimmer profiles and choose one to keep.' using errcode = '22023';
  end if;
  if (select count(distinct selected.id) from unnest(p_swimmer_ids) as selected(id)) <> cardinality(p_swimmer_ids) then
    raise exception 'A swimmer profile was selected more than once.' using errcode = '22023';
  end if;
  if not p_primary_swimmer_id = any(p_swimmer_ids) then
    raise exception 'The profile to keep must be one of the selected profiles.' using errcode = '22023';
  end if;

  select count(*) into profile_count
  from public.swimmer_profiles profile
  where profile.id = any(p_swimmer_ids);
  if profile_count <> cardinality(p_swimmer_ids) then
    raise exception 'One or more selected swimmer profiles no longer exist. Refresh the list and try again.' using errcode = 'P0002';
  end if;

  select count(distinct profile.account_id) into account_count
  from public.swimmer_profiles profile
  where profile.id = any(p_swimmer_ids) and profile.account_id is not null;

  select coalesce(jsonb_agg(to_jsonb(profile) order by profile.created_at), '[]'::jsonb)
  into profiles_snapshot
  from public.swimmer_profiles profile
  where profile.id = any(p_swimmer_ids);
  select coalesce(jsonb_agg(jsonb_build_object('profile_id', profile.id, 'account_id', profile.account_id, 'is_account_holder', profile.is_account_holder)), '[]'::jsonb)
  into accounts_snapshot
  from public.swimmer_profiles profile
  where profile.id = any(p_swimmer_ids) and profile.account_id is not null;

  if account_count > 1 then
    select profile.account_id into keeper_account_id
    from public.swimmer_profiles profile where profile.id = p_primary_swimmer_id;
    if keeper_account_id is null then
      raise exception 'Choose one of the linked account profiles to keep its swimmer access.' using errcode = '22023';
    end if;
    keep_id := p_primary_swimmer_id;
  else
    -- Keep the account-holder profile when one is part of the selection.
    select profile.id into keep_id
    from public.swimmer_profiles profile
    where profile.id = any(p_swimmer_ids) and profile.account_id is not null
    order by profile.is_account_holder desc, (profile.id = p_primary_swimmer_id) desc, profile.created_at asc
    limit 1;
    keep_id := coalesce(keep_id, p_primary_swimmer_id);
    select profile.account_id into keeper_account_id from public.swimmer_profiles profile where profile.id = keep_id;
  end if;

  for profile_to_merge in
    select selected.id, profile.account_id
    from unnest(p_swimmer_ids) as selected(id)
    join public.swimmer_profiles profile on profile.id = selected.id
    where selected.id <> keep_id
    order by selected.id
  loop
    if profile_to_merge.account_id is not null and profile_to_merge.account_id is distinct from keeper_account_id then
      -- Keep both login accounts intact, but detach the losing login from this
      -- swimmer so the canonical profile can be owned by only one account.
      unlinked_account_ids := array_append(unlinked_account_ids, profile_to_merge.account_id);
      update public.swimmer_profiles
      set account_id = null, is_account_holder = false
      where id = profile_to_merge.id;
    end if;

    merge_response := public.admin_merge_swimmer_profiles(
      p_duplicate_swimmer_id => profile_to_merge.id,
      p_primary_swimmer_id => keep_id
    );
    merged_profile_id := (merge_response ->> 'primary_swimmer_id')::uuid;
    if merged_profile_id is distinct from keep_id then
      raise exception 'The canonical profile changed during merge. No profiles were merged.' using errcode = '23514';
    end if;
    merged_profile_ids := array_append(merged_profile_ids, profile_to_merge.id);
    select coalesce(array_agg(distinct merged_key), '{}') into merged_source_keys
    from unnest(merged_source_keys || array(
      select jsonb_array_elements_text(coalesce(merge_response -> 'source_keys', '[]'::jsonb))
    )) as merged(merged_key);
  end loop;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, after_data)
  values (
    auth.uid(), 'swimmer_profile_group_merged', 'swimmer_profile', keep_id::text,
    jsonb_build_object(
      'profile_ids', p_swimmer_ids,
      'primary_swimmer_id', keep_id,
      'profiles_before_merge', profiles_snapshot,
      'account_links_before_merge', accounts_snapshot,
      'login_account_ids_unlinked_from_swimmer', unlinked_account_ids,
      'source_keys', merged_source_keys
    )
  );

  return jsonb_build_object(
    'merged', true,
    'primary_swimmer_id', keep_id,
    'merged_swimmer_ids', merged_profile_ids,
    'merged_count', cardinality(merged_profile_ids),
    'login_account_ids_unlinked_from_swimmer', unlinked_account_ids,
    'source_keys', merged_source_keys
  );
end;
$$;

revoke all on function public.admin_merge_swimmer_profiles(uuid[], uuid) from public, anon;
grant execute on function public.admin_merge_swimmer_profiles(uuid[], uuid) to authenticated;
notify pgrst, 'reload schema';
