-- Allow admin and manager users to read all profiles, so the
-- "Link to login" dropdown in /admin/clients, /admin/suppliers, /admin/labourers
-- can list everyone who has signed up.
--
-- Run AFTER 02_domain.sql (which defines public.is_staff()).
-- Safe to re-run; uses drop policy if exists.

drop policy if exists "staff_read_profiles" on public.profiles;

create policy "staff_read_profiles"
  on public.profiles for select
  using (public.is_staff());

-- Optional: also let staff update any profile (e.g. change a user's role).
drop policy if exists "staff_update_profiles" on public.profiles;

create policy "staff_update_profiles"
  on public.profiles for update
  using (public.is_staff())
  with check (public.is_staff());
