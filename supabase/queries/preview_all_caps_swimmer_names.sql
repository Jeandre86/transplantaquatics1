-- Preview canonical swimmer profile names that contain all-caps name parts.
-- The normalization query updates only the all-caps parts and the profile
-- trigger mirrors the corrected names into public.athletes.
select
  id,
  first_name as current_first_name,
  last_name as current_last_name,
  case
    when first_name ~ '[[:alpha:]]' and first_name = upper(first_name)
      then initcap(lower(btrim(first_name)))
    else first_name
  end as proposed_first_name,
  case
    when last_name ~ '[[:alpha:]]' and last_name = upper(last_name)
      then initcap(lower(btrim(last_name)))
    else last_name
  end as proposed_last_name
from public.swimmer_profiles
where (first_name ~ '[[:alpha:]]' and first_name = upper(first_name))
   or (last_name ~ '[[:alpha:]]' and last_name = upper(last_name))
order by last_name, first_name;
