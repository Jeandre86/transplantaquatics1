create table if not exists public.swimmer_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  gender text not null check (gender in ('Men', 'Women')),
  transplant_type text not null,
  country text not null,
  country_code text,
  is_account_holder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_account_holder or account_id is not null)
);

create unique index if not exists swimmer_profiles_one_account_holder_idx
  on public.swimmer_profiles (account_id) where is_account_holder;
create index if not exists swimmer_profiles_account_idx on public.swimmer_profiles (account_id, created_at);

alter table public.swimmer_profiles enable row level security;
drop policy if exists "Account owners manage their swimmer profiles" on public.swimmer_profiles;
create policy "Account owners manage their swimmer profiles"
  on public.swimmer_profiles for all to authenticated
  using ((select auth.uid()) = account_id)
  with check ((select auth.uid()) = account_id);
grant select, insert, update, delete on public.swimmer_profiles to authenticated;

create table if not exists public.submitted_meets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  name text not null,
  meet_date date not null,
  opening_ceremony_date date,
  location text not null,
  course text not null check (course in ('LCM', 'SCM')),
  is_world_transplant_games boolean not null default false,
  created_at timestamptz not null default now(),
  check (not is_world_transplant_games or opening_ceremony_date is not null)
);

create unique index if not exists submitted_meets_identity_idx
  on public.submitted_meets (lower(name), meet_date, lower(location), course, is_world_transplant_games, coalesce(opening_ceremony_date, meet_date));
create index if not exists submitted_meets_date_idx on public.submitted_meets (meet_date desc);

alter table public.submitted_meets enable row level security;
drop policy if exists "Submitted meets are public" on public.submitted_meets;
create policy "Submitted meets are public"
  on public.submitted_meets for select to anon, authenticated using (true);
drop policy if exists "Signed-in users can add submitted meets" on public.submitted_meets;
create policy "Signed-in users can add submitted meets"
  on public.submitted_meets for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists "Meet submitters can update their meets" on public.submitted_meets;
create policy "Meet submitters can update their meets"
  on public.submitted_meets for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
drop policy if exists "Meet submitters can delete their meets" on public.submitted_meets;
create policy "Meet submitters can delete their meets"
  on public.submitted_meets for delete to authenticated using (created_by = (select auth.uid()));
grant select on public.submitted_meets to anon, authenticated;
grant insert, update, delete on public.submitted_meets to authenticated;

create table if not exists public.swimmer_results (
  id uuid primary key default gen_random_uuid(),
  meet_id uuid references public.submitted_meets(id) on delete set null,
  swimmer_id uuid references public.swimmer_profiles(id) on delete set null,
  submitted_by uuid default auth.uid() references auth.users(id) on delete set null,
  swimmer_name text not null,
  country text not null,
  country_code text,
  gender text not null,
  transplant_type text not null,
  event text not null,
  time text not null check (time ~ '^[0-9]+(:[0-5][0-9])?([.][0-9]{1,2})?$'),
  age_group text not null,
  points integer check (points is null or points >= 0),
  record_candidate boolean not null default false,
  record_candidate_status text not null default 'not_candidate' check (record_candidate_status in ('not_candidate', 'pending_verification', 'verified', 'rejected')),
  status text not null default 'swimmer_submitted' check (status in ('swimmer_submitted', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meet_id, swimmer_id, event)
);

create index if not exists swimmer_results_meet_idx on public.swimmer_results (meet_id, created_at desc);
create index if not exists swimmer_results_swimmer_idx on public.swimmer_results (swimmer_id, created_at desc);

alter table public.swimmer_results enable row level security;
drop policy if exists "Swimmer results are public" on public.swimmer_results;
create policy "Swimmer results are public"
  on public.swimmer_results for select to anon, authenticated using (true);
drop policy if exists "Account owners can submit results for their swimmers" on public.swimmer_results;
create policy "Account owners can submit results for their swimmers"
  on public.swimmer_results for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and exists (select 1 from public.swimmer_profiles s where s.id = swimmer_id and s.account_id = (select auth.uid()))
  );
drop policy if exists "Submitters can edit their results" on public.swimmer_results;
create policy "Submitters can edit their results"
  on public.swimmer_results for update to authenticated
  using (submitted_by = (select auth.uid()))
  with check (
    submitted_by = (select auth.uid())
    and exists (select 1 from public.swimmer_profiles s where s.id = swimmer_id and s.account_id = (select auth.uid()))
  );
drop policy if exists "Submitters can delete their results" on public.swimmer_results;
create policy "Submitters can delete their results"
  on public.swimmer_results for delete to authenticated using (submitted_by = (select auth.uid()));
grant select on public.swimmer_results to anon, authenticated;
grant insert, update, delete on public.swimmer_results to authenticated;
