-- Show every athlete/profile row in the public directory, even if the public
-- projection and canonical profile have drifted or optional details are blank.
create or replace function public.get_public_swimmer_directory()
returns table (
  id uuid,
  first_name text,
  last_name text,
  country text,
  country_code text,
  gender text,
  transplant_type text,
  age_group text,
  club_id uuid,
  club_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sp.id, a.id) as id,
    coalesce(sp.first_name, a.first_name) as first_name,
    coalesce(sp.last_name, a.last_name) as last_name,
    coalesce(nullif(trim(sp.country), ''), nullif(trim(a.country), '')) as country,
    coalesce(sp.country_code, a.country_code) as country_code,
    coalesce(sp.gender, a.gender) as gender,
    coalesce(sp.transplant_type, a.transplant_type) as transplant_type,
    case
      when sp.date_of_birth is null then 'Unknown'
      when extract(year from age(current_date, sp.date_of_birth))::integer < 18 then 'Under 18'
      when extract(year from age(current_date, sp.date_of_birth))::integer < 30 then '18-29'
      else concat(
        (extract(year from age(current_date, sp.date_of_birth))::integer / 10) * 10,
        '-',
        (extract(year from age(current_date, sp.date_of_birth))::integer / 10) * 10 + 9
      )
    end as age_group,
    coalesce(sp.club_id, a.club_id) as club_id,
    coalesce(c.name, sp.club_name, a.club_name) as club_name
  from public.athletes as a
  full outer join public.swimmer_profiles as sp on sp.id = a.id
  left join public.clubs as c on c.id = coalesce(sp.club_id, a.club_id)
  order by coalesce(sp.last_name, a.last_name), coalesce(sp.first_name, a.first_name), coalesce(sp.id, a.id);
$$;
revoke all on function public.get_public_swimmer_directory() from public;
grant execute on function public.get_public_swimmer_directory() to anon, authenticated;
notify pgrst, 'reload schema';
