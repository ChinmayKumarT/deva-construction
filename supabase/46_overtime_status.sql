-- Add overtime status to attendance (1.5x daily wage).
alter type public.attendance_status add value 'overtime';

-- Update the staff wage-accrued function to include overtime.
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
             when 'present'  then 1.0
             when 'half_day' then 0.5
             when 'overtime'  then 1.5
             else 0.0
           end * l.daily_wage
         ), 0)
  from public.attendance a
  join public.labourers l on l.id = a.labourer_id
  where a.project_id is not null and public.is_staff()
  group by a.project_id, a.labourer_id;
$$;

-- Update the client wage-totals function to include overtime.
create or replace function public.my_project_wage_totals()
returns table(project_id uuid, wage_total numeric)
language sql
security definer
set search_path = public
as $$
  select a.project_id,
         coalesce(sum(
           case a.status
             when 'present'  then 1.0
             when 'half_day' then 0.5
             when 'overtime'  then 1.5
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
