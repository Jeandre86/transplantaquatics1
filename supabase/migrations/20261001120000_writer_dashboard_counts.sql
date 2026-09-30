create or replace function public.admin_dashboard_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('view_admin') then raise exception 'Admin access required.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'swimmer_profiles', (select count(*) from public.swimmer_profiles),
    'registered_accounts', (select count(*) from auth.users),
    'claimed_profiles', (select count(*) from public.swimmer_profiles where account_id is not null),
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
