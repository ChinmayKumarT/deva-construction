-- Archive for website showcase projects.
-- Run AFTER 37_showcase_policies_repair.sql.
--
-- Matches the soft-delete pattern the rest of the app already uses (see
-- 10_archive.sql): "delete" that can be undone, with the genuinely permanent
-- delete kept as a separate, deliberate action.
--
-- Archiving is not the same as unpublishing, and both are worth having:
--   unpublish  — temporarily off the website, still in the working list.
--                For a project being edited, or held back for a client.
--   archive    — finished with. Out of the working list AND off the website,
--                but recoverable. For old work that no longer represents the
--                firm, where deleting would throw away the write-up and the
--                photographs for no reason.

alter table public.showcase_projects
  add column if not exists archived_at timestamptz;

create index if not exists showcase_projects_archived_at_idx
  on public.showcase_projects(archived_at);

-- The public site must never show an archived project, even one still marked
-- published. Enforcing it here rather than in the website's query means the
-- rule cannot be forgotten by a future caller — the same reason `published`
-- is checked in the policy rather than in the query.
drop policy if exists "public_read_published_showcase" on public.showcase_projects;
create policy "public_read_published_showcase" on public.showcase_projects
  for select to anon, authenticated
  using (published = true and archived_at is null);

-- Photos follow their parent, so they inherit both conditions.
drop policy if exists "public_read_published_showcase_photos" on public.showcase_photos;
create policy "public_read_published_showcase_photos" on public.showcase_photos
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.showcase_projects s
      where s.id = showcase_id
        and s.published = true
        and s.archived_at is null
    )
  );

-- Check: expect the two public_read policies to mention archived_at.
select policyname, qual
from pg_policies
where tablename in ('showcase_projects', 'showcase_photos')
  and policyname like 'public_read%';
