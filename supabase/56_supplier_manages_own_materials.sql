-- Let a supplier maintain their own material list.
--
-- 54 made this table read-only for the supplier, on the reasoning that the
-- office set the agreed rates and the portal only offered them as a prefill.
-- 55 removed the rate: an entry is now a name, a unit and a description of
-- which material it is. There is nothing left on the row that the office needs
-- to own -- and the supplier is the one who knows their own catalogue, so
-- making them ask the admin to add "OPC 53 grade, Ultratech" is friction for
-- no benefit.
--
-- Run AFTER 55_supplier_material_description.sql.

-- Insert: only ever against their OWN supplier row. The app also resolves the
-- supplier from the session rather than the form, but this is the real gate --
-- a supplier cannot add an entry to someone else's list even if they forge the
-- request. Same reasoning as the supplier bill policy: RLS is the boundary,
-- not the UI (see 26/49 and the rls-is-the-authority brain page).
drop policy if exists "supplier_insert_own_materials" on public.supplier_materials;
create policy "supplier_insert_own_materials"
  on public.supplier_materials for insert
  with check (
    supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );

-- Update: so they can archive an entry they added. `using` and `with check`
-- both scope to their own supplier, which is what stops a row being moved onto
-- another supplier's list by updating supplier_id.
drop policy if exists "supplier_update_own_materials" on public.supplier_materials;
create policy "supplier_update_own_materials"
  on public.supplier_materials for update
  using (
    supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  )
  with check (
    supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );

-- Deliberately no DELETE policy. Removing an entry archives it here exactly as
-- it does everywhere else (10_archive.sql), so the list stops offering it
-- without throwing away what was once recorded.
