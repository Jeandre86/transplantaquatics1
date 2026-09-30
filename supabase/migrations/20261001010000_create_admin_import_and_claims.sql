-- Admin, import review, profile claims, and sourced race publication.
-- Administrative writes are performed by permission-checked security definer RPCs
-- or Edge Functions; browser clients cannot write these tables directly.

create table if not exists public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'administrator', 'results_editor', 'claim_reviewer')),
  is_active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_permission_overrides (
  user_id uuid not null references public.admin_memberships(user_id) on delete cascade,
  permission text not null check (permission in (
    'view_admin', 'import_results', 'publish_results', 'rollback_imports',
    'merge_swimmers', 'review_claims', 'confirm_records', 'manage_roles'
  )),
  allowed boolean not null,
  granted_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, permission)
);

create or replace function public.has_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when m.role = 'owner' then true
      when o.allowed is not null then o.allowed
      when m.role = 'administrator' then p_permission in (
        'view_admin', 'import_results', 'publish_results', 'rollback_imports',
        'merge_swimmers', 'review_claims', 'confirm_records'
      )
      when m.role = 'results_editor' then p_permission in ('view_admin', 'import_results')
      when m.role = 'claim_reviewer' then p_permission in ('view_admin', 'review_claims')
      else false
    end
    from public.admin_memberships m
    left join public.admin_permission_overrides o
      on o.user_id = m.user_id and o.permission = p_permission
    where m.user_id = auth.uid() and m.is_active
  ), false);
$$;
revoke all on function public.has_admin_permission(text) from public;
grant execute on function public.has_admin_permission(text) to authenticated;

alter table public.swimmer_profiles alter column account_id drop not null;
alter table public.swimmer_profiles alter column date_of_birth drop not null;
alter table public.swimmer_profiles alter column gender drop not null;
alter table public.swimmer_profiles alter column transplant_type drop not null;
alter table public.swimmer_profiles drop constraint if exists swimmer_profiles_gender_check;
alter table public.swimmer_profiles add constraint swimmer_profiles_gender_check
  check (gender is null or gender in ('Men', 'Women'));
alter table public.athletes alter column gender drop not null;
alter table public.athletes alter column transplant_type drop not null;
alter table public.athletes drop constraint if exists athletes_gender_check;
alter table public.athletes add constraint athletes_gender_check
  check (gender is null or gender in ('Men', 'Women'));

create table if not exists public.profile_claims (
  id uuid primary key default gen_random_uuid(),
  swimmer_profile_id uuid not null references public.swimmer_profiles(id) on delete cascade,
  claimant_id uuid not null references auth.users(id) on delete cascade,
  evidence text not null,
  evidence_file_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'disputed', 'correction_requested', 'removal_requested')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profile_claims_one_open_claim_idx
  on public.profile_claims (swimmer_profile_id)
  where status in ('pending', 'approved', 'disputed');
create index if not exists profile_claims_claimant_idx on public.profile_claims (claimant_id, created_at desc);

create table if not exists public.admin_import_batches (
  id uuid primary key default gen_random_uuid(),
  meet_catalog_id uuid not null references public.meet_catalog(id),
  submitted_meet_id uuid references public.submitted_meets(id) on delete set null,
  created_by uuid not null references auth.users(id),
  source_type text not null check (source_type in ('url', 'upload', 'json')),
  source_url text,
  file_name text,
  source_sha256 text,
  retrieved_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'parsing', 'review', 'ready_to_publish', 'published', 'failed', 'rolled_back')),
  stage_count integer not null default 0,
  published_count integer not null default 0,
  progress text not null default 'Waiting to process',
  error_message text,
  source_metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_import_batches_created_idx on public.admin_import_batches(created_at desc);
create index if not exists admin_import_batches_meet_idx on public.admin_import_batches(meet_catalog_id, created_at desc);

