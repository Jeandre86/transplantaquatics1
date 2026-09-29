-- Expose only the fields used by the public athlete and country directories.
-- Date of birth, account IDs, and other private profile fields remain private.
create or replace function public.get_public_swimmer_directory()
returns table (
  id uuid,
  first_name text,
  last_name text,
  country text,
  country_code text,
  gender text,
  transplant_type text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Managed swimmer rows represent swimmers registered by an adult, including minors.
  select
    sp.id,
    sp.first_name,
    sp.last_name,
    sp.country,
    sp.country_code,
    sp.gender,
    sp.transplant_type
  from public.swimmer_profiles sp
  where nullif(trim(sp.country), '') is not null

  union all

  -- Adult swimmers are themselves the account holder; use only the explicit
  -- swimmer account role and omit accounts that already have a profile row.
  select
    md5('swimmer-directory:' || au.id::text)::uuid,
    au.raw_user_meta_data ->> 'first_name',
    au.raw_user_meta_data ->> 'last_name',
    au.raw_user_meta_data ->> 'country',
    au.raw_user_meta_data ->> 'country_code',
    au.raw_user_meta_data ->> 'gender',
    au.raw_user_meta_data ->> 'transplant_type'
  from auth.users au
  where au.email_confirmed_at is not null
    and au.raw_user_meta_data ->> 'account_role' = 'swimmer'
    and nullif(trim(au.raw_user_meta_data ->> 'country'), '') is not null
    and not exists (
      select 1
      from public.swimmer_profiles account_profile
      where account_profile.account_id = au.id
        and account_profile.is_account_holder
    )

  order by 4, 3, 2;
$$;

revoke all on function public.get_public_swimmer_directory() from public;
grant execute on function public.get_public_swimmer_directory() to anon, authenticated;
