-- Historical swimming data import. Source rows stay visibly unverified until
-- an administrator reviews them; missing fields are retained as NULL.
alter table public.swimmer_profiles
  alter column country drop not null,
  add column if not exists source_key text,
  add column if not exists is_claimed boolean not null default false;
create unique index if not exists swimmer_profiles_source_key_uidx
  on public.swimmer_profiles(source_key) where source_key is not null;

alter table public.athletes alter column country drop not null;
alter table public.swimmer_results
  alter column country drop not null,
  alter column gender drop not null,
  alter column transplant_type drop not null,
  alter column age_group drop not null,
  add column if not exists course text,
  add column if not exists "placing" integer,
  add column if not exists round_name text,
  add column if not exists source_result_key text,
  add column if not exists source_data jsonb not null default '{}'::jsonb;
alter table public.swimmer_results drop constraint if exists swimmer_results_status_check;
alter table public.swimmer_results add constraint swimmer_results_status_check
  check (status in ('swimmer_submitted', 'imported_unverified', 'verified', 'rejected'));
alter table public.swimmer_results drop constraint if exists swimmer_results_meet_id_swimmer_id_event_key;
create unique index if not exists swimmer_results_category_uidx
  on public.swimmer_results(meet_id, swimmer_id, lower(trim(event)), coalesce(gender,''), coalesce(age_group,''), coalesce(course,''));
create unique index if not exists swimmer_results_source_key_uidx
  on public.swimmer_results(source_result_key) where source_result_key is not null;

alter table public.submitted_meets
  alter column meet_date drop not null,
  alter column location drop not null,
  add column if not exists source_meet_key text,
  add column if not exists meet_year integer;
alter table public.submitted_meets drop constraint if exists submitted_meets_course_check;
alter table public.submitted_meets add constraint submitted_meets_course_check
  check (course in ('LCM','SCM','SCY'));
alter table public.submitted_meets drop constraint if exists submitted_meets_check;
create unique index if not exists submitted_meets_source_key_uidx
  on public.submitted_meets(source_meet_key) where source_meet_key is not null;
create unique index if not exists profile_claims_one_swimmer_per_account_idx
  on public.profile_claims(claimant_id) where status in ('pending','approved','disputed');

create or replace function public.set_swimmer_result_club_representation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare swimmer_club_id uuid; swimmer_club_name text; is_wtg boolean:=false;
begin
  select sp.club_id,coalesce(c.name,sp.club_name) into swimmer_club_id,swimmer_club_name
  from public.swimmer_profiles sp left join public.clubs c on c.id=sp.club_id where sp.id=new.swimmer_id;
  select coalesce(sm.is_world_transplant_games,false) into is_wtg from public.submitted_meets sm where sm.id=new.meet_id;
  if is_wtg and swimmer_club_id is null and new.status <> 'imported_unverified' then
    raise exception 'A swimmer must belong to a club to submit World Transplant Games results.';
  end if;
  if tg_op='UPDATE' then new.represented_club_id:=old.represented_club_id;new.represented_club_name:=old.represented_club_name;
  else new.represented_club_id:=swimmer_club_id;new.represented_club_name:=swimmer_club_name; end if;
  return new;
end $$;

create table if not exists public.transplant_medals (
  id uuid primary key default gen_random_uuid(),
  swimmer_id uuid not null references public.swimmer_profiles(id) on delete cascade,
  result_id uuid not null unique references public.swimmer_results(id) on delete cascade,
  competition text not null,
  year integer not null,
  medal text not null check (medal in ('Gold','Silver','Bronze')),
  created_at timestamptz not null default now()
);
alter table public.transplant_medals enable row level security;
drop policy if exists "Transplant Games medals are public" on public.transplant_medals;
create policy "Transplant Games medals are public" on public.transplant_medals for select to anon, authenticated using (true);
grant select on public.transplant_medals to anon, authenticated;

