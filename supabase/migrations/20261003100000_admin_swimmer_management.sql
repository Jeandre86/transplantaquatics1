-- Admin swimmer editing/deletion, searchable source identifiers, and archive
-- tombstones so a later JSON import cannot recreate intentionally deleted rows.
create table if not exists public.swimmer_profile_archive_exclusions (
  source_key text primary key,
  swimmer_name text not null,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now()
);
alter table public.swimmer_profile_archive_exclusions enable row level security;
revoke all on public.swimmer_profile_archive_exclusions from public, anon, authenticated;

-- Age group is a result attribute. A swimmer may therefore have the same
-- event recorded in distinct age groups across their competition history.
alter table public.swimmer_results
  drop constraint if exists swimmer_results_meet_id_swimmer_id_event_key;
create unique index if not exists swimmer_results_swimmer_event_identity_uidx
  on public.swimmer_results(meet_id,swimmer_id,event,coalesce(age_group,''),coalesce(gender,''),coalesce(course,''));

create or replace function public.admin_update_swimmer_profile(
  p_swimmer_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_country text,
  p_country_code text,
  p_gender text,
  p_transplant_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_permission('merge_swimmers') then
    raise exception 'Swimmer management permission required.' using errcode='42501';
  end if;
  if nullif(trim(p_first_name),'') is null or nullif(trim(p_last_name),'') is null then
    raise exception 'First and last name are required.' using errcode='22023';
  end if;
  if p_gender is not null and p_gender not in ('Men','Women') then
    raise exception 'Gender must be Men, Women, or blank.' using errcode='22023';
  end if;

  update public.swimmer_profiles set
    first_name=trim(p_first_name),
    last_name=trim(p_last_name),
    date_of_birth=p_date_of_birth,
    country=nullif(trim(p_country),''),
    country_code=nullif(upper(trim(p_country_code)),''),
    gender=p_gender,
    transplant_type=nullif(trim(p_transplant_type),''),
    updated_at=now()
  where id=p_swimmer_id;
  if not found then raise exception 'Swimmer profile not found.' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.admin_update_swimmer_profile(uuid,text,text,date,text,text,text,text) from public;
grant execute on function public.admin_update_swimmer_profile(uuid,text,text,date,text,text,text,text) to authenticated;

create or replace function public.admin_delete_swimmer_profile(p_swimmer_id uuid,p_confirmation_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  swimmer public.swimmer_profiles%rowtype;
  keys text[];
  full_name text;
begin
  if not public.has_admin_permission('merge_swimmers') then
    raise exception 'Swimmer management permission required.' using errcode='42501';
  end if;
  select * into swimmer from public.swimmer_profiles where id=p_swimmer_id for update;
  if not found then raise exception 'Swimmer profile not found.' using errcode='P0002'; end if;
  full_name:=trim(swimmer.first_name||' '||swimmer.last_name);
  if lower(trim(coalesce(p_confirmation_name,'')))<>lower(full_name) then
    raise exception 'Confirmation name does not match this swimmer.' using errcode='22023';
  end if;
  if swimmer.account_id is not null or swimmer.is_claimed
    or exists(select 1 from public.profile_claims where swimmer_profile_id=p_swimmer_id) then
    raise exception 'This profile is linked to an account or claim and cannot be deleted here.' using errcode='23514';
  end if;

  select array_agg(distinct source_key) into keys from (
    select swimmer.source_key as source_key where swimmer.source_key is not null
    union all
    select aliases.source_key from public.swimmer_profile_source_aliases aliases where aliases.swimmer_profile_id=p_swimmer_id
  ) all_keys;
  if cardinality(coalesce(keys,'{}'::text[]))>0 then
    insert into public.swimmer_profile_archive_exclusions(source_key,swimmer_name,deleted_by)
    select key,full_name,auth.uid() from unnest(keys) as removed(key)
    on conflict(source_key) do update set swimmer_name=excluded.swimmer_name,deleted_by=excluded.deleted_by,deleted_at=now();
  end if;

  -- Preserve published meet rows as unattributed source results. Both profile
  -- links clear together through the existing synchronization trigger.
  update public.swimmer_results set swimmer_id=null,athlete_id=null where swimmer_id=p_swimmer_id;
  delete from public.swimmer_profiles where id=p_swimmer_id;
  return jsonb_build_object('deleted',true,'swimmer_name',full_name,'source_keys',coalesce(keys,'{}'::text[]));
end;
$$;
revoke all on function public.admin_delete_swimmer_profile(uuid,text) from public;
grant execute on function public.admin_delete_swimmer_profile(uuid,text) to authenticated;

-- Future archive imports skip a profile if any of its stable keys were
-- deliberately removed in the admin. Its result rows therefore cannot relink.
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
    if exists(select 1 from public.swimmer_profile_archive_exclusions x where x.source_key=any(source_keys)) then continue; end if;

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
        -- If two old profiles contain the same exact event result, retain the
        -- existing canonical row and carry over its medal before removing the
        -- duplicate. Rows with a different age group remain distinct.
        insert into public.transplant_medals(swimmer_id,result_id,competition,year,medal)
        select profile_id,keeper.id,medal.competition,medal.year,medal.medal
        from public.transplant_medals medal
        join public.swimmer_results duplicate_result on duplicate_result.id=medal.result_id and duplicate_result.swimmer_id=duplicate_id
        join public.swimmer_results keeper on keeper.swimmer_id=profile_id
          and keeper.meet_id is not distinct from duplicate_result.meet_id
          and lower(trim(keeper.event))=lower(trim(duplicate_result.event))
          and coalesce(keeper.age_group,'')=coalesce(duplicate_result.age_group,'')
          and coalesce(keeper.gender,'')=coalesce(duplicate_result.gender,'')
          and coalesce(keeper.course,'')=coalesce(duplicate_result.course,'')
        on conflict(result_id) do nothing;
        delete from public.transplant_medals medal
        using public.swimmer_results duplicate_result,public.swimmer_results keeper
        where medal.result_id=duplicate_result.id and duplicate_result.swimmer_id=duplicate_id
          and keeper.swimmer_id=profile_id
          and keeper.meet_id is not distinct from duplicate_result.meet_id
          and lower(trim(keeper.event))=lower(trim(duplicate_result.event))
          and coalesce(keeper.age_group,'')=coalesce(duplicate_result.age_group,'')
          and coalesce(keeper.gender,'')=coalesce(duplicate_result.gender,'')
          and coalesce(keeper.course,'')=coalesce(duplicate_result.course,'');
        delete from public.swimmer_results duplicate_result
        using public.swimmer_results keeper
        where duplicate_result.swimmer_id=duplicate_id and keeper.swimmer_id=profile_id
          and keeper.meet_id is not distinct from duplicate_result.meet_id
          and lower(trim(keeper.event))=lower(trim(duplicate_result.event))
          and coalesce(keeper.age_group,'')=coalesce(duplicate_result.age_group,'')
          and coalesce(keeper.gender,'')=coalesce(duplicate_result.gender,'')
          and coalesce(keeper.course,'')=coalesce(duplicate_result.course,'');
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

drop function if exists public.admin_list_swimmer_profiles();
create function public.admin_list_swimmer_profiles()
returns table(id uuid,first_name text,last_name text,date_of_birth date,country text,country_code text,gender text,transplant_type text,club_name text,account_id uuid,is_claimed boolean,source_key text,source_keys text[],identity_review_required boolean)
language sql stable security definer set search_path = '' as $$
  select sp.id,sp.first_name,sp.last_name,sp.date_of_birth,sp.country,sp.country_code,sp.gender,sp.transplant_type,sp.club_name,sp.account_id,sp.is_claimed,sp.source_key,
    array_remove(array_agg(distinct aliases.source_key),null),sp.identity_review_required
  from public.swimmer_profiles sp left join public.swimmer_profile_source_aliases aliases on aliases.swimmer_profile_id=sp.id
  where public.has_admin_permission('view_admin')
  group by sp.id order by lower(sp.last_name),lower(sp.first_name);
$$;
revoke all on function public.admin_list_swimmer_profiles() from public;
grant execute on function public.admin_list_swimmer_profiles() to authenticated;
notify pgrst,'reload schema';
