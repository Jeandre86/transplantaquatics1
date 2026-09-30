create or replace function public.admin_list_members()
returns table(user_id uuid,email text,role text,is_active boolean,created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_permission('manage_roles') then raise exception 'Only Owners can manage roles.' using errcode='42501'; end if;
  return query select m.user_id,u.email,m.role,m.is_active,m.created_at from public.admin_memberships m join auth.users u on u.id=m.user_id order by m.created_at;
end; $$;
revoke all on function public.admin_list_members() from public;
grant execute on function public.admin_list_members() to authenticated;

create or replace function public.admin_search_accounts(p_query text)
returns table(user_id uuid,email text,created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_permission('manage_roles') then raise exception 'Only Owners can manage roles.' using errcode='42501'; end if;
  if length(trim(coalesce(p_query,''))) < 3 then return; end if;
  return query select u.id,u.email,u.created_at from auth.users u
    where u.email ilike '%'||trim(p_query)||'%'
    order by u.created_at desc limit 30;
end; $$;
revoke all on function public.admin_search_accounts(text) from public;
grant execute on function public.admin_search_accounts(text) to authenticated;
