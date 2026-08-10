-- Lets admin/manager attach a photo of the signed client agreement to a
-- project, viewable by the project's client too. Uses the existing
-- project-images storage bucket (03_storage.sql) -- no new bucket or
-- storage policy needed. No new RLS policy either: staff_all_projects
-- (02_domain.sql) already covers admin/manager read+write, and
-- client_own_projects already covers the client's read-only view.
alter table public.projects add column if not exists agreement_image_url text;
