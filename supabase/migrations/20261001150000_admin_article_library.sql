-- Give article managers a complete library workflow while preserving writer attribution.
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
  v_previous_status text;
begin
  if not public.has_admin_permission('manage_articles') then
    raise exception 'Article authoring permission required.' using errcode = '42501';
  end if;
  v_clean_body := regexp_replace(coalesce(p_body, ''), '<[^>]*>', ' ', 'g');
  if length(trim(coalesce(p_title, ''))) < 1 then raise exception 'Add a headline before saving your draft.'; end if;
  if p_publish and length(trim(coalesce(p_title, ''))) < 5 then raise exception 'Add a headline with at least five characters.'; end if;
  if p_publish and length(trim(coalesce(p_excerpt, ''))) < 20 then raise exception 'Add a summary with at least twenty characters.'; end if;
  if p_publish and length(trim(v_clean_body)) < 100 then raise exception 'Write at least one hundred characters before publishing.'; end if;
  if p_access not in ('free', 'member') then raise exception 'Unsupported article access setting.'; end if;
  if nullif(trim(coalesce(p_slug, '')), '') is null then raise exception 'An article URL slug is required.'; end if;

  if p_article_id is null then
    insert into public.site_writers(user_id, email, display_name, status)
    values(auth.uid(), coalesce(auth.jwt() ->> 'email', ''), v_author_name, 'active')
    on conflict(user_id) do nothing;
    insert into public.site_articles(
      author_id, author_name, title, slug, excerpt, body, category, access, cover_image, tags,
      status, is_featured, comments_enabled, read_time, published_at, updated_at
    ) values (
      auth.uid(), v_author_name, trim(p_title), trim(p_slug), trim(coalesce(p_excerpt, '')), coalesce(p_body, ''),
      coalesce(nullif(trim(p_category), ''), 'Community'), p_access, nullif(trim(coalesce(p_cover_image, '')), ''),
      coalesce(p_tags, '{}'), case when p_publish then 'published' else 'draft' end,
      p_publish and coalesce(p_featured, false), coalesce(p_comments_enabled, true),
      greatest(1, ceil(array_length(regexp_split_to_array(trim(v_clean_body), '\s+'), 1)::numeric / 200)::integer),
      case when p_publish then now() else null end, now()
    ) returning id into v_article_id;
  else
    select status into v_previous_status
    from public.site_articles
    where id = p_article_id;
    if not found then raise exception 'Article not found.' using errcode = 'P0002'; end if;

    update public.site_articles set
      title = trim(p_title), slug = trim(p_slug), excerpt = trim(coalesce(p_excerpt, '')), body = coalesce(p_body, ''),
      category = coalesce(nullif(trim(p_category), ''), 'Community'), access = p_access,
      cover_image = nullif(trim(coalesce(p_cover_image, '')), ''), tags = coalesce(p_tags, '{}'),
      status = case when p_publish then 'published' else 'draft' end,
      is_featured = p_publish and coalesce(p_featured, false),
      comments_enabled = coalesce(p_comments_enabled, true),
      read_time = greatest(1, ceil(array_length(regexp_split_to_array(trim(v_clean_body), '\s+'), 1)::numeric / 200)::integer),
      published_at = case when p_publish then coalesce(published_at, now()) else null end,
      reviewer_id = null, reviewer_note = null, updated_at = now()
    where id = p_article_id and public.has_admin_permission('manage_articles')
    returning id into v_article_id;
    if v_article_id is null then raise exception 'Article not found or not editable.' using errcode = '42501'; end if;
  end if;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data, after_data)
  values(auth.uid(), case when p_publish then 'admin_article_published' else 'admin_article_draft_saved' end,
    'site_article', v_article_id::text,
    case when p_article_id is null then null else jsonb_build_object('status', v_previous_status) end,
    jsonb_build_object('title', trim(p_title), 'status', case when p_publish then 'published' else 'draft' end, 'featured', p_publish and coalesce(p_featured, false)));
  return v_article_id;
end;
$$;

revoke all on function public.admin_save_article(uuid,text,text,text,text,text,text,text,text,text[],boolean,boolean,boolean) from public, anon;
grant execute on function public.admin_save_article(uuid,text,text,text,text,text,text,text,text,text[],boolean,boolean,boolean) to authenticated;

create or replace function public.admin_set_article_status(p_article_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_title text;
begin
  if not public.has_admin_permission('manage_articles') then
    raise exception 'Article management permission required.' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception 'Unsupported article status.';
  end if;
  select jsonb_build_object('status', status, 'is_featured', is_featured), title
    into v_before, v_title
  from public.site_articles where id = p_article_id for update;
  if not found then raise exception 'Article not found.' using errcode = 'P0002'; end if;

  update public.site_articles set
    status = p_status,
    is_featured = case when p_status = 'archived' then false else is_featured end,
    published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
    updated_at = now()
  where id = p_article_id;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data, after_data)
  values(auth.uid(), case when p_status = 'archived' then 'admin_article_archived' else 'admin_article_restored' end,
    'site_article', p_article_id::text, v_before, jsonb_build_object('title', v_title, 'status', p_status));
end;
$$;
revoke all on function public.admin_set_article_status(uuid,text) from public, anon;
grant execute on function public.admin_set_article_status(uuid,text) to authenticated;

create or replace function public.admin_delete_article(p_article_id uuid, p_confirmation_title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_article public.site_articles%rowtype;
begin
  if not public.has_admin_permission('manage_articles') then
    raise exception 'Article management permission required.' using errcode = '42501';
  end if;
  select * into v_article from public.site_articles where id = p_article_id for update;
  if not found then raise exception 'Article not found.' using errcode = 'P0002'; end if;
  if p_confirmation_title is distinct from v_article.title then
    raise exception 'The confirmation headline does not match.' using errcode = '22023';
  end if;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data)
  values(auth.uid(), 'admin_article_deleted', 'site_article', p_article_id::text,
    jsonb_build_object('title', v_article.title, 'slug', v_article.slug, 'status', v_article.status, 'author_id', v_article.author_id));
  delete from public.site_articles where id = p_article_id;
end;
$$;
revoke all on function public.admin_delete_article(uuid,text) from public, anon;
grant execute on function public.admin_delete_article(uuid,text) to authenticated;
