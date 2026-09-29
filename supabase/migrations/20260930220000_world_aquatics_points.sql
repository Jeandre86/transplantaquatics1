-- World Aquatics 2026 individual-event base times. A base-time swim scores
-- 1,000 points; points use the official cubic formula and truncate to integer.
create or replace function public.world_aquatics_points_2026(
  p_event text,
  p_gender text,
  p_course text,
  p_age_group text,
  p_time text
)
returns integer
language sql
stable
set search_path = ''
as $$
  with base_times(course_key, gender_key, event_key, base_seconds) as (
    values
      ('LCM','men','50m Freestyle',20.91), ('LCM','men','100m Freestyle',46.40), ('LCM','men','200m Freestyle',102.00),
      ('LCM','men','400m Freestyle',219.96), ('LCM','men','800m Freestyle',452.12), ('LCM','men','1500m Freestyle',870.67),
      ('LCM','men','50m Backstroke',23.55), ('LCM','men','100m Backstroke',51.60), ('LCM','men','200m Backstroke',111.92),
      ('LCM','men','50m Breaststroke',25.95), ('LCM','men','100m Breaststroke',56.88), ('LCM','men','200m Breaststroke',125.48),
      ('LCM','men','50m Butterfly',22.27), ('LCM','men','100m Butterfly',49.45), ('LCM','men','200m Butterfly',110.34),
      ('LCM','men','200m Medley',112.69), ('LCM','men','400m Medley',242.50),
      ('LCM','women','50m Freestyle',23.61), ('LCM','women','100m Freestyle',51.71), ('LCM','women','200m Freestyle',112.23),
      ('LCM','women','400m Freestyle',234.18), ('LCM','women','800m Freestyle',484.12), ('LCM','women','1500m Freestyle',920.48),
      ('LCM','women','50m Backstroke',26.86), ('LCM','women','100m Backstroke',57.13), ('LCM','women','200m Backstroke',123.14),
      ('LCM','women','50m Breaststroke',29.16), ('LCM','women','100m Breaststroke',64.13), ('LCM','women','200m Breaststroke',137.55),
      ('LCM','women','50m Butterfly',24.43), ('LCM','women','100m Butterfly',54.60), ('LCM','women','200m Butterfly',121.81),
      ('LCM','women','200m Medley',125.70), ('LCM','women','400m Medley',263.65),
      ('SCM','men','50m Freestyle',19.90), ('SCM','men','100m Freestyle',44.84), ('SCM','men','200m Freestyle',98.61),
      ('SCM','men','400m Freestyle',212.25), ('SCM','men','800m Freestyle',440.46), ('SCM','men','1500m Freestyle',846.88),
      ('SCM','men','50m Backstroke',22.11), ('SCM','men','100m Backstroke',48.16), ('SCM','men','200m Backstroke',105.12),
      ('SCM','men','50m Breaststroke',24.95), ('SCM','men','100m Breaststroke',55.28), ('SCM','men','200m Breaststroke',119.52),
      ('SCM','men','50m Butterfly',21.32), ('SCM','men','100m Butterfly',47.68), ('SCM','men','200m Butterfly',106.85),
      ('SCM','men','200m Medley',108.88), ('SCM','men','400m Medley',234.81),
      ('SCM','women','50m Freestyle',22.83), ('SCM','women','100m Freestyle',49.93), ('SCM','women','200m Freestyle',109.36),
      ('SCM','women','400m Freestyle',230.25), ('SCM','women','800m Freestyle',474.00), ('SCM','women','1500m Freestyle',908.24),
      ('SCM','women','50m Backstroke',25.23), ('SCM','women','100m Backstroke',54.02), ('SCM','women','200m Backstroke',117.33),
      ('SCM','women','50m Breaststroke',28.37), ('SCM','women','100m Breaststroke',62.36), ('SCM','women','200m Breaststroke',132.50),
      ('SCM','women','50m Butterfly',23.72), ('SCM','women','100m Butterfly',52.71), ('SCM','women','200m Butterfly',119.32),
      ('SCM','women','200m Medley',121.63), ('SCM','women','400m Medley',255.48)
  ), parsed_time as (
    select case
      when p_time ~ '^[0-9]+(:[0-5][0-9])?([.][0-9]{1,2})?$' then
        case when position(':' in p_time) > 0
          then split_part(p_time, ':', 1)::numeric * 60 + split_part(p_time, ':', 2)::numeric
          else p_time::numeric
        end
      else null
    end as seconds
  ), normalized_event as (
    select lower(regexp_replace(trim(coalesce(p_event, '')), 'individual medley', 'medley', 'i')) as event_key
  ), official_base as (
    select bt.base_seconds
    from base_times bt, normalized_event ne
    where bt.course_key = upper(trim(p_course))
      and bt.gender_key = lower(trim(p_gender))
      and lower(bt.event_key) = ne.event_key
  ), wtg_fallback as (
    select min(
      case
        when wr.time ~ '^[0-9]+(:[0-5][0-9])?([.][0-9]{1,2})?$' then
          case when position(':' in wr.time) > 0
            then split_part(wr.time, ':', 1)::numeric * 60 + split_part(wr.time, ':', 2)::numeric
            else wr.time::numeric
          end
        else null
      end
    ) as base_seconds
    from public.world_records wr, normalized_event ne
    where (upper(wr.course) = upper(trim(p_course)) or ne.event_key like '25m %')
      and lower(regexp_replace(trim(wr.event), 'individual medley', 'medley', 'i')) = ne.event_key
      and regexp_replace(lower(trim(coalesce(wr.age_group, ''))), '[[:space:]]*(years?|yrs?)$', '', 'i')
        = regexp_replace(lower(trim(coalesce(p_age_group, ''))), '[[:space:]]*(years?|yrs?)$', '', 'i')
      and ((lower(trim(p_gender)) = 'men' and lower(trim(wr.gender)) in ('men', 'boys'))
        or (lower(trim(p_gender)) = 'women' and lower(trim(wr.gender)) in ('women', 'girls')))
  ), resolved_base as (
    select base_seconds from official_base
    union all
    select fallback.base_seconds from wtg_fallback fallback
    where fallback.base_seconds is not null and not exists (select 1 from official_base)
  )
  select floor(1000 * power(rb.base_seconds / pt.seconds, 3))::integer
  from resolved_base rb
  cross join parsed_time pt
  where pt.seconds > 0;
$$;

create or replace function public.set_swimmer_result_points_2026()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meet_course text;
begin
  select sm.course into meet_course
  from public.submitted_meets sm
  where sm.id = new.meet_id;

  new.points := public.world_aquatics_points_2026(new.event, new.gender, meet_course, new.age_group, new.time);
  return new;
end;
$$;

drop trigger if exists set_swimmer_result_points_2026 on public.swimmer_results;
create trigger set_swimmer_result_points_2026
  before insert or update of event, gender, time, meet_id on public.swimmer_results
  for each row execute function public.set_swimmer_result_points_2026();

update public.swimmer_results sr
set points = public.world_aquatics_points_2026(sr.event, sr.gender, sm.course, sr.age_group, sr.time)
from public.submitted_meets sm
where sm.id = sr.meet_id;

update public.swimmer_results sr
set points = null
where sr.meet_id is null;
