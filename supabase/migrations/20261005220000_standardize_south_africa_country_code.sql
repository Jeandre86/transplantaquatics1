-- The platform stores South Africa as RSA. ZA remains an internal ISO alpha-2
-- alias only for rendering the South African flag emoji.
create or replace function public.normalize_country_code(p_country text, p_country_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(trim(coalesce(p_country, ''))) in ('SOUTH AFRICA', 'RSA')
      or upper(trim(coalesce(p_country_code, ''))) in ('ZA', 'ZAF', 'RSA')
      then 'RSA'
    else nullif(upper(trim(coalesce(p_country_code, ''))), '')
  end;
$$;

create or replace function public.normalize_country_code_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.country_code := public.normalize_country_code(new.country, new.country_code);
  return new;
end;
$$;

-- Normalize both existing rows and future writes across profile, results,
-- directory, club, import staging and records tables.
update public.swimmer_profiles
set country_code = public.normalize_country_code(country, country_code)
where upper(trim(coalesce(country, ''))) in ('SOUTH AFRICA', 'RSA')
   or upper(trim(coalesce(country_code, ''))) in ('ZA', 'ZAF', 'RSA');

update public.athletes
set country_code = public.normalize_country_code(country, country_code)
where upper(trim(coalesce(country, ''))) in ('SOUTH AFRICA', 'RSA')
   or upper(trim(coalesce(country_code, ''))) in ('ZA', 'ZAF', 'RSA');

update public.swimmer_results
set country_code = public.normalize_country_code(country, country_code)
where upper(trim(coalesce(country, ''))) in ('SOUTH AFRICA', 'RSA')
   or upper(trim(coalesce(country_code, ''))) in ('ZA', 'ZAF', 'RSA');

update public.clubs
set country_code = public.normalize_country_code(country, country_code)
where upper(trim(coalesce(country, ''))) in ('SOUTH AFRICA', 'RSA')
   or upper(trim(coalesce(country_code, ''))) in ('ZA', 'ZAF', 'RSA');

update public.admin_import_swimmers
set country_code = public.normalize_country_code(country, country_code)
where upper(trim(coalesce(country, ''))) in ('SOUTH AFRICA', 'RSA')
   or upper(trim(coalesce(country_code, ''))) in ('ZA', 'ZAF', 'RSA');

update public.admin_import_results
set country_code = public.normalize_country_code(country, country_code)
where upper(trim(coalesce(country, ''))) in ('SOUTH AFRICA', 'RSA')
   or upper(trim(coalesce(country_code, ''))) in ('ZA', 'ZAF', 'RSA');

update public.world_records
set country_code = public.normalize_country_code(country, country_code)
where upper(trim(coalesce(country, ''))) in ('SOUTH AFRICA', 'RSA')
   or upper(trim(coalesce(country_code, ''))) in ('ZA', 'ZAF', 'RSA');

update public.wtg_record_history
set country_code = public.normalize_country_code(country, country_code)
where upper(trim(coalesce(country, ''))) in ('SOUTH AFRICA', 'RSA')
   or upper(trim(coalesce(country_code, ''))) in ('ZA', 'ZAF', 'RSA');

drop trigger if exists normalize_sa_code_swimmer_profiles on public.swimmer_profiles;
create trigger normalize_sa_code_swimmer_profiles
before insert or update of country, country_code on public.swimmer_profiles
for each row execute function public.normalize_country_code_columns();

drop trigger if exists normalize_sa_code_athletes on public.athletes;
create trigger normalize_sa_code_athletes
before insert or update of country, country_code on public.athletes
for each row execute function public.normalize_country_code_columns();

drop trigger if exists normalize_sa_code_swimmer_results on public.swimmer_results;
create trigger normalize_sa_code_swimmer_results
before insert or update of country, country_code on public.swimmer_results
for each row execute function public.normalize_country_code_columns();

drop trigger if exists normalize_sa_code_clubs on public.clubs;
create trigger normalize_sa_code_clubs
before insert or update of country, country_code on public.clubs
for each row execute function public.normalize_country_code_columns();

drop trigger if exists normalize_sa_code_admin_import_swimmers on public.admin_import_swimmers;
create trigger normalize_sa_code_admin_import_swimmers
before insert or update of country, country_code on public.admin_import_swimmers
for each row execute function public.normalize_country_code_columns();

drop trigger if exists normalize_sa_code_admin_import_results on public.admin_import_results;
create trigger normalize_sa_code_admin_import_results
before insert or update of country, country_code on public.admin_import_results
for each row execute function public.normalize_country_code_columns();

drop trigger if exists normalize_sa_code_world_records on public.world_records;
create trigger normalize_sa_code_world_records
before insert or update of country, country_code on public.world_records
for each row execute function public.normalize_country_code_columns();

drop trigger if exists normalize_sa_code_wtg_record_history on public.wtg_record_history;
create trigger normalize_sa_code_wtg_record_history
before insert or update of country, country_code on public.wtg_record_history
for each row execute function public.normalize_country_code_columns();

-- Normalize before matching record holders to swimmer profiles.
create or replace function public.link_world_record_holder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.country_code := public.normalize_country_code(new.country, new.country_code);
  if new.athlete_id is null and new.country_code is not null then
    select a.id into new.athlete_id
    from public.athletes a
    where upper(a.country_code) = new.country_code
      and regexp_replace(lower(trim(a.first_name || ' ' || a.last_name)), '[^a-z0-9]+', '', 'g')
          = regexp_replace(lower(trim(new.athlete_name)), '[^a-z0-9]+', '', 'g')
    limit 1;
  end if;
  return new;
end;
$$;

create or replace function public.link_unmatched_records_for_athlete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.country_code := public.normalize_country_code(new.country, new.country_code);
  if new.country_code is not null then
    update public.world_records wr
    set athlete_id = new.id
    where wr.athlete_id is null
      and wr.country_code = upper(new.country_code)
      and regexp_replace(lower(trim(wr.athlete_name)), '[^a-z0-9]+', '', 'g')
          = regexp_replace(lower(trim(new.first_name || ' ' || new.last_name)), '[^a-z0-9]+', '', 'g');
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