-- Keep partial-country profiles in the public directory instead of deleting
-- their projection until the athlete corrects the missing field.
create or replace function public.sync_athlete_directory_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare resolved_club_name text;
begin
  if tg_op = 'DELETE' then delete from public.athletes where id=old.id; return old; end if;
  select c.name into resolved_club_name from public.clubs c where c.id=new.club_id;
  insert into public.athletes(id,first_name,last_name,country,country_code,gender,transplant_type,club_id,club_name,updated_at)
  values(new.id,new.first_name,new.last_name,nullif(trim(new.country),''),new.country_code,new.gender,new.transplant_type,new.club_id,coalesce(resolved_club_name,new.club_name),now())
  on conflict(id) do update set first_name=excluded.first_name,last_name=excluded.last_name,country=excluded.country,
   country_code=excluded.country_code,gender=excluded.gender,transplant_type=excluded.transplant_type,
   club_id=excluded.club_id,club_name=excluded.club_name,updated_at=now();
  return new;
end $$;
insert into public.athletes(id,first_name,last_name,country,country_code,gender,transplant_type,club_id,club_name)
select sp.id,sp.first_name,sp.last_name,nullif(trim(sp.country),''),sp.country_code,sp.gender,sp.transplant_type,sp.club_id,coalesce(c.name,sp.club_name)
from public.swimmer_profiles sp left join public.clubs c on c.id=sp.club_id
on conflict(id) do update set country=excluded.country,first_name=excluded.first_name,last_name=excluded.last_name,
 country_code=excluded.country_code,gender=excluded.gender,transplant_type=excluded.transplant_type,club_id=excluded.club_id,club_name=excluded.club_name,updated_at=now();

