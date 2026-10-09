-- Keep public reads narrow: table pages return only the requested rows, while
-- ranking and home summaries are calculated in PostgreSQL.

create extension if not exists pg_trgm with schema extensions;

create index if not exists swimmer_results_athlete_status_idx
  on public.swimmer_results (athlete_id, status, created_at desc, id desc);
create index if not exists swimmer_results_swimmer_status_idx
  on public.swimmer_results (swimmer_id, status, created_at desc, id desc);
create index if not exists swimmer_results_status_date_idx
  on public.swimmer_results (status, created_at desc, id desc);
create index if not exists swimmer_results_country_idx on public.swimmer_results (country);
create index if not exists swimmer_results_event_age_gender_idx
  on public.swimmer_results (event, age_group, gender, created_at desc);
create index if not exists athletes_directory_name_idx on public.athletes (last_name, first_name, id);
create index if not exists athletes_country_idx on public.athletes (country);
create index if not exists athletes_gender_transplant_idx on public.athletes (gender, transplant_type);
create index if not exists submitted_meets_date_idx on public.submitted_meets (meet_date desc, id);
create index if not exists official_relay_date_idx on public.imported_official_performances (published_at desc, id)
  where is_relay;
create index if not exists athletes_name_search_idx
  on public.athletes using gin (lower(first_name || ' ' || last_name) extensions.gin_trgm_ops);
create index if not exists athletes_country_search_idx
  on public.athletes using gin (lower(country) extensions.gin_trgm_ops);
create index if not exists swimmer_results_name_search_idx
  on public.swimmer_results using gin (lower(swimmer_name) extensions.gin_trgm_ops);

create or replace function public.get_public_swimmer_profile(p_swimmer_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select to_jsonb(profile_row)
  from public.get_public_swimmer_directory() as profile_row
  where profile_row.id = p_swimmer_id
  limit 1;
$$;
revoke all on function public.get_public_swimmer_profile(uuid) from public;
grant execute on function public.get_public_swimmer_profile(uuid) to anon, authenticated;

create or replace function public.get_public_swimmer_directory_page(
  p_search text default null, p_country text default null, p_gender text default null,
  p_age_group text default null, p_transplant text default null,
  p_page integer default 1, p_page_size integer default 25, p_sort_by text default 'name'
)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with directory as materialized (
    select d.* from public.get_public_swimmer_directory() d
  ), record_counts as materialized (
    select wr.swimmer_id, count(*)::integer as record_count
    from public.wtg_record_history wr
    where wr.superseded_at is null
    group by wr.swimmer_id
  ), filtered as materialized (
    select d.*, coalesce(rc.record_count, 0) as record_count
    from directory d
    left join record_counts rc on rc.swimmer_id = d.id
    where (nullif(trim(p_search), '') is null or (
      lower(d.first_name || ' ' || d.last_name) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(d.country,'')) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(d.club_name,'')) like '%' || lower(trim(p_search)) || '%'))
      and (nullif(p_country, '') is null or p_country = 'All' or d.country = p_country
        or upper(coalesce(d.country_code,'')) = upper(p_country)
        or lower(regexp_replace(d.country, '[^a-z0-9]+', '-', 'g')) = lower(p_country))
      and (nullif(p_gender, '') is null or p_gender = 'All' or d.gender = p_gender)
      and (nullif(p_age_group, '') is null or p_age_group = 'All'
        or replace(replace(lower(d.age_group), '–', '-'), ' years', '') = replace(replace(lower(p_age_group), '–', '-'), ' years', ''))
      and (nullif(p_transplant, '') is null or p_transplant = 'All' or
        (lower(p_transplant) = 'donor' and lower(d.transplant_type) in ('donor','living donor')) or
        lower(regexp_replace(d.transplant_type, '[[:space:]]+transplant$', '', 'i')) = lower(p_transplant))
  ), page_base as materialized (
    select f.* from filtered f
    order by case when p_sort_by = 'featured' then f.record_count end desc,
      lower(f.last_name), lower(f.first_name), f.id
    limit greatest(1, least(coalesce(p_page_size, 25), 100))
    offset greatest(0, coalesce(p_page, 1) - 1) * greatest(1, least(coalesce(p_page_size, 25), 100))
  ), page_rows as (
    select to_jsonb(p) || jsonb_build_object(
      'best_swim_time', best.time, 'best_swim_event', best.event
    ) as row
    from page_base p
    left join lateral (
      select r.time, r.event
      from public.swimmer_results r
      where (r.athlete_id = p.id or (r.athlete_id is null and r.swimmer_id = p.id))
        and r.status <> 'rejected'
        and r.time ~ '^([0-9]+:)?[0-9]+([.][0-9]{1,2})?$'
        and r.event not ilike '%relay%'
      order by case when position(':' in r.time) > 0
        then split_part(r.time, ':', 1)::numeric * 60 + split_part(r.time, ':', 2)::numeric
        else r.time::numeric end,
        (r.status = 'verified') desc
      limit 1
    ) best on true
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(row) from page_rows), '[]'::jsonb),
    'totalCount', (select count(*) from filtered),
    'countryCount', (select count(distinct country) from directory where nullif(trim(country), '') is not null),
    'countryOptions', coalesce((select jsonb_agg(value order by value) from (select distinct country as value from directory where nullif(trim(country), '') is not null) countries), '[]'::jsonb),
    'resultCount', (select count(*) from public.swimmer_results where status <> 'rejected')
  );
