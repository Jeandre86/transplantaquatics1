create or replace function public.get_claimable_swimmer_profiles()
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
    sp.id,
    sp.first_name,
    sp.last_name,
    nullif(trim(sp.country), ''),
    sp.country_code,
    sp.gender,
    sp.transplant_type,
    case
      when sp.date_of_birth is null then 'Unknown'
      when extract(year from age(current_date, sp.date_of_birth))::integer < 18 then 'Under 18'
      when extract(year from age(current_date, sp.date_of_birth))::integer < 30 then '18-29'
      else concat(
        (extract(year from age(current_date, sp.date_of_birth))::integer / 10) * 10,
        '-',
        (extract(year from age(current_date, sp.date_of_birth))::integer / 10) * 10 + 9
      )
    end,
    sp.club_id,
    coalesce(c.name, sp.club_name)
  from public.swimmer_profiles sp
  left join public.clubs c on c.id = sp.club_id
  where sp.account_id is null
    and not sp.is_claimed
  order by sp.last_name, sp.first_name, sp.id;
$$;

revoke all on function public.get_claimable_swimmer_profiles() from public;
grant execute on function public.get_claimable_swimmer_profiles() to authenticated;
notify pgrst, 'reload schema';
