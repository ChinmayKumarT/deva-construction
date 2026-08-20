-- Let suppliers archive (soft-delete) their own delivery and payment records.
-- Run AFTER 02_domain.sql and 10_archive.sql.
--
-- supplier_own_materials / supplier_own_payments (02_domain.sql) only grant
-- SELECT, so the "Delete" buttons on the supplier dashboard were updating
-- archived_at but RLS silently dropped the write (0 rows affected, no error).

drop policy if exists "supplier_update_own_materials" on public.materials;
create policy "supplier_update_own_materials"
  on public.materials for update
  using (
    supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  )
  with check (
    supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );

drop policy if exists "supplier_update_own_payments" on public.payments;
create policy "supplier_update_own_payments"
  on public.payments for update
  using (
    payee_type = 'supplier'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  )
  with check (
    payee_type = 'supplier'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );
