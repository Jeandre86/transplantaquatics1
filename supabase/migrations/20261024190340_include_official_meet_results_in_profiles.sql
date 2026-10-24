-- Include linked, published official meet performances in swimmer profile
-- results and rankings. These records can exist only in the import tables.

create or replace function public.get_public_swimmer_profile_results(p_swimmer_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with target as (
    select profile_row.*,
      (select count(*) from public.get_public_swimmer_directory() same_profile
       where lower(trim(same_profile.first_name || ' ' || same_profile.last_name)) =  lower(trim(profile_row.first_name || ' ' || profile_row.last_name))
         and lower(trim(coalesce(same_profile.country, ''))) = lower(trim(coalesce(profile_row.country, '')))
         and lower(trim(coalesce(same_profile.gender, ''))) = lower(trim(coalesce(profile_row.gender, '')))) as identity_count
    from public.get_public_swimmer_directory() profile_row
    where profile_row.id = p_swimmer_id
  ), rows as (
    select r.id::text as row_id, r.created_at, m.meet_date,
      (to_jsonb(r) - 'submitted_by' - 'updated_at')
      || jsonb_build_object(
        'athlete_id', coalesce(r.athlete_id, r.swimmer_id), 'is_relay', false,
        'submitted_meets', case when m.id is null then null else jsonb_build_object(
          'name', m.name, 'meet_date', m.meet_date, 'end_date', m.end_date,
          'meet_year', m.meet_year, 'location', m.location, 'course', m.course,
          'is_world_transplant_games', m.is_world_transplant_games
        ) end
      ) as result
    from public.swimmer_results r
    left join public.submitted_meets m on m.id = r.meet_id
    cross join target t
    where r.status <> 'rejected'
      and (
        coalesce(r.athlete_id, r.swimmer_id) = p_swimmer_id
        or (r.athlete_id is null and r.swimmer_id is null and t.identity_count = 1
          and lower(trim(r.swimmer_name)) = lower(trim(t.first_name || ' ' || t.last_name))
          and lower(trim(coalesce(r.country, ''))) = lower(trim(coalesce(t.country, '')))
          and lower(trim(coalesce(r.gender, ''))) = lower(trim(coalesce(t.gender, ''))))
      )
    union all
    select p.id::text, coalesce(mc.meet_date::timestamptz, p.published_at), mc.meet_date,
      jsonb_build_object(
        'id', p.id::text, 'swimmer_id', coalesce(p.swimmer_id, resolved.id), 'athlete_id', coalesce(p.swimmer_id, resolved.id),
        'event', p.event, 'time', coalesce(p.time_original, p.race_status), 'age_group', coalesce(p.age_group, '—'),
        'points', null, 'placing', p.placing, 'record_candidate', false,
        'record_candidate_status', 'not_candidate', 'status', 'verified',
        'created_at', coalesce(mc.meet_date::timestamptz, p.published_at),
        'meet_id', null, 'swimmer_name', coalesce(nullif(trim(p.swimmer_name), ''), trim(sp.first_name || ' ' || sp.last_name)),
        'country', coalesce(sp.country, p.country, ''), 'country_code', sp.country_code,
        'gender', coalesce(sp.gender, p.gender, ''), 'transplant_type', sp.transplant_type,
        'course', p.course, 'round_name', p.round_name,
        'represented_club_id', sp.club_id, 'represented_club_name', coalesce(c.name, sp.club_name),
        'is_relay', false,
        'submitted_meets', jsonb_build_object(
          'name', mc.name, 'meet_date', mc.meet_date, 'end_date', mc.end_date,
          'meet_year', mc.year, 'location', concat_ws(', ', mc.host_city, mc.host_country),
          'course', p.course, 'is_world_transplant_games', mc.category = 'World Transplant Games'
        )
      )
    from public.imported_official_performances p
    join public.admin_import_batches b on b.id = p.batch_id and b.status = 'published'
    join public.meet_catalog mc on mc.id = p.meet_catalog_id
    cross join target t
    left join lateral (
      select candidate.id from (
        select d.id, count(*) over () as candidate_count
        from public.get_public_swimmer_directory() d
        where lower(trim(d.first_name || ' ' || d.last_name)) = lower(trim(p.swimmer_name))
          and (nullif(trim(p.country), '') is null or lower(trim(coalesce(d.country, ''))) = lower(trim(p.country)))
          and (nullif(trim(p.gender), '') is null or lower(trim(coalesce(d.gender, ''))) = lower(trim(p.gender)))
      ) candidate where candidate.candidate_count = 1 limit 1
    ) resolved on true
    join public.swimmer_profiles sp on sp.id = coalesce(p.swimmer_id, resolved.id)
    left join public.clubs c on c.id = sp.club_id
    where (p.swimmer_id = p_swimmer_id or (p.swimmer_id is null and t.identity_count = 1
        and resolved.id = p_swimmer_id)) and not p.is_relay
      and not exists (
        select 1 from public.swimmer_results existing
        left join public.submitted_meets submitted on submitted.id = existing.meet_id
        where coalesce(existing.athlete_id, existing.swimmer_id) = coalesce(p.swimmer_id, resolved.id)
          and existing.event = p.event and existing.time = p.time_original
          and coalesce(existing.age_group, '') = coalesce(p.age_group, '')
          and coalesce(existing.course, submitted.course, '') = coalesce(p.course, '')
          and coalesce(existing.round_name, '') = coalesce(p.round_name, '')
          and submitted.catalog_meet_id = p.meet_catalog_id
      )
  )
  select coalesce(jsonb_agg(result order by meet_date desc nulls last, created_at desc, row_id), '[]'::jsonb)
  from rows;
$$;
revoke all on function public.get_public_swimmer_profile_results(uuid) from public;
grant execute on function public.get_public_swimmer_profile_results(uuid) to anon, authenticated;

create or replace function public.get_my_swimmer_event_rankings(p_swimmer_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
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
      select r.id::text as id, r.created_at, r.time, r.event, r.age_group, r.status,
        coalesce(r.athlete_id, r.swimmer_id) as public_athlete_id,
        coalesce(nullif(trim(a.first_name || ' ' || a.last_name), ''), r.swimmer_name, 'Unknown swimmer') as public_name,
        coalesce(a.country, r.country, '') as public_country,
        case lower(coalesce(a.gender, r.gender, ''))
          when 'men' then 'Men' when 'male' then 'Men' when 'boys' then 'Men'
          when 'women' then 'Women' when 'female' then 'Women' when 'girls' then 'Women' else null end as public_gender,
        coalesce(nullif(trim(r.course), ''), m.course) as public_course,
        coalesce(m.name, mc.name) as public_meet,
        coalesce(m.meet_date, mc.meet_date) as public_date,
        coalesce(m.meet_year, mc.year, extract(year from m.meet_date)::integer,
          extract(year from mc.meet_date)::integer, extract(year from r.created_at)::integer) as season,
        a.club_id, coalesce(c.name, a.club_name, '') as public_club,
        case when r.time ~ '^([0-9]+:)?[0-9]+([.][0-9]{1,2})?$' then
          case when position(':' in r.time) > 0
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
      union all
      select p.id::text, coalesce(mc.meet_date::timestamptz, p.published_at), p.time_original,
        p.event, coalesce(p.age_group, ''), 'verified', coalesce(p.swimmer_id, resolved.id),
        coalesce(nullif(trim(a.first_name || ' ' || a.last_name), ''), p.swimmer_name, 'Unknown swimmer'),
        coalesce(a.country, p.country, ''),
        case lower(coalesce(a.gender, p.gender, ''))
          when 'men' then 'Men' when 'male' then 'Men' when 'boys' then 'Men'
          when 'women' then 'Women' when 'female' then 'Women' when 'girls' then 'Women' else null end,
        p.course, mc.name, mc.meet_date,
        coalesce(mc.year, extract(year from mc.meet_date)::integer, extract(year from p.published_at)::integer),
        a.club_id, coalesce(c.name, a.club_name, ''),
        case when p.time_original ~ '^([0-9]+:)?[0-9]+([.][0-9]{1,2})?$' then
          case when position(':' in p.time_original) > 0
            then split_part(p.time_original, ':', 1)::numeric * 60 + split_part(p.time_original, ':', 2)::numeric
            else p.time_original::numeric end
          else null end,
        regexp_match(lower(trim(p.event)), '^([0-9]+)[[:space:]]*m?[[:space:]]*(.*)$')
      from public.imported_official_performances p
      join public.admin_import_batches b on b.id = p.batch_id and b.status = 'published'
      join public.meet_catalog mc on mc.id = p.meet_catalog_id
      left join lateral (
        select candidate.id from (
          select d.id, count(*) over () as candidate_count
          from public.get_public_swimmer_directory() d
          where lower(trim(d.first_name || ' ' || d.last_name)) = lower(trim(p.swimmer_name))
            and (nullif(trim(p.country), '') is null or lower(trim(coalesce(d.country, ''))) = lower(trim(p.country)))
            and (nullif(trim(p.gender), '') is null or lower(trim(coalesce(d.gender, ''))) = lower(trim(p.gender)))
        ) candidate where candidate.candidate_count = 1 limit 1
      ) resolved on true
      left join public.athletes a on a.id = coalesce(p.swimmer_id, resolved.id)
      left join public.clubs c on c.id = a.club_id
      where not p.is_relay and p.race_status = 'OK' and p.time_original is not null
    ), canonical as (
      select s.*,
        case when s.event_parts is null then trim(s.event)
          else (s.event_parts[1] || 'm ') || case
            when s.event_parts[2] like '%free%' then 'Freestyle'
            when s.event_parts[2] like '%back%' then 'Backstroke'
            when s.event_parts[2] like '%breast%' then 'Breaststroke'
            when s.event_parts[2] like '%butterfly%' or s.event_parts[2] like '%fly%' then 'Butterfly'
            when s.event_parts[2] like '%individual medley%' or s.event_parts[2] like '% medley%' or s.event_parts[2] = 'im' then 'Individual Medley'
            else trim(s.event_parts[2]) end end as public_event,
        case when lower(coalesce(s.public_course, '')) in ('lcm', 'long course') then 'LCM'
          when lower(coalesce(s.public_course, '')) in ('scm', 'short course') then 'SCM' else null end as canonical_course,
        case when lower(coalesce(s.age_group, '')) like '%open relay%' then 'Open Relay'
          else replace(replace(trim(s.age_group), '–', '-'), ' years', '') end as canonical_age
      from source_rows s where s.seconds is not null
    ), with_strokes as (
      select c.*,
        case when c.public_event ilike '% freestyle' then 'Freestyle'
          when c.public_event ilike '% backstroke' then 'Backstroke'
          when c.public_event ilike '% breaststroke' then 'Breaststroke'
          when c.public_event ilike '% butterfly' then 'Butterfly'
          when c.public_event ilike '% individual medley' then 'Individual Medley' else null end as stroke
      from canonical c
      where c.public_gender is not null and c.canonical_course is not null and c.canonical_age <> ''
    ), best as (
      select s.*, row_number() over (
        partition by coalesce(s.public_athlete_id::text, lower(s.public_name || '|' || s.public_country)),
          lower(s.public_event), s.public_gender, s.canonical_course, lower(s.canonical_age), s.season
        order by s.seconds, (s.status = 'verified') desc, s.created_at
      ) as personal_best_number
      from with_strokes s
    ), ranked as (
      select b.*,
        row_number() over (partition by lower(b.public_event), b.public_gender, b.canonical_course,
          lower(b.canonical_age), b.season order by b.seconds, lower(b.public_name)) as world_rank,
        case when b.club_id is not null then row_number() over (partition by lower(b.public_event),
          b.public_gender, b.canonical_course, lower(b.canonical_age), b.club_id, b.season
          order by b.seconds, lower(b.public_name)) end as club_rank,
        count(*) over (partition by lower(b.public_event), b.public_gender, b.canonical_course,
          lower(b.canonical_age), b.season) as world_swimmer_count,
        case when b.club_id is not null then count(*) over (partition by lower(b.public_event), b.public_gender,
          b.canonical_course, lower(b.canonical_age), b.club_id, b.season) end as club_swimmer_count
      from best b where b.personal_best_number = 1 and b.stroke is not null
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'event', public_event, 'stroke', stroke, 'ageGroup', canonical_age, 'gender', public_gender,
      'course', canonical_course, 'season', season, 'time', time, 'worldRank', world_rank,
      'worldSwimmerCount', world_swimmer_count, 'clubRank', club_rank,
      'clubSwimmerCount', club_swimmer_count, 'clubName', nullif(public_club, ''),
      'date', coalesce(public_date::text, created_at::text), 'meetName', public_meet
    ) order by case lower(stroke) when 'freestyle' then 1 when 'backstroke' then 2
      when 'breaststroke' then 3 when 'butterfly' then 4 when 'individual medley' then 5 else 6 end,
      lower(public_event), canonical_course, canonical_age, season desc), '[]'::jsonb)
    from ranked where public_athlete_id = p_swimmer_id
  );
end;
$$;
revoke all on function public.get_my_swimmer_event_rankings(uuid) from public, anon;
grant execute on function public.get_my_swimmer_event_rankings(uuid) to authenticated;

notify pgrst, 'reload schema';
