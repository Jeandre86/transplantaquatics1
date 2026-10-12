drop policy if exists "Admins can delete contact messages" on public.contact_messages;
create policy "Admins can delete contact messages" on public.contact_messages
  for delete to authenticated
  using (public.has_admin_permission('view_admin'));

grant delete on public.contact_messages to authenticated;

notify pgrst, 'reload schema';
