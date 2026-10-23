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
      and (nullif(p_age_group, '') is null or p_age_group = 'All' or
        case replace(replace(replace(lower(trim(s.age_group)), '–', '-'), '—', '-'), '−', '-')
          when '5 years and under' then '5 and under'
          when '5 years & under' then '5 and under'
          when '5 and under' then '5 and under'
          when '6-8' then '6-8'
          when '9-11' then '9-11'
          when '10-11' then '9-11'
          when '12-14' then '12-14'
          when '15-17' then '15-17'
          when '16-17' then '15-17'
          when '18-29' then '18-29'
          when '30-39' then '30-39'
          when '40-49' then '40-49'
          when '50-59' then '50-59'
          when '60-69' then '60-69'
          when '70-79' then '70-79'
          when '80+' then '80+'
          when '80 and over' then '80+'
          else null
        end = replace(replace(replace(lower(trim(p_age_group)), '–', '-'), '—', '-'), '−', '-'))
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
