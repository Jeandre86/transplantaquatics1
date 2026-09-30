create or replace function public.admin_delete_ad_campaign(p_campaign_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  if not public.has_admin_permission('manage_articles') then
    raise exception 'Ad campaign management permission required.' using errcode = '42501';
  end if;

  select to_jsonb(c) into v_before
  from public.ad_campaigns c
  where c.id = p_campaign_id
  for update;
  if not found then
    raise exception 'Ad campaign not found.' using errcode = 'P0002';
  end if;

  delete from public.ad_campaigns where id = p_campaign_id;
  insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data)
  values (auth.uid(), 'ad_campaign_deleted', 'ad_campaign', p_campaign_id::text, v_before);
end;
$$;

revoke all on function public.admin_delete_ad_campaign(uuid) from public, anon;
grant execute on function public.admin_delete_ad_campaign(uuid) to authenticated;

notify pgrst, 'reload schema';
