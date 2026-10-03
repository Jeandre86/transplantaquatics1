-- Restore the admin delete RPC used by the Swimmers management screen.
-- Only unclaimed archive profiles can be removed; source keys are tombstoned
-- so a later historical import cannot recreate them.
create table if not exists public.swimmer_profile_archive_exclusions (
  source_key text primary key,
  swimmer_name text not null,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now()
);
alter table public.swimmer_profile_archive_exclusions enable row level security;
revoke all on public.swimmer_profile_archive_exclusions from public, anon, authenticated;

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
begin
  if not public.has_admin_permission('merge_swimmers') then
    raise exception 'Swimmer management permission required.' using errcode='42501';
  end if;

  select * into swimmer
  from public.swimmer_profiles
  where id = p_swimmer_id
  for update;
  if not found then
    raise exception 'Swimmer profile not found.' using errcode='P0002';
  end if;

  full_name := trim(swimmer.first_name || ' ' || swimmer.last_name);
  if lower(trim(coalesce(p_confirmation_name, ''))) <> lower(full_name) then
    raise exception 'Confirmation name does not match this swimmer.' using errcode='22023';
  end if;

  if swimmer.account_id is not null
    or swimmer.is_claimed
    or exists (
      select 1 from public.profile_claims
      where swimmer_profile_id = p_swimmer_id
    ) then
    raise exception 'This profile is linked to an account or claim and cannot be deleted here.' using errcode='23514';
  end if;

  select array_agg(distinct source_key) into keys
  from (
    select swimmer.source_key as source_key where swimmer.source_key is not null
    union all
    select aliases.source_key
    from public.swimmer_profile_source_aliases as aliases
    where aliases.swimmer_profile_id = p_swimmer_id
  ) as all_keys;

  if cardinality(coalesce(keys, '{}'::text[])) > 0 then
    insert into public.swimmer_profile_archive_exclusions(source_key, swimmer_name, deleted_by)
    select key, full_name, auth.uid()
    from unnest(keys) as removed(key)
    on conflict (source_key) do update
      set swimmer_name = excluded.swimmer_name,
          deleted_by = excluded.deleted_by,
          deleted_at = now();
  end if;

  -- Keep historical meet results while detaching them from the deleted profile.
  update public.swimmer_results
  set swimmer_id = null, athlete_id = null
  where swimmer_id = p_swimmer_id or athlete_id = p_swimmer_id;

  delete from public.swimmer_profiles where id = p_swimmer_id;

  return jsonb_build_object(
    'deleted', true,
    'swimmer_name', full_name,
    'source_keys', coalesce(keys, '{}'::text[])
  );
end;
$$;

revoke all on function public.admin_delete_swimmer_profile(uuid, text) from public;
grant execute on function public.admin_delete_swimmer_profile(uuid, text) to authenticated;
notify pgrst, 'reload schema';
