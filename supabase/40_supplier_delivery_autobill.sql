-- Link a supplier bill to the delivery it bills.
--
-- Recording a delivery and billing for it are one real-world event, but the
-- app made them two disconnected forms: a supplier filled in "Record
-- delivery" (a materials row), then had to separately fill in "Generate
-- bill" (a payments row) before the admin's books showed anything owed. If
-- they skipped the second form the goods were on site and the debt was
-- invisible. recordDelivery() now creates the bill itself.
--
-- That needs a link back. Until now the only connection between the two
-- tables was materials.billed (28_material_billed.sql), a one-way boolean
-- saying "something has been paid for this" with no record of which payment.
-- Without a real reference, removing the supplier's "Generate bill" form
-- would leave them able to delete a delivery while its bill stayed behind,
-- with no UI left to remove it.
--
-- Run AFTER 28_material_billed.sql.

alter table public.payments
  add column if not exists material_id uuid references public.materials(id) on delete set null;

-- One bill per delivery, enforced by the database rather than by whichever
-- code path happens to run. Partial so the many legitimately unlinked rows
-- (labour wages, admin-entered bills, every payment predating this column)
-- are unaffected.
create unique index if not exists payments_material_id_key
  on public.payments(material_id) where material_id is not null;

-- No RLS change is needed. supplier_insert_own_payments
-- (26_supplier_bills_auto_approved.sql) already requires status = 'approved',
-- which is what the auto-created bill uses, and supplier_update_own_payments
-- (35_supplier_created_only_delete.sql) already lets a supplier archive a row
-- carrying created_by_supplier = true. Neither policy restricts columns, so
-- material_id passes through both.
