alter table public.swimmer_results
  add column if not exists round_name text;

update public.swimmer_results result
set round_name = import_result.round_name
from public.admin_import_results import_result
where import_result.published_result_id = result.id
  and nullif(trim(import_result.round_name), '') is not null
  and nullif(trim(result.round_name), '') is null;

create table if not exists public.result_correction_requests (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.swimmer_results(id) on delete cascade,
  swimmer_profile_id uuid not null references public.swimmer_profiles(id) on delete cascade,
  claimant_id uuid not null references auth.users(id) on delete cascade,
  swimmer_name text not null,
  event text not null,
  meet_name text,
  course text,
  original_time text not null,
  proposed_time text,
  original_round text,
  proposed_round text,
  correction_type text not null check (correction_type in ('time', 'round', 'time_and_round', 'other')),
  reason text not null check (length(trim(reason)) between 5 and 1000),
  evidence_path text not null check (length(evidence_path) <= 500),
  evidence_url text check (evidence_url is null or (length(evidence_url) <= 2000 and evidence_url ~* '^https?://')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposed_time is null or proposed_time ~ '^([0-9]+:[0-5]?[0-9](\.[0-9]{1,2})?|[0-9]+(\.[0-9]{1,2})?)$'),
  check (proposed_round is null or length(trim(proposed_round)) <= 100),
  check (correction_type not in ('time', 'time_and_round') or nullif(trim(proposed_time), '') is not null),
  check (correction_type not in ('round', 'time_and_round') or nullif(trim(proposed_round), '') is not null)
);

-- CREATE TABLE IF NOT EXISTS does not modify an already-created table. Keep
-- this migration safe to rerun after an earlier version created the request
-- table without uploaded-proof support. Legacy requests may have no file, but
-- the insert policy below requires one for all new reports.
alter table public.result_correction_requests
  add column if not exists evidence_path text;

create index if not exists result_correction_requests_status_created_idx
  on public.result_correction_requests(status, created_at desc);
create index if not exists result_correction_requests_claimant_idx
  on public.result_correction_requests(claimant_id, created_at desc);
create unique index if not exists result_correction_requests_one_pending_per_result_idx
  on public.result_correction_requests(result_id) where status = 'pending';

alter table public.result_correction_requests enable row level security;
revoke all on public.result_correction_requests from public, anon, authenticated;
grant select, insert on public.result_correction_requests to authenticated;

drop policy if exists "Athletes can view their correction requests" on public.result_correction_requests;
create policy "Athletes can view their correction requests"
  on public.result_correction_requests for select to authenticated
  using (claimant_id = (select auth.uid()) or public.has_admin_permission('publish_results'));

drop policy if exists "Athletes can report corrections for their verified results" on public.result_correction_requests;
create policy "Athletes can report corrections for their verified results"
  on public.result_correction_requests for insert to authenticated
  with check (
    claimant_id = (select auth.uid())
    and status = 'pending'
    and reviewer_id is null
    and reviewer_note is null
    and reviewed_at is null
    and evidence_path like (select auth.uid())::text || '/%'
    and exists (
      select 1
      from public.swimmer_results result
      join public.swimmer_profiles swimmer on swimmer.id = result.swimmer_id
      where result.id = public.result_correction_requests.result_id
        and result.swimmer_id = public.result_correction_requests.swimmer_profile_id
        and result.status = 'verified'
        and swimmer.account_id = (select auth.uid())
        and result.time = public.result_correction_requests.original_time
        and result.event = public.result_correction_requests.event
        and coalesce(result.round_name, '') = coalesce(public.result_correction_requests.original_round, '')
        and result.swimmer_name = public.result_correction_requests.swimmer_name
    )
  );

-- Proof files are private. Swimmers can upload only into their own folder;
-- admins with result review permission can read them through short-lived URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('result-correction-evidence', 'result-correction-evidence', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Swimmers upload their result correction proof" on storage.objects;
create policy "Swimmers upload their result correction proof"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'result-correction-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Swimmers and result admins view correction proof" on storage.objects;
create policy "Swimmers and result admins view correction proof"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'result-correction-evidence'
    and (
      owner_id = (select auth.uid())::text
      or public.has_admin_permission('publish_results')
    )
  );

