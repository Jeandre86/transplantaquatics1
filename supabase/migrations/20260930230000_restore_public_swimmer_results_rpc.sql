-- Restore the public athlete profile results endpoint independently of the
-- broader swimmer/athlete linking migration so an RPC deployment can be fixed
-- without replaying unrelated schema changes.
create or replace function public.get_public_swimmer_results(p_swimmer_id uuid)
returns table (
  id uuid,
  event text,
  time text,
  age_group text,
  points integer,
  status text,
  created_at timestamptz,
  meet_name text,
  meet_date date,
  location text,
  course text,
  is_world_transplant_games boolean,
  represented_club_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sr.id, sr.event, sr.time, sr.age_group, sr.points, sr.status, sr.created_at,
    sm.name, sm.meet_date, sm.location, sm.course, sm.is_world_transplant_games,
    sr.represented_club_name
  from public.swimmer_results sr
  left join public.submitted_meets sm on sm.id = sr.meet_id
  where sr.swimmer_id = p_swimmer_id and sr.status <> 'rejected'
  order by coalesce(sm.meet_date, sr.created_at::date) desc, sr.event;
$$;

revoke all on function public.get_public_swimmer_results(uuid) from public;
grant execute on function public.get_public_swimmer_results(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
