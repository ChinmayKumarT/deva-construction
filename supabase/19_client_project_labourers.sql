-- Clients can now see which labourers worked their project. This is a
-- deliberate reversal of 17_client_wage_totals.sql's "no per-labourer
-- detail" stance -- that RPC stays as-is for the wage TOTAL (still no
-- individual wage figures leak), this one adds names/trade only, no money.
--
-- Same scoping pattern as my_project_wage_totals(): security-definer,
-- restricted to attendance rows on projects owned by the calling client.
create or replace function public.my_project_labourers()
returns table(project_id uuid, labourer_id uuid, labourer_name text, category text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct a.project_id, l.id as labourer_id, l.name as labourer_name, l.category
  from public.attendance a
  join public.labourers l on l.id = a.labourer_id
  where a.project_id in (
    select p.id
    from public.projects p
    join public.clients c on c.id = p.client_id
    where c.profile_id = auth.uid()
  )
  and l.archived_at is null;
$$;

grant execute on function public.my_project_labourers() to authenticated;
