create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_name text not null,
  contact_email text,
  campaign_name text not null,
  placement text not null check (placement in ('article_inline', 'article_sidebar', 'news_feed')),
  image_url text not null,
  destination_url text not null,
  starts_on date not null,
  ends_on date not null,
  rate_amount numeric(10,2),
  rate_currency text not null default 'ZAR' check (rate_currency in ('ZAR', 'USD', 'EUR', 'GBP')),
  rate_period text not null default 'monthly' check (rate_period in ('weekly', 'monthly')),
  invoice_status text not null default 'not_invoiced' check (invoice_status in ('not_invoiced', 'invoiced', 'paid')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'archived')),
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaign_dates_valid check (ends_on >= starts_on),
  constraint ad_campaign_urls_valid check (image_url ~* '^https?://' and destination_url ~* '^https?://'),
  constraint ad_campaign_rate_valid check (rate_amount is null or rate_amount >= 0)
);

create index if not exists ad_campaigns_rotation_idx
  on public.ad_campaigns(placement, status, impressions, starts_on, ends_on);
alter table public.ad_campaigns enable row level security;
drop policy if exists "Admin managers read ad campaigns" on public.ad_campaigns;
create policy "Admin managers read ad campaigns" on public.ad_campaigns
  for select to authenticated using (public.has_admin_permission('manage_articles'));
grant select on public.ad_campaigns to authenticated;

create or replace function public.admin_save_ad_campaign(
  p_campaign_id uuid,
  p_advertiser_name text,
  p_contact_email text,
  p_campaign_name text,
  p_placement text,
  p_image_url text,
  p_destination_url text,
  p_starts_on date,
  p_ends_on date,
  p_rate_amount numeric,
  p_rate_currency text,
  p_rate_period text,
  p_invoice_status text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_status text;
begin
  if not public.has_admin_permission('manage_articles') then raise exception 'Ad campaign management permission required.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_advertiser_name, ''))) < 2 or length(trim(coalesce(p_campaign_name, ''))) < 2 then raise exception 'Add an advertiser and campaign name.'; end if;
  if p_placement not in ('article_inline', 'article_sidebar', 'news_feed') then raise exception 'Choose a supported ad placement.'; end if;
  if coalesce(p_image_url, '') !~* '^https?://' or coalesce(p_destination_url, '') !~* '^https?://' then raise exception 'Ad image and destination must use an HTTP or HTTPS URL.'; end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on or p_ends_on < current_date then raise exception 'Choose a valid campaign date range that has not ended.'; end if;
  if p_rate_amount is not null and p_rate_amount < 0 then raise exception 'Rate cannot be negative.'; end if;
  if p_rate_currency not in ('ZAR', 'USD', 'EUR', 'GBP') then raise exception 'Choose a supported currency.'; end if;
  if p_rate_period not in ('weekly', 'monthly') or p_invoice_status not in ('not_invoiced', 'invoiced', 'paid') then raise exception 'Choose a valid rate period and invoice status.'; end if;
  v_status := case when p_starts_on > current_date then 'scheduled' else 'active' end;
  if p_campaign_id is null then
    insert into public.ad_campaigns(advertiser_name,contact_email,campaign_name,placement,image_url,destination_url,starts_on,ends_on,rate_amount,rate_currency,rate_period,invoice_status,status)
    values(trim(p_advertiser_name),nullif(trim(coalesce(p_contact_email,'')),''),trim(p_campaign_name),p_placement,trim(p_image_url),trim(p_destination_url),p_starts_on,p_ends_on,p_rate_amount,p_rate_currency,p_rate_period,p_invoice_status,v_status)
    returning id into v_id;
  else
    update public.ad_campaigns set advertiser_name=trim(p_advertiser_name),contact_email=nullif(trim(coalesce(p_contact_email,'')),''),campaign_name=trim(p_campaign_name),placement=p_placement,image_url=trim(p_image_url),destination_url=trim(p_destination_url),starts_on=p_starts_on,ends_on=p_ends_on,rate_amount=p_rate_amount,rate_currency=p_rate_currency,rate_period=p_rate_period,invoice_status=p_invoice_status,
      status=case when status='paused' then 'paused' else v_status end,updated_at=now()
    where id=p_campaign_id returning id into v_id;
    if v_id is null then raise exception 'Ad campaign not found.' using errcode = 'P0002'; end if;
  end if;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,after_data)
  values(auth.uid(),case when p_campaign_id is null then 'ad_campaign_created' else 'ad_campaign_updated' end,'ad_campaign',v_id::text,
    jsonb_build_object('campaign',trim(p_campaign_name),'advertiser',trim(p_advertiser_name),'placement',p_placement,'status',v_status,'invoice_status',p_invoice_status));
  return v_id;
