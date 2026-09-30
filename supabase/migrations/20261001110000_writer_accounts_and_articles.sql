-- Writer accounts and moderated article publishing.
alter table public.admin_permission_overrides drop constraint if exists admin_permission_overrides_permission_check;
alter table public.admin_permission_overrides add constraint admin_permission_overrides_permission_check
  check (permission in (
    'view_admin', 'import_results', 'publish_results', 'rollback_imports',
    'merge_swimmers', 'review_claims', 'confirm_records', 'manage_roles',
    'manage_writers', 'manage_articles'
  ));

create or replace function public.has_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when m.role = 'owner' then true
      when o.allowed is not null then o.allowed
      when m.role = 'administrator' then p_permission in (
        'view_admin', 'import_results', 'publish_results', 'rollback_imports',
        'merge_swimmers', 'review_claims', 'confirm_records', 'manage_articles', 'manage_writers'
      )
      when m.role = 'results_editor' then p_permission in ('view_admin', 'import_results')
      when m.role = 'claim_reviewer' then p_permission in ('view_admin', 'review_claims')
      else false
    end
    from public.admin_memberships m
    left join public.admin_permission_overrides o
      on o.user_id = m.user_id and o.permission = p_permission
    where m.user_id = auth.uid() and m.is_active
  ), false);
$$;
revoke all on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated;

create or replace function public.admin_set_permission(p_user_id uuid, p_permission text, p_allowed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('manage_roles') then raise exception 'Role management permission required.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own permissions.'; end if;
  if p_permission not in ('view_admin','import_results','publish_results','rollback_imports','merge_swimmers','review_claims','confirm_records','manage_roles','manage_writers','manage_articles') then raise exception 'Unsupported permission.'; end if;
  insert into public.admin_permission_overrides(user_id,permission,allowed,granted_by)
  values(p_user_id,p_permission,p_allowed,auth.uid())
  on conflict(user_id,permission) do update set allowed=excluded.allowed,granted_by=auth.uid(),updated_at=now();
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,after_data)
  values(auth.uid(),'admin_permission_changed','admin_membership',p_user_id::text,jsonb_build_object('permission',p_permission,'allowed',p_allowed));
end;
$$;
revoke all on function public.admin_set_permission(uuid,text,boolean) from public, anon;
grant execute on function public.admin_set_permission(uuid,text,boolean) to authenticated;

create table if not exists public.site_writers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('invited','active','suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.site_writers(user_id) on delete restrict,
  author_name text not null default 'Writer',
  title text not null default '',
  slug text not null unique,
  excerpt text not null default '',
  body text not null default '',
  category text not null default 'Community',
  access text not null default 'free' check (access in ('free','member')),
  cover_image text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','rejected','published','archived')),
  is_featured boolean not null default false,
  read_time integer not null default 1 check (read_time > 0),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_note text,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_articles_public_feed_idx on public.site_articles(status, is_featured desc, published_at desc);
create index if not exists site_articles_author_status_idx on public.site_articles(author_id, status, updated_at desc);

alter table public.site_writers enable row level security;
alter table public.site_articles enable row level security;

drop policy if exists "Writers and admins read writer directory" on public.site_writers;
create policy "Writers and admins read writer directory" on public.site_writers for select to authenticated
  using (user_id = (select auth.uid()) or public.has_admin_permission('manage_writers') or public.has_admin_permission('manage_articles'));
drop policy if exists "Published articles are public" on public.site_articles;
create policy "Published articles are public" on public.site_articles for select to anon, authenticated using (status = 'published');
drop policy if exists "Writers read own articles" on public.site_articles;
create policy "Writers read own articles" on public.site_articles for select to authenticated using (author_id = (select auth.uid()));
drop policy if exists "Editors read all articles" on public.site_articles;
create policy "Editors read all articles" on public.site_articles for select to authenticated using (public.has_admin_permission('manage_articles'));
drop policy if exists "Writers create drafts" on public.site_articles;
create policy "Writers create drafts" on public.site_articles for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'draft' and exists(select 1 from public.site_writers w where w.user_id = (select auth.uid()) and w.status = 'active'));
drop policy if exists "Writers edit unmoderated articles" on public.site_articles;
create policy "Writers edit unmoderated articles" on public.site_articles for update to authenticated
  using (author_id = (select auth.uid()) and status in ('draft','changes_requested'))
  with check (author_id = (select auth.uid()) and status in ('draft','submitted','changes_requested'));
