alter table public.athlete_goals
  add column if not exists is_public boolean not null default false;

alter table public.athlete_goals
  drop constraint if exists athlete_goals_course_check;

alter table public.athlete_goals
  add constraint athlete_goals_course_check check (course in ('SCY', 'SCM', 'LCM'));

drop policy if exists "Athletes can update their own goals" on public.athlete_goals;
create policy "Athletes can update their own goals"
  on public.athlete_goals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant update on public.athlete_goals to authenticated;
