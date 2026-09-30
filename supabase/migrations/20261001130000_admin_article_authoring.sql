alter table public.site_articles
  add column if not exists comments_enabled boolean not null default true;

create or replace function public.admin_save_article(
  p_article_id uuid,
  p_author_name text,
  p_title text,
  p_slug text,
  p_excerpt text,
  p_body text,
  p_category text,
  p_access text,
  p_cover_image text,
  p_tags text[],
  p_comments_enabled boolean default true,
  p_publish boolean default false,
  p_featured boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_article_id uuid;
  v_author_name text := coalesce(nullif(trim(p_author_name), ''), 'Transplant Aquatics');
  v_clean_body text;
begin
  if not public.has_admin_permission('manage_articles') then
    raise exception 'Article authoring permission required.' using errcode = '42501';
  end if;
  v_clean_body := regexp_replace(coalesce(p_body, ''), '<[^>]*>', ' ', 'g');
  if length(trim(coalesce(p_title, ''))) < 5 then raise exception 'Add a headline with at least five characters.'; end if;
  if length(trim(coalesce(p_excerpt, ''))) < 20 then raise exception 'Add a summary with at least twenty characters.'; end if;
  if length(trim(v_clean_body)) < 100 then raise exception 'Write at least one hundred characters before saving.'; end if;
  if p_access not in ('free', 'member') then raise exception 'Unsupported article access setting.'; end if;
  if nullif(trim(coalesce(p_slug, '')), '') is null then raise exception 'An article URL slug is required.'; end if;

  insert into public.site_writers(user_id, email, display_name, status)
  values(auth.uid(), coalesce(auth.jwt() ->> 'email', ''), v_author_name, 'active')
  on conflict(user_id) do nothing;

  if p_article_id is null then
    insert into public.site_articles(
      author_id, author_name, title, slug, excerpt, body, category, access, cover_image, tags,
      status, is_featured, comments_enabled, read_time, published_at, updated_at
    ) values (
      auth.uid(), v_author_name, trim(p_title), trim(p_slug), trim(p_excerpt), p_body,
      coalesce(nullif(trim(p_category), ''), 'Community'), p_access, nullif(trim(coalesce(p_cover_image, '')), ''),
      coalesce(p_tags, '{}'), case when p_publish then 'published' else 'draft' end,
      p_publish and coalesce(p_featured, false), coalesce(p_comments_enabled, true),
      greatest(1, ceil(array_length(regexp_split_to_array(trim(v_clean_body), '\s+'), 1)::numeric / 200)::integer),
      case when p_publish then now() else null end, now()
    ) returning id into v_article_id;
  else
    update public.site_articles set
      author_name = v_author_name,
      title = trim(p_title), slug = trim(p_slug), excerpt = trim(p_excerpt), body = p_body,
      category = coalesce(nullif(trim(p_category), ''), 'Community'), access = p_access,
      cover_image = nullif(trim(coalesce(p_cover_image, '')), ''), tags = coalesce(p_tags, '{}'),
      status = case when p_publish then 'published' else 'draft' end,
      is_featured = p_publish and coalesce(p_featured, false),
      comments_enabled = coalesce(p_comments_enabled, true),
      read_time = greatest(1, ceil(array_length(regexp_split_to_array(trim(v_clean_body), '\s+'), 1)::numeric / 200)::integer),
      published_at = case when p_publish then coalesce(published_at, now()) else null end,
      reviewer_id = null, reviewer_note = null, updated_at = now()
    where id = p_article_id and author_id = auth.uid() and public.has_admin_permission('manage_articles')
    returning id into v_article_id;
    if v_article_id is null then raise exception 'Article draft not found or not editable.' using errcode = '42501'; end if;
  end if;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, after_data)
  values(auth.uid(), case when p_publish then 'admin_article_published' else 'admin_article_draft_saved' end,
    'site_article', v_article_id::text, jsonb_build_object('title', trim(p_title), 'featured', p_publish and coalesce(p_featured, false)));
  return v_article_id;
end;
$$;

revoke all on function public.admin_save_article(uuid,text,text,text,text,text,text,text,text,text[],boolean,boolean,boolean) from public, anon;
grant execute on function public.admin_save_article(uuid,text,text,text,text,text,text,text,text,text[],boolean,boolean,boolean) to authenticated;
