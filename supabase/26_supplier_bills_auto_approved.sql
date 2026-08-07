-- Supplier-submitted bills no longer need a manual admin review step --
-- suppliers are trusted, so a self-submitted bill counts toward project
-- costs immediately instead of sitting in "pending" until someone clicks
-- Approve. "Mark paid" stays a separate, admin-only action: that reflects
-- money actually having changed hands, a real event admin controls, not
-- something a supplier's own submission should be able to claim.
drop policy if exists "supplier_insert_own_payments" on public.payments;
create policy "supplier_insert_own_payments"
  on public.payments for insert
  with check (
    payee_type = 'supplier'
    and status = 'approved'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );
