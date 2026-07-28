-- Owner-gated admin/manager access.
-- Run AFTER 07_supplier_bills.sql.
--
-- Problem this closes: handle_new_user() (schema.sql) trusted whatever role the
-- signup client sent, so anyone could pick "admin" at signup. Separately,
-- profiles_update_self (schema.sql) let any signed-in user UPDATE any column on
-- their own row -- including role -- with no restriction, so even without the
-- signup picker, a direct Postgrest call could self-promote to admin. And
-- staff_update_profiles (05_profiles_staff_access.sql) let any existing
-- admin/manager change *anyone's* role. Manager has identical database power to
-- admin (see is_staff() in 02_domain.sql), so both are gated the same way here.
--
-- Fix: a single "owner" flag, a security-definer RPC as the only path that can
-- ever write `role`, and a column-level privilege revocation so nothing else --
-- no RLS policy, present or future -- can write `role` or `is_owner` directly.

-- ---------- Owner flag ----------
alter table public.profiles add column if not exists is_owner boolean not null default false;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.profiles where id = auth.uid()), false)
$$;

-- ---------- Column-level lockdown ----------
-- Column privileges are checked independently of RLS: even a policy that
-- returns true cannot write a column that hasn't been granted. This is what
-- actually stops a raw API call from setting role/is_owner, regardless of any
-- policy mistake now or later.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- staff no longer get a blanket write policy on profiles; role changes only
-- ever happen through set_user_role() below. Reading all profiles (for the
-- admin "Link to login" dropdowns) is untouched -- staff_read_profiles stays.
drop policy if exists "staff_update_profiles" on public.profiles;

-- ---------- Signup can never produce admin/manager ----------
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
    when 'labour' then 'labour'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    safe_role
  );
  return new;
end;
$$;

-- ---------- Owner-only role changes ----------
create or replace function public.set_user_role(target_id uuid, new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can change roles';
  end if;
  update public.profiles set role = new_role where id = target_id;
end;
$$;

revoke all on function public.set_user_role(uuid, public.user_role) from public;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

-- ---------- One-time bootstrap (run manually, once) ----------
-- The real owner must sign up through the app first (any role -- it will be
-- clamped to client by the trigger above), then run this by hand in the
-- Supabase SQL editor to grant themselves owner + admin:
--
--   update public.profiles set is_owner = true, role = 'admin'
--   where id = (select id from auth.users where email = 'chinmaykumart04@gmail.com');
