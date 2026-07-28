-- Completes the archive columns started in 10_archive.sql.
-- project_updates was the one table left out; it needs the same treatment now
-- that admin can archive individual progress updates.
-- Run AFTER 10_archive.sql.

alter table public.project_updates add column if not exists archived_at timestamptz;

create index if not exists project_updates_active_idx
  on public.project_updates(archived_at) where archived_at is null;
