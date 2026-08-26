-- Add superadmin role — sits above admin, has Team Access.
-- Regular admin keeps all other permissions but cannot manage team roles.
--
-- IMPORTANT: Postgres requires ALTER TYPE ADD VALUE to be committed before
-- the new value can be referenced. Run this file in TWO separate executions:
--
--   Step 1: run ONLY the ALTER TYPE line below, then commit.
--   Step 2: run everything from "-- Step 2" onward.

-- Step 1
alter type public.user_role add value if not exists 'superadmin' before 'admin';

-- Step 2 (run after Step 1 is committed)

-- Superadmin is staff.
create or replace function public.is_staff() returns boolean
language sql stable as $$
  select public.current_role() in ('superadmin','admin','manager')
$$;

-- Superadmin counts as admin for all existing admin-gated features.
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select public.current_role() in ('superadmin','admin')
$$;

-- Update handle_new_user: superadmin is never self-serve.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  reserved public.user_role;
  safe_role public.user_role;
begin
  select r.role into reserved
    from public.role_reservations r
   where r.email = lower(new.email);

  if reserved is not null then
    safe_role := reserved;
    delete from public.role_reservations where email = lower(new.email);
  else
    safe_role := case requested_role
      when 'client' then 'client'::public.user_role
      when 'supplier' then 'supplier'::public.user_role
      else 'client'::public.user_role
    end;
  end if;

  insert into public.profiles (id, full_name, role, role_pending)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    safe_role,
    reserved is null and requested_role is null
  );
  return new;
end;
$$;
