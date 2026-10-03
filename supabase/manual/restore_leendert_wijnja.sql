-- Restore only the deleted historical archive key for Leendert Jelle Wijnja.
-- Run this in the Supabase SQL Editor, then re-import data/swimming/swimmers.json
-- from Admin → Historical archive so the profile and its two results are recreated.
delete from public.swimmer_profile_archive_exclusions
where source_key = 'swimmer-43beb6435901241abfcde76b'
  and lower(trim(swimmer_name)) = lower('Leendert Jelle Wijnja')
returning source_key, swimmer_name;

-- After re-import, this should return the restored profile:
-- select id, first_name, last_name, source_key
-- from public.swimmer_profiles
-- where source_key = 'swimmer-43beb6435901241abfcde76b';
