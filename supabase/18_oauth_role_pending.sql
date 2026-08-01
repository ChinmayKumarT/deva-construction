-- ---------- Google sign-in doesn't collect a role ----------
-- Email/password signup always sends role metadata (client or supplier), so
-- handle_new_user() clamps it safely. Google OAuth carries no such metadata
-- at all, so every Google signup silently landed as 'client' with no way for
-- the person to say otherwise. Track that explicitly and ask once, right
-- after their first sign-in.
alter table public.profiles add column if not exists role_pending boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.user_role;
begin
  safe_role := case requested_role
    when 'client' then 'client'::public.user_role
    when 'supplier' then 'supplier'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, role, role_pending)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    safe_role,
    requested_role is null
  );
  return new;
end;
$$;

-- Self-service, but narrow: column-level UPDATE on profiles.role is revoked
-- from authenticated (08_owner_admin_approval.sql) so this RPC is the only
-- way to set it outside set_user_role(). It can't be used to self-promote --
-- client/supplier only, one-shot (only fires while role_pending is true), and
-- scoped to auth.uid()'s own row. This is exactly the choice signup already
-- lets any client/supplier make for themselves; we're just deferring it for
-- the one flow (Google OAuth) that has nowhere to ask up front.
create or replace function public.choose_role(new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_role not in ('client', 'supplier') then
    raise exception 'Invalid role selection';
  end if;

  update public.profiles
  set role = new_role, role_pending = false
  where id = auth.uid() and role_pending;

  if not found then
    raise exception 'No pending role selection for this account';
  end if;
end;
$$;

grant execute on function public.choose_role(public.user_role) to authenticated;
