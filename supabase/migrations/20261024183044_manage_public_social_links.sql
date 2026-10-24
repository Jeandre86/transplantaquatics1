create or replace function public.admin_update_site_settings(p_settings jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  saved_settings jsonb;
  platform text;
  social jsonb;
begin
  if not public.has_admin_permission('manage_roles') then
    raise exception 'Only Owners can manage site settings.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_settings) is distinct from 'object'
    or p_settings->>'points_table' <> 'world_aquatics_2026'
    or jsonb_typeof(p_settings->'require_meet_sheet_for_submissions') is distinct from 'boolean'
    or jsonb_typeof(p_settings->'auto_verify_clean_official_imports') is distinct from 'boolean'
    or jsonb_typeof(p_settings->'require_second_admin_for_world_records') is distinct from 'boolean'
    or jsonb_typeof(p_settings->'email_on_profile_claim') is distinct from 'boolean'
    or jsonb_typeof(p_settings->'email_on_result_submission') is distinct from 'boolean'
    or jsonb_typeof(p_settings->'email_on_contact_message') is distinct from 'boolean'
    or jsonb_typeof(p_settings->'socials') is distinct from 'object' then
    raise exception 'Site settings contain unsupported values.' using errcode = '22023';
  end if;

  foreach platform in array array['facebook', 'instagram', 'x'] loop
    social := p_settings->'socials'->platform;
    if jsonb_typeof(social) is distinct from 'object'
      or jsonb_typeof(social->'enabled') is distinct from 'boolean'
      or jsonb_typeof(social->'url') is distinct from 'string'
      or (length(trim(social->>'url')) > 0 and (social->>'url') !~* '^https://[[:alnum:]][^[:space:]]*$')
      or ((social->>'enabled')::boolean and length(trim(social->>'url')) = 0) then
      raise exception 'Each enabled social link needs a valid HTTPS URL.' using errcode = '22023';
    end if;
  end loop;

  insert into public.admin_site_settings(id, settings, updated_at, updated_by)
  values (true, p_settings, now(), auth.uid())
  on conflict (id) do update set settings = excluded.settings, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  returning settings into saved_settings;
  return saved_settings;
end;
$$;

create or replace function public.get_public_social_links()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'facebook', case when s.settings #> '{socials,facebook,enabled}' = 'true'::jsonb
      and (s.settings #>> '{socials,facebook,url}') ~* '^https://[[:alnum:]][^[:space:]]*$'
      then s.settings #>> '{socials,facebook,url}' end,
    'instagram', case when s.settings #> '{socials,instagram,enabled}' = 'true'::jsonb
      and (s.settings #>> '{socials,instagram,url}') ~* '^https://[[:alnum:]][^[:space:]]*$'
      then s.settings #>> '{socials,instagram,url}' end,
    'x', case when s.settings #> '{socials,x,enabled}' = 'true'::jsonb
      and (s.settings #>> '{socials,x,url}') ~* '^https://[[:alnum:]][^[:space:]]*$'
      then s.settings #>> '{socials,x,url}' end
  ))
  from public.admin_site_settings s
  where s.id = true
  limit 1;
$$;

revoke all on function public.get_public_social_links() from public;
revoke all on function public.get_public_social_links() from anon, authenticated;
grant execute on function public.get_public_social_links() to anon, authenticated;
