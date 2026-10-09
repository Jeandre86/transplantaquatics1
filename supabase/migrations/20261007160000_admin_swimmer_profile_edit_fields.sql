-- Keep the admin profile editor aligned with all fields available on a swimmer
-- profile, including the club name used by the athlete directory.
drop function if exists public.admin_update_swimmer_profile(uuid, text, text, date, text, text, text, text, text);
drop function if exists public.admin_update_swimmer_profile(uuid, text, text, date, text, text, text, text);

create function public.admin_update_swimmer_profile(
  p_swimmer_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_country text,
  p_country_code text,
  p_gender text,
  p_transplant_type text,
  p_club_name text
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_date_of_birth date;
begin
  if not public.has_admin_permission('merge_swimmers') then
    raise exception 'Swimmer management permission required.' using errcode = '42501';
  end if;

  if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null then
    raise exception 'First and last names are required.' using errcode = '22023';
  end if;

  if p_gender is not null and p_gender not in ('Men', 'Women') then
    raise exception 'Gender must be Men, Women, or blank.' using errcode = '22023';
  end if;

  update public.swimmer_profiles
  set first_name = trim(p_first_name),
      last_name = trim(p_last_name),
      date_of_birth = p_date_of_birth,
      country = nullif(trim(p_country), ''),
      country_code = nullif(upper(trim(p_country_code)), ''),
      gender = p_gender,
      transplant_type = nullif(trim(p_transplant_type), ''),
      club_name = nullif(trim(p_club_name), ''),
      updated_at = now()
  where id = p_swimmer_id
  returning date_of_birth into saved_date_of_birth;

  if not found then
    raise exception 'Swimmer profile not found.' using errcode = 'P0002';
  end if;

  return saved_date_of_birth;
end;
$$;

revoke all on function public.admin_update_swimmer_profile(uuid, text, text, date, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_swimmer_profile(uuid, text, text, date, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
