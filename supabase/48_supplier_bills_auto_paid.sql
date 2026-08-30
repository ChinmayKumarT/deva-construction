-- Supplier-submitted bills settle themselves. Recording the delivery IS the
-- payment event now: the cost comes straight off the supplier's advance
-- ledger, so there is no separate moment for an admin to confirm and no
-- "Mark paid" button left to click. 26_supplier_bills_auto_approved.sql
-- required status = 'approved' on this insert; that check is what made the
-- manual step mandatory, so it moves to 'paid'.
--
-- The advance balance is allowed to go negative. A negative balance is the
-- real "what we still owe this supplier" figure, and is why nothing is lost
-- by dropping the approved→paid pause.
drop policy if exists "supplier_insert_own_payments" on public.payments;
create policy "supplier_insert_own_payments"
  on public.payments for insert
  with check (
    payee_type = 'supplier'
    and status = 'paid'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );

-- Bills already sitting in 'approved' have no UI left to settle them, so
-- close them out. Deliberately NOT creating matching advance deductions for
-- these: that would rewrite ledger history for money already accounted for.
update public.payments
   set status = 'paid',
       paid_at = coalesce(paid_at, approved_at, created_at)
 where payee_type = 'supplier'
   and status = 'approved'
   and archived_at is null;