$$;
revoke all on function public.get_public_swimmer_directory_page(text,text,text,text,text,integer,integer,text) from public;
grant execute on function public.get_public_swimmer_directory_page(text,text,text,text,text,integer,integer,text) to anon, authenticated;

create or replace function public.get_public_countries_directory()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with swimmer_counts as (
    select lower(trim(country)) as country_key, min(trim(country)) as country,
      min(nullif(trim(country_code), '')) as country_code, count(*)::integer as swimmer_count
    from public.get_public_swimmer_directory()
    where nullif(trim(country), '') is not null
    group by lower(trim(country))
  ), record_counts as (
    select lower(trim(country)) as country_key, min(trim(country)) as country,
      min(nullif(trim(country_code), '')) as country_code, count(*)::integer as record_count
    from public.world_records
    where nullif(trim(country), '') is not null
    group by lower(trim(country))
  ), combined as (
    select coalesce(s.country_key, r.country_key) as country_key,
      coalesce(s.country, r.country) as country,
      coalesce(s.country_code, r.country_code) as country_code,
      coalesce(s.swimmer_count, 0) as swimmer_count,
      coalesce(r.record_count, 0) as record_count
    from swimmer_counts s full outer join record_counts r using (country_key)
  )
  select coalesce(jsonb_agg(jsonb_build_object('country', country, 'country_code', country_code,
    'swimmer_count', swimmer_count, 'record_count', record_count) order by country), '[]'::jsonb)
  from combined;
$$;
revoke all on function public.get_public_countries_directory() from public;
grant execute on function public.get_public_countries_directory() to anon, authenticated;

