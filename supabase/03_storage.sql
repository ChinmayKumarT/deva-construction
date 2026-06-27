-- Storage bucket for project update photos.
-- Run AFTER 02_domain.sql.

insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do nothing;

-- Public read (bucket is public, but explicit policy is clearer).
create policy "project_images_public_read"
  on storage.objects for select
  using (bucket_id = 'project-images');

-- Any authenticated user can upload (staff posts updates; later we can tighten to staff-only).
create policy "project_images_authenticated_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-images');

-- Authors can delete their own files.
create policy "project_images_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-images' and owner = auth.uid());