drop policy if exists "Editors moderate articles" on public.site_articles;
create policy "Editors moderate articles" on public.site_articles for update to authenticated
  using (public.has_admin_permission('manage_articles'))
  with check (public.has_admin_permission('manage_articles'));

grant select on public.site_articles to anon, authenticated;
grant insert, update on public.site_articles to authenticated;
grant select on public.site_writers to authenticated;

create or replace function public.writer_submit_article(p_article_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists(select 1 from public.site_writers where user_id = auth.uid() and status = 'active') then
    raise exception 'An active writer account is required.' using errcode = '42501';
  end if;
  update public.site_articles
  set status = 'submitted', submitted_at = now(), updated_at = now(), reviewer_note = null
  where id = p_article_id and author_id = auth.uid() and status in ('draft','changes_requested')
    and length(trim(title)) >= 5 and length(trim(excerpt)) >= 20 and length(trim(body)) >= 100;
  if not found then raise exception 'Complete the title, summary and article before submitting.'; end if;
end;
$$;
revoke all on function public.writer_submit_article(uuid) from public, anon;
grant execute on function public.writer_submit_article(uuid) to authenticated;

create or replace function public.admin_moderate_article(p_article_id uuid, p_action text, p_featured boolean default false, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('manage_articles') then raise exception 'Article moderation permission required.' using errcode = '42501'; end if;
  if p_action not in ('publish','request_changes','reject') then raise exception 'Unsupported moderation action.'; end if;
  update public.site_articles
  set status = case p_action when 'publish' then 'published' when 'request_changes' then 'changes_requested' else 'rejected' end,
      is_featured = case when p_action = 'publish' then p_featured else false end,
      published_at = case when p_action = 'publish' then now() else null end,
      reviewer_id = auth.uid(), reviewer_note = nullif(trim(p_note), ''), updated_at = now()
  where id = p_article_id and status in ('submitted','changes_requested');
  if not found then raise exception 'Article is not awaiting moderation.'; end if;
end;
$$;
revoke all on function public.admin_moderate_article(uuid,text,boolean,text) from public, anon;
grant execute on function public.admin_moderate_article(uuid,text,boolean,text) to authenticated;

create or replace function public.admin_invite_writer_record(p_user_id uuid, p_email text, p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('manage_writers') then raise exception 'Writer management permission required.' using errcode = '42501'; end if;
  insert into public.site_writers(user_id,email,display_name,status,invited_by)
  values(p_user_id,lower(trim(p_email)),trim(p_display_name),'invited',auth.uid())
  on conflict(user_id) do update set email=excluded.email,display_name=excluded.display_name,status='invited',updated_at=now();
end;
$$;
revoke all on function public.admin_invite_writer_record(uuid,text,text) from public, anon;
grant execute on function public.admin_invite_writer_record(uuid,text,text) to authenticated;

create or replace function public.admin_list_writers()
returns table(user_id uuid,email text,display_name text,status text,created_at timestamptz,article_count bigint,draft_count bigint,submitted_count bigint,published_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select w.user_id,w.email,w.display_name,w.status,w.created_at,
    count(a.id),count(a.id) filter(where a.status='draft'),count(a.id) filter(where a.status='submitted'),count(a.id) filter(where a.status='published')
  from public.site_writers w left join public.site_articles a on a.author_id=w.user_id
  where public.has_admin_permission('manage_writers')
  group by w.user_id
  order by w.created_at desc;
$$;
revoke all on function public.admin_list_writers() from public, anon;
grant execute on function public.admin_list_writers() to authenticated;