create or replace function public.get_public_swimmer_profile_results(p_swimmer_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with target as (
    select profile_row.*,
      (select count(*) from public.get_public_swimmer_directory() same_profile
       where lower(trim(same_profile.first_name || ' ' || same_profile.last_name)) = lower(trim(profile_row.first_name || ' ' || profile_row.last_name))
         and lower(trim(coalesce(same_profile.country, ''))) = lower(trim(coalesce(profile_row.country, '')))
         and lower(trim(coalesce(same_profile.gender, ''))) = lower(trim(coalesce(profile_row.gender, '')))) as identity_count
    from public.get_public_swimmer_directory() profile_row
    where profile_row.id = p_swimmer_id
  ), rows as (
    select r.id, r.created_at, m.meet_date,
      (to_jsonb(r) - 'submitted_by' - 'updated_at')
      || jsonb_build_object(
        'athlete_id', coalesce(r.athlete_id, r.swimmer_id),
        'is_relay', false,
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
  )
  select coalesce(jsonb_agg(result order by meet_date desc nulls last, created_at desc, id), '[]'::jsonb)
  from rows;
$$;
revoke all on function public.get_public_swimmer_profile_results(uuid) from public;
grant execute on function public.get_public_swimmer_profile_results(uuid) to anon, authenticated;

create or replace function public.get_public_results_filter_options()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with choices as (
    select country, event, age_group from public.swimmer_results where status <> 'rejected'
    union all
    select coalesce(p.country, ''), p.event, coalesce(p.age_group, '—')
    from public.imported_official_performances p where p.is_relay
  )
  select jsonb_build_object(
    'countries', coalesce((select jsonb_agg(value order by value) from (select distinct country as value from choices where nullif(trim(country), '') is not null) values), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(value order by value) from (select distinct event as value from choices where nullif(trim(event), '') is not null) values), '[]'::jsonb),
    'ageGroups', coalesce((select jsonb_agg(value order by value) from (select distinct age_group as value from choices where nullif(trim(age_group), '') is not null) values), '[]'::jsonb)
  );
$$;
revoke all on function public.get_public_results_filter_options() from public;
grant execute on function public.get_public_results_filter_options() to anon, authenticated;

create or replace function public.get_public_results_page(
  p_search text default null,
  p_country text default null,
  p_event text default null,
  p_age_group text default null,
  p_gender text default null,
  p_swim_type text default null,
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with source_rows as (
    select
      (to_jsonb(r) - 'submitted_by' - 'updated_at') || jsonb_build_object(
        'athlete_id', coalesce(r.athlete_id, r.swimmer_id), 'is_relay', false,
        'submitted_meets', case when m.id is null then null else jsonb_build_object(
          'name', m.name, 'meet_date', m.meet_date, 'end_date', m.end_date,
          'meet_year', m.meet_year, 'location', m.location, 'course', m.course,
          'is_world_transplant_games', m.is_world_transplant_games
        ) end
      ) as result,
      coalesce(m.meet_date, r.created_at::date) as sort_date,
      coalesce(r.country, '') as country, r.event, r.age_group, r.gender,
      false as is_relay
    from public.swimmer_results r
    left join public.submitted_meets m on m.id = r.meet_id
    where r.status <> 'rejected'
    union all
    select jsonb_build_object(
        'id', 'official-relay-' || p.id::text, 'athlete_id', p.swimmer_id, 'swimmer_id', p.swimmer_id,
        'event', p.event, 'time', coalesce(p.time_original, p.race_status), 'age_group', coalesce(p.age_group, '—'),
        'points', null, 'placing', null, 'record_candidate', false, 'record_candidate_status', 'not_candidate',
        'status', 'verified', 'created_at', coalesce(mc.meet_date::timestamptz, p.published_at),
        'meet_id', null, 'swimmer_name', coalesce(p.relay_team, p.swimmer_name), 'country', coalesce(p.country, ''),
        'country_code', null, 'gender', coalesce(p.gender, ''), 'transplant_type', '', 'course', p.course,
        'represented_club_id', null, 'represented_club_name', null, 'is_relay', true,
        'relay_team', p.relay_team, 'relay_members', p.relay_members,
        'submitted_meets', jsonb_build_object('name', mc.name, 'meet_date', mc.meet_date, 'end_date', mc.end_date,
          'meet_year', mc.year, 'location', concat_ws(', ', mc.host_city, mc.host_country), 'course', p.course,
          'is_world_transplant_games', mc.category = 'World Transplant Games')
      ) as result,
      coalesce(mc.meet_date, p.published_at::date) as sort_date,
      coalesce(p.country, '') as country, p.event, coalesce(p.age_group, '—') as age_group,
      coalesce(p.gender, '') as gender, true as is_relay
    from public.imported_official_performances p
    join public.meet_catalog mc on mc.id = p.meet_catalog_id
    where p.is_relay
  ), filtered as (
    select * from source_rows s
    where (nullif(trim(p_search), '') is null
      or s.result->>'swimmer_name' ilike '%' || trim(p_search) || '%'
      or s.result->'submitted_meets'->>'name' ilike '%' || trim(p_search) || '%'
      or s.result->>'relay_team' ilike '%' || trim(p_search) || '%'
      or s.result->>'relay_members' ilike '%' || trim(p_search) || '%')
      and (nullif(p_country, '') is null or p_country = 'All' or s.country = p_country)
      and (nullif(p_event, '') is null or p_event = 'All' or s.event = p_event)
      and (nullif(p_age_group, '') is null or p_age_group = 'All' or s.age_group = p_age_group)
      and (nullif(p_gender, '') is null or p_gender = 'All' or s.gender = p_gender)
      and (nullif(p_swim_type, '') is null or p_swim_type = 'All'
        or (p_swim_type = 'Relay' and s.is_relay) or (p_swim_type = 'Individual' and not s.is_relay))
  ), page_rows as (
    select result, sort_date from filtered order by sort_date desc, (result->>'id') desc
    limit greatest(1, least(coalesce(p_page_size, 10), 100))
    offset greatest(0, coalesce(p_page, 1) - 1) * greatest(1, least(coalesce(p_page_size, 10), 100))
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(result order by sort_date desc, (result->>'id') desc) from page_rows), '[]'::jsonb),
    'totalCount', (select count(*) from filtered)
  );
$$;
revoke all on function public.get_public_results_page(text,text,text,text,text,text,integer,integer) from public;
grant execute on function public.get_public_results_page(text,text,text,text,text,text,integer,integer) to anon, authenticated;

