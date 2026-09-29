-- Each swim belongs directly to both the canonical swimmer profile and its
-- public athlete directory row. Both rows share the swimmer profile UUID.
alter table public.swimmer_results
  add column if not exists athlete_id uuid references public.athletes(id) on delete set null;

-- Preserve existing profile links and create their matching athlete links.
update public.swimmer_results
set athlete_id = swimmer_id
where swimmer_id is not null
  and athlete_id is null
  and exists (select 1 from public.athletes a where a.id = swimmer_results.swimmer_id);

-- Link older imported swims only where athlete name and country identify one
-- public athlete uniquely. Ambiguous records remain unlinked for review.
with unique_matches as (
  select sr.id as result_id, min(a.id::text)::uuid as athlete_id
  from public.swimmer_results sr
  join public.athletes a
    on lower(trim(a.first_name || ' ' || a.last_name)) = lower(trim(sr.swimmer_name))
   and lower(trim(a.country)) = lower(trim(sr.country))
  where sr.swimmer_id is null and sr.athlete_id is null
  group by sr.id
  having count(*) = 1
)
update public.swimmer_results sr
set swimmer_id = matches.athlete_id,
    athlete_id = matches.athlete_id
from unique_matches matches
where sr.id = matches.result_id;

create or replace function public.sync_swimmer_result_athlete_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and ((new.swimmer_id is null) <> (new.athlete_id is null)) then
    -- Foreign-key ON DELETE SET NULL actions must clear both halves together.
    new.swimmer_id := null;
    new.athlete_id := null;
    return new;
  end if;

  if new.swimmer_id is not null and new.athlete_id is not null
    and new.swimmer_id <> new.athlete_id then
    raise exception 'A result athlete and swimmer profile must refer to the same person.';
  end if;

  if new.swimmer_id is null and new.athlete_id is not null then
    new.swimmer_id := new.athlete_id;
  elsif new.athlete_id is null and new.swimmer_id is not null then
    new.athlete_id := new.swimmer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_swimmer_result_athlete_links on public.swimmer_results;
create trigger sync_swimmer_result_athlete_links
  before insert or update of swimmer_id, athlete_id on public.swimmer_results
  for each row execute function public.sync_swimmer_result_athlete_links();

alter table public.swimmer_results
  drop constraint if exists swimmer_results_athlete_profile_match_check;
alter table public.swimmer_results
  add constraint swimmer_results_athlete_profile_match_check
  check (swimmer_id is not distinct from athlete_id);

create index if not exists swimmer_results_athlete_idx
  on public.swimmer_results (athlete_id, created_at desc);
grant select (athlete_id) on public.swimmer_results to anon, authenticated;
