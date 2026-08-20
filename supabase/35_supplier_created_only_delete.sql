-- Suppliers may only delete (archive) materials/payments THEY created --
-- not admin-entered deliveries or admin-approved bills for the same supplier.
-- Run AFTER 32_supplier_archive.sql.
--
-- 32_supplier_archive.sql scoped the supplier update policy to
-- `supplier_id in (their supplier row)`, which covers every row for that
-- supplier regardless of who entered it -- so a supplier could delete a
-- payment/material the admin/owner created and approved on their behalf.
-- This adds an explicit ownership flag set only by the supplier-facing
-- recordDelivery/generateBill actions, and requires it in the policy.

alter table public.materials add column if not exists created_by_supplier boolean not null default false;
alter table public.payments  add column if not exists created_by_supplier boolean not null default false;

drop policy if exists "supplier_update_own_materials" on public.materials;
create policy "supplier_update_own_materials"
  on public.materials for update
  using (
    created_by_supplier
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  )
  with check (
    created_by_supplier
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );

drop policy if exists "supplier_update_own_payments" on public.payments;
create policy "supplier_update_own_payments"
  on public.payments for update
  using (
    created_by_supplier
    and payee_type = 'supplier'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  )
  with check (
    created_by_supplier
    and payee_type = 'supplier'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );
