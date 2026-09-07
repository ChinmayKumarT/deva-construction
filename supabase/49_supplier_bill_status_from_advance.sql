-- Supersedes 48_supplier_bills_auto_paid.sql.
--
-- 48 wrote every supplier-recorded delivery straight to 'paid' and let the
-- advance ledger run negative to carry the debt. That stated the same debt
-- twice: the bill claimed the money had gone out while the ledger claimed it
-- was still owed. For a supplier who was never given an advance, "Total paid"
-- and "Remaining" both became fiction, and Remaining could only ever read
-- zero because no supplier bill was ever left outstanding.
--
-- The rule now: the advance ledger holds money actually handed over and never
-- drops below zero. A delivery is 'paid' only where an advance covered it --
-- the one case where money genuinely left already. Everything else is
-- 'approved', i.e. a real outstanding bill.
--
-- There is still no approval step and no "Mark paid" button; the status is
-- computed at insert time rather than clicked.
drop policy if exists "supplier_insert_own_payments" on public.payments;
create policy "supplier_insert_own_payments"
  on public.payments for insert
  with check (
    payee_type = 'supplier'
    and status in ('paid', 'approved')
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );
