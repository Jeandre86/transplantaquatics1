-- Normalize record-holder countries for country-level record counts and link
-- holders to registered athlete profiles when country and name match uniquely.
alter table public.world_records
  add column if not exists country_code text,
  add column if not exists athlete_id uuid references public.athletes(id) on delete set null;

update public.world_records
set country_code = case upper(country)
  when 'AUSTRALIA' then 'AU'
  when 'BRAZIL' then 'BR'
  when 'CANADA' then 'CA'
  when 'FINLAND' then 'FI'
  when 'FRANCE' then 'FR'
  when 'GB&NI' then 'GB'
  when 'GREAT BRITAIN' then 'GB'
  when 'NORTHERN IRELAND' then 'GB'
  when 'UK' then 'GB'
  when 'GERMANY' then 'DE'
  when 'GREECE' then 'GR'
  when 'HUNGARY' then 'HU'
  when 'IRELAND' then 'IE'
  when 'ISRAEL' then 'IL'
  when 'ITALY' then 'IT'
  when 'JAPAN' then 'JP'
  when 'MEXICO' then 'MX'
  when 'NETHERLANDS' then 'NL'
  when 'PORTUGAL' then 'PT'
  when 'RSA' then 'ZA'
  when 'SOUTH AFRICA' then 'ZA'
  when 'SPAIN' then 'ES'
  when 'USA' then 'US'
  else country_code
end
where country_code is null;

create index if not exists world_records_country_code_idx on public.world_records(country_code);
create index if not exists world_records_athlete_id_idx on public.world_records(athlete_id);

-- Link existing records only when exactly one athlete matches both identity
-- fields. Relay team records intentionally remain unlinked.
with candidates as (
  select
    wr.id as record_id,
    min(a.id::text)::uuid as athlete_id
  from public.world_records wr
  join public.athletes a
    on upper(a.country_code) = wr.country_code
   and regexp_replace(lower(trim(a.first_name || ' ' || a.last_name)), '[^a-z0-9]+', '', 'g')
       = regexp_replace(lower(trim(wr.athlete_name)), '[^a-z0-9]+', '', 'g')
  where wr.athlete_id is null
  group by wr.id
  having count(distinct a.id) = 1
)
update public.world_records wr
set athlete_id = candidates.athlete_id
from candidates
where wr.id = candidates.record_id;

create or replace function public.link_world_record_holder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.athlete_id is null and new.country_code is not null then
    select a.id into new.athlete_id
    from public.athletes a
    where upper(a.country_code) = new.country_code
      and regexp_replace(lower(trim(a.first_name || ' ' || a.last_name)), '[^a-z0-9]+', '', 'g')
          = regexp_replace(lower(trim(new.athlete_name)), '[^a-z0-9]+', '', 'g')
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists link_world_record_holder on public.world_records;
create trigger link_world_record_holder
  before insert or update of athlete_name, country_code on public.world_records
  for each row execute function public.link_world_record_holder();

create or replace function public.link_unmatched_records_for_athlete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.country_code is not null then
    update public.world_records wr
    set athlete_id = new.id
    where wr.athlete_id is null
      and wr.country_code = upper(new.country_code)
      and regexp_replace(lower(trim(wr.athlete_name)), '[^a-z0-9]+', '', 'g')
          = regexp_replace(lower(trim(new.first_name || ' ' || new.last_name)), '[^a-z0-9]+', '', 'g');
  end if;
  return new;
end;
$$;

drop trigger if exists link_unmatched_records_for_athlete on public.athletes;
create trigger link_unmatched_records_for_athlete
  after insert or update of first_name, last_name, country_code on public.athletes
  for each row execute function public.link_unmatched_records_for_athlete();
