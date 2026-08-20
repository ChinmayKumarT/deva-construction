-- Capture phone at signup so "Link to login" can auto-fill it later, the
-- same way full_name/email already do. Run AFTER 22_auto_create_client.sql
-- and 33_admin_profile_email.sql.
--
-- Before this, phone was never collected anywhere tied to an account -- only
-- typed manually into the Supplier/Client "Phone" field on each record, with
-- no link back to profiles/auth.users. There was nothing to auto-fill from.

alter table public.profiles add column if not exists phone text;

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
  phone text := nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '');
  pending boolean := requested_role is null;
begin
  safe_role := case requested_role
    when 'client' then 'client'::public.user_role
    when 'supplier' then 'supplier'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, role, role_pending, phone)
  values (new.id, full_name, safe_role, pending, phone);

  if safe_role = 'client' and not pending then
    insert into public.clients (profile_id, name, email, phone)
    values (new.id, coalesce(nullif(trim(full_name), ''), new.email, 'New client'), new.email, phone)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

-- Return signature changed (added phone) -- CREATE OR REPLACE can't do that
-- for a function returning TABLE, so drop first.
drop function if exists public.admin_list_profiles_with_email(public.user_role);
create function public.admin_list_profiles_with_email(p_role public.user_role)
returns table (id uuid, full_name text, email text, phone text)
language sql security definer set search_path = public
as $$
  select p.id, p.full_name, u.email, p.phone
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_staff() and p.role = p_role
$$;

revoke all on function public.admin_list_profiles_with_email(public.user_role) from public;
grant execute on function public.admin_list_profiles_with_email(public.user_role) to authenticated;

-- Same phone hand-off for the choose_role() path (Google OAuth signups,
-- which have no phone metadata at all -- coalesces to null, same as before).
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
  returning id, full_name, phone into acting_profile;

  if not found then
    raise exception 'No pending role selection for this account';
  end if;

  if new_role = 'client' then
    select email into acting_email from auth.users where id = auth.uid();
    insert into public.clients (profile_id, name, email, phone)
    values (auth.uid(), coalesce(nullif(trim(acting_profile.full_name), ''), acting_email, 'New client'), acting_email, acting_profile.phone)
    on conflict (profile_id) do nothing;
  end if;
end;
$$;

grant execute on function public.choose_role(public.user_role) to authenticated;
