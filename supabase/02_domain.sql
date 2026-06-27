-- Domain schema for the construction management app.
-- Run AFTER supabase/schema.sql (which creates profiles + user_role enum).

-- ---------- Enums ----------
create type public.project_status as enum ('planned', 'active', 'on_hold', 'completed', 'cancelled');
create type public.payment_status as enum ('pending', 'approved', 'paid', 'rejected');
create type public.payee_type     as enum ('supplier', 'labour');
create type public.attendance_status as enum ('present', 'absent', 'half_day');
create type public.material_status   as enum ('ordered', 'delivered', 'returned');

-- ---------- Helper: current user's role ----------
create or replace function public.current_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable as $$
  select public.current_role() in ('admin','manager')
$$;

-- ---------- Clients ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- ---------- Suppliers ----------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- ---------- Labourers ----------
create table public.labourers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  daily_wage numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Projects (a.k.a. sites) ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  address text,
  status public.project_status not null default 'planned',
  current_stage text,
  start_date date,
  end_date date,
  total_cost numeric(14,2) not null default 0,
  completion_pct numeric(5,2) not null default 0 check (completion_pct between 0 and 100),
  created_at timestamptz not null default now()
);

create index on public.projects(client_id);
create index on public.projects(status);

-- Assignments: labourers to projects (so a labourer's "current site" can be derived)
create table public.project_labourers (
  project_id uuid not null references public.projects(id) on delete cascade,
  labourer_id uuid not null references public.labourers(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  primary key (project_id, labourer_id)
);

-- ---------- Materials ----------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  unit text not null default 'unit',
  quantity numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  status public.material_status not null default 'ordered',
  ordered_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index on public.materials(project_id);
create index on public.materials(supplier_id);

-- ---------- Payments / bills ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  payee_type public.payee_type not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  labourer_id uuid references public.labourers(id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  description text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  paid_at timestamptz,
  check (
    (payee_type = 'supplier' and supplier_id is not null and labourer_id is null) or
    (payee_type = 'labour'   and labourer_id is not null and supplier_id is null)
  )
);

create index on public.payments(project_id);
create index on public.payments(supplier_id);
create index on public.payments(labourer_id);
create index on public.payments(status);

-- ---------- Attendance ----------
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  labourer_id uuid not null references public.labourers(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  date date not null default current_date,
  status public.attendance_status not null default 'present',
  check_in timestamptz,
  check_out timestamptz,
  created_at timestamptz not null default now(),
  unique (labourer_id, date)
);

create index on public.attendance(date);
create index on public.attendance(project_id);

-- ---------- Project updates (progress notes + images) ----------
create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  stage text,
  note text,
  image_url text,
  created_at timestamptz not null default now()
);

create index on public.project_updates(project_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.clients          enable row level security;
alter table public.suppliers        enable row level security;
alter table public.labourers        enable row level security;
alter table public.projects         enable row level security;
alter table public.project_labourers enable row level security;
alter table public.materials        enable row level security;
alter table public.payments         enable row level security;
alter table public.attendance       enable row level security;
alter table public.project_updates  enable row level security;

-- Staff (admin/manager) get full access on everything.
create policy "staff_all_clients"           on public.clients          for all using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_suppliers"         on public.suppliers        for all using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_labourers"         on public.labourers        for all using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_projects"          on public.projects         for all using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_project_labourers" on public.project_labourers for all using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_materials"         on public.materials        for all using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_payments"          on public.payments         for all using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_attendance"        on public.attendance       for all using (public.is_staff()) with check (public.is_staff());
create policy "staff_all_project_updates"   on public.project_updates  for all using (public.is_staff()) with check (public.is_staff());

-- Clients: see own profile row, own projects, updates, and materials/payments on those projects.
create policy "client_self" on public.clients for select
  using (profile_id = auth.uid());

create policy "client_own_projects" on public.projects for select
  using (client_id in (select id from public.clients where profile_id = auth.uid()));

create policy "client_own_project_updates" on public.project_updates for select
  using (project_id in (
    select p.id from public.projects p
    join public.clients c on c.id = p.client_id
    where c.profile_id = auth.uid()
  ));

create policy "client_own_materials" on public.materials for select
  using (project_id in (
    select p.id from public.projects p
    join public.clients c on c.id = p.client_id
    where c.profile_id = auth.uid()
  ));

create policy "client_own_payments" on public.payments for select
  using (project_id in (
    select p.id from public.projects p
    join public.clients c on c.id = p.client_id
    where c.profile_id = auth.uid()
  ));

-- Suppliers: see their own profile, materials they supply, and payments owed to them.
create policy "supplier_self" on public.suppliers for select
  using (profile_id = auth.uid());

create policy "supplier_own_materials" on public.materials for select
  using (supplier_id in (select id from public.suppliers where profile_id = auth.uid()));

create policy "supplier_own_payments" on public.payments for select
  using (supplier_id in (select id from public.suppliers where profile_id = auth.uid()));

-- Labourers: see their own profile, assignments, attendance, and wages.
create policy "labour_self" on public.labourers for select
  using (profile_id = auth.uid());

create policy "labour_own_assignments" on public.project_labourers for select
  using (labourer_id in (select id from public.labourers where profile_id = auth.uid()));

create policy "labour_own_attendance" on public.attendance for select
  using (labourer_id in (select id from public.labourers where profile_id = auth.uid()));

-- Labourers may insert their own attendance (for self-check-in).
create policy "labour_insert_own_attendance" on public.attendance for insert
  with check (labourer_id in (select id from public.labourers where profile_id = auth.uid()));

create policy "labour_own_payments" on public.payments for select
  using (labourer_id in (select id from public.labourers where profile_id = auth.uid()));

-- Projects visibility for labourers (so they can see their assigned site).
create policy "labour_assigned_projects" on public.projects for select
  using (id in (
    select pl.project_id from public.project_labourers pl
    join public.labourers l on l.id = pl.labourer_id
    where l.profile_id = auth.uid()
  ));
