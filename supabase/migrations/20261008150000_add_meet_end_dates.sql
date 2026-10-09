alter table public.submitted_meets
  add column if not exists end_date date;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'submitted_meets_end_date_after_start'
      and conrelid = 'public.submitted_meets'::regclass
  ) then
    alter table public.submitted_meets
      add constraint submitted_meets_end_date_after_start
      check (end_date is null or end_date >= meet_date);
  end if;
end $$;

-- Correct the known competition date ranges used by athlete result histories.
update public.submitted_meets as meet
set meet_date = date '2025-08-17',
    end_date = date '2025-08-24',
    meet_year = 2025,
    opening_ceremony_date = case when meet.is_world_transplant_games then date '2025-08-17' else meet.opening_ceremony_date end
where meet.name ilike '%world transplant games%'
  and (meet.meet_year = 2025 or meet.name ilike '%2025%')
  and (meet.meet_date = date '2025-08-17' or not exists (
    select 1 from public.submitted_meets other_meet
    where other_meet.id <> meet.id
      and lower(other_meet.name) = lower(meet.name)
      and other_meet.meet_date = date '2025-08-17'
      and lower(other_meet.location) = lower(meet.location)
      and other_meet.course = meet.course
      and other_meet.is_world_transplant_games = meet.is_world_transplant_games
      and coalesce(other_meet.opening_ceremony_date, date '2025-08-17') = date '2025-08-17'
  ));

update public.submitted_meets as meet
set name = 'South African Masters Swimming 41st LC Champs',
    meet_date = date '2026-03-11',
    end_date = date '2026-03-14',
    meet_year = 2026
where meet.name ilike '%south african masters championships%'
  and (meet.meet_date = date '2026-03-11' or not exists (
    select 1 from public.submitted_meets other_meet
    where other_meet.id <> meet.id
      and lower(other_meet.name) = lower(meet.name)
      and other_meet.meet_date = date '2026-03-11'
      and lower(other_meet.location) = lower(meet.location)
      and other_meet.course = meet.course
      and other_meet.is_world_transplant_games = meet.is_world_transplant_games
      and coalesce(other_meet.opening_ceremony_date, date '2026-03-11') = date '2026-03-11'
  ));
