create table if not exists public.athlete_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event text not null,
  course text not null check (course in ('LCM', 'SCM')),
  target_time text not null check (target_time ~ '^[0-9]+(:[0-5][0-9])?([.][0-9]{1,2})?$'),
  created_at timestamptz not null default now()
);

create index if not exists athlete_goals_user_created_idx
  on public.athlete_goals (user_id, created_at desc);

alter table public.athlete_goals enable row level security;

drop policy if exists "Athletes can read their own goals" on public.athlete_goals;
create policy "Athletes can read their own goals"
  on public.athlete_goals for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Athletes can create their own goals" on public.athlete_goals;
create policy "Athletes can create their own goals"
  on public.athlete_goals for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Athletes can delete their own goals" on public.athlete_goals;
create policy "Athletes can delete their own goals"
  on public.athlete_goals for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.athlete_goals to authenticated;
