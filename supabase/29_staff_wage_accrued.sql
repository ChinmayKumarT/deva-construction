-- The Payments pages (index and per-project) only need a small per
-- (project, labourer) wage-accrued total to auto-fill the amount when
-- creating a wage payment -- but they were fetching the ENTIRE attendance
-- table (every day, every labourer, ever) just to sum it client-side. That
-- full-table fetch runs again after every single payment create (Next.js
-- re-renders the page's whole data fetch), which is a real source of the
-- "why is create payment slow" latency as the table grows.
--
-- Same security-definer pattern as my_project_wage_totals() in
-- 17_client_wage_totals.sql, but staff-scoped (admin/manager) and broken
-- out per labourer instead of only per project, since the Payments pages
-- need per-labourer amounts. Does the sum in Postgres and returns one row
-- per (project, labourer) pair that has any attendance, instead of one row
-- per attendance day -- a much smaller, roughly-constant-size result
-- instead of one that grows forever.
create or replace function public.staff_labourer_wage_accrued()
returns table(project_id uuid, labourer_id uuid, accrued numeric)
language sql
stable
security definer
set search_path = public
as $$
  select a.project_id, a.labourer_id,
         coalesce(sum(
           case a.status
             when 'present' then 1.0
             when 'half_day' then 0.5
             else 0.0
           end * l.daily_wage
         ), 0)
  from public.attendance a
  join public.labourers l on l.id = a.labourer_id
  where a.project_id is not null and public.is_staff()
  group by a.project_id, a.labourer_id;
$$;

grant execute on function public.staff_labourer_wage_accrued() to authenticated;
