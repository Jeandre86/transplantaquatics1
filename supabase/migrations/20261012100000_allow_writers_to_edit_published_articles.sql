-- Let writers edit their own published stories while routing every edit back
-- through the existing editorial review process.
drop policy if exists "Writers edit unmoderated articles" on public.site_articles;
create policy "Writers edit own editable articles" on public.site_articles for update to authenticated
  using (
    author_id = (select auth.uid())
    and status in ('draft', 'changes_requested', 'published')
  )
  with check (
    author_id = (select auth.uid())
    and status in ('draft', 'submitted', 'changes_requested')
  );

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

  if tg_op = 'UPDATE' and old.status = 'published' then
    new.status := 'submitted';
    new.submitted_at := now();
  elsif tg_op = 'UPDATE' and new.status not in ('draft', 'submitted', 'changes_requested') then
    raise exception 'Writer articles must be submitted for admin review before publication.' using errcode = '42501';
  end if;

  -- Writer changes must be approved before returning to the public site.
  new.is_featured := false;
  new.published_at := null;
  return new;
end;
$$;

revoke all on function public.enforce_writer_article_review() from public, anon, authenticated;
