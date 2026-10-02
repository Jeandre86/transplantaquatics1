-- Admins need a controlled view of swimmer profiles. Direct table reads are
-- intentionally limited by the account-owner RLS policy on swimmer_profiles.
create or replace function public.admin_list_swimmer_profiles()
returns table (
  id uuid,
  first_name text,
  last_name text,
  country text,
  country_code text,
  gender text,
  transplant_type text,
  club_name text,
  account_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('view_admin') then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  return query
    select
      sp.id,
      sp.first_name,
      sp.last_name,
      sp.country,
      sp.country_code,
      sp.gender,
      sp.transplant_type,
      sp.club_name,
      sp.account_id
    from public.swimmer_profiles sp
    order by lower(sp.last_name), lower(sp.first_name);
end;
$$;

revoke all on function public.admin_list_swimmer_profiles() from public;
grant execute on function public.admin_list_swimmer_profiles() to authenticated;
