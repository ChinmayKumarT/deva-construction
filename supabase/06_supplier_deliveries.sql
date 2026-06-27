-- Let suppliers self-record materials they've delivered.
-- Run AFTER 02_domain.sql.

-- Suppliers can insert materials where they are the supplier.
drop policy if exists "supplier_insert_own_materials" on public.materials;
create policy "supplier_insert_own_materials"
  on public.materials for insert
  with check (
    supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );

-- Suppliers can read the list of projects (name + id only matters for picking
-- a site to deliver to). We allow reading all projects for any authenticated user
-- because RLS still blocks them from any other table.
drop policy if exists "auth_read_projects" on public.projects;
create policy "auth_read_projects"
  on public.projects for select
  to authenticated
  using (true);
