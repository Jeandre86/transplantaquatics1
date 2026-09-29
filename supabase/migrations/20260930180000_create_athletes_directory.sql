-- Public athlete directory projection. swimmer_profiles remains the private,
-- canonical profile (and result foreign-key target); this table provides the
-- public fields used by the Athletes, Countries, and athlete profile pages.
create table if not exists public.athletes (
  id uuid primary key references public.swimmer_profiles(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  country text not null,
  country_code text,
  gender text not null,
  transplant_type text not null,
  club_id uuid references public.clubs(id) on delete set null,
  club_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.athletes enable row level security;
drop policy if exists "Public can view athlete directory" on public.athletes;
create policy "Public can view athlete directory"
  on public.athletes for select to anon, authenticated using (true);
grant select on public.athletes to anon, authenticated;

create or replace function public.sync_athlete_directory_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_club_name text;
begin
  if tg_op = 'DELETE' then
    delete from public.athletes where id = old.id;
    return old;
  end if;

  if nullif(trim(new.country), '') is null then
    delete from public.athletes where id = new.id;
    return new;
  end if;

  select c.name into resolved_club_name
  from public.clubs c
  where c.id = new.club_id;

  insert into public.athletes (
    id, first_name, last_name, country, country_code, gender,
    transplant_type, club_id, club_name, updated_at
  ) values (
    new.id, new.first_name, new.last_name, trim(new.country), new.country_code,
    new.gender, new.transplant_type, new.club_id,
    coalesce(resolved_club_name, new.club_name), now()
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    country = excluded.country,
    country_code = excluded.country_code,
    gender = excluded.gender,
    transplant_type = excluded.transplant_type,
    club_id = excluded.club_id,
    club_name = excluded.club_name,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_athlete_directory_row on public.swimmer_profiles;
create trigger sync_athlete_directory_row
  after insert or update on public.swimmer_profiles
  for each row execute function public.sync_athlete_directory_row();

-- Include existing swimmers, including the account holder already in the DB.
insert into public.athletes (
  id, first_name, last_name, country, country_code, gender,
  transplant_type, club_id, club_name
)
select
  sp.id, sp.first_name, sp.last_name, trim(sp.country), sp.country_code,
  sp.gender, sp.transplant_type, sp.club_id,
  coalesce(c.name, sp.club_name)
from public.swimmer_profiles sp
left join public.clubs c on c.id = sp.club_id
where nullif(trim(sp.country), '') is not null
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  country = excluded.country,
  country_code = excluded.country_code,
  gender = excluded.gender,
  transplant_type = excluded.transplant_type,
  club_id = excluded.club_id,
  club_name = excluded.club_name,
  updated_at = now();

-- Keep the existing frontend RPC stable while sourcing directory data from
-- the visible athletes table. DOB remains private and is used only to derive
-- the displayed age group.
drop function if exists public.get_public_swimmer_directory();
create function public.get_public_swimmer_directory()
returns table (
  id uuid,
  first_name text,
  last_name text,
  country text,
  country_code text,
  gender text,
  transplant_type text,
  age_group text,
  club_id uuid,
  club_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.first_name,
    a.last_name,
    a.country,
    a.country_code,
    a.gender,
    a.transplant_type,
    case
      when sp.date_of_birth is null then 'Unknown'
      when date_part('year', age(current_date, sp.date_of_birth)) < 18 then 'Under 18'
      when date_part('year', age(current_date, sp.date_of_birth)) < 30 then '18-29'
      else concat(
          ((date_part('year', age(current_date, sp.date_of_birth))::int / 10) * 10),
          '-',
          ((date_part('year', age(current_date, sp.date_of_birth))::int / 10) * 10 + 9)
        )
    end as age_group,
    a.club_id,
    a.club_name
  from public.athletes a
  join public.swimmer_profiles sp on sp.id = a.id
  order by a.last_name, a.first_name;
$$;

revoke all on function public.get_public_swimmer_directory() from public;
grant execute on function public.get_public_swimmer_directory() to anon, authenticated;