drop policy if exists "Swimmers clean up unsubmitted correction proof" on storage.objects;
create policy "Swimmers clean up unsubmitted correction proof"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'result-correction-evidence'
    and owner_id = (select auth.uid())::text
    and not exists (
      select 1 from public.result_correction_requests request
      where request.evidence_path = name
    )
  );

-- Preserve round labels when new official import rows are published into the
-- swimmer_results table used by athlete profiles, rankings and public results.
create or replace function public.admin_publish_import_batch(p_batch_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r public.admin_import_results%rowtype;
  batch_row public.admin_import_batches%rowtype;
  published integer := 0;
  official_id uuid;
  display_name text;
begin
  if not public.has_admin_permission('publish_results') then
    raise exception 'Publication permission required.' using errcode = '42501';
  end if;
  select * into batch_row from public.admin_import_batches where id = p_batch_id for update;
  if not found or batch_row.status not in ('review', 'ready_to_publish') then
    raise exception 'Import batch is not ready for publication.';
  end if;

  for r in select * from public.admin_import_results where batch_id = p_batch_id and review_action = 'publish' loop
    insert into public.imported_official_performances(
      import_result_id, batch_id, meet_catalog_id, swimmer_id, swimmer_name, country,
      event, age_group, gender, course, round_name, time_original, time_ms, "placing",
      race_status, is_relay, relay_team, relay_members, source_metadata, published_by
    ) values (
      r.id, p_batch_id, batch_row.meet_catalog_id, r.linked_swimmer_id, r.swimmer_name,
      r.country, r.event, r.age_group, r.gender, r.course, r.round_name, r.time_original,
      r.time_ms, r."placing", r.race_status, r.is_relay, r.relay_team, r.relay_members,
      jsonb_build_object('source_url', batch_row.source_url, 'file_name', batch_row.file_name,
        'source_references', r.source_references, 'source_values', r.raw_data,
        'competition_category', r.competition_category), auth.uid()
    ) on conflict (import_result_id) do update set source_metadata = excluded.source_metadata
      returning id into official_id;

    if r.race_status = 'OK' and not r.is_relay and r.time_original is not null
      and r.linked_swimmer_id is not null and r.validation_state = 'valid'
      and r.time_ms is not null and r.course is not null and r.gender is not null
      and r.age_group is not null then
      select concat_ws(' ', first_name, last_name) into display_name
      from public.swimmer_profiles where id = r.linked_swimmer_id;

      insert into public.swimmer_results(
        meet_id, swimmer_id, athlete_id, submitted_by, swimmer_name, country,
        country_code, gender, transplant_type, event, time, age_group, status,
        record_candidate, record_candidate_status, round_name
      )
      select batch_row.submitted_meet_id, sp.id, sp.id, null,
        coalesce(display_name, r.swimmer_name), coalesce(sp.country, r.country),
        sp.country_code, coalesce(sp.gender, r.gender), sp.transplant_type, r.event,
        r.time_original, r.age_group, 'verified', false, 'not_candidate', r.round_name
      from public.swimmer_profiles sp where sp.id = r.linked_swimmer_id
      and not exists (
        select 1 from public.swimmer_results sr
        where sr.meet_id = batch_row.submitted_meet_id and sr.swimmer_id = sp.id
          and lower(trim(sr.event)) = lower(trim(r.event)) and sr.time = r.time_original
          and coalesce(sr.round_name, '') = coalesce(r.round_name, '')
          and sr.status = 'verified'
      );

      update public.admin_import_results
      set published_result_id = (
        select id from public.swimmer_results
        where meet_id = batch_row.submitted_meet_id and swimmer_id = r.linked_swimmer_id
          and lower(trim(event)) = lower(trim(r.event)) and time = r.time_original
          and coalesce(round_name, '') = coalesce(r.round_name, '') and status = 'verified'
        order by created_at desc limit 1
      ) where id = r.id;
    end if;
    published := published + 1;
  end loop;

  update public.admin_import_batches
  set status = 'published', published_count = published, published_at = now(),
      progress = 'Published', updated_at = now()
  where id = p_batch_id;
  insert into public.admin_activity_log(actor_id, action, target_type, target_id, batch_id, details)
  values (auth.uid(), 'import_published', 'import_batch', p_batch_id::text, p_batch_id,
    jsonb_build_object('official_rows', published));
  return published;
end;
$$;
revoke all on function public.admin_publish_import_batch(uuid) from public, anon;
grant execute on function public.admin_publish_import_batch(uuid) to authenticated;

create or replace function public.admin_review_result_correction(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  correction public.result_correction_requests%rowtype;
  current_result public.swimmer_results%rowtype;
  correction_ms integer;
  source_time text;
  source_round text;
begin
  if not public.has_admin_permission('publish_results') then
    raise exception 'Result correction review permission required.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approve or reject.';
  end if;

  select * into correction from public.result_correction_requests
  where id = p_request_id for update;
  if not found then raise exception 'Correction request not found.' using errcode = 'P0002'; end if;
  if correction.status <> 'pending' then raise exception 'This correction has already been reviewed.'; end if;

  select * into current_result from public.swimmer_results
  where id = correction.result_id for update;
  if not found or current_result.status <> 'verified' then
    raise exception 'The verified result is no longer available for correction.';
  end if;
  if current_result.time is distinct from correction.original_time
    or current_result.round_name is distinct from correction.original_round then
    raise exception 'The result changed after this report was submitted. Refresh the request before reviewing it.';
  end if;

  if p_decision = 'approved' then
    if correction.correction_type in ('time', 'time_and_round') then
      source_time := trim(correction.proposed_time);
      if source_time ~ '^[0-9]+:[0-5]?[0-9](\.[0-9]{1,2})?$' then
        correction_ms := round(split_part(source_time, ':', 1)::numeric * 60000
          + split_part(source_time, ':', 2)::numeric * 1000)::integer;
      elsif source_time ~ '^[0-9]+(\.[0-9]{1,2})?$' then
        correction_ms := round(source_time::numeric * 1000)::integer;
      else
        raise exception 'The proposed time is not valid.';
      end if;

      update public.swimmer_results
      set time = source_time, updated_at = now()
      where id = correction.result_id;

      update public.imported_official_performances official
      set time_original = source_time, time_ms = correction_ms,
          source_metadata = jsonb_set(
            coalesce(official.source_metadata, '{}'::jsonb), '{correction_history}',
            coalesce(official.source_metadata->'correction_history', '[]'::jsonb)
              || jsonb_build_array(jsonb_build_object('request_id', correction.id,
                'previous_time', current_result.time, 'corrected_time', source_time,
                'reviewed_by', auth.uid(), 'reviewed_at', now())), true)
      where official.import_result_id in (
        select import_result.id from public.admin_import_results import_result
        where import_result.published_result_id = correction.result_id
      );
    end if;

    if correction.correction_type in ('round', 'time_and_round') then
      source_round := trim(correction.proposed_round);
      update public.swimmer_results
      set round_name = source_round, updated_at = now()
      where id = correction.result_id;

      update public.imported_official_performances official
      set round_name = source_round,
          source_metadata = jsonb_set(
            coalesce(official.source_metadata, '{}'::jsonb), '{correction_history}',
            coalesce(official.source_metadata->'correction_history', '[]'::jsonb)
              || jsonb_build_array(jsonb_build_object('request_id', correction.id,
                'previous_round', current_result.round_name, 'corrected_round', source_round,
                'reviewed_by', auth.uid(), 'reviewed_at', now())), true)
      where official.import_result_id in (
        select import_result.id from public.admin_import_results import_result
        where import_result.published_result_id = correction.result_id
      );
    end if;
  end if;

  update public.result_correction_requests
  set status = p_decision, reviewer_id = auth.uid(), reviewer_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_at = now(), updated_at = now()
  where id = correction.id;

  insert into public.admin_activity_log(actor_id, action, target_type, target_id, before_data, after_data, details)
  values (auth.uid(), 'result_correction_' || p_decision, 'swimmer_result', correction.result_id::text,
    jsonb_build_object('time', current_result.time, 'round', current_result.round_name),
    jsonb_build_object('time', case when p_decision = 'approved' and correction.correction_type in ('time', 'time_and_round') then correction.proposed_time else current_result.time end,
      'round', case when p_decision = 'approved' and correction.correction_type in ('round', 'time_and_round') then correction.proposed_round else current_result.round_name end),
    jsonb_build_object('request_id', correction.id, 'correction_type', correction.correction_type,
      'reason', correction.reason, 'evidence_url', correction.evidence_url, 'reviewer_note', p_note));
end;
$$;
revoke all on function public.admin_review_result_correction(uuid, text, text) from public, anon;
grant execute on function public.admin_review_result_correction(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
