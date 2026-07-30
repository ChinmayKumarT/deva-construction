-- Clients have no access to the attendance / labourers tables (labour info is
-- admin/manager only). But the admin "Spent" figure now includes wages accrued
-- from attendance, so without this a client would see a LOWER Spent than the
-- admin for the same project, and think more budget remains than actually does.
--
-- This security-definer function closes that gap while leaking nothing about
-- individual labourers: it returns only a per-project TOTAL, and only for
-- projects owned by the calling client (scoped by auth.uid()). A client calls
-- it once and gets the wage total for each of their own projects; anyone else
-- gets no rows.
--
-- The wage weighting (present = full daily wage, half day = 50%, absent = 0)
-- mirrors lib/wages.ts and the admin cost/report calculations exactly.
create or replace function public.my_project_wage_totals()
returns table(project_id uuid, wage_total numeric)
language sql
security definer
set search_path = public
as $$
  select a.project_id,
         coalesce(sum(
           case a.status
             when 'present' then 1.0
             when 'half_day' then 0.5
             else 0.0
           end * l.daily_wage
         ), 0)
  from public.attendance a
  join public.labourers l on l.id = a.labourer_id
  where a.project_id in (
    select p.id
    from public.projects p
    join public.clients c on c.id = p.client_id
    where c.profile_id = auth.uid()
  )
  group by a.project_id;
$$;

-- Callable by any signed-in user; the WHERE clause is what scopes the result
-- to the caller's own projects, so this grant leaks nothing.
grant execute on function public.my_project_wage_totals() to authenticated;
