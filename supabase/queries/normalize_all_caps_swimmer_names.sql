-- Convert all-caps first and last name parts to title case.
-- Updating swimmer_profiles also syncs public.athletes through its trigger.
begin;

update public.swimmer_profiles
set first_name = case
      when first_name ~ '[[:alpha:]]' and first_name = upper(first_name)
        then initcap(lower(btrim(first_name)))
      else first_name
    end,
    last_name = case
      when last_name ~ '[[:alpha:]]' and last_name = upper(last_name)
        then initcap(lower(btrim(last_name)))
      else last_name
    end
where (first_name ~ '[[:alpha:]]' and first_name = upper(first_name))
   or (last_name ~ '[[:alpha:]]' and last_name = upper(last_name));

-- The UPDATE command reports how many profiles changed; this reports how
-- many all-caps name fields remain afterward.
select count(*) as profiles_with_all_caps_name_parts_remaining
from public.swimmer_profiles
where (first_name ~ '[[:alpha:]]' and first_name = upper(first_name))
   or (last_name ~ '[[:alpha:]]' and last_name = upper(last_name));

commit;