create table if not exists public.admin_import_swimmers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.admin_import_batches(id) on delete cascade,
  source_key text not null,
  source_identifier text,
  first_name text not null,
  last_name text not null,
  country text,
  country_code text,
  gender text check (gender is null or gender in ('Men', 'Women')),
  age_group_at_meet text,
  transplant_type text,
  resolved_swimmer_id uuid references public.swimmer_profiles(id) on delete set null,
  resolution text not null default 'unreviewed' check (resolution in ('unreviewed', 'uncertain', 'link_existing', 'create_profile', 'skip')),
  raw_data jsonb not null default '{}'::jsonb,
  source_references jsonb not null default '[]'::jsonb,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, source_key)
);

create table if not exists public.admin_import_results (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.admin_import_batches(id) on delete cascade,
  source_row_key text not null,
  swimmer_source_key text,
  swimmer_name text not null,
  country text,
  country_code text,
  gender text check (gender is null or gender in ('Men', 'Women')),
  event text not null,
  distance_m smallint,
  stroke text,
  age_group text,
  competition_category text,
  course text check (course is null or course in ('LCM', 'SCM', 'SCY')),
  round_name text,
  time_original text,
  time_ms integer check (time_ms is null or time_ms >= 0),
  "placing" text,
  race_status text not null default 'OK' check (race_status in ('OK', 'DNS', 'DNF', 'DQ', 'SCR', 'NS')),
  is_relay boolean not null default false,
  relay_team text,
  relay_members jsonb not null default '[]'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  source_references jsonb not null default '[]'::jsonb,
  validation_state text not null default 'pending' check (validation_state in ('pending', 'valid', 'invalid', 'duplicate', 'uncertain')),
  validation_issues jsonb not null default '[]'::jsonb,
  review_action text not null default 'pending' check (review_action in ('pending', 'publish', 'skip')),
  linked_swimmer_id uuid references public.swimmer_profiles(id) on delete set null,
  published_result_id uuid references public.swimmer_results(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (batch_id, source_row_key)
);
create index if not exists admin_import_results_batch_idx on public.admin_import_results(batch_id, created_at);
create index if not exists admin_import_results_swimmer_key_idx on public.admin_import_results(batch_id, swimmer_source_key);

create table if not exists public.imported_official_performances (
  id uuid primary key default gen_random_uuid(),
  import_result_id uuid not null unique references public.admin_import_results(id) on delete restrict,
  batch_id uuid not null references public.admin_import_batches(id) on delete restrict,
  meet_catalog_id uuid not null references public.meet_catalog(id),
  swimmer_id uuid references public.swimmer_profiles(id) on delete set null,
  swimmer_name text not null,
  country text,
  event text not null,
  age_group text,
  gender text,
  course text,
  round_name text,
  time_original text,
  time_ms integer,
  "placing" text,
  race_status text not null,
  is_relay boolean not null default false,
  relay_team text,
  relay_members jsonb not null default '[]'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now()
);
create index if not exists imported_official_performances_meet_idx on public.imported_official_performances(meet_catalog_id, event, gender, age_group);
create index if not exists imported_official_performances_swimmer_idx on public.imported_official_performances(swimmer_id, published_at desc);

create table if not exists public.admin_import_rollback_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.admin_import_batches(id) on delete cascade,
  entity_type text not null check (entity_type in ('swimmer_profile', 'swimmer_result', 'official_performance', 'submitted_meet')),
  entity_id uuid not null,
  previous_row jsonb,
  published_row jsonb not null,
  created_by_batch boolean not null,
  rolled_back boolean not null default false,
  skip_reason text,
  created_at timestamptz not null default now(),
  unique (batch_id, entity_type, entity_id)
);

create table if not exists public.admin_record_candidates (
  id uuid primary key default gen_random_uuid(),
  imported_performance_id uuid not null references public.imported_official_performances(id) on delete restrict,
  baseline_record_id text references public.world_records(id) on delete set null,
  status text not null check (status in ('potential_record', 'equalled', 'needs_review', 'confirmed', 'rejected')),
  old_time_ms integer,
  new_time_ms integer not null,
  improvement_ms integer,
  reviewed_by uuid references auth.users(id) on delete set null,
  confirmation_evidence text,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (imported_performance_id, baseline_record_id)
);
create index if not exists admin_record_candidates_status_idx on public.admin_record_candidates(status, created_at desc);

