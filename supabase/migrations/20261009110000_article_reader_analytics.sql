-- Store anonymous article engagement events and expose only writer-owned aggregates.
create table if not exists public.site_article_analytics_events (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.site_articles(id) on delete cascade,
  event_day date not null default ((now() at time zone 'UTC')::date),
  event_type text not null check (event_type in ('view', 'read_complete', 'share', 'like', 'save')),
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  constraint site_article_analytics_events_dedupe unique (article_id, event_day, event_type, visitor_id)
);

create index if not exists site_article_analytics_events_article_day_idx
  on public.site_article_analytics_events(article_id, event_day desc);

alter table public.site_article_analytics_events enable row level security;
revoke all on public.site_article_analytics_events from public, anon, authenticated;
revoke all on sequence public.site_article_analytics_events_id_seq from public, anon, authenticated;

create or replace function public.track_public_article_event(
  p_article_id uuid,
  p_event_type text,
  p_visitor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_event_type is null or p_event_type not in ('view', 'read_complete', 'share', 'like', 'save') or p_visitor_id is null then
    return;
  end if;

  insert into public.site_article_analytics_events(article_id, event_type, visitor_id)
  select a.id, p_event_type, p_visitor_id
  from public.site_articles a
  where a.id = p_article_id and a.status = 'published'
  on conflict (article_id, event_day, event_type, visitor_id) do nothing;
end;
$$;

revoke all on function public.track_public_article_event(uuid, text, uuid) from public;
grant execute on function public.track_public_article_event(uuid, text, uuid) to anon, authenticated;

create or replace function public.writer_article_analytics()
returns table (
  article_id uuid,
  views bigint,
  completed_reads bigint,
  shares bigint,
  likes bigint,
  saves bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.site_writers w where w.user_id = auth.uid() and w.status = 'active'
  ) then
    raise exception 'Active writer access is required.' using errcode = '42501';
  end if;

  return query
  select a.id,
    count(e.id) filter (where e.event_type = 'view'),
    count(e.id) filter (where e.event_type = 'read_complete'),
    count(e.id) filter (where e.event_type = 'share'),
    count(e.id) filter (where e.event_type = 'like'),
    count(e.id) filter (where e.event_type = 'save')
  from public.site_articles a
  left join public.site_article_analytics_events e on e.article_id = a.id
  where a.author_id = auth.uid() and a.status = 'published'
  group by a.id;
end;
$$;

revoke all on function public.writer_article_analytics() from public, anon;
grant execute on function public.writer_article_analytics() to authenticated;
