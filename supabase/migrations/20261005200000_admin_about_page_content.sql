create table if not exists public.site_about_sections (
  slug text primary key,
  title text not null,
  description text not null default '',
  paragraphs text[] not null default '{}',
  badge text,
  external_label text,
  external_href text,
  links jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint site_about_sections_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint site_about_sections_links_array check (jsonb_typeof(links) = 'array')
);

alter table public.site_about_sections enable row level security;

drop policy if exists "Published about sections are public" on public.site_about_sections;
create policy "Published about sections are public"
  on public.site_about_sections for select to anon, authenticated
  using (is_published);

drop policy if exists "About editors can read all sections" on public.site_about_sections;
create policy "About editors can read all sections"
  on public.site_about_sections for select to authenticated
  using (public.has_admin_permission('manage_articles'));

drop policy if exists "About editors can create sections" on public.site_about_sections;
create policy "About editors can create sections"
  on public.site_about_sections for insert to authenticated
  with check (public.has_admin_permission('manage_articles'));

drop policy if exists "About editors can update sections" on public.site_about_sections;
create policy "About editors can update sections"
  on public.site_about_sections for update to authenticated
  using (public.has_admin_permission('manage_articles'))
  with check (public.has_admin_permission('manage_articles'));

grant select on public.site_about_sections to anon, authenticated;
grant insert, update on public.site_about_sections to authenticated;
