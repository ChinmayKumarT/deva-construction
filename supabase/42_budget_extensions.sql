-- Track budget extensions as a separate history from change orders.
-- A change order logs extra scope ("add a balcony"); a budget extension
-- increases the available money without changing scope ("client approved
-- an additional ₹2L for the same work").
--
-- Admin-only create/archive/delete. Clients can see extensions on their
-- own project (read-only), same as change orders.

create table public.budget_extensions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index on public.budget_extensions(project_id);

alter table public.budget_extensions enable row level security;

create policy "staff_all_budget_extensions" on public.budget_extensions for all
  using (public.is_staff()) with check (public.is_staff());

create policy "client_own_budget_extensions" on public.budget_extensions for select
  using (project_id in (
    select p.id from public.projects p
    join public.clients c on c.id = p.client_id
    where c.profile_id = auth.uid()
  ));
