-- Keep Leendert's account-created profile as the canonical athlete and attach
-- the two imported swims to it. The guards deliberately make this a no-op if
-- either row no longer has the expected account/archive provenance.
do $$
declare
  signup_profile public.swimmer_profiles%rowtype;
  archive_profile public.swimmer_profiles%rowtype;
begin
  select * into signup_profile
  from public.swimmer_profiles
  where account_id is not null
    and not archive_imported
    and lower(first_name) = 'leendert'
    and lower(last_name) = 'wijnja'
    and lower(country) = 'south africa'
    and lower(transplant_type) = 'heart';

  if not found then
    raise notice 'Leendert repair skipped: no account-backed Leendert Wijnja signup profile matched.';
    return;
  end if;
  if (select count(*) from public.swimmer_profiles
      where account_id is not null and not archive_imported
        and lower(first_name) = 'leendert' and lower(last_name) = 'wijnja'
        and lower(country) = 'south africa' and lower(transplant_type) = 'heart') <> 1 then
    raise notice 'Leendert repair skipped: multiple account-backed profiles matched; manual identity review is needed.';
    return;
  end if;

  select * into archive_profile
  from public.swimmer_profiles
  where account_id is null
    and archive_imported
    and source_key = 'swimmer-43beb6435901241abfcde76b'
    and lower(first_name) = 'leendert jelle'
    and lower(last_name) = 'wijnja';

  if archive_profile.id is null then
    raise notice 'Leendert repair skipped: the signup and archive profile provenance did not match the expected rows.';
    return;
  end if;

  -- Never consume an archive profile that has an active identity claim.
  if exists (
    select 1 from public.profile_claims
    where swimmer_profile_id = archive_profile.id
      and status in ('pending', 'approved', 'disputed')
  ) then
    raise notice 'Leendert repair skipped: the archive profile has an active identity claim.';
    return;
  end if;

  -- The signup profile is authoritative. Fill only blanks from the archive.
  update public.swimmer_profiles as target
  set country = coalesce(nullif(trim(target.country), ''), archive_profile.country),
      country_code = coalesce(nullif(upper(trim(target.country_code)), ''), archive_profile.country_code),
      gender = coalesce(target.gender, archive_profile.gender),
      transplant_type = coalesce(nullif(trim(target.transplant_type), ''), archive_profile.transplant_type),
      date_of_birth = coalesce(target.date_of_birth, archive_profile.date_of_birth),
      club_id = coalesce(target.club_id, archive_profile.club_id),
      club_name = coalesce(nullif(trim(target.club_name), ''), archive_profile.club_name),
      updated_at = now()
  where target.id = signup_profile.id;

  -- Ensure the public athlete row exists before result athlete_id is assigned.
  insert into public.athletes (
    id, first_name, last_name, country, country_code, gender, transplant_type,
    club_id, club_name, updated_at
  )
  select
    sp.id, sp.first_name, sp.last_name, nullif(trim(sp.country), ''), sp.country_code,
    sp.gender, sp.transplant_type, sp.club_id, coalesce(c.name, sp.club_name), now()
  from public.swimmer_profiles as sp
  left join public.clubs as c on c.id = sp.club_id
  where sp.id = signup_profile.id
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    country = excluded.country,
    country_code = excluded.country_code,
    gender = excluded.gender,
    transplant_type = excluded.transplant_type,
    club_id = excluded.club_id,
    club_name = excluded.club_name,
    updated_at = now();

  update public.swimmer_results
  set swimmer_id = signup_profile.id,
      athlete_id = signup_profile.id
  where swimmer_id = archive_profile.id;

  update public.transplant_medals
  set swimmer_id = signup_profile.id
  where swimmer_id = archive_profile.id;

  update public.wtg_record_history
  set swimmer_id = signup_profile.id
  where swimmer_id = archive_profile.id;

  -- Tombstone all archive identifiers before deleting the imported duplicate,
  -- so a later bulk import cannot recreate it.
  insert into public.swimmer_profile_archive_exclusions(source_key, swimmer_name)
  select archive_profile.source_key, concat_ws(' ', archive_profile.first_name, archive_profile.last_name)
  where archive_profile.source_key is not null
  on conflict (source_key) do nothing;

  insert into public.swimmer_profile_archive_exclusions(source_key, swimmer_name)
  select aliases.source_key, concat_ws(' ', archive_profile.first_name, archive_profile.last_name)
  from public.swimmer_profile_source_aliases as aliases
  where aliases.swimmer_profile_id = archive_profile.id
  on conflict (source_key) do nothing;

  delete from public.swimmer_profiles where id = archive_profile.id;
end $$;

notify pgrst, 'reload schema';
