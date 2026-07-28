-- Reversible archive for business records.
-- Run AFTER 09_project_date_extension.sql.
--
-- Why archive rather than DELETE: the foreign keys in 02_domain.sql cascade.
-- Deleting a project would permanently destroy every row in materials,
-- project_labourers and project_updates for that project -- i.e. material cost
-- records and all progress photos. Deleting a labourer would cascade to
-- attendance, wiping their wage history. That contradicts the retention promise
-- in the privacy policy ("Business records ... are kept by the construction
-- company for accounting and audit purposes"), so the UI's "delete" sets
-- archived_at instead: the row disappears from lists but nothing is lost, and
-- it can be restored. labourers.active already set this soft-disable precedent.
--
-- No RLS changes needed: the staff_all_* policies in 02_domain.sql are `for all`,
-- which already covers the UPDATE these operations use.

alter table public.projects   add column if not exists archived_at timestamptz;
alter table public.clients    add column if not exists archived_at timestamptz;
alter table public.suppliers  add column if not exists archived_at timestamptz;
alter table public.labourers  add column if not exists archived_at timestamptz;
alter table public.materials  add column if not exists archived_at timestamptz;
alter table public.payments   add column if not exists archived_at timestamptz;

-- Only projects gets archive UI in this pass; the other columns are added now so
-- extending the same pattern to those entities needs no further migration.

-- Every list query filters `archived_at is null`, so index that specific case.
create index if not exists projects_active_idx  on public.projects(archived_at) where archived_at is null;
create index if not exists materials_active_idx on public.materials(archived_at) where archived_at is null;
create index if not exists payments_active_idx  on public.payments(archived_at)  where archived_at is null;
