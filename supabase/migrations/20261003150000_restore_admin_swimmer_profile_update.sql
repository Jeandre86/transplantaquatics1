-- Ensure the profile editor's RPC is present in the remote schema cache.
create or replace function public.admin_update_swimmer_profile(
  p_swimmer_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_country text,
  p_country_code text,
  p_gender text,
  p_transplant_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('merge_swimmers') then
    raise exception 'Swimmer management permission required.' using errcode='42501';
  end if;
  if nullif(trim(p_first_name),'') is null or nullif(trim(p_last_name),'') is null then
    raise exception 'First and last names are required.' using errcode='22023';
  end if;
  if p_gender is not null and p_gender not in ('Men','Women') then
    raise exception 'Gender must be Men, Women, or blank.' using errcode='22023';
  end if;

  update public.swimmer_profiles set
    first_name=trim(p_first_name),
    last_name=trim(p_last_name),
    date_of_birth=p_date_of_birth,
    country=nullif(trim(p_country),''),
    country_code=nullif(upper(trim(p_country_code)),''),
    gender=p_gender,
    transplant_type=nullif(trim(p_transplant_type),''),
    updated_at=now()
  where id=p_swimmer_id;
  if not found then raise exception 'Swimmer profile not found.' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.admin_update_swimmer_profile(uuid,text,text,date,text,text,text,text) from public;
grant execute on function public.admin_update_swimmer_profile(uuid,text,text,date,text,text,text,text) to authenticated;
notify pgrst, 'reload schema';