end;
$$;
revoke all on function public.admin_save_ad_campaign(uuid,text,text,text,text,text,text,date,date,numeric,text,text,text) from public,anon;
grant execute on function public.admin_save_ad_campaign(uuid,text,text,text,text,text,text,date,date,numeric,text,text,text) to authenticated;

create or replace function public.admin_set_ad_campaign_status(p_campaign_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.has_admin_permission('manage_articles') then raise exception 'Ad campaign management permission required.' using errcode = '42501'; end if;
  if p_status not in ('paused','archived','active','scheduled') then raise exception 'Unsupported ad campaign status.'; end if;
  select jsonb_build_object('status',status) into v_before from public.ad_campaigns where id=p_campaign_id for update;
  if not found then raise exception 'Ad campaign not found.' using errcode = 'P0002'; end if;
  update public.ad_campaigns set status=case
    when p_status='active' and starts_on>current_date then 'scheduled'
    when p_status='scheduled' and starts_on<=current_date then 'active'
    else p_status end,updated_at=now()
  where id=p_campaign_id returning jsonb_build_object('status',status) into v_after;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,before_data,after_data)
  values(auth.uid(),'ad_campaign_status_changed','ad_campaign',p_campaign_id::text,v_before,v_after);
end;
$$;
revoke all on function public.admin_set_ad_campaign_status(uuid,text) from public,anon;
grant execute on function public.admin_set_ad_campaign_status(uuid,text) to authenticated;

create or replace function public.get_rotating_ad(p_placement text)
returns table(id uuid,advertiser_name text,campaign_name text,image_url text,destination_url text,placement text)
language plpgsql security definer set search_path = '' as $$
begin
  if p_placement not in ('article_inline','article_sidebar','news_feed') then return; end if;
  update public.ad_campaigns set status='archived',updated_at=now()
    where status in ('active','scheduled') and ends_on<current_date;
  update public.ad_campaigns set status='active',updated_at=now()
    where status='scheduled' and starts_on<=current_date and ends_on>=current_date;
  return query with chosen as (
    select c.id from public.ad_campaigns c
    where c.placement=p_placement and c.status='active' and c.starts_on<=current_date and c.ends_on>=current_date
    order by c.impressions asc, random() limit 1
  )
  update public.ad_campaigns c set impressions=c.impressions+1
    from chosen where c.id=chosen.id
    returning c.id,c.advertiser_name,c.campaign_name,c.image_url,c.destination_url,c.placement;
end;
$$;
revoke all on function public.get_rotating_ad(text) from public;
grant execute on function public.get_rotating_ad(text) to anon,authenticated;

create or replace function public.record_ad_click(p_campaign_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.ad_campaigns set clicks=clicks+1 where id=p_campaign_id;
$$;
revoke all on function public.record_ad_click(uuid) from public;
grant execute on function public.record_ad_click(uuid) to anon,authenticated;

create or replace function public.archive_expired_ad_campaigns()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.ad_campaigns set status='archived',updated_at=now()
  where status in ('active','scheduled') and ends_on<current_date;
  get diagnostics v_count=row_count;
  update public.ad_campaigns set status='active',updated_at=now()
  where status='scheduled' and starts_on<=current_date and ends_on>=current_date;
  return v_count;
end;
$$;
revoke all on function public.archive_expired_ad_campaigns() from public,anon,authenticated;

create extension if not exists pg_cron;
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='archive-expired-ad-campaigns' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule('archive-expired-ad-campaigns','*/15 * * * *','select public.archive_expired_ad_campaigns();');
end $$;

notify pgrst, 'reload schema';