create table if not exists public.admin_activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  batch_id uuid references public.admin_import_batches(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_activity_log_created_idx on public.admin_activity_log(created_at desc);
create index if not exists admin_activity_log_actor_idx on public.admin_activity_log(actor_id, created_at desc);

-- Existing public pages continue to use their existing projections. Unknown
-- imported DOBs and transplant types remain null rather than being invented.
create or replace function public.sync_athlete_directory_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare resolved_club_name text;
begin
  if tg_op = 'DELETE' then
    delete from public.athletes where id = old.id;
    return old;
  end if;
  if nullif(trim(new.country), '') is null then
    delete from public.athletes where id = new.id;
    return new;
  end if;
  select c.name into resolved_club_name from public.clubs c where c.id = new.club_id;
  insert into public.athletes (id, first_name, last_name, country, country_code, gender, transplant_type, club_id, club_name, updated_at)
  values (new.id, new.first_name, new.last_name, trim(new.country), new.country_code, new.gender, new.transplant_type, new.club_id, coalesce(resolved_club_name, new.club_name), now())
  on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name,
    country = excluded.country, country_code = excluded.country_code, gender = excluded.gender,
    transplant_type = excluded.transplant_type, club_id = excluded.club_id, club_name = excluded.club_name, updated_at = now();
  return new;
end;
$$;

-- Admin metadata is private. Each table has separate read permissions; only
-- the publishing/review RPCs and the server functions may perform writes.
alter table public.admin_memberships enable row level security;
alter table public.admin_permission_overrides enable row level security;
alter table public.profile_claims enable row level security;
alter table public.admin_import_batches enable row level security;
alter table public.admin_import_swimmers enable row level security;
alter table public.admin_import_results enable row level security;
alter table public.imported_official_performances enable row level security;
alter table public.admin_import_rollback_items enable row level security;
alter table public.admin_record_candidates enable row level security;
alter table public.admin_activity_log enable row level security;

create policy "Admin memberships visible to self and role managers" on public.admin_memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.has_admin_permission('manage_roles'));
create policy "Permission overrides visible to self and role managers" on public.admin_permission_overrides for select to authenticated
  using (user_id = (select auth.uid()) or public.has_admin_permission('manage_roles'));
create policy "Claimants and claim reviewers can read claims" on public.profile_claims for select to authenticated
  using (claimant_id = (select auth.uid()) or public.has_admin_permission('review_claims'));
create policy "Claimants submit claims for unclaimed profiles" on public.profile_claims for insert to authenticated
  with check (claimant_id = (select auth.uid()) and status = 'pending' and reviewer_id is null and exists (
    select 1 from public.swimmer_profiles sp where sp.id = swimmer_profile_id and sp.account_id is null
  ));
create policy "Importers read batches" on public.admin_import_batches for select to authenticated
  using (public.has_admin_permission('import_results'));
create policy "Importers read staged swimmers" on public.admin_import_swimmers for select to authenticated
  using (public.has_admin_permission('import_results'));
create policy "Importers read staged results" on public.admin_import_results for select to authenticated
  using (public.has_admin_permission('import_results'));
create policy "Published imported performances are public" on public.imported_official_performances for select to anon, authenticated
  using (exists (select 1 from public.admin_import_batches b where b.id = batch_id and b.status = 'published'));
create policy "Importers read rollback records" on public.admin_import_rollback_items for select to authenticated
  using (public.has_admin_permission('rollback_imports'));
create policy "Record reviewers read candidates" on public.admin_record_candidates for select to authenticated
  using (public.has_admin_permission('view_admin'));
create policy "Admins read activity history" on public.admin_activity_log for select to authenticated
  using (public.has_admin_permission('view_admin'));

