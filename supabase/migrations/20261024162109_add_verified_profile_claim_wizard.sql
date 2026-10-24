create or replace function public.submit_verified_profile_claim(
  p_swimmer_profile_id uuid,
  p_result_id uuid,
  p_answer text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimant_id uuid := auth.uid();
  v_claim_id uuid;
  v_profile public.swimmer_profiles%rowtype;
  v_result record;
  v_answer text := regexp_replace(trim(coalesce(p_answer, '')), '\s+', '', 'g');
  v_answer_seconds numeric;
  v_expected_seconds numeric;
begin
  if v_claimant_id is null then
    raise exception 'Sign in to claim an athlete profile.' using errcode = '42501';
  end if;

  select * into v_profile
  from public.swimmer_profiles
  where id = p_swimmer_profile_id
  for update;

  if not found or v_profile.account_id is not null or v_profile.is_claimed then
    raise exception 'This athlete profile is no longer available to claim.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.swimmer_profiles
    where account_id = v_claimant_id and is_claimed
  ) or exists (
    select 1 from public.profile_claims
    where claimant_id = v_claimant_id and status in ('pending', 'approved', 'disputed')
  ) then
    raise exception 'This account already has a linked athlete profile or an open claim.' using errcode = '23505';
  end if;

  select r.id, r.event, r.time, m.name as meet_name, m.meet_year
  into v_result
  from public.swimmer_results r
  join public.submitted_meets m on m.id = r.meet_id
  where r.id = p_result_id
    and coalesce(r.athlete_id, r.swimmer_id) = p_swimmer_profile_id
    and r.status = 'verified'
    and m.is_world_transplant_games is true
  for share of r;

  if not found then
    raise exception 'That verified World Transplant Games result could not be matched.' using errcode = '22023';
  end if;

  if v_answer ~ '^\d+:[0-5]?\d(\.\d{1,2})?$' then
    v_answer_seconds := split_part(v_answer, ':', 1)::numeric * 60
      + split_part(v_answer, ':', 2)::numeric;
  elsif v_answer ~ '^\d+(\.\d{1,2})?$' then
    v_answer_seconds := v_answer::numeric;
  else
    raise exception 'Enter the swim time in seconds or minutes:seconds.' using errcode = '22023';
  end if;

  if v_result.time ~ '^\d+:[0-5]?\d(\.\d{1,2})?$' then
    v_expected_seconds := split_part(v_result.time, ':', 1)::numeric * 60
      + split_part(v_result.time, ':', 2)::numeric;
  elsif v_result.time ~ '^\d+(\.\d{1,2})?$' then
    v_expected_seconds := v_result.time::numeric;
  else
    raise exception 'The stored result time cannot be used for verification.' using errcode = '22023';
  end if;

  if v_answer_seconds <> v_expected_seconds then
    raise exception 'That time does not match the verified result. Check the time and try again.' using errcode = '22023';
  end if;

  insert into public.profile_claims (swimmer_profile_id, claimant_id, evidence)
  values (
    p_swimmer_profile_id,
    v_claimant_id,
    format('Passed WTG result check: %s, %s, %s. Submitted for administrator review.', v_result.meet_name, v_result.event, v_result.time)
  )
  returning id into v_claim_id;

  insert into public.admin_activity_log (actor_id, action, target_type, target_id, details)
  values (
    v_claimant_id,
    'profile_claim_submitted',
    'profile_claim',
    v_claim_id::text,
    jsonb_build_object('swimmer_profile_id', p_swimmer_profile_id, 'verification', 'verified_wtg_result')
  );

  return v_claim_id;
end;
$$;

revoke all on function public.submit_verified_profile_claim(uuid, uuid, text) from public, anon;
grant execute on function public.submit_verified_profile_claim(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
