-- Self-serve client signup only ever created a `profiles` row -- the admin
-- had to separately add a `clients` record and use "Link to login" to
-- connect it, so a new client was invisible on the Clients page and in the
-- project-creation client dropdown until that manual step happened. Create
-- the `clients` row automatically instead, for both signup paths that can
-- land someone as role='client':
--
-- 1. Direct email/password signup, where the role is known immediately.
-- 2. Google OAuth, which has no role metadata -- handle_new_user() parks
--    the profile as role_pending until choose_role() (18_oauth_role_pending.sql)
--    confirms it. Only create the clients row once the role is confirmed,
--    since a pending signup might still end up choosing 'supplier'.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.user_role;
  full_name text := coalesce(new.raw_user_meta_data->>'full_name', '');
  pending boolean := requested_role is null;
begin
  safe_role := case requested_role
    when 'client' then 'client'::public.user_role
    when 'supplier' then 'supplier'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, role, role_pending)
  values (new.id, full_name, safe_role, pending);

  if safe_role = 'client' and not pending then
    insert into public.clients (profile_id, name, email)
    values (new.id, coalesce(nullif(trim(full_name), ''), new.email, 'New client'), new.email)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.choose_role(new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_profile record;
  acting_email text;
begin
  if new_role not in ('client', 'supplier') then
    raise exception 'Invalid role selection';
  end if;

  update public.profiles
  set role = new_role, role_pending = false
  where id = auth.uid() and role_pending
  returning id, full_name into acting_profile;

  if not found then
    raise exception 'No pending role selection for this account';
  end if;

  if new_role = 'client' then
    select email into acting_email from auth.users where id = auth.uid();
    insert into public.clients (profile_id, name, email)
    values (auth.uid(), coalesce(nullif(trim(acting_profile.full_name), ''), acting_email, 'New client'), acting_email)
    on conflict (profile_id) do nothing;
  end if;
end;
$$;

grant execute on function public.choose_role(public.user_role) to authenticated;
