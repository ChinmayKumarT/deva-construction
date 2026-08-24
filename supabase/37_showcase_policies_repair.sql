-- Repair for 36_showcase.sql.
--
-- 36 was run through the Supabase SQL editor and only partly applied: the
-- tables were created, but the policies and the seed at the end were not.
-- The symptom is a table that exists and answers queries, yet returns zero
-- rows to the anonymous key — RLS is on, and with no SELECT policy the
-- correct behaviour is to show nothing rather than to raise an error.
--
-- Safe to run repeatedly, and safe to run even if 36 fully applied: every
-- statement drops before it creates.

alter table public.showcase_projects enable row level security;
alter table public.showcase_photos   enable row level security;

-- Table-level privileges. RLS decides which ROWS are visible; these decide
-- whether the role may touch the table at all. Both are required.
grant select on public.showcase_projects to anon, authenticated;
grant select on public.showcase_photos   to anon, authenticated;

drop policy if exists "staff_all_showcase_projects" on public.showcase_projects;
create policy "staff_all_showcase_projects" on public.showcase_projects
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff_all_showcase_photos" on public.showcase_photos;
create policy "staff_all_showcase_photos" on public.showcase_photos
  for all using (public.is_staff()) with check (public.is_staff());

-- Anonymous read of PUBLISHED rows only. Unpublished rows stay invisible to
-- the website entirely, so a draft cannot be read by guessing an id.
drop policy if exists "public_read_published_showcase" on public.showcase_projects;
create policy "public_read_published_showcase" on public.showcase_projects
  for select to anon, authenticated
  using (published = true);

-- Photos follow their parent: visible only while that project is published.
drop policy if exists "public_read_published_showcase_photos" on public.showcase_photos;
create policy "public_read_published_showcase_photos" on public.showcase_photos
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.showcase_projects s
      where s.id = showcase_id and s.published = true
    )
  );

-- Check: expect four policy rows, and rowsecurity true for both tables.
select tablename, policyname, roles::text, cmd
from pg_policies
where tablename in ('showcase_projects', 'showcase_photos')
order by tablename, policyname;
