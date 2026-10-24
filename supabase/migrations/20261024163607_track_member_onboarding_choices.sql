create table if not exists public.member_onboarding (
  account_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('new_member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_onboarding enable row level security;
drop policy if exists "Members can read their onboarding choice" on public.member_onboarding;
create policy "Members can read their onboarding choice"
  on public.member_onboarding for select to authenticated
  using (account_id = (select auth.uid()));

revoke all on public.member_onboarding from public, anon, authenticated;
grant select on public.member_onboarding to authenticated;

create or replace function public.mark_myself_as_new_member()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to update your member status.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.profile_claims
    where claimant_id = auth.uid() and status in ('pending', 'approved', 'disputed')
  ) then
    raise exception 'An existing profile claim is already in progress for this account.';
  end if;

  insert into public.member_onboarding (account_id, status)
  values (auth.uid(), 'new_member')
  on conflict (account_id) do update
    set status = excluded.status, updated_at = now();
end;
$$;
revoke all on function public.mark_myself_as_new_member() from public, anon;
grant execute on function public.mark_myself_as_new_member() to authenticated;

create or replace function public.admin_list_new_members(p_limit integer default 50)
returns table (
  account_id uuid,
  email text,
  display_name text,
  marked_at timestamptz,
  account_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('view_admin') then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  return query
  select m.account_id,
    u.email::text,
    coalesce(
      nullif(trim(concat_ws(' ', u.raw_user_meta_data ->> 'first_name', u.raw_user_meta_data ->> 'last_name')), ''),
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      u.email::text
    ) as display_name,
    m.created_at as marked_at,
    u.created_at as account_created_at
  from public.member_onboarding m
  join auth.users u on u.id = m.account_id
  where m.status = 'new_member'
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;
revoke all on function public.admin_list_new_members(integer) from public, anon;
grant execute on function public.admin_list_new_members(integer) to authenticated;

create or replace function public.admin_dashboard_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('view_admin') then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'swimmer_profiles', (select count(*) from public.swimmer_profiles),
    'registered_accounts', (select count(*) from auth.users),
    'claimed_profiles', (select count(*) from public.swimmer_profiles where account_id is not null),
    'claimed_members', (select count(distinct claimant_id) from public.profile_claims where status = 'approved'),
    'new_members', (select count(*) from public.member_onboarding where status = 'new_member'),
    'unclaimed_profiles', (select count(*) from public.swimmer_profiles where account_id is null),
    'pending_claims', (select count(*) from public.profile_claims where status = 'pending'),
    'published_results', (select count(*) from public.swimmer_results where status = 'verified'),
    'record_candidates', (select count(*) from public.admin_record_candidates where status in ('potential_record', 'equalled', 'needs_review')),
    'writers', (select count(*) from public.site_writers where status = 'active'),
    'article_drafts', (select count(*) from public.site_articles where status in ('draft','changes_requested')),
    'articles_in_review', (select count(*) from public.site_articles where status = 'submitted'),
    'published_articles', (select count(*) from public.site_articles where status = 'published'),
    'feature_articles', (select count(*) from public.site_articles where status = 'published' and is_featured)
  );
end;
$$;
revoke all on function public.admin_dashboard_counts() from public, anon;
grant execute on function public.admin_dashboard_counts() to authenticated;