grant select on public.admin_memberships, public.admin_permission_overrides, public.profile_claims,
  public.admin_import_batches, public.admin_import_swimmers, public.admin_import_results,
  public.admin_import_rollback_items, public.admin_record_candidates, public.admin_activity_log to authenticated;
grant insert on public.profile_claims to authenticated;
grant select on public.imported_official_performances to anon, authenticated;

create or replace function public.admin_dashboard_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('view_admin') then raise exception 'Admin access required.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'swimmer_profiles', (select count(*) from public.swimmer_profiles),
    'registered_accounts', (select count(*) from auth.users),
    'claimed_profiles', (select count(*) from public.swimmer_profiles where account_id is not null),
    'unclaimed_profiles', (select count(*) from public.swimmer_profiles where account_id is null),
    'pending_claims', (select count(*) from public.profile_claims where status = 'pending'),
    'published_results', (select count(*) from public.swimmer_results where status = 'verified'),
    'record_candidates', (select count(*) from public.admin_record_candidates where status in ('potential_record', 'equalled', 'needs_review'))
  );
end;
$$;
revoke all on function public.admin_dashboard_counts() from public;
grant execute on function public.admin_dashboard_counts() to authenticated;

create or replace function public.admin_review_profile_claim(p_claim_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare c public.profile_claims%rowtype;
begin
  if not public.has_admin_permission('review_claims') then raise exception 'Claim review permission required.' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected', 'disputed', 'correction_requested', 'removal_requested') then raise exception 'Unsupported claim decision.'; end if;
  select * into c from public.profile_claims where id = p_claim_id for update;
  if not found or c.status <> 'pending' then raise exception 'This claim is no longer pending.'; end if;
  if p_decision = 'approved' then
    update public.swimmer_profiles set account_id = c.claimant_id, is_account_holder = false, updated_at = now()
      where id = c.swimmer_profile_id and account_id is null;
    if not found then raise exception 'This swimmer profile is already linked to an account.'; end if;
  end if;
  update public.profile_claims set status = p_decision, reviewer_id = auth.uid(), reviewer_note = p_note, reviewed_at = now(), updated_at = now() where id = c.id;
  insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data, after_data, details)
  values (auth.uid(), 'profile_claim_' || p_decision, 'profile_claim', c.id::text,
    jsonb_build_object('status', c.status), jsonb_build_object('status', p_decision), jsonb_build_object('swimmer_profile_id', c.swimmer_profile_id, 'claimant_id', c.claimant_id, 'note', p_note));
end;
$$;
revoke all on function public.admin_review_profile_claim(uuid, text, text) from public;
grant execute on function public.admin_review_profile_claim(uuid, text, text) to authenticated;

create or replace function public.submit_profile_claim(p_swimmer_profile_id uuid, p_evidence text, p_evidence_file_path text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare new_claim_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to submit a profile claim.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_evidence, ''))) < 20 then raise exception 'Please provide enough detail for the review.'; end if;
  if not exists (select 1 from public.swimmer_profiles sp where sp.id = p_swimmer_profile_id and sp.account_id is null) then
    raise exception 'This profile is not available to claim.';
  end if;
  insert into public.profile_claims(swimmer_profile_id, claimant_id, evidence, evidence_file_path)
  values (p_swimmer_profile_id, auth.uid(), trim(p_evidence), p_evidence_file_path)
  returning id into new_claim_id;
  insert into public.admin_activity_log(actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'profile_claim_submitted', 'profile_claim', new_claim_id::text, jsonb_build_object('swimmer_profile_id', p_swimmer_profile_id));
  return new_claim_id;
end;
$$;
revoke all on function public.submit_profile_claim(uuid, text, text) from public;
grant execute on function public.submit_profile_claim(uuid, text, text) to authenticated;

