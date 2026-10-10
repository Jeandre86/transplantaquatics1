-- Swimmers must have an approved club before submitting results. Admin-managed
-- imports and verification must still work for swimmers without a club.
create or replace function public.set_swimmer_result_club_representation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  swimmer_club_id uuid;
  swimmer_club_name text;
begin
  select sp.club_id, coalesce(c.name, sp.club_name)
    into swimmer_club_id, swimmer_club_name
  from public.swimmer_profiles sp
  left join public.clubs c on c.id = sp.club_id
  where sp.id = new.swimmer_id;

  if new.submitted_by is not null
    and swimmer_club_id is null
    and not public.has_admin_permission('publish_results') then
    raise exception 'Join an approved club before submitting results.';
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

drop policy if exists "Account owners can submit results for their swimmers" on public.swimmer_results;
create policy "Account owners can submit results for their swimmers"
  on public.swimmer_results for insert to authenticated
  with check (
    submitted_by = (select auth.uid())
    and exists (
      select 1 from public.swimmer_profiles s
      where s.id = swimmer_id
        and s.account_id = (select auth.uid())
        and s.club_id is not null
    )
  );

drop policy if exists "Submitters can edit their results" on public.swimmer_results;
create policy "Submitters can edit their results"
  on public.swimmer_results for update to authenticated
  using (submitted_by = (select auth.uid()))
  with check (
    submitted_by = (select auth.uid())
    and exists (
      select 1 from public.swimmer_profiles s
      where s.id = swimmer_id
        and s.account_id = (select auth.uid())
        and s.club_id is not null
    )
  );