create or replace function public.get_public_personal_best_rankings()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with source_rows as (
    select r.*, coalesce(r.athlete_id, r.swimmer_id) as public_athlete_id,
      coalesce(nullif(trim(a.first_name || ' ' || a.last_name), ''), r.swimmer_name, 'Unknown swimmer') as public_name,
      coalesce(a.country, r.country, '') as public_country,
      coalesce(a.country_code, r.country_code, '') as public_country_code,
      case lower(coalesce(a.gender, r.gender, '')) when 'men' then 'Men' when 'male' then 'Men' when 'boys' then 'Men'
        when 'women' then 'Women' when 'female' then 'Women' when 'girls' then 'Women' else null end as public_gender,
      coalesce(nullif(trim(a.transplant_type), ''), r.transplant_type) as public_transplant_type,
      coalesce(nullif(trim(r.course), ''), m.course) as public_course,
      m.meet_date as public_date, m.name as public_meet,
      case when r.time ~ '^([0-9]+:)?[0-9]+([.][0-9]{1,2})?$'
        then case when position(':' in r.time) > 0
          then split_part(r.time, ':', 1)::numeric * 60 + split_part(r.time, ':', 2)::numeric
          else r.time::numeric end
        else null end as seconds,
      regexp_match(lower(trim(r.event)), '^([0-9]+)[[:space:]]*m?[[:space:]]*(.*)$') as event_parts
    from public.swimmer_results r
    left join public.athletes a on a.id = coalesce(r.athlete_id, r.swimmer_id)
    left join public.submitted_meets m on m.id = r.meet_id
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
      case when lower(coalesce(s.public_course, '')) in ('lcm','long course') then 'LCM'
        when lower(coalesce(s.public_course, '')) in ('scm','short course') then 'SCM' else null end as canonical_course,
      case when lower(coalesce(s.age_group, '')) like '%open relay%' then 'Open Relay'
        else replace(replace(trim(s.age_group), '–', '-'), ' years', '') end as canonical_age
    from source_rows s
    where s.seconds is not null
  ), best as (
    select c.*,
      row_number() over (
        partition by coalesce(c.public_athlete_id::text, lower(c.public_name || '|' || c.public_country)),
          lower(c.public_event), c.public_gender, c.canonical_course, lower(c.canonical_age)
        order by c.seconds, (c.status = 'verified') desc, c.created_at
      ) as personal_best_number
    from canonical c
    where c.public_gender is not null and c.canonical_course is not null and c.canonical_age <> ''
  ), personal_bests as (
    select b.*,
      row_number() over (partition by lower(b.public_event), b.public_gender, b.canonical_course, lower(b.canonical_age)
        order by b.seconds, lower(b.public_name)) as rank_number
    from best b where b.personal_best_number = 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'athleteId', coalesce(public_athlete_id::text, 'result:' || lower(public_name || '|' || public_country_code)),
    'athleteName', public_name, 'country', public_country, 'countryCode', public_country_code,
    'ageGroup', canonical_age, 'gender', public_gender, 'event', public_event,
    'course', canonical_course, 'time', time, 'transplantType', public_transplant_type,
    'date', coalesce(public_date::text, created_at::text), 'meetName', public_meet,
    'points', points, 'rank', rank_number
  ) order by rank_number, lower(public_name)), '[]'::jsonb)
  from personal_bests;
$$;
revoke all on function public.get_public_personal_best_rankings() from public;
grant execute on function public.get_public_personal_best_rankings() to anon, authenticated;

create or replace function public.get_public_ranking_preview(
  p_gender text default 'All', p_event text default 'All', p_course text default 'All', p_limit integer default 5,
  p_age_group text default 'All'
)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with rankings as (
    select value from jsonb_array_elements(public.get_public_personal_best_rankings()) value
  ), filtered as (
    select value,
      coalesce(nullif(value->>'time',''), '0') as time_text,
      coalesce(value->>'athleteId','') as athlete_id
    from rankings
    where (p_gender = 'All' or value->>'gender' = p_gender)
      and (p_event = 'All' or value->>'event' = p_event)
      and (p_course = 'All' or value->>'course' = p_course)
      and (p_age_group = 'All' or replace(value->>'ageGroup', '–', '-') = replace(p_age_group, '–', '-'))
      and coalesce(value->>'event','') not ilike '25m %'
  ), ranked as (
    select value, athlete_id,
      row_number() over (partition by athlete_id order by
        case when position(':' in time_text) > 0 then split_part(time_text,':',1)::numeric*60 + split_part(time_text,':',2)::numeric else time_text::numeric end,
        value->>'athleteName') as per_athlete
    from filtered
  ), top_rows as (
    select value from ranked where per_athlete = 1
    order by case when position(':' in value->>'time') > 0 then split_part(value->>'time',':',1)::numeric*60 + split_part(value->>'time',':',2)::numeric else (value->>'time')::numeric end,
      value->>'athleteName'
    limit greatest(1, least(coalesce(p_limit,5), 20))
  )
  select coalesce(jsonb_agg(value), '[]'::jsonb) from top_rows;
