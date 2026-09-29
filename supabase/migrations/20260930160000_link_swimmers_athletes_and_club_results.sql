-- A swimmer profile is the canonical athlete record. Create it from signup
-- metadata so swimmer accounts and parent-managed minor swimmers are linked
-- before any results are submitted.
create or replace function public.create_swimmer_athlete_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  account_role text := metadata ->> 'account_role';
  holder boolean := account_role = 'swimmer';
begin
  if coalesce(account_role, '') not in ('swimmer', 'parent_guardian')
    or nullif(trim(metadata ->> 'first_name'), '') is null
    or nullif(trim(metadata ->> 'last_name'), '') is null
    or nullif(metadata ->> 'date_of_birth', '') is null
    or coalesce(metadata ->> 'gender', '') not in ('Men', 'Women')
    or nullif(trim(metadata ->> 'transplant_type'), '') is null
    or nullif(trim(metadata ->> 'country'), '') is null then
    return new;
  end if;

  insert into public.swimmer_profiles (
    account_id, first_name, last_name, date_of_birth, gender,
    transplant_type, country, country_code, club_id, club_name, is_account_holder
  ) values (
    new.id,
    trim(metadata ->> 'first_name'),
    trim(metadata ->> 'last_name'),
    (metadata ->> 'date_of_birth')::date,
    metadata ->> 'gender',
    trim(metadata ->> 'transplant_type'),
    trim(metadata ->> 'country'),
    nullif(metadata ->> 'country_code', ''),
    nullif(metadata ->> 'club_id', '')::uuid,
    nullif(metadata ->> 'club', ''),
    holder
  )
  on conflict do nothing;

  return new;
exception
  when invalid_text_representation or datetime_field_overflow then
    -- Invalid optional signup metadata must not prevent account creation.
    return new;
end;
$$;

drop trigger if exists create_swimmer_athlete_profile on auth.users;
create trigger create_swimmer_athlete_profile
  after insert on auth.users
  for each row execute function public.create_swimmer_athlete_profile();

-- Backfill swimmer and parent-managed profiles created before the trigger.
insert into public.swimmer_profiles (
  account_id, first_name, last_name, date_of_birth, gender,
  transplant_type, country, country_code, club_id, club_name, is_account_holder
)
select
  au.id,
  trim(au.raw_user_meta_data ->> 'first_name'),
  trim(au.raw_user_meta_data ->> 'last_name'),
  (au.raw_user_meta_data ->> 'date_of_birth')::date,
  au.raw_user_meta_data ->> 'gender',
  trim(au.raw_user_meta_data ->> 'transplant_type'),
  trim(au.raw_user_meta_data ->> 'country'),
  nullif(au.raw_user_meta_data ->> 'country_code', ''),
  nullif(au.raw_user_meta_data ->> 'club_id', '')::uuid,
  nullif(au.raw_user_meta_data ->> 'club', ''),
  au.raw_user_meta_data ->> 'account_role' = 'swimmer'
from auth.users au
where au.raw_user_meta_data ->> 'account_role' in ('swimmer', 'parent_guardian')
  and nullif(trim(au.raw_user_meta_data ->> 'first_name'), '') is not null
  and nullif(trim(au.raw_user_meta_data ->> 'last_name'), '') is not null
  and nullif(au.raw_user_meta_data ->> 'date_of_birth', '') is not null
  and au.raw_user_meta_data ->> 'gender' in ('Men', 'Women')
  and nullif(trim(au.raw_user_meta_data ->> 'transplant_type'), '') is not null
  and nullif(trim(au.raw_user_meta_data ->> 'country'), '') is not null
  and not exists (
    select 1 from public.swimmer_profiles sp
    where sp.account_id = au.id
      and (
        (au.raw_user_meta_data ->> 'account_role' = 'swimmer' and sp.is_account_holder)
        or (au.raw_user_meta_data ->> 'account_role' = 'parent_guardian'
          and not sp.is_account_holder
          and lower(sp.first_name) = lower(trim(au.raw_user_meta_data ->> 'first_name'))
          and lower(sp.last_name) = lower(trim(au.raw_user_meta_data ->> 'last_name'))
          and sp.date_of_birth = (au.raw_user_meta_data ->> 'date_of_birth')::date)
      )
  );

