-- Review repeated names before merging. This query is read-only; people can
-- share names, so confirm country, date of birth, account link and results.
with per_profile as (
  select
    sp.id,
    concat_ws(' ', nullif(trim(sp.first_name), ''), nullif(trim(sp.last_name), '')) as full_name,
    lower(regexp_replace(
      trim(concat_ws(' ', nullif(trim(sp.first_name), ''), nullif(trim(sp.last_name), ''))),
      '\s+', ' ', 'g'
    )) as name_key,
    sp.country,
    sp.country_code,
    sp.date_of_birth,
    sp.gender,
    sp.transplant_type,
    sp.account_id,
    sp.is_account_holder,
    sp.source_key,
    sp.created_at,
    count(distinct sr.id) as result_count,
    array_agg(distinct nullif(trim(sr.age_group), '') order by nullif(trim(sr.age_group), ''))
      filter (where nullif(trim(sr.age_group), '') is not null) as age_groups
  from public.swimmer_profiles sp
  left join public.swimmer_results sr on sr.swimmer_id = sp.id
  group by sp.id
), duplicate_keys as (
  select name_key
  from per_profile
  where name_key <> ''
  group by name_key
  having count(*) > 1
)
select
  p.name_key as normalized_name,
  count(*) as profiles_in_group,
  jsonb_agg(
    jsonb_build_object(
      'profile_id', p.id,
      'name', p.full_name,
      'country', p.country,
      'country_code', p.country_code,
      'date_of_birth', p.date_of_birth,
      'gender', p.gender,
      'transplant_type', p.transplant_type,
      'account_id', p.account_id,
      'is_account_holder', p.is_account_holder,
      'source_key', p.source_key,
      'result_count', p.result_count,
      'age_groups', coalesce(to_jsonb(p.age_groups), '[]'::jsonb)
    ) order by p.created_at
  ) as profiles
from per_profile p
join duplicate_keys d using (name_key)
group by p.name_key
order by count(*) desc, p.name_key;
