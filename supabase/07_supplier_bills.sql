-- Let suppliers submit their own bills (insert pending payments).
-- Run AFTER 02_domain.sql.

drop policy if exists "supplier_insert_own_payments" on public.payments;
create policy "supplier_insert_own_payments"
  on public.payments for insert
  with check (
    payee_type = 'supplier'
    and status = 'pending'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );
