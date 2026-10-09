-- Writers may submit drafts but cannot publish or feature their own articles.
create or replace function public.enforce_writer_article_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Service-side maintenance is trusted; authenticated editorial managers retain their workflow.
  if auth.uid() is null or public.has_admin_permission('manage_articles') then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'Writer articles must be created as drafts.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.status not in ('draft', 'submitted', 'changes_requested') then
    raise exception 'Writer articles must be submitted for admin review before publication.' using errcode = '42501';
  end if;

  new.is_featured := false;
  new.published_at := null;
  return new;
end;
$$;

drop trigger if exists enforce_writer_article_review on public.site_articles;
create trigger enforce_writer_article_review
before insert or update on public.site_articles
for each row execute function public.enforce_writer_article_review();

revoke all on function public.enforce_writer_article_review() from public, anon, authenticated;
