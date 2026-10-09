-- Backfill imported swims whose profile foreign keys were missing. Only attach
-- rows where full name, country, and gender point to one public athlete.
with exact_matches as (
  select sr.id as result_id, min(sp.id::text)::uuid as swimmer_id
  from public.swimmer_results sr
  join public.swimmer_profiles sp
    on lower(regexp_replace(trim(concat_ws(' ', sp.first_name, sp.last_name)), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(sr.swimmer_name), '\s+', ' ', 'g'))
   and lower(trim(sp.country)) = lower(trim(sr.country))
   and lower(trim(sp.gender)) = lower(trim(sr.gender))
  join public.athletes a on a.id = sp.id
  where (sr.swimmer_id is null or sr.athlete_id is null)
    and sr.status <> 'rejected'
    and nullif(trim(sr.swimmer_name), '') is not null
    and nullif(trim(sr.country), '') is not null
    and nullif(trim(sr.gender), '') is not null
  group by sr.id
  having count(distinct sp.id) = 1
)
update public.swimmer_results sr
set swimmer_id = matches.swimmer_id,
    athlete_id = matches.swimmer_id
from exact_matches matches
where sr.id = matches.result_id
  and (sr.swimmer_id is null or sr.swimmer_id = matches.swimmer_id)
  and (sr.athlete_id is null or sr.athlete_id = matches.swimmer_id);

-- Keep existing WTG medal records attached to the same swimmer as their result.
update public.transplant_medals medals
set swimmer_id = results.swimmer_id
from public.swimmer_results results
where medals.result_id = results.id
  and results.swimmer_id is not null
  and medals.swimmer_id is distinct from results.swimmer_id;

-- Restore medal rows when an imported WTG result retained its placing but the
-- medal record was not created during publication.
insert into public.transplant_medals(swimmer_id, result_id, competition, year, medal)
select results.swimmer_id,
       results.id,
       meets.name,
       coalesce(meets.meet_year, extract(year from meets.meet_date)::integer),
       case results.placing when 1 then 'Gold' when 2 then 'Silver' else 'Bronze' end
from public.swimmer_results results
join public.submitted_meets meets on meets.id = results.meet_id
where results.swimmer_id is not null
  and meets.is_world_transplant_games
  and results.placing between 1 and 3
  and coalesce(meets.meet_year, extract(year from meets.meet_date)::integer) is not null
on conflict (result_id) do update
set swimmer_id = excluded.swimmer_id,
    competition = excluded.competition,
    year = excluded.year,
    medal = excluded.medal
where row(public.transplant_medals.swimmer_id, public.transplant_medals.competition, public.transplant_medals.year, public.transplant_medals.medal)
  is distinct from row(excluded.swimmer_id, excluded.competition, excluded.year, excluded.medal);

notify pgrst, 'reload schema';
