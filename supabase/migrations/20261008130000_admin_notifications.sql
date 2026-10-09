create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('new_user', 'profile_claim')),
  title text not null,
  message text not null,
  subject_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_notifications_created_idx on public.admin_notifications(created_at desc);

create table if not exists public.admin_notification_reads (
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.admin_notifications enable row level security;
alter table public.admin_notification_reads enable row level security;

drop policy if exists "Admins read notifications" on public.admin_notifications;
create policy "Admins read notifications" on public.admin_notifications
  for select to authenticated using (public.has_admin_permission('view_admin'));

drop policy if exists "Admins read their notification receipts" on public.admin_notification_reads;
create policy "Admins read their notification receipts" on public.admin_notification_reads
  for select to authenticated using (user_id = (select auth.uid()) and public.has_admin_permission('view_admin'));
drop policy if exists "Admins mark their notifications read" on public.admin_notification_reads;
create policy "Admins mark their notifications read" on public.admin_notification_reads
  for insert to authenticated with check (user_id = (select auth.uid()) and public.has_admin_permission('view_admin'));
drop policy if exists "Admins update their notification receipts" on public.admin_notification_reads;
create policy "Admins update their notification receipts" on public.admin_notification_reads
  for update to authenticated using (user_id = (select auth.uid()) and public.has_admin_permission('view_admin'))
  with check (user_id = (select auth.uid()) and public.has_admin_permission('view_admin'));

grant select on public.admin_notifications to authenticated;
grant select, insert, update on public.admin_notification_reads to authenticated;

create or replace function public.notify_admin_of_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare display_name text;
begin
  display_name := nullif(trim(concat_ws(' ', new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name')), '');
  insert into public.admin_notifications(event_type, title, message, subject_id)
  values (
    'new_user',
    'New user signed up',
    coalesce(display_name, new.email, 'A new account was created.'),
    new.id::text
  );
  return new;
end;
$$;

drop trigger if exists notify_admin_on_user_signup on auth.users;
create trigger notify_admin_on_user_signup
  after insert on auth.users
  for each row execute function public.notify_admin_of_new_user();
revoke all on function public.notify_admin_of_new_user() from public, anon, authenticated;

create or replace function public.notify_admin_of_profile_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare swimmer_name text;
begin
  select concat_ws(' ', sp.first_name, sp.last_name)
    into swimmer_name
    from public.swimmer_profiles sp
    where sp.id = new.swimmer_profile_id;
  insert into public.admin_notifications(event_type, title, message, subject_id)
  values (
    'profile_claim',
    'New profile claim',
    coalesce(nullif(trim(swimmer_name), ''), 'A swimmer profile') || ' was submitted for claim review.',
    new.id::text
  );
  return new;
end;
$$;

drop trigger if exists notify_admin_on_profile_claim on public.profile_claims;
create trigger notify_admin_on_profile_claim
  after insert on public.profile_claims
  for each row execute function public.notify_admin_of_profile_claim();
revoke all on function public.notify_admin_of_profile_claim() from public, anon, authenticated;

notify pgrst, 'reload schema';