create or replace function public.admin_import_historical_meets(p_meets jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare m jsonb; imported integer:=0;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  for m in select value from jsonb_array_elements(coalesce(p_meets,'[]'::jsonb)) loop
    insert into public.submitted_meets(name,meet_date,location,course,is_world_transplant_games,source_meet_key,meet_year,created_by)
    values(m->>'name',nullif(m->>'meet_date','')::date,nullif(m->>'location',''),coalesce(nullif(m->>'course',''),'LCM'),coalesce((m->>'is_world_transplant_games')::boolean,false),m->>'source_meet_key',nullif(m->>'meet_year','')::integer,null)
    on conflict(source_meet_key) where source_meet_key is not null do update set
      name=excluded.name,location=coalesce(excluded.location,public.submitted_meets.location),meet_year=excluded.meet_year;
    imported:=imported+1;
  end loop;
  return imported;
end $$;

create or replace function public.admin_import_historical_swimmers(p_swimmers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s jsonb; n integer:=0;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  for s in select value from jsonb_array_elements(coalesce(p_swimmers,'[]'::jsonb)) loop
    insert into public.swimmer_profiles(source_key,first_name,last_name,country,country_code,gender,transplant_type,date_of_birth,account_id,is_account_holder,is_claimed)
    values(s->>'source_key',coalesce(nullif(s->>'first_name',''),'Unknown'),coalesce(nullif(s->>'last_name',''),'Swimmer'),nullif(s->>'country',''),nullif(s->>'country_code',''),nullif(s->>'gender',''),nullif(s->>'transplant_type',''),nullif(s->>'date_of_birth','')::date,null,false,false)
    on conflict(source_key) where source_key is not null do update set
      first_name=case when public.swimmer_profiles.account_id is null then excluded.first_name else public.swimmer_profiles.first_name end,
      last_name=case when public.swimmer_profiles.account_id is null then excluded.last_name else public.swimmer_profiles.last_name end,
      country=case when public.swimmer_profiles.account_id is null then coalesce(excluded.country,public.swimmer_profiles.country) else public.swimmer_profiles.country end,
      country_code=coalesce(public.swimmer_profiles.country_code,excluded.country_code),
      gender=coalesce(public.swimmer_profiles.gender,excluded.gender),transplant_type=coalesce(public.swimmer_profiles.transplant_type,excluded.transplant_type);
    n:=n+1;
  end loop;
  return jsonb_build_object('processed',n);
end $$;

create or replace function public.admin_import_historical_results(p_results jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; sp public.swimmer_profiles%rowtype; meet_row public.submitted_meets%rowtype; v_result_id uuid; n integer:=0; medals integer:=0;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  for r in select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb)) loop
    select * into sp from public.swimmer_profiles where source_key=r->>'swimmer_source_key';
    select * into meet_row from public.submitted_meets where source_meet_key=r->>'meet_source_key';
    if sp.id is null or meet_row.id is null then continue; end if;
    insert into public.swimmer_results(meet_id,swimmer_id,athlete_id,submitted_by,swimmer_name,country,country_code,gender,transplant_type,event,time,age_group,points,status,course,"placing",round_name,source_result_key,source_data,record_candidate,record_candidate_status)
    values(meet_row.id,sp.id,sp.id,null,r->>'swimmer_name',nullif(r->>'country',''),nullif(r->>'country_code',''),nullif(r->>'gender',''),nullif(r->>'transplant_type',''),r->>'event',r->>'time_original',nullif(r->>'age_group',''),nullif(r->>'points','')::integer,'imported_unverified',coalesce(nullif(r->>'course',''),'LCM'),nullif(r->>'placing','')::integer,r->>'round_name',r->>'source_result_key',coalesce(r->'source_data','{}'::jsonb),false,'not_candidate')
    on conflict do nothing
    returning id into v_result_id;
    if v_result_id is null then
      select sr.id into v_result_id from public.swimmer_results as sr where sr.source_result_key=r->>'source_result_key'
        or (sr.meet_id=meet_row.id and sr.swimmer_id=sp.id and lower(trim(sr.event))=lower(trim(r->>'event'))
          and coalesce(sr.gender,'')=coalesce(r->>'gender','') and coalesce(sr.age_group,'')=coalesce(r->>'age_group','')
          and coalesce(sr.course,'')=coalesce(r->>'course','LCM')) limit 1;
    end if;
    if v_result_id is not null and meet_row.is_world_transplant_games and nullif(r->>'placing','')::integer between 1 and 3 then
      insert into public.transplant_medals(swimmer_id,result_id,competition,year,medal)
      values(sp.id,v_result_id,meet_row.name,coalesce(meet_row.meet_year,extract(year from now())::integer),case nullif(r->>'placing','')::integer when 1 then 'Gold' when 2 then 'Silver' else 'Bronze' end)
      on conflict(result_id) do nothing;
      medals:=medals+1;
    end if;
    n:=n+1;
  end loop;
  return jsonb_build_object('processed',n,'medals',medals);
end $$;

revoke all on function public.admin_import_historical_meets(jsonb) from public;
revoke all on function public.admin_import_historical_swimmers(jsonb) from public;
revoke all on function public.admin_import_historical_results(jsonb) from public;
grant execute on function public.admin_import_historical_meets(jsonb) to authenticated;
grant execute on function public.admin_import_historical_swimmers(jsonb) to authenticated;
grant execute on function public.admin_import_historical_results(jsonb) to authenticated;

create or replace function public.admin_review_profile_claim(p_claim_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.profile_claims%rowtype;
begin
  if not public.has_admin_permission('review_claims') then raise exception 'Claim review permission required.' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected','disputed','correction_requested','removal_requested') then raise exception 'Unsupported claim decision.'; end if;
  select * into c from public.profile_claims where id=p_claim_id for update;
  if not found or c.status<>'pending' then raise exception 'This claim is no longer pending.'; end if;
  if p_decision='approved' then
    if exists(select 1 from public.swimmer_profiles where account_id=c.claimant_id and is_claimed and id<>c.swimmer_profile_id) then raise exception 'Each account can claim only one imported swimmer profile.'; end if;
    update public.swimmer_profiles set account_id=c.claimant_id,is_account_holder=false,is_claimed=true,updated_at=now()
      where id=c.swimmer_profile_id and account_id is null and not is_claimed;
    if not found then raise exception 'This swimmer profile is already claimed.'; end if;
  end if;
  update public.profile_claims set status=p_decision,reviewer_id=auth.uid(),reviewer_note=p_note,reviewed_at=now(),updated_at=now() where id=c.id;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,before_data,after_data,details)
  values(auth.uid(),'profile_claim_'||p_decision,'profile_claim',c.id::text,jsonb_build_object('status',c.status),jsonb_build_object('status',p_decision),jsonb_build_object('swimmer_profile_id',c.swimmer_profile_id,'claimant_id',c.claimant_id,'note',p_note));
end $$;
revoke all on function public.admin_review_profile_claim(uuid,text,text) from public;
grant execute on function public.admin_review_profile_claim(uuid,text,text) to authenticated;

create or replace function public.admin_set_submitted_result_status(p_result_id uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_result public.swimmer_results%rowtype;
begin
  if not public.has_admin_permission('publish_results') then raise exception 'Result review permission required.' using errcode='42501'; end if;
  if p_status not in ('verified','rejected','swimmer_submitted','imported_unverified') then raise exception 'Choose a supported result status.'; end if;
  select * into v_result from public.swimmer_results where id=p_result_id for update;
  if not found then raise exception 'Submitted result not found.' using errcode='P0002'; end if;
  v_before:=jsonb_build_object('status',v_result.status,'record_candidate_status',v_result.record_candidate_status);
  update public.swimmer_results set status=p_status,
    record_candidate_status=case when p_status='rejected' and record_candidate then 'rejected' when p_status in ('swimmer_submitted','imported_unverified') and record_candidate then 'pending_verification' else record_candidate_status end,
    updated_at=now() where id=p_result_id;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,before_data,after_data,details)
  values(auth.uid(),'submitted_result_status_changed','swimmer_result',p_result_id::text,v_before,
    jsonb_build_object('status',p_status),jsonb_build_object('note',nullif(trim(coalesce(p_note,'')),''),'event',v_result.event,'swimmer',v_result.swimmer_name));
end $$;
revoke all on function public.admin_set_submitted_result_status(uuid,text,text) from public,anon;
grant execute on function public.admin_set_submitted_result_status(uuid,text,text) to authenticated;

create or replace function public.get_public_swimmer_results(p_swimmer_id uuid)
returns table(id uuid,event text,"time" text,age_group text,points integer,status text,created_at timestamptz,meet_name text,meet_date date,location text,course text,is_world_transplant_games boolean,represented_club_name text)
language sql stable security definer set search_path = '' as $$
  select sr.id,sr.event,sr.time,sr.age_group,sr.points,sr.status,sr.created_at,sm.name,sm.meet_date,sm.location,
    coalesce(sr.course,sm.course),sm.is_world_transplant_games,sr.represented_club_name
  from public.swimmer_results sr left join public.submitted_meets sm on sm.id=sr.meet_id
  where sr.swimmer_id=p_swimmer_id and sr.status<>'rejected'
  order by coalesce(sm.meet_date,sr.created_at::date) desc,sr.event;
$$;
revoke all on function public.get_public_swimmer_results(uuid) from public;
grant execute on function public.get_public_swimmer_results(uuid) to anon,authenticated;

create or replace function public.submit_profile_claim(p_swimmer_profile_id uuid,p_evidence text,p_evidence_file_path text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_claim_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to submit a profile claim.' using errcode='42501'; end if;
  if length(trim(coalesce(p_evidence,'')))<20 then raise exception 'Please provide enough detail for the review.'; end if;
  if exists(select 1 from public.profile_claims where claimant_id=auth.uid() and status in ('pending','approved','disputed')) then
    raise exception 'An account can claim only one swimmer profile.';
  end if;
  if not exists(select 1 from public.swimmer_profiles sp where sp.id=p_swimmer_profile_id and sp.account_id is null and not sp.is_claimed) then
    raise exception 'This profile is not available to claim.';
  end if;
  insert into public.profile_claims(swimmer_profile_id,claimant_id,evidence,evidence_file_path)
  values(p_swimmer_profile_id,auth.uid(),trim(p_evidence),p_evidence_file_path) returning id into new_claim_id;
  insert into public.admin_activity_log(actor_id,action,target_type,target_id,details)
  values(auth.uid(),'profile_claim_submitted','profile_claim',new_claim_id::text,jsonb_build_object('swimmer_profile_id',p_swimmer_profile_id));
  return new_claim_id;
end $$;
revoke all on function public.submit_profile_claim(uuid,text,text) from public;
grant execute on function public.submit_profile_claim(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';

drop function if exists public.admin_list_swimmer_profiles();
create function public.admin_list_swimmer_profiles()
returns table(id uuid,first_name text,last_name text,country text,country_code text,gender text,transplant_type text,club_name text,account_id uuid,is_claimed boolean,source_key text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_admin_permission('view_admin') then raise exception 'Admin access required.' using errcode='42501'; end if;
  return query select sp.id,sp.first_name,sp.last_name,sp.country,sp.country_code,sp.gender,sp.transplant_type,sp.club_name,sp.account_id,sp.is_claimed,sp.source_key
   from public.swimmer_profiles sp order by lower(sp.last_name),lower(sp.first_name);
end $$;
revoke all on function public.admin_list_swimmer_profiles() from public;
grant execute on function public.admin_list_swimmer_profiles() to authenticated;
