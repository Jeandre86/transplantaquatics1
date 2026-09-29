create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text not null,
  country_code text,
  city text not null,
  description text not null default '',
  founded_year integer,
  banner_url text,
  logo_url text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists clubs_name_country_idx on public.clubs (lower(name), lower(country));

create table if not exists public.club_coaches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'coach' check (role in ('owner', 'coach')),
  created_at timestamptz not null default now(),
  unique (club_id, account_id)
);

create table if not exists public.club_coach_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (club_id, invited_email)
);

create table if not exists public.club_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  city text not null,
  contact_email text not null,
  contact_name text not null,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'declined', 'created')),
  created_at timestamptz not null default now()
);

alter table public.clubs enable row level security;
alter table public.club_coaches enable row level security;
alter table public.club_coach_invites enable row level security;
alter table public.club_requests enable row level security;

drop policy if exists "Clubs are publicly visible" on public.clubs;
create policy "Clubs are publicly visible" on public.clubs for select to anon, authenticated using (true);
drop policy if exists "Coaches can create clubs" on public.clubs;
create policy "Coaches can create clubs" on public.clubs for insert to authenticated
  with check (created_by = (select auth.uid()) and (auth.jwt() -> 'user_metadata' ->> 'account_role') = 'coach');
drop policy if exists "Club owners can update clubs" on public.clubs;
create policy "Club owners can update clubs" on public.clubs for update to authenticated
  using (exists (select 1 from public.club_coaches c where c.club_id = clubs.id and c.account_id = (select auth.uid()) and c.role = 'owner'))
  with check (exists (select 1 from public.club_coaches c where c.club_id = clubs.id and c.account_id = (select auth.uid()) and c.role = 'owner'));

drop policy if exists "Club coaches are public" on public.club_coaches;
create policy "Club coaches are public" on public.club_coaches for select to anon, authenticated using (true);
drop policy if exists "Club creators become owners" on public.club_coaches;
create policy "Club creators become owners" on public.club_coaches for insert to authenticated
  with check (account_id = (select auth.uid()) and role = 'owner' and exists (select 1 from public.clubs c where c.id = club_id and c.created_by = (select auth.uid())));
drop policy if exists "Owners add coaches" on public.club_coaches;
create policy "Owners add coaches" on public.club_coaches for insert to authenticated
  with check (role = 'coach' and exists (select 1 from public.club_coaches owner_row where owner_row.club_id = club_id and owner_row.account_id = (select auth.uid()) and owner_row.role = 'owner'));

drop policy if exists "Owners view coach invites" on public.club_coach_invites;
create policy "Owners view coach invites" on public.club_coach_invites for select to authenticated
  using (exists (select 1 from public.club_coaches c where c.club_id = club_coach_invites.club_id and c.account_id = (select auth.uid()) and c.role = 'owner') or lower(invited_email) = lower((select auth.jwt() ->> 'email')));
drop policy if exists "Owners create coach invites" on public.club_coach_invites;
create policy "Owners create coach invites" on public.club_coach_invites for insert to authenticated
  with check (invited_by = (select auth.uid()) and exists (select 1 from public.club_coaches c where c.club_id = club_coach_invites.club_id and c.account_id = (select auth.uid()) and c.role = 'owner'));
drop policy if exists "Owners cancel coach invites" on public.club_coach_invites;
create policy "Owners cancel coach invites" on public.club_coach_invites for delete to authenticated
  using (exists (select 1 from public.club_coaches c where c.club_id = club_coach_invites.club_id and c.account_id = (select auth.uid()) and c.role = 'owner'));

drop policy if exists "Anyone can request a club listing" on public.club_requests;
create policy "Anyone can request a club listing" on public.club_requests for insert to anon, authenticated with check (true);
drop policy if exists "Requesters can read their own club requests" on public.club_requests;
create policy "Requesters can read their own club requests" on public.club_requests for select to authenticated using (requested_by = (select auth.uid()));

grant select on public.clubs, public.club_coaches to anon, authenticated;
grant insert, update on public.clubs to authenticated;
grant insert on public.club_coaches to authenticated;
grant select, insert, delete on public.club_coach_invites to authenticated;
grant insert on public.club_requests to anon, authenticated;
grant select on public.club_requests to authenticated;

alter table public.swimmer_profiles add column if not exists club_id uuid references public.clubs(id) on delete set null;
alter table public.swimmer_profiles add column if not exists club_name text;
create index if not exists swimmer_profiles_club_idx on public.swimmer_profiles (club_id);
create index if not exists swimmer_profiles_club_name_idx on public.swimmer_profiles (lower(club_name));

-- Expose only public roster fields; swimmer date of birth and account identifiers stay private.
create or replace function public.get_club_roster(p_club_id uuid default null, p_club_name text default null)
returns table (id uuid, first_name text, last_name text, country text, country_code text, gender text)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.id, sp.first_name, sp.last_name, sp.country, sp.country_code, sp.gender
  from public.swimmer_profiles sp
  where (p_club_id is not null and sp.club_id = p_club_id)
     or (p_club_name is not null and lower(sp.club_name) = lower(p_club_name))
  order by sp.last_name, sp.first_name;
$$;
revoke all on function public.get_club_roster(uuid, text) from public;
grant execute on function public.get_club_roster(uuid, text) to anon, authenticated;

-- The club and its owner membership are created in one transaction.
create or replace function public.add_club_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.club_coaches (club_id, account_id, name, role)
  values (
    new.id,
    new.created_by,
    coalesce(nullif(trim(concat_ws(' ', auth.jwt() -> 'user_metadata' ->> 'first_name', auth.jwt() -> 'user_metadata' ->> 'last_name')), ''), 'Club owner'),
    'owner'
  );
  return new;
end;
$$;

drop trigger if exists add_club_creator_as_owner on public.clubs;
create trigger add_club_creator_as_owner after insert on public.clubs
for each row execute function public.add_club_creator_as_owner();

-- Accepting an invitation validates the signed-in email and creates membership atomically.
create or replace function public.accept_club_coach_invite(invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.club_coach_invites%rowtype;
  coach_name text;
begin
  select * into invite_row from public.club_coach_invites where id = invite_id and status = 'pending';
  if not found or lower(invite_row.invited_email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'This invitation is not valid for the signed-in account.';
  end if;
  coach_name := coalesce(nullif(trim(concat_ws(' ', auth.jwt() -> 'user_metadata' ->> 'first_name', auth.jwt() -> 'user_metadata' ->> 'last_name')), ''), auth.jwt() ->> 'email');
  insert into public.club_coaches (club_id, account_id, name, role)
  values (invite_row.club_id, auth.uid(), coach_name, 'coach')
  on conflict (club_id, account_id) do nothing;
  update public.club_coach_invites set status = 'accepted', accepted_by = auth.uid() where id = invite_row.id;
  return invite_row.club_id;
end;
$$;
revoke all on function public.accept_club_coach_invite(uuid) from public;
grant execute on function public.accept_club_coach_invite(uuid) to authenticated;
