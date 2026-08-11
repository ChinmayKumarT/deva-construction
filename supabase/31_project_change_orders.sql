-- Logs extra scope a client asks for mid-project (e.g. "add a balcony"),
-- with the cost it adds to the project's budget. total_cost was previously
-- a single flat number with no history of why it changed -- this gives that
-- a place to live. Admin-only (the client role has no write access anywhere
-- in this app), same shape as materials/payments (project_id FK,
-- archived_at soft-delete convention).
create table public.project_change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  work_category text,
  extra_cost numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index on public.project_change_orders(project_id);

alter table public.project_change_orders enable row level security;

create policy "staff_all_change_orders" on public.project_change_orders for all
  using (public.is_staff()) with check (public.is_staff());

-- Read-only for clients -- lets them see what's been logged against their
-- project. No insert policy: change orders are admin-logged only.
create policy "client_own_change_orders" on public.project_change_orders for select
  using (project_id in (
    select p.id from public.projects p
    join public.clients c on c.id = p.client_id
    where c.profile_id = auth.uid()
  ));
