-- Map stable source swimmer IDs to one canonical profile and expose unresolved
-- identity candidates to admins. Age group remains on each result record.
alter table public.swimmer_profiles
  add column if not exists identity_review_required boolean not null default false;

create table if not exists public.swimmer_profile_source_aliases (
  source_key text primary key,
  swimmer_profile_id uuid not null references public.swimmer_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.swimmer_profile_source_aliases enable row level security;
revoke all on public.swimmer_profile_source_aliases from public, anon, authenticated;

create or replace function public.admin_import_historical_swimmers(p_swimmers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s jsonb; v_source_key text; source_keys text[]; existing_ids uuid[]; profile_id uuid;
  duplicate_id uuid; inserted integer:=0; merged integer:=0; alias_count integer:=0;
begin
  if not public.has_admin_permission('import_results') then
    raise exception 'Import permission required.' using errcode='42501';
  end if;
  for s in select value from jsonb_array_elements(coalesce(p_swimmers,'[]'::jsonb)) loop
    source_keys := array(select distinct key from jsonb_array_elements_text(
      coalesce(s->'source_keys',jsonb_build_array(s->>'source_key'))
    ) as keys(key) where key is not null and key<>'');
    if cardinality(source_keys)=0 then continue; end if;

    select array_agg(distinct candidate.profile_id) into existing_ids from (
      select sp.id as profile_id from public.swimmer_profiles sp where sp.source_key=any(source_keys)
      union all
      select aliases.swimmer_profile_id as profile_id from public.swimmer_profile_source_aliases aliases where aliases.source_key=any(source_keys)
    ) candidate;

    if coalesce(cardinality(existing_ids),0)>0 and (
      exists(select 1 from public.swimmer_profiles sp where sp.id=any(existing_ids) and (sp.account_id is not null or sp.is_claimed))
      or exists(select 1 from public.profile_claims pc where pc.swimmer_profile_id=any(existing_ids))
    ) then
      raise exception 'A matching source profile is claimed or has a claim request. No identities in this import batch were merged.' using errcode='23514';
    end if;

    select sp.id into profile_id from public.swimmer_profiles sp where sp.id=any(coalesce(existing_ids,'{}'::uuid[]))
      order by (sp.source_key=s->>'source_key') desc, sp.created_at asc limit 1;
    if profile_id is null then
      insert into public.swimmer_profiles(source_key,first_name,last_name,country,country_code,gender,transplant_type,date_of_birth,account_id,is_account_holder,is_claimed,identity_review_required)
      values(s->>'source_key',coalesce(nullif(s->>'first_name',''),'Unknown'),coalesce(nullif(s->>'last_name',''),'Swimmer'),nullif(s->>'country',''),nullif(s->>'country_code',''),nullif(s->>'gender',''),nullif(s->>'transplant_type',''),nullif(s->>'date_of_birth','')::date,null,false,false,coalesce((s->>'identity_review_required')::boolean,false))
      returning id into profile_id;
      inserted:=inserted+1;
    else
      update public.swimmer_profiles sp set
        first_name=coalesce(nullif(s->>'first_name',''),sp.first_name),
        last_name=coalesce(nullif(s->>'last_name',''),sp.last_name),
        country=coalesce(nullif(s->>'country',''),sp.country),
        country_code=coalesce(sp.country_code,nullif(s->>'country_code','')),
        gender=coalesce(sp.gender,nullif(s->>'gender','')),
        transplant_type=coalesce(sp.transplant_type,nullif(s->>'transplant_type','')),
        identity_review_required=coalesce((s->>'identity_review_required')::boolean,false),
        updated_at=now()
      where sp.id=profile_id;
      for duplicate_id in select existing_id from unnest(coalesce(existing_ids,'{}'::uuid[])) as ids(existing_id) where existing_id<>profile_id loop
        update public.swimmer_results set swimmer_id=profile_id,athlete_id=profile_id where swimmer_id=duplicate_id;
        update public.transplant_medals set swimmer_id=profile_id where swimmer_id=duplicate_id;
        update public.swimmer_profile_source_aliases set swimmer_profile_id=profile_id where swimmer_profile_id=duplicate_id;
        delete from public.swimmer_profiles where id=duplicate_id;
        merged:=merged+1;
      end loop;
    end if;

    foreach v_source_key in array source_keys loop
      insert into public.swimmer_profile_source_aliases(source_key,swimmer_profile_id)
      values(v_source_key,profile_id)
      on conflict(source_key) do update set swimmer_profile_id=excluded.swimmer_profile_id;
      alias_count:=alias_count+1;
    end loop;
  end loop;
  return jsonb_build_object('created',inserted,'merged',merged,'source_keys',alias_count);
end $$;
revoke all on function public.admin_import_historical_swimmers(jsonb) from public;
grant execute on function public.admin_import_historical_swimmers(jsonb) to authenticated;

create or replace function public.admin_import_historical_results(p_results jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; sp public.swimmer_profiles%rowtype; meet_row public.submitted_meets%rowtype; v_result_id uuid; n integer:=0; medals integer:=0;
begin
  if not public.has_admin_permission('import_results') then raise exception 'Import permission required.' using errcode='42501'; end if;
  for r in select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb)) loop
    select profile.* into sp from public.swimmer_profiles as profile
    where profile.source_key=r->>'swimmer_source_key' or exists (
      select 1 from public.swimmer_profile_source_aliases as aliases
      where aliases.source_key=r->>'swimmer_source_key' and aliases.swimmer_profile_id=profile.id
    ) limit 1;
    select * into meet_row from public.submitted_meets where source_meet_key=r->>'meet_source_key';
    if sp.id is null or meet_row.id is null then continue; end if;
    insert into public.swimmer_results(meet_id,swimmer_id,athlete_id,submitted_by,swimmer_name,country,country_code,gender,transplant_type,event,time,age_group,points,status,course,"placing",round_name,source_result_key,source_data,record_candidate,record_candidate_status)
    values(meet_row.id,sp.id,sp.id,null,r->>'swimmer_name',nullif(r->>'country',''),nullif(r->>'country_code',''),nullif(r->>'gender',''),nullif(r->>'transplant_type',''),r->>'event',r->>'time_original',nullif(r->>'age_group',''),nullif(r->>'points','')::integer,'imported_unverified',coalesce(nullif(r->>'course',''),'LCM'),nullif(r->>'placing','')::integer,r->>'round_name',r->>'source_result_key',coalesce(r->'source_data','{}'::jsonb),false,'not_candidate')
    on conflict do nothing returning id into v_result_id;
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
revoke all on function public.admin_import_historical_results(jsonb) from public;
grant execute on function public.admin_import_historical_results(jsonb) to authenticated;

drop function if exists public.admin_list_swimmer_profiles();
create function public.admin_list_swimmer_profiles()
returns table(id uuid,first_name text,last_name text,country text,country_code text,gender text,transplant_type text,club_name text,account_id uuid,is_claimed boolean,source_key text,identity_review_required boolean)
language sql stable security definer set search_path = '' as $$
  select sp.id,sp.first_name,sp.last_name,sp.country,sp.country_code,sp.gender,sp.transplant_type,sp.club_name,sp.account_id,sp.is_claimed,sp.source_key,sp.identity_review_required
  from public.swimmer_profiles sp where public.has_admin_permission('view_admin') order by sp.last_name,sp.first_name;
$$;
revoke all on function public.admin_list_swimmer_profiles() from public;
grant execute on function public.admin_list_swimmer_profiles() to authenticated;
notify pgrst,'reload schema';
