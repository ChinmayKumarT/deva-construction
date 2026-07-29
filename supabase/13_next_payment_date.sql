-- Lets admin/manager set an upcoming payment due date per project, shown to
-- the client. Plain nullable column -- RLS already lets staff update
-- projects (staff_all_projects in 02_domain.sql) and clients read their own
-- (client_select_own_projects), so no new policy is needed.
alter table public.projects add column if not exists next_payment_date date;
