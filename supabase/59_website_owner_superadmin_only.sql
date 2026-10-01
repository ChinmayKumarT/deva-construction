-- ============================================================
-- 59_website_owner_superadmin_only.sql
-- ============================================================
-- The Website section (showcase_projects / showcase_photos -- what the public
-- site at devaconstructions.in shows) is now managed by the superadmin and the
-- owner only. Admins and managers keep everything else but can no longer edit
-- what strangers see.
--
-- The app hides the nav item and guards the pages, but RLS is the wall
-- (see rls-is-the-authority), so the write policies change here too.
-- Public read of published rows (public_read_published_*) is untouched.
-- Run AFTER 57_apply_advance_to_material.sql.

create or replace function public.is_owner_or_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() = 'superadmin' or public.is_owner()
$$;

revoke all on function public.is_owner_or_superadmin() from public;
grant execute on function public.is_owner_or_superadmin() to authenticated;

drop policy if exists "staff_all_showcase_projects" on public.showcase_projects;
drop policy if exists "website_managers_all_showcase_projects" on public.showcase_projects;
create policy "website_managers_all_showcase_projects" on public.showcase_projects
  for all using (public.is_owner_or_superadmin()) with check (public.is_owner_or_superadmin());

drop policy if exists "staff_all_showcase_photos" on public.showcase_photos;
drop policy if exists "website_managers_all_showcase_photos" on public.showcase_photos;
create policy "website_managers_all_showcase_photos" on public.showcase_photos
  for all using (public.is_owner_or_superadmin()) with check (public.is_owner_or_superadmin());

-- Photo files: project-images accepts uploads from any signed-in user (project
-- updates need that), so fence off just the showcase/ prefix. A restrictive
-- policy is ANDed with the permissive ones; it only bites inside showcase/.
drop policy if exists "project_images_showcase_upload_restricted" on storage.objects;
create policy "project_images_showcase_upload_restricted"
  on storage.objects as restrictive for insert to authenticated
  with check (
    bucket_id <> 'project-images'
    or name not like 'showcase/%'
    or public.is_owner_or_superadmin()
  );
