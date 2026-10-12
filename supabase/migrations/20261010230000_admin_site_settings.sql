create table if not exists public.admin_site_settings (
  id boolean primary key default true check (id),
  settings jsonb not null default '{
    "points_table": "world_aquatics_2026",
    "require_meet_sheet_for_submissions": true,
    "auto_verify_clean_official_imports": false,
    "require_second_admin_for_world_records": true,
    "email_on_profile_claim": true,
    "email_on_result_submission": true,
    "email_on_contact_message": true
  }'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.admin_site_settings enable row level security;
revoke all on public.admin_site_settings from public, anon, authenticated;

create or replace function public.admin_get_site_settings()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare settings_value jsonb;
begin
  if not public.has_admin_permission('manage_roles') then
    raise exception 'Only Owners can manage site settings.' using errcode = '42501';
  end if;
  select s.settings into settings_value from public.admin_site_settings s where s.id = true;
  return coalesce(settings_value, '{
    "points_table": "world_aquatics_2026",
    "require_meet_sheet_for_submissions": true,
    "auto_verify_clean_official_imports": false,
    "require_second_admin_for_world_records": true,
    "email_on_profile_claim": true,
    "email_on_result_submission": true,
    "email_on_contact_message": true
  }'::jsonb);
end;
$$;

create or replace function public.admin_update_site_settings(p_settings jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare saved_settings jsonb;
begin
  if not public.has_admin_permission('manage_roles') then
    raise exception 'Only Owners can manage site settings.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_settings) <> 'object'
    or p_settings->>'points_table' <> 'world_aquatics_2026'
    or jsonb_typeof(p_settings->'require_meet_sheet_for_submissions') <> 'boolean'
    or jsonb_typeof(p_settings->'auto_verify_clean_official_imports') <> 'boolean'
    or jsonb_typeof(p_settings->'require_second_admin_for_world_records') <> 'boolean'
    or jsonb_typeof(p_settings->'email_on_profile_claim') <> 'boolean'
    or jsonb_typeof(p_settings->'email_on_result_submission') <> 'boolean'
    or jsonb_typeof(p_settings->'email_on_contact_message') <> 'boolean' then
    raise exception 'Site settings contain unsupported values.' using errcode = '22023';
  end if;

  insert into public.admin_site_settings(id, settings, updated_at, updated_by)
  values (true, p_settings, now(), auth.uid())
  on conflict (id) do update set settings = excluded.settings, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning settings into saved_settings;
  return saved_settings;
end;
$$;

revoke all on function public.admin_get_site_settings() from public, anon;
revoke all on function public.admin_update_site_settings(jsonb) from public, anon;
grant execute on function public.admin_get_site_settings() to authenticated;
grant execute on function public.admin_update_site_settings(jsonb) to authenticated;
