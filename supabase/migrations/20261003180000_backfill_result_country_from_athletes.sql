-- Restore country metadata on old result rows from their linked athlete record.
-- Existing non-empty meet-time country values are preserved.
update public.swimmer_results as sr
set country = coalesce(
      nullif(trim(sr.country), ''),
      nullif(trim(a.country), ''),
      nullif(trim(sp.country), '')
    ),
    country_code = coalesce(
      nullif(upper(trim(sr.country_code)), ''),
      nullif(upper(trim(a.country_code)), ''),
      nullif(upper(trim(sp.country_code)), '')
    )
from public.swimmer_profiles as sp
left join public.athletes as a on a.id = sp.id
where sp.id = sr.swimmer_id
  and (
    (nullif(trim(sr.country), '') is null and coalesce(nullif(trim(a.country), ''), nullif(trim(sp.country), '')) is not null)
    or (nullif(trim(sr.country_code), '') is null and coalesce(nullif(trim(a.country_code), ''), nullif(trim(sp.country_code), '')) is not null)
  );
