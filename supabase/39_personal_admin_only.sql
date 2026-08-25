-- Narrow personal_transactions from staff (admin + manager) to admin only.
--
-- 21_personal_transactions.sql created this table as "Admin's own personal
-- income/expense log -- has nothing to do with any construction project",
-- then gave it a policy of public.is_staff(), which resolves to
-- role in ('admin','manager'). So every site manager could read, edit and
-- delete the owner's private ledger. That was a mismatch between the stated
-- intent and the policy, not a decision.
--
-- Run AFTER 21_personal_transactions.sql.

-- Helper mirroring is_staff()/is_owner(), so future policies that mean
-- "admin but not manager" have a name to use instead of repeating the
-- literal.
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select public.current_role() = 'admin'
$$;

drop policy if exists "staff_all_personal_transactions" on public.personal_transactions;

create policy "admin_all_personal_transactions" on public.personal_transactions
  for all using (public.is_admin()) with check (public.is_admin());

-- Note on the app side: the Personal section is hidden from the manager
-- sidebar (app/admin/layout.tsx) and the page redirects managers
-- (app/admin/personal/page.tsx), but this policy is the actual boundary --
-- it also covers a manager calling the server actions directly or querying
-- the table with the anon key from the Android client.
