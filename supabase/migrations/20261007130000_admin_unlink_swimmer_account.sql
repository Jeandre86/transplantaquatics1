create or replace function public.admin_unlink_swimmer_account(
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
  full_name text;
  closed_claims integer := 0;
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

  update public.profile_claims
  set status = 'rejected',
      reviewer_id = auth.uid(),
      reviewer_note = concat_ws(E'\n', nullif(trim(reviewer_note), ''), 'Closed by administrator while unlinking an invalid account link.'),
      reviewed_at = now(),
      updated_at = now()
  where swimmer_profile_id = p_swimmer_id
    and status <> 'rejected';
  get diagnostics closed_claims = row_count;

  update public.swimmer_profiles
  set account_id = null,
      is_account_holder = false,
      is_claimed = false,
      updated_at = now()
  where id = p_swimmer_id;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data)
  values (
    auth.uid(), 'swimmer_account_unlinked', 'swimmer_profile', p_swimmer_id::text,
    jsonb_build_object(
      'name', full_name,
      'account_id', swimmer.account_id,
      'is_account_holder', swimmer.is_account_holder,
      'is_claimed', swimmer.is_claimed,
      'closed_claims', closed_claims
    )
  );

  return jsonb_build_object(
    'unlinked', true,
    'swimmer_name', full_name,
    'closed_claims', closed_claims
  );
end;
$$;

revoke all on function public.admin_unlink_swimmer_account(uuid, text) from public, anon;
grant execute on function public.admin_unlink_swimmer_account(uuid, text) to authenticated;

-- Rejected claim history remains attached for auditing, but no longer blocks
-- deletion after an administrator has explicitly unlinked the profile.
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

  if swimmer.account_id is not null
    or swimmer.is_claimed
    or exists (
      select 1 from public.profile_claims
      where swimmer_profile_id = p_swimmer_id
        and status in ('pending', 'approved', 'disputed', 'correction_requested', 'removal_requested')
    ) then
    raise exception 'This profile is linked to an account or open claim. Unlink or resolve it before deleting.' using errcode = '23514';
  end if;

  select array_agg(distinct source_key) into keys
  from (
    select swimmer.source_key as source_key where swimmer.source_key is not null
    union all
    select aliases.source_key
    from public.swimmer_profile_source_aliases as aliases
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

  update public.swimmer_results
  set swimmer_id = null, athlete_id = null
  where swimmer_id = p_swimmer_id or athlete_id = p_swimmer_id;
  get diagnostics result_count = row_count;

  delete from public.swimmer_profiles where id = p_swimmer_id;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data)
  values (
    auth.uid(), 'swimmer_profile_deleted', 'swimmer_profile', p_swimmer_id::text,
    jsonb_build_object(
      'name', full_name,
      'account_id', swimmer.account_id,
      'is_claimed', swimmer.is_claimed,
      'results_detached', result_count,
      'source_keys', coalesce(keys, '{}'::text[])
    )
  );

  return jsonb_build_object(
    'deleted', true,
    'swimmer_name', full_name,
    'source_keys', coalesce(keys, '{}'::text[])
  );
end;
$$;

revoke all on function public.admin_delete_swimmer_profile(uuid, text) from public, anon;
grant execute on function public.admin_delete_swimmer_profile(uuid, text) to authenticated;
notify pgrst, 'reload schema';
