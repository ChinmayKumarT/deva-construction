-- Lets a supplier attach a photo of what was actually delivered, so admin
-- can visually check it against the recorded quantity/status without a
-- site visit. Optional, not required. Uses the existing project-images
-- storage bucket (03_storage.sql already allows any authenticated user to
-- upload there, not just staff) -- no new bucket or policy needed.
alter table public.materials add column if not exists image_url text;