$$;
revoke all on function public.get_public_ranking_preview(text,text,text,integer,text) from public;
grant execute on function public.get_public_ranking_preview(text,text,text,integer,text) to anon, authenticated;

create or replace function public.get_public_fastest_transplant_swims()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with source_rows as (
    select r.*, coalesce(r.athlete_id, r.swimmer_id) as public_athlete_id,
      coalesce(nullif(trim(a.first_name || ' ' || a.last_name), ''), r.swimmer_name, 'Unknown swimmer') as public_name,
      coalesce(a.country, r.country, '') as public_country, coalesce(a.country_code, r.country_code, '') as public_country_code,
      case lower(coalesce(a.gender, r.gender, '')) when 'men' then 'Men' when 'male' then 'Men' when 'boys' then 'Men'
        when 'women' then 'Women' when 'female' then 'Women' when 'girls' then 'Women' else '' end as public_gender,
      coalesce(nullif(trim(a.transplant_type), ''), r.transplant_type) as public_transplant_type,
      coalesce(nullif(trim(r.course), ''), m.course) as public_course,
      case when r.time ~ '^([0-9]+:)?[0-9]+([.][0-9]{1,2})?$'
        then case when position(':' in r.time) > 0 then split_part(r.time, ':', 1)::numeric * 60 + split_part(r.time, ':', 2)::numeric else r.time::numeric end
        else null end as seconds,
      regexp_match(lower(trim(r.event)), '^([0-9]+)[[:space:]]*m?[[:space:]]*(.*)$') as event_parts
    from public.swimmer_results r
    left join public.athletes a on a.id = coalesce(r.athlete_id, r.swimmer_id)
    left join public.submitted_meets m on m.id = r.meet_id
    where r.status <> 'rejected'
  ), canonical as (
    select s.*,
      case when event_parts is null then trim(event) else event_parts[1] || 'm ' || case
        when event_parts[2] like '%free%' then 'Freestyle' when event_parts[2] like '%back%' then 'Backstroke'
        when event_parts[2] like '%breast%' then 'Breaststroke' when event_parts[2] like '%butterfly%' or event_parts[2] like '%fly%' then 'Butterfly'
        when event_parts[2] like '%medley%' or event_parts[2] = 'im' then 'Individual Medley' else trim(event_parts[2]) end
      end as public_event,
      case when lower(coalesce(public_course,'')) in ('lcm','long course') then 'LCM' when lower(coalesce(public_course,'')) in ('scm','short course') then 'SCM' end as canonical_course,
      case when lower(coalesce(public_transplant_type,'')) in ('kidney','liver','heart','lung','pancreas','donor','living donor') then
        case when lower(public_transplant_type) = 'living donor' then 'Donor' else initcap(lower(public_transplant_type)) end
        when lower(coalesce(public_transplant_type,'')) in ('bone marrow','marrow') then 'Bone Marrow' end as canonical_transplant
    from source_rows s where seconds is not null
  ), fastest as (
    select c.*, row_number() over (partition by canonical_transplant, lower(public_event), public_gender, canonical_course
      order by (status = 'verified') desc, seconds, lower(public_name)) as category_rank
    from canonical c where canonical_transplant is not null and canonical_course is not null
      and public_gender <> ''
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'athleteId', coalesce(public_athlete_id::text, 'result:' || lower(public_name || '|' || public_country_code)),
    'athleteName', public_name, 'country', public_country, 'countryCode', public_country_code,
    'transplantType', canonical_transplant, 'gender', public_gender, 'ageGroup', age_group,
    'event', public_event, 'time', time, 'course', canonical_course, 'status', status
  ) order by canonical_transplant, seconds, public_event), '[]'::jsonb)
  from fastest where category_rank = 1;
$$;
revoke all on function public.get_public_fastest_transplant_swims() from public;
grant execute on function public.get_public_fastest_transplant_swims() to anon, authenticated;

notify pgrst, 'reload schema';
