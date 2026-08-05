-- Tracks how much is outstanding for the currently-set "next payment due"
-- reminder, so a client payment can be checked against it instead of
-- blindly clearing the reminder on any payment regardless of amount. A
-- partial payment reduces this balance instead of clearing the due date;
-- the reminder only clears once it reaches zero. See app logic in
-- createClientPayment (app/admin/actions.ts, Repository.kt).
alter table public.projects add column if not exists next_payment_amount numeric(14,2);