-- Keep the club represented at the meet even after the swimmer moves clubs.
alter table public.swimmer_results
  add column if not exists represented_club_id uuid references public.clubs(id) on delete set null,
  add column if not exists represented_club_name text;

create or replace function public.set_swimmer_result_club_representation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  swimmer_club_id uuid;
  swimmer_club_name text;
  is_wtg boolean := false;
begin
  select sp.club_id, coalesce(c.name, sp.club_name)
    into swimmer_club_id, swimmer_club_name
  from public.swimmer_profiles sp
  left join public.clubs c on c.id = sp.club_id
  where sp.id = new.swimmer_id;

  select coalesce(sm.is_world_transplant_games, false)
    into is_wtg
  from public.submitted_meets sm
  where sm.id = new.meet_id;

  if is_wtg and swimmer_club_id is null then
    raise exception 'A swimmer must belong to a club to submit World Transplant Games results.';
  end if;

  if tg_op = 'UPDATE' then
    new.represented_club_id := old.represented_club_id;
    new.represented_club_name := old.represented_club_name;
  else
    new.represented_club_id := swimmer_club_id;
    new.represented_club_name := swimmer_club_name;
  end if;

  return new;
end;
$$;

drop trigger if exists set_swimmer_result_club_representation on public.swimmer_results;
create trigger set_swimmer_result_club_representation
  before insert or update on public.swimmer_results
  for each row execute function public.set_swimmer_result_club_representation();

drop policy if exists "Account owners can submit results for their swimmers" on public.swimmer_results;
create policy "Account owners can submit results for their swimmers"
  on public.swimmer_results for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and exists (select 1 from public.swimmer_profiles s where s.id = swimmer_id and s.account_id = (select auth.uid()))
    and (not exists (select 1 from public.submitted_meets m where m.id = meet_id and m.is_world_transplant_games)
      or exists (select 1 from public.swimmer_profiles s where s.id = swimmer_id and s.club_id is not null))
  );

drop policy if exists "Submitters can edit their results" on public.swimmer_results;
create policy "Submitters can edit their results"
  on public.swimmer_results for update to authenticated
  using (submitted_by = (select auth.uid()))
  with check (
    submitted_by = (select auth.uid())
    and exists (select 1 from public.swimmer_profiles s where s.id = swimmer_id and s.account_id = (select auth.uid()))
    and (not exists (select 1 from public.submitted_meets m where m.id = meet_id and m.is_world_transplant_games)
      or exists (select 1 from public.swimmer_profiles s where s.id = swimmer_id and s.club_id is not null))
  );

-- This RPC is the public athlete directory: IDs are swimmer_profiles IDs,
-- which are the same IDs stored on submitted results.
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
    sp.id,
    sp.first_name,
    sp.last_name,
    sp.country,
    sp.country_code,
    sp.gender,
    sp.transplant_type,
    case
      when extract(year from age(current_date, sp.date_of_birth))::integer < 18 then 'Under 18'
      when extract(year from age(current_date, sp.date_of_birth))::integer < 30 then '18-29'
      else concat(
        (extract(year from age(current_date, sp.date_of_birth))::integer / 10) * 10,
        '-',
        (extract(year from age(current_date, sp.date_of_birth))::integer / 10) * 10 + 9
      )
    end as age_group,
    sp.club_id,
    coalesce(c.name, sp.club_name) as club_name
  from public.swimmer_profiles sp
  left join public.clubs c on c.id = sp.club_id
  where nullif(trim(sp.country), '') is not null
  order by sp.country, sp.last_name, sp.first_name;
$$;
revoke all on function public.get_public_swimmer_directory() from public;
grant execute on function public.get_public_swimmer_directory() to anon, authenticated;

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