create or replace function public.admin_set_membership(p_user_id uuid, p_role text, p_active boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare old_row public.admin_memberships%rowtype;
begin
  if not public.has_admin_permission('manage_roles') then raise exception 'Role management permission required.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own administrator access.'; end if;
  if p_role not in ('owner', 'administrator', 'results_editor', 'claim_reviewer') then raise exception 'Unsupported admin role.'; end if;
  select * into old_row from public.admin_memberships where user_id = p_user_id for update;
  if old_row.role = 'owner' and (p_role <> 'owner' or not p_active)
    and (select count(*) from public.admin_memberships where role = 'owner' and is_active) <= 1 then
    raise exception 'The last active Owner cannot be removed or demoted.';
  end if;
  insert into public.admin_memberships(user_id, role, is_active, granted_by)
    values (p_user_id, p_role, p_active, auth.uid())
    on conflict (user_id) do update set role = excluded.role, is_active = excluded.is_active, granted_by = auth.uid(), updated_at = now();
  insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data, after_data)
    values (auth.uid(), 'admin_membership_changed', 'admin_membership', p_user_id::text,
      case when old_row.user_id is null then null else jsonb_build_object('role', old_row.role, 'is_active', old_row.is_active) end,
      jsonb_build_object('role', p_role, 'is_active', p_active));
end;
$$;
revoke all on function public.admin_set_membership(uuid, text, boolean) from public;
grant execute on function public.admin_set_membership(uuid, text, boolean) to authenticated;

create or replace function public.admin_set_permission(p_user_id uuid, p_permission text, p_allowed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('manage_roles') then raise exception 'Role management permission required.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot change your own permissions.'; end if;
  if p_permission not in ('view_admin', 'import_results', 'publish_results', 'rollback_imports', 'merge_swimmers', 'review_claims', 'confirm_records', 'manage_roles') then raise exception 'Unsupported permission.'; end if;
  insert into public.admin_permission_overrides(user_id, permission, allowed, granted_by)
  values (p_user_id, p_permission, p_allowed, auth.uid())
  on conflict (user_id, permission) do update set allowed = excluded.allowed, granted_by = auth.uid(), updated_at = now();
  insert into public.admin_activity_log(actor_id, action, target_type, target_id, after_data)
  values (auth.uid(), 'admin_permission_changed', 'admin_membership', p_user_id::text, jsonb_build_object('permission', p_permission, 'allowed', p_allowed));
end;
$$;
revoke all on function public.admin_set_permission(uuid, text, boolean) from public;
grant execute on function public.admin_set_permission(uuid, text, boolean) to authenticated;

create or replace function public.admin_set_import_progress(p_batch_id uuid, p_status text, p_progress text default null, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode = '42501'; end if;
  if p_status not in ('queued', 'parsing', 'review', 'ready_to_publish', 'failed') then raise exception 'Unsupported import state.'; end if;
  update public.admin_import_batches set status = p_status, progress = coalesce(p_progress, progress), error_message = p_error, updated_at = now()
    where id = p_batch_id and created_by = auth.uid();
  if not found then raise exception 'Import batch not found or not owned by this account.'; end if;
  insert into public.admin_activity_log(actor_id, action, target_type, target_id, batch_id, details)
  values (auth.uid(), 'import_' || p_status, 'import_batch', p_batch_id::text, p_batch_id, jsonb_build_object('progress', p_progress, 'error', p_error));
end;
$$;
revoke all on function public.admin_set_import_progress(uuid, text, text, text) from public;
grant execute on function public.admin_set_import_progress(uuid, text, text, text) to authenticated;

-- Private upload area for official files and claim evidence.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('admin-imports', 'admin-imports', false, 15728640,
  array['application/json','text/csv','application/csv','application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "Importers upload admin source files" on storage.objects for insert to authenticated
  with check (bucket_id = 'admin-imports' and public.has_admin_permission('import_results'));
create policy "Importers view admin source files" on storage.objects for select to authenticated
  using (bucket_id = 'admin-imports' and (public.has_admin_permission('import_results') or public.has_admin_permission('review_claims')));

-- Only the authenticated Edge Function entrypoint receives the service key;
-- data table writes are restricted behind these server-verifiable policies.
