create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null check (
    char_length(email) <= 320
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  subject text not null check (subject in ('General enquiry', 'Partnership', 'Club', 'Results or profile', 'Media', 'Other')),
  message text not null check (char_length(trim(message)) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_status_created_idx
  on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;

drop policy if exists "Public can submit contact messages" on public.contact_messages;
create policy "Public can submit contact messages" on public.contact_messages
  for insert to anon, authenticated
  with check (status = 'new' and read_at is null);

drop policy if exists "Admins can read contact messages" on public.contact_messages;
create policy "Admins can read contact messages" on public.contact_messages
  for select to authenticated
  using (public.has_admin_permission('view_admin'));

drop policy if exists "Admins can update contact message status" on public.contact_messages;
create policy "Admins can update contact message status" on public.contact_messages
  for update to authenticated
  using (public.has_admin_permission('view_admin'))
  with check (public.has_admin_permission('view_admin'));

revoke all on public.contact_messages from public, anon, authenticated;
grant insert (name, email, subject, message) on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
grant update (status, read_at) on public.contact_messages to authenticated;

notify pgrst, 'reload schema';
