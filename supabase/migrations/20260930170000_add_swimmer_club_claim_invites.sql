create table if not exists public.club_claim_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz
);

create index if not exists club_claim_invites_club_status_idx
  on public.club_claim_invites (club_id, status, created_at desc);

alter table public.club_claim_invites enable row level security;
drop policy if exists "Invite creators and club owners can view club claims" on public.club_claim_invites;
create policy "Invite creators and club owners can view club claims"
  on public.club_claim_invites for select to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.club_coaches cc
      where cc.club_id = club_claim_invites.club_id
        and cc.account_id = (select auth.uid())
        and cc.role = 'owner'
    )
  );
grant select on public.club_claim_invites to authenticated;

create or replace function public.create_club_claim_invite(p_club_id uuid, p_invited_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(trim(coalesce(p_invited_email, '')));
  invite_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to invite a coach to this club.';
  end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid coach email address.';
  end if;
  if not exists (
    select 1 from public.swimmer_profiles sp
    where sp.account_id = auth.uid() and sp.club_id = p_club_id
  ) then
    raise exception 'Only an account linked to a swimmer at this club can invite its coaches.';
  end if;

  insert into public.club_claim_invites (club_id, created_by, invited_email)
  values (p_club_id, auth.uid(), normalized_email)
  returning id into invite_id;
  return invite_id;
end;
$$;
revoke all on function public.create_club_claim_invite(uuid, text) from public;
grant execute on function public.create_club_claim_invite(uuid, text) to authenticated;

create or replace function public.accept_club_claim_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.club_claim_invites%rowtype;
  auth_email text;
  account_role text;
  coach_name text;
  owner_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in with the invited coach account to accept this invitation.';
  end if;

  select lower(email), raw_user_meta_data ->> 'account_role'
    into auth_email, account_role
  from auth.users
  where id = auth.uid() and email_confirmed_at is not null;
  if auth_email is null then
    raise exception 'Confirm your email before accepting the club invitation.';
  end if;
  if coalesce(account_role, '') <> 'coach' then
    raise exception 'This invitation is for a coach account. Sign in or join as a coach to continue.';
  end if;

  select * into invite_row
  from public.club_claim_invites
  where id = p_invite_id
  for update;
  if not found or invite_row.status <> 'pending' or invite_row.expires_at <= now() then
    raise exception 'This club invitation has expired or has already been used.';
  end if;
  if auth_email <> invite_row.invited_email then
    raise exception 'Use the invited email address (%) to accept this club invitation.', invite_row.invited_email;
  end if;

  select exists (
    select 1 from public.club_coaches cc
    where cc.club_id = invite_row.club_id and cc.role = 'owner'
  ) into owner_exists;

  coach_name := coalesce(
    nullif(trim(concat_ws(' ', auth.jwt() -> 'user_metadata' ->> 'first_name', auth.jwt() -> 'user_metadata' ->> 'last_name')), ''),
    auth_email
  );

  if owner_exists then
    insert into public.club_coaches (club_id, account_id, name, role)
    values (invite_row.club_id, auth.uid(), coach_name, 'coach')
    on conflict (club_id, account_id) do nothing;
  else
    update public.clubs set created_by = auth.uid() where id = invite_row.club_id;
    insert into public.club_coaches (club_id, account_id, name, role)
    values (invite_row.club_id, auth.uid(), coach_name, 'owner')
    on conflict (club_id, account_id) do nothing;
  end if;

  update public.club_claim_invites
  set status = 'claimed', accepted_by = auth.uid(), accepted_at = now()
  where id = invite_row.id;
  return invite_row.club_id;
end;
$$;
revoke all on function public.accept_club_claim_invite(uuid) from public;
grant execute on function public.accept_club_claim_invite(uuid) to authenticated;
