-- Return ranking positions only for a profile owned by the signed-in account.
-- Positions use season-specific event, age-group, gender, and course personal
-- bests, with an additional current-club position. Season is the calendar year
-- of the meet (or the result creation date when no meet date is available).
create or replace function public.get_my_swimmer_event_rankings(p_swimmer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.swimmer_profiles sp
    where sp.id = p_swimmer_id and sp.account_id = auth.uid()
  ) then
    raise exception 'You can only view rankings for a swimmer profile linked to your account.'
      using errcode = '42501';
  end if;

  return (
    with source_rows as (
      select r.id, r.created_at, r.time, r.event, r.age_group, r.status,
        coalesce(r.athlete_id, r.swimmer_id) as public_athlete_id,
        coalesce(nullif(trim(a.first_name || ' ' || a.last_name), ''), r.swimmer_name, 'Unknown swimmer') as public_name,
        coalesce(a.country, r.country, '') as public_country,
        case lower(coalesce(a.gender, r.gender, ''))
          when 'men' then 'Men' when 'male' then 'Men' when 'boys' then 'Men'
          when 'women' then 'Women' when 'female' then 'Women' when 'girls' then 'Women'
          else null end as public_gender,
        coalesce(nullif(trim(r.course), ''), m.course) as public_course,
        coalesce(m.name, mc.name) as public_meet,
        coalesce(m.meet_date, mc.meet_date) as public_date,
        extract(year from coalesce(m.meet_date, mc.meet_date, r.created_at::date))::integer as season,
        a.club_id,
        coalesce(c.name, a.club_name, '') as public_club,
        case when r.time ~ '^([0-9]+:)?[0-9]+([.][0-9]{1,2})?$'
          then case when position(':' in r.time) > 0
            then split_part(r.time, ':', 1)::numeric * 60 + split_part(r.time, ':', 2)::numeric
            else r.time::numeric end
          else null end as seconds,
        regexp_match(lower(trim(r.event)), '^([0-9]+)[[:space:]]*m?[[:space:]]*(.*)$') as event_parts
      from public.swimmer_results r
      left join public.athletes a on a.id = coalesce(r.athlete_id, r.swimmer_id)
      left join public.clubs c on c.id = a.club_id
      left join public.submitted_meets m on m.id = r.meet_id
      left join public.meet_catalog mc on mc.id = m.catalog_meet_id
      where r.status <> 'rejected'
    ), canonical as (
      select s.*,
        case when s.event_parts is null then trim(s.event)
          else (s.event_parts[1] || 'm ') || case
            when s.event_parts[2] like '%free%' then 'Freestyle'
            when s.event_parts[2] like '%back%' then 'Backstroke'
            when s.event_parts[2] like '%breast%' then 'Breaststroke'
            when s.event_parts[2] like '%butterfly%' or s.event_parts[2] like '%fly%' then 'Butterfly'
            when s.event_parts[2] like '%individual medley%' or s.event_parts[2] like '% medley%' or s.event_parts[2] = 'im' then 'Individual Medley'
            else trim(s.event_parts[2]) end
        end as public_event,
        case when lower(coalesce(s.public_course, '')) in ('lcm', 'long course') then 'LCM'
          when lower(coalesce(s.public_course, '')) in ('scm', 'short course') then 'SCM'
          else null end as canonical_course,
        case when lower(coalesce(s.age_group, '')) like '%open relay%' then 'Open Relay'
          else replace(replace(trim(s.age_group), '–', '-'), ' years', '') end as canonical_age
      from source_rows s
      where s.seconds is not null
    ), with_strokes as (
      select c.*,
        case when c.public_event ilike '% freestyle' then 'Freestyle'
          when c.public_event ilike '% backstroke' then 'Backstroke'
          when c.public_event ilike '% breaststroke' then 'Breaststroke'
          when c.public_event ilike '% butterfly' then 'Butterfly'
          when c.public_event ilike '% individual medley' then 'Individual Medley'
          else null end as stroke
      from canonical c
      where c.public_gender is not null and c.canonical_course is not null and c.canonical_age <> ''
    ), best as (
      select s.*,
        row_number() over (
          partition by coalesce(s.public_athlete_id::text, lower(s.public_name || '|' || s.public_country)),
            lower(s.public_event), s.public_gender, s.canonical_course, lower(s.canonical_age), s.season
          order by s.seconds, (s.status = 'verified') desc, s.created_at
        ) as personal_best_number
      from with_strokes s
    ), ranked as (
      select b.*,
        row_number() over (
          partition by lower(b.public_event), b.public_gender, b.canonical_course, lower(b.canonical_age), b.season
          order by b.seconds, lower(b.public_name)
        ) as world_rank,
        case when b.club_id is not null then row_number() over (
          partition by lower(b.public_event), b.public_gender, b.canonical_course, lower(b.canonical_age), b.club_id, b.season
          order by b.seconds, lower(b.public_name)
        ) end as club_rank,
        count(*) over (
          partition by lower(b.public_event), b.public_gender, b.canonical_course, lower(b.canonical_age), b.season
        ) as world_swimmer_count,
        case when b.club_id is not null then count(*) over (
          partition by lower(b.public_event), b.public_gender, b.canonical_course, lower(b.canonical_age), b.club_id, b.season
        ) end as club_swimmer_count
      from best b
      where b.personal_best_number = 1 and b.stroke is not null
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'event', public_event,
      'stroke', stroke,
      'ageGroup', canonical_age,
      'gender', public_gender,
      'course', canonical_course,
      'season', season,
      'time', time,
      'worldRank', world_rank,
      'worldSwimmerCount', world_swimmer_count,
      'clubRank', club_rank,
      'clubSwimmerCount', club_swimmer_count,
      'clubName', nullif(public_club, ''),
      'date', coalesce(public_date::text, created_at::text),
      'meetName', public_meet
    ) order by case lower(stroke)
      when 'freestyle' then 1 when 'backstroke' then 2 when 'breaststroke' then 3
      when 'butterfly' then 4 when 'individual medley' then 5 else 6 end,
      lower(public_event), canonical_course, canonical_age, season desc), '[]'::jsonb)
    from ranked
    where public_athlete_id = p_swimmer_id
  );
end;
$$;

revoke all on function public.get_my_swimmer_event_rankings(uuid) from public, anon;
grant execute on function public.get_my_swimmer_event_rankings(uuid) to authenticated;

notify pgrst, 'reload schema';
