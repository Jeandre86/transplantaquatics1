-- Allow a swimmer to have multiple swims in the same event and age group at a
-- meet (for example, heats and finals), so merging profiles never has to reject
-- distinct result times merely to satisfy the old category-only unique index.
alter table public.swimmer_results
  drop constraint if exists swimmer_results_meet_id_swimmer_id_event_key;
drop index if exists public.swimmer_results_category_uidx;
drop index if exists public.swimmer_results_swimmer_event_identity_uidx;
create unique index if not exists swimmer_results_meet_performance_uidx
  on public.swimmer_results(
    meet_id,
    swimmer_id,
    lower(trim(event)),
    coalesce(gender, ''),
    coalesce(age_group, ''),
    coalesce(course, ''),
    coalesce(round_name, ''),
    time
  );

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
  moved_result_count integer := 0;
  merged_age_groups text[] := '{}';
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

  select coalesce(array_agg(distinct result.age_group order by result.age_group)
    filter (where nullif(trim(result.age_group), '') is not null), '{}')
  into merged_age_groups
  from public.swimmer_results result
  where result.swimmer_id in (keep_id, remove_id);

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
    identity_review_required = identity_review_required or duplicate_profile.identity_review_required,
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
     and coalesce(primary_result.round_name, '') = coalesce(duplicate_result.round_name, '')
     and primary_result.time is not distinct from duplicate_result.time
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
    and coalesce(primary_result.round_name, '') = coalesce(duplicate_result.round_name, '')
    and primary_result.time is not distinct from duplicate_result.time;
  get diagnostics merged_result_count = row_count;

  -- Result age groups belong to each swim, so reparent every remaining result
  -- row intact; this carries the swimmer's full history across age groups.
  update public.swimmer_results set swimmer_id = keep_id, athlete_id = keep_id where swimmer_id = remove_id;
  get diagnostics moved_result_count = row_count;
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
      'merged_age_groups', merged_age_groups,
      'result_rows_moved', moved_result_count,
      'merged_duplicate_results', merged_result_count,
      'source_keys', merged_source_keys
    )
  );

  return jsonb_build_object(
    'merged', true,
    'primary_swimmer_id', keep_id,
    'duplicate_swimmer_id', remove_id,
    'account_id_retained', primary_profile.account_id,
    'merged_age_groups', merged_age_groups,
    'result_rows_moved', moved_result_count,
    'duplicate_results_removed', merged_result_count,
    'source_keys', merged_source_keys
  );
end;
$$;

revoke all on function public.admin_merge_swimmer_profiles(uuid, uuid) from public, anon;
grant execute on function public.admin_merge_swimmer_profiles(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
