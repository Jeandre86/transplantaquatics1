-- Ensure the admin directory returns the saved date of birth after edits.
drop function if exists public.admin_list_swimmer_profiles();

create function public.admin_list_swimmer_profiles()
returns table(
  id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  country text,
  country_code text,
  gender text,
  transplant_type text,
  club_name text,
  account_id uuid,
  is_claimed boolean,
  source_key text,
  source_keys text[],
  identity_review_required boolean
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
    sp.date_of_birth,
    sp.country,
    sp.country_code,
    sp.gender,
    sp.transplant_type,
    sp.club_name,
    sp.account_id,
    sp.is_claimed,
    sp.source_key,
    array_remove(array_agg(distinct aliases.source_key), null),
    sp.identity_review_required
  from public.swimmer_profiles sp
  left join public.swimmer_profile_source_aliases aliases
    on aliases.swimmer_profile_id = sp.id
  where public.has_admin_permission('view_admin')
  group by sp.id
  order by lower(sp.last_name), lower(sp.first_name);
$$;

revoke all on function public.admin_list_swimmer_profiles() from public, anon;
grant execute on function public.admin_list_swimmer_profiles() to authenticated;

notify pgrst, 'reload schema';
