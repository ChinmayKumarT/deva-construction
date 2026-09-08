-- ============================================================
-- FULL SETUP -- run once, top to bottom, on a FRESH database.
--
-- Every migration concatenated in order, for standing up a new Supabase
-- project (a dev/test database) without pasting fifty files by hand.
--
-- DO NOT run this against a database that already has these objects. It is
-- for a brand-new project only.
--
-- Deliberately NOT included:
--   50_repair_negative_advances.sql -- a one-off repair for production data
--                                      written under the old advance rule.
--                                      Nothing to repair on a fresh database.
--   test_data.sql                   -- the seed. Run it AFTER this file.
--
-- Two manual steps afterwards:
--   1. Seed:  run test_data.sql
--   2. Owner: sign up through the app, then run
--        update public.profiles set is_owner = true, role = 'admin'
--        where id = (select id from auth.users where email = 'you@example.com');
--
-- Regenerate with:  bash supabase/build-setup-all.sh
-- ============================================================



-- ============================================================
-- schema.sql
-- ============================================================

-- Run this in the Supabase SQL editor.

create type public.user_role as enum ('admin', 'manager', 'client', 'supplier', 'labour');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'client',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_self"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
-- The role can be passed via signUp options.data.role; defaults to 'client'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'client')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 02_domain.sql
-- ============================================================

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


-- ============================================================
-- 03_storage.sql
-- ============================================================

-- Storage bucket for project update photos.
-- Run AFTER 02_domain.sql.

insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do nothing;

-- Public read (bucket is public, but explicit policy is clearer).
create policy "project_images_public_read"
  on storage.objects for select
  using (bucket_id = 'project-images');

-- Any authenticated user can upload (staff posts updates; later we can tighten to staff-only).
create policy "project_images_authenticated_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-images');

-- Authors can delete their own files.
create policy "project_images_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-images' and owner = auth.uid());


-- ============================================================
-- 04_account.sql
-- ============================================================

-- Self-service account deletion.
-- Run AFTER 02_domain.sql.
-- Deleting the auth.users row cascades to public.profiles (FK on delete cascade),
-- which in turn nulls out profile_id on clients/suppliers/labourers (on delete set null),
-- so domain rows (projects, materials, etc.) are NOT lost — only the login is.
--
-- If you want to ALSO wipe the linked clients/suppliers/labourers row, extend this fn.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;


-- ============================================================
-- 05_profiles_staff_access.sql
-- ============================================================

-- Allow admin and manager users to read all profiles, so the
-- "Link to login" dropdown in /admin/clients, /admin/suppliers, /admin/labourers
-- can list everyone who has signed up.
--
-- Run AFTER 02_domain.sql (which defines public.is_staff()).
-- Safe to re-run; uses drop policy if exists.

drop policy if exists "staff_read_profiles" on public.profiles;

create policy "staff_read_profiles"
  on public.profiles for select
  using (public.is_staff());

-- Optional: also let staff update any profile (e.g. change a user's role).
drop policy if exists "staff_update_profiles" on public.profiles;

create policy "staff_update_profiles"
  on public.profiles for update
  using (public.is_staff())
  with check (public.is_staff());


-- ============================================================
-- 06_supplier_deliveries.sql
-- ============================================================

-- Let suppliers self-record materials they've delivered.
-- Run AFTER 02_domain.sql.

-- Suppliers can insert materials where they are the supplier.
drop policy if exists "supplier_insert_own_materials" on public.materials;
create policy "supplier_insert_own_materials"
  on public.materials for insert
  with check (
    supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );

-- Suppliers can read the list of projects (name + id only matters for picking
-- a site to deliver to). We allow reading all projects for any authenticated user
-- because RLS still blocks them from any other table.
drop policy if exists "auth_read_projects" on public.projects;
create policy "auth_read_projects"
  on public.projects for select
  to authenticated
  using (true);


-- ============================================================
-- 07_supplier_bills.sql
-- ============================================================

-- Let suppliers submit their own bills (insert pending payments).
-- Run AFTER 02_domain.sql.

drop policy if exists "supplier_insert_own_payments" on public.payments;
create policy "supplier_insert_own_payments"
  on public.payments for insert
  with check (
    payee_type = 'supplier'
    and status = 'pending'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );


-- ============================================================
-- 08_owner_admin_approval.sql
-- ============================================================

-- Owner-gated admin/manager access.
-- Run AFTER 07_supplier_bills.sql.
--
-- Problem this closes: handle_new_user() (schema.sql) trusted whatever role the
-- signup client sent, so anyone could pick "admin" at signup. Separately,
-- profiles_update_self (schema.sql) let any signed-in user UPDATE any column on
-- their own row -- including role -- with no restriction, so even without the
-- signup picker, a direct Postgrest call could self-promote to admin. And
-- staff_update_profiles (05_profiles_staff_access.sql) let any existing
-- admin/manager change *anyone's* role. Manager has identical database power to
-- admin (see is_staff() in 02_domain.sql), so both are gated the same way here.
--
-- Fix: a single "owner" flag, a security-definer RPC as the only path that can
-- ever write `role`, and a column-level privilege revocation so nothing else --
-- no RLS policy, present or future -- can write `role` or `is_owner` directly.

-- ---------- Owner flag ----------
alter table public.profiles add column if not exists is_owner boolean not null default false;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.profiles where id = auth.uid()), false)
$$;

-- ---------- Column-level lockdown ----------
-- Column privileges are checked independently of RLS: even a policy that
-- returns true cannot write a column that hasn't been granted. This is what
-- actually stops a raw API call from setting role/is_owner, regardless of any
-- policy mistake now or later.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- staff no longer get a blanket write policy on profiles; role changes only
-- ever happen through set_user_role() below. Reading all profiles (for the
-- admin "Link to login" dropdowns) is untouched -- staff_read_profiles stays.
drop policy if exists "staff_update_profiles" on public.profiles;

-- ---------- Signup can never produce admin/manager ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.user_role;
begin
  safe_role := case requested_role
    when 'client' then 'client'::public.user_role
    when 'supplier' then 'supplier'::public.user_role
    when 'labour' then 'labour'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    safe_role
  );
  return new;
end;
$$;

-- ---------- Owner-only role changes ----------
create or replace function public.set_user_role(target_id uuid, new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can change roles';
  end if;
  update public.profiles set role = new_role where id = target_id;
end;
$$;

revoke all on function public.set_user_role(uuid, public.user_role) from public;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

-- ---------- One-time bootstrap (run manually, once) ----------
-- The real owner must sign up through the app first (any role -- it will be
-- clamped to client by the trigger above), then run this by hand in the
-- Supabase SQL editor to grant themselves owner + admin:
--
--   update public.profiles set is_owner = true, role = 'admin'
--   where id = (select id from auth.users where email = 'chinmaykumart04@gmail.com');


-- ============================================================
-- 09_project_date_extension.sql
-- ============================================================

-- Tracks project finishing-date extensions so clients can see when a project's
-- end date has slipped from what was originally planned.
-- Run AFTER 08_owner_admin_approval.sql.

alter table public.projects add column if not exists original_end_date date;
alter table public.projects add column if not exists extension_reason text;
alter table public.projects add column if not exists extension_updated_at timestamptz;

-- Backfill: existing rows had no original_end_date captured, so treat their
-- current end_date (if any) as the original -- they show as "not extended"
-- until admin pushes the date further, which is the correct starting state.
update public.projects set original_end_date = end_date
where original_end_date is null and end_date is not null;

-- original_end_date is captured once, at creation, and never touched again;
-- extension_updated_at is stamped automatically whenever end_date actually
-- changes, so the client-visible "extended" flag never depends on the app
-- remembering to set it manually.
create or replace function public.track_project_date_extension()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.original_end_date is null then
      new.original_end_date := new.end_date;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.end_date is distinct from old.end_date then
      new.extension_updated_at := now();
    end if;
    -- original_end_date is immutable once set; ignore any client-sent change.
    new.original_end_date := old.original_end_date;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_date_extension on public.projects;
create trigger projects_date_extension
  before insert or update on public.projects
  for each row execute function public.track_project_date_extension();

-- No RLS changes needed: staff_all_projects (02_domain.sql) already grants
-- admin/manager full write access to projects, and client_own_projects only
-- ever granted select, so clients can see but never set these columns.


-- ============================================================
-- 10_archive.sql
-- ============================================================

-- Reversible archive for business records.
-- Run AFTER 09_project_date_extension.sql.
--
-- Why archive rather than DELETE: the foreign keys in 02_domain.sql cascade.
-- Deleting a project would permanently destroy every row in materials,
-- project_labourers and project_updates for that project -- i.e. material cost
-- records and all progress photos. Deleting a labourer would cascade to
-- attendance, wiping their wage history. That contradicts the retention promise
-- in the privacy policy ("Business records ... are kept by the construction
-- company for accounting and audit purposes"), so the UI's "delete" sets
-- archived_at instead: the row disappears from lists but nothing is lost, and
-- it can be restored. labourers.active already set this soft-disable precedent.
--
-- No RLS changes needed: the staff_all_* policies in 02_domain.sql are `for all`,
-- which already covers the UPDATE these operations use.

alter table public.projects   add column if not exists archived_at timestamptz;
alter table public.clients    add column if not exists archived_at timestamptz;
alter table public.suppliers  add column if not exists archived_at timestamptz;
alter table public.labourers  add column if not exists archived_at timestamptz;
alter table public.materials  add column if not exists archived_at timestamptz;
alter table public.payments   add column if not exists archived_at timestamptz;

-- Only projects gets archive UI in this pass; the other columns are added now so
-- extending the same pattern to those entities needs no further migration.

-- Every list query filters `archived_at is null`, so index that specific case.
create index if not exists projects_active_idx  on public.projects(archived_at) where archived_at is null;
create index if not exists materials_active_idx on public.materials(archived_at) where archived_at is null;
create index if not exists payments_active_idx  on public.payments(archived_at)  where archived_at is null;


-- ============================================================
-- 11_archive_updates.sql
-- ============================================================

-- Completes the archive columns started in 10_archive.sql.
-- project_updates was the one table left out; it needs the same treatment now
-- that admin can archive individual progress updates.
-- Run AFTER 10_archive.sql.

alter table public.project_updates add column if not exists archived_at timestamptz;

create index if not exists project_updates_active_idx
  on public.project_updates(archived_at) where archived_at is null;


-- ============================================================
-- 12_owner_delete.sql
-- ============================================================

-- Permanent, owner-only delete from the archived view.
-- Run AFTER 11_archive_updates.sql.
--
-- Archive (10_archive.sql / 11_archive_updates.sql) never destroys data -- it
-- just hides a row. This adds the one genuinely irreversible action in the
-- app. Enforcement lives here, in Postgres, not in the app: a Next.js server
-- action or a Postgrest call is directly reachable by anyone with a valid
-- session, so a UI-only check would not actually stop a non-owner. This
-- mirrors set_user_role() in 08_owner_admin_approval.sql exactly -- a
-- security definer function that checks is_owner() itself and rejects
-- everyone else.
--
-- Deleting a project cascades to its materials, project_labourers and
-- project_updates (02_domain.sql); deleting a labourer cascades to their
-- attendance. That is expected and intentional once the owner has chosen to
-- permanently delete rather than archive.

create or replace function public.owner_delete_row(target_table text, target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can permanently delete records';
  end if;
  if target_table not in (
    'projects', 'clients', 'suppliers', 'labourers',
    'materials', 'payments', 'project_updates'
  ) then
    raise exception 'invalid table: %', target_table;
  end if;
  execute format('delete from public.%I where id = $1', target_table) using target_id;
end;
$$;

revoke all on function public.owner_delete_row(text, uuid) from public;
grant execute on function public.owner_delete_row(text, uuid) to authenticated;


-- ============================================================
-- 13_next_payment_date.sql
-- ============================================================

-- Lets admin/manager set an upcoming payment due date per project, shown to
-- the client. Plain nullable column -- RLS already lets staff update
-- projects (staff_all_projects in 02_domain.sql) and clients read their own
-- (client_select_own_projects), so no new policy is needed.
alter table public.projects add column if not exists next_payment_date date;


-- ============================================================
-- 14_work_category.sql
-- ============================================================

-- Freeform "what was this money for" tag within a project (e.g. Foundation,
-- Electrical, Plumbing), same style as the freeform current_stage text on
-- projects -- no fixed list, admin just types whatever they want. Nullable
-- so existing rows are unaffected.
alter table public.materials add column if not exists work_category text;
alter table public.payments add column if not exists work_category text;
create index if not exists materials_work_category_idx on public.materials(work_category);
create index if not exists payments_work_category_idx on public.payments(work_category);


-- ============================================================
-- 15_retire_labour_self_access.sql
-- ============================================================

-- ---------- Labourers are records, not app users ----------
-- The client doesn't want a labour-facing app: a site manager records every
-- labourer's attendance and wages, and only admin/manager hold labour
-- information. (Attendance is expected to come from biometric hardware in
-- future, writing straight into public.attendance.)
--
-- These six policies were the labourer's self-access grants (02_domain.sql
-- lines 215-238). They are purely ADDITIVE on top of the staff_all_* policies,
-- so dropping them removes labourer read/write without touching admin or
-- manager capability at all.
drop policy if exists "labour_self"                  on public.labourers;
drop policy if exists "labour_own_assignments"       on public.project_labourers;
drop policy if exists "labour_own_attendance"        on public.attendance;
drop policy if exists "labour_insert_own_attendance" on public.attendance;
drop policy if exists "labour_own_payments"          on public.payments;
drop policy if exists "labour_assigned_projects"     on public.projects;

-- NOT touched, deliberately: the labourers table, project_labourers,
-- labourers.profile_id (the natural anchor for biometric identity later), and
-- the payee_type = 'labour' enum value with its CHECK constraint -- that
-- describes WHO GETS PAID, not a login role, and the wage/cash-flow reporting
-- depends on it.

-- ---------- Signup can no longer mint a labour account ----------
-- Same clamp as 08_owner_admin_approval.sql, with 'labour' removed so a
-- request crafted directly against the API (bypassing the UI, which no longer
-- offers the option) falls through to 'client' rather than creating a role
-- that has no home in the app.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.user_role;
begin
  safe_role := case requested_role
    when 'client' then 'client'::public.user_role
    when 'supplier' then 'supplier'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    safe_role
  );
  return new;
end;
$$;

-- The 'labour' value stays in the user_role enum on purpose. Dropping it would
-- need a type recreate and would strand any existing labour account: guard.ts
-- redirects an unpermitted role to /<role>, so such a profile would bounce
-- /labour -> 404 -> / -> /labour forever. Existing accounts keep the role and
-- land on a short "your site manager handles this" notice instead.


-- ============================================================
-- 16_labourer_category.sql
-- ============================================================

-- A labourer's trade/category (Carpenter, Plumber, Electrician, ...), the
-- same fixed list already used for materials.work_category and
-- payments.work_category. Plain nullable text -- existing rows are unaffected
-- and categorising is optional per labourer.
alter table public.labourers add column if not exists category text;
create index if not exists labourers_category_idx on public.labourers(category);


-- ============================================================
-- 17_client_wage_totals.sql
-- ============================================================

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


-- ============================================================
-- 18_oauth_role_pending.sql
-- ============================================================

-- ---------- Google sign-in doesn't collect a role ----------
-- Email/password signup always sends role metadata (client or supplier), so
-- handle_new_user() clamps it safely. Google OAuth carries no such metadata
-- at all, so every Google signup silently landed as 'client' with no way for
-- the person to say otherwise. Track that explicitly and ask once, right
-- after their first sign-in.
alter table public.profiles add column if not exists role_pending boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.user_role;
begin
  safe_role := case requested_role
    when 'client' then 'client'::public.user_role
    when 'supplier' then 'supplier'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, role, role_pending)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    safe_role,
    requested_role is null
  );
  return new;
end;
$$;

-- Self-service, but narrow: column-level UPDATE on profiles.role is revoked
-- from authenticated (08_owner_admin_approval.sql) so this RPC is the only
-- way to set it outside set_user_role(). It can't be used to self-promote --
-- client/supplier only, one-shot (only fires while role_pending is true), and
-- scoped to auth.uid()'s own row. This is exactly the choice signup already
-- lets any client/supplier make for themselves; we're just deferring it for
-- the one flow (Google OAuth) that has nowhere to ask up front.
create or replace function public.choose_role(new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_role not in ('client', 'supplier') then
    raise exception 'Invalid role selection';
  end if;

  update public.profiles
  set role = new_role, role_pending = false
  where id = auth.uid() and role_pending;

  if not found then
    raise exception 'No pending role selection for this account';
  end if;
end;
$$;

grant execute on function public.choose_role(public.user_role) to authenticated;


-- ============================================================
-- 19_client_project_labourers.sql
-- ============================================================

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


-- ============================================================
-- 20_admin_delete_user.sql
-- ============================================================

-- Owner-only permanent user deletion from the Team access screen.
-- Same delete pattern as delete_my_account() (04_account.sql): deleting the
-- auth.users row cascades to public.profiles (FK on delete cascade), which in
-- turn nulls out profile_id on clients/suppliers/labourers (on delete set
-- null) -- so business records (projects, materials, payments, etc.) are NOT
-- lost, only the login. This is the account-removal equivalent of
-- owner_delete_row() (12_owner_delete.sql): genuinely irreversible, so the UI
-- must confirm before calling it.
create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can delete accounts';
  end if;
  if target_id = auth.uid() then
    raise exception 'use delete_my_account() to delete your own account';
  end if;
  delete from auth.users where id = target_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;


-- ============================================================
-- 21_personal_transactions.sql
-- ============================================================

-- Admin's own personal income/expense log -- has nothing to do with any
-- construction project. Deliberately excluded from every cost/cash-flow
-- calculation elsewhere in the app; this is a private ledger, not a P&L
-- input. Admin/manager only -- no client/supplier/labour policy exists on
-- this table at all, so those roles get zero rows regardless of what the
-- UI does.
create table public.personal_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  amount numeric(10,2) not null check (amount >= 0),
  description text,
  occurred_at date not null default current_date,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.personal_transactions enable row level security;

create policy "staff_all_personal_transactions" on public.personal_transactions
  for all using (public.is_staff()) with check (public.is_staff());

create index personal_transactions_active_idx on public.personal_transactions(archived_at) where archived_at is null;

-- Extend owner_delete_row()'s table whitelist (12_owner_delete.sql) so the
-- same permanent-delete-from-archived-view flow works here too.
create or replace function public.owner_delete_row(target_table text, target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can permanently delete records';
  end if;
  if target_table not in (
    'projects', 'clients', 'suppliers', 'labourers',
    'materials', 'payments', 'project_updates', 'personal_transactions'
  ) then
    raise exception 'invalid table: %', target_table;
  end if;
  execute format('delete from public.%I where id = $1', target_table) using target_id;
end;
$$;


-- ============================================================
-- 22_auto_create_client.sql
-- ============================================================

-- Self-serve client signup only ever created a `profiles` row -- the admin
-- had to separately add a `clients` record and use "Link to login" to
-- connect it, so a new client was invisible on the Clients page and in the
-- project-creation client dropdown until that manual step happened. Create
-- the `clients` row automatically instead, for both signup paths that can
-- land someone as role='client':
--
-- 1. Direct email/password signup, where the role is known immediately.
-- 2. Google OAuth, which has no role metadata -- handle_new_user() parks
--    the profile as role_pending until choose_role() (18_oauth_role_pending.sql)
--    confirms it. Only create the clients row once the role is confirmed,
--    since a pending signup might still end up choosing 'supplier'.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.user_role;
  full_name text := coalesce(new.raw_user_meta_data->>'full_name', '');
  pending boolean := requested_role is null;
begin
  safe_role := case requested_role
    when 'client' then 'client'::public.user_role
    when 'supplier' then 'supplier'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, role, role_pending)
  values (new.id, full_name, safe_role, pending);

  if safe_role = 'client' and not pending then
    insert into public.clients (profile_id, name, email)
    values (new.id, coalesce(nullif(trim(full_name), ''), new.email, 'New client'), new.email)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.choose_role(new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_profile record;
  acting_email text;
begin
  if new_role not in ('client', 'supplier') then
    raise exception 'Invalid role selection';
  end if;

  update public.profiles
  set role = new_role, role_pending = false
  where id = auth.uid() and role_pending
  returning id, full_name into acting_profile;

  if not found then
    raise exception 'No pending role selection for this account';
  end if;

  if new_role = 'client' then
    select email into acting_email from auth.users where id = auth.uid();
    insert into public.clients (profile_id, name, email)
    values (auth.uid(), coalesce(nullif(trim(acting_profile.full_name), ''), acting_email, 'New client'), acting_email)
    on conflict (profile_id) do nothing;
  end if;
end;
$$;

grant execute on function public.choose_role(public.user_role) to authenticated;


-- ============================================================
-- 23_client_payments.sql
-- ============================================================

-- Money the client has paid the business, recorded by admin -- a fact being
-- logged after the fact, not a request needing approval, so no
-- pending/approved/paid workflow like the existing outgoing `payments`
-- table. Deliberately a separate table (not a third payee_type on
-- `payments`) so none of the existing spend/cost-tracking/cash-flow
-- calculations that sum payments.amount need to change or start filtering
-- it out -- same reasoning as personal_transactions.
create table public.client_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  description text,
  paid_on date not null default current_date,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index on public.client_payments(project_id);

alter table public.client_payments enable row level security;

create policy "staff_all_client_payments" on public.client_payments
  for all using (public.is_staff()) with check (public.is_staff());

create policy "client_own_client_payments" on public.client_payments for select
  using (project_id in (
    select p.id from public.projects p
    join public.clients c on c.id = p.client_id
    where c.profile_id = auth.uid()
  ));

-- Extend owner_delete_row()'s table whitelist (12_owner_delete.sql) so the
-- owner-only permanent-delete-forever action also works on this table.
create or replace function public.owner_delete_row(target_table text, target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can permanently delete records';
  end if;
  if target_table not in (
    'projects', 'clients', 'suppliers', 'labourers',
    'materials', 'payments', 'project_updates', 'personal_transactions',
    'client_payments'
  ) then
    raise exception 'invalid table: %', target_table;
  end if;
  execute format('delete from public.%I where id = $1', target_table) using target_id;
end;
$$;


-- ============================================================
-- 24_next_payment_amount.sql
-- ============================================================

-- Tracks how much is outstanding for the currently-set "next payment due"
-- reminder, so a client payment can be checked against it instead of
-- blindly clearing the reminder on any payment regardless of amount. A
-- partial payment reduces this balance instead of clearing the due date;
-- the reminder only clears once it reaches zero. See app logic in
-- createClientPayment (app/admin/actions.ts, Repository.kt).
alter table public.projects add column if not exists next_payment_amount numeric(14,2);


-- ============================================================
-- 25_multi_site_attendance.sql
-- ============================================================

-- Previously one attendance row per labourer per day, full stop -- made it
-- impossible to record a labourer splitting a single day across two sites
-- (e.g. half-day at each). Relax the uniqueness to include project_id, so a
-- labourer can have one attendance entry per project per day instead of one
-- total. The wage math (lib/wages.ts / AdminScreens.kt's ReportWageFactor)
-- already sums per (project, labourer) pair across however many attendance
-- rows exist, so split-day pay across two projects already computes
-- correctly once more than one row per day is allowed -- no math changes
-- needed there.
alter table public.attendance drop constraint attendance_labourer_id_date_key;
alter table public.attendance add constraint attendance_labourer_id_date_project_id_key
  unique (labourer_id, date, project_id);


-- ============================================================
-- 26_supplier_bills_auto_approved.sql
-- ============================================================

-- Supplier-submitted bills no longer need a manual admin review step --
-- suppliers are trusted, so a self-submitted bill counts toward project
-- costs immediately instead of sitting in "pending" until someone clicks
-- Approve. "Mark paid" stays a separate, admin-only action: that reflects
-- money actually having changed hands, a real event admin controls, not
-- something a supplier's own submission should be able to claim.
drop policy if exists "supplier_insert_own_payments" on public.payments;
create policy "supplier_insert_own_payments"
  on public.payments for insert
  with check (
    payee_type = 'supplier'
    and status = 'approved'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );


-- ============================================================
-- 27_material_delivery_photo.sql
-- ============================================================

-- Lets a supplier attach a photo of what was actually delivered, so admin
-- can visually check it against the recorded quantity/status without a
-- site visit. Optional, not required. Uses the existing project-images
-- storage bucket (03_storage.sql already allows any authenticated user to
-- upload there, not just staff) -- no new bucket or policy needed.
alter table public.materials add column if not exists image_url text;


-- ============================================================
-- 28_material_billed.sql
-- ============================================================

-- Tracks whether a material purchase already has a payment created for it
-- through the Payments page's "Purchase (optional)" picker, so it drops out
-- of that dropdown afterward instead of being payable more than once.
alter table public.materials add column if not exists billed boolean not null default false;


-- ============================================================
-- 29_staff_wage_accrued.sql
-- ============================================================

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


-- ============================================================
-- 30_project_agreement.sql
-- ============================================================

-- Lets admin/manager attach a photo of the signed client agreement to a
-- project, viewable by the project's client too. Uses the existing
-- project-images storage bucket (03_storage.sql) -- no new bucket or
-- storage policy needed. No new RLS policy either: staff_all_projects
-- (02_domain.sql) already covers admin/manager read+write, and
-- client_own_projects already covers the client's read-only view.
alter table public.projects add column if not exists agreement_image_url text;


-- ============================================================
-- 31_project_change_orders.sql
-- ============================================================

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


-- ============================================================
-- 32_supplier_archive.sql
-- ============================================================

-- Let suppliers archive (soft-delete) their own delivery and payment records.
-- Run AFTER 02_domain.sql and 10_archive.sql.
--
-- supplier_own_materials / supplier_own_payments (02_domain.sql) only grant
-- SELECT, so the "Delete" buttons on the supplier dashboard were updating
-- archived_at but RLS silently dropped the write (0 rows affected, no error).

drop policy if exists "supplier_update_own_materials" on public.materials;
create policy "supplier_update_own_materials"
  on public.materials for update
  using (
    supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  )
  with check (
    supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );

drop policy if exists "supplier_update_own_payments" on public.payments;
create policy "supplier_update_own_payments"
  on public.payments for update
  using (
    payee_type = 'supplier'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  )
  with check (
    payee_type = 'supplier'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );


-- ============================================================
-- 33_admin_profile_email.sql
-- ============================================================

-- Let admin/manager read the email behind a profile, for auto-filling the
-- create-supplier form when "Link to login" is picked. Run AFTER 02_domain.sql.
--
-- profiles has no email column (it lives in auth.users, which RLS never
-- exposes to normal queries). security definer + the is_staff() guard here
-- is the only way to surface it without granting broad auth.users access.

create or replace function public.admin_list_profiles_with_email(p_role public.user_role)
returns table (id uuid, full_name text, email text)
language sql security definer set search_path = public
as $$
  select p.id, p.full_name, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_staff() and p.role = p_role
$$;

revoke all on function public.admin_list_profiles_with_email(public.user_role) from public;
grant execute on function public.admin_list_profiles_with_email(public.user_role) to authenticated;


-- ============================================================
-- 34_profile_phone.sql
-- ============================================================

-- Capture phone at signup so "Link to login" can auto-fill it later, the
-- same way full_name/email already do. Run AFTER 22_auto_create_client.sql
-- and 33_admin_profile_email.sql.
--
-- Before this, phone was never collected anywhere tied to an account -- only
-- typed manually into the Supplier/Client "Phone" field on each record, with
-- no link back to profiles/auth.users. There was nothing to auto-fill from.

alter table public.profiles add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.user_role;
  full_name text := coalesce(new.raw_user_meta_data->>'full_name', '');
  phone text := nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '');
  pending boolean := requested_role is null;
begin
  safe_role := case requested_role
    when 'client' then 'client'::public.user_role
    when 'supplier' then 'supplier'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (id, full_name, role, role_pending, phone)
  values (new.id, full_name, safe_role, pending, phone);

  if safe_role = 'client' and not pending then
    insert into public.clients (profile_id, name, email, phone)
    values (new.id, coalesce(nullif(trim(full_name), ''), new.email, 'New client'), new.email, phone)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

-- Return signature changed (added phone) -- CREATE OR REPLACE can't do that
-- for a function returning TABLE, so drop first.
drop function if exists public.admin_list_profiles_with_email(public.user_role);
create function public.admin_list_profiles_with_email(p_role public.user_role)
returns table (id uuid, full_name text, email text, phone text)
language sql security definer set search_path = public
as $$
  select p.id, p.full_name, u.email, p.phone
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_staff() and p.role = p_role
$$;

revoke all on function public.admin_list_profiles_with_email(public.user_role) from public;
grant execute on function public.admin_list_profiles_with_email(public.user_role) to authenticated;

-- Same phone hand-off for the choose_role() path (Google OAuth signups,
-- which have no phone metadata at all -- coalesces to null, same as before).
create or replace function public.choose_role(new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_profile record;
  acting_email text;
begin
  if new_role not in ('client', 'supplier') then
    raise exception 'Invalid role selection';
  end if;

  update public.profiles
  set role = new_role, role_pending = false
  where id = auth.uid() and role_pending
  returning id, full_name, phone into acting_profile;

  if not found then
    raise exception 'No pending role selection for this account';
  end if;

  if new_role = 'client' then
    select email into acting_email from auth.users where id = auth.uid();
    insert into public.clients (profile_id, name, email, phone)
    values (auth.uid(), coalesce(nullif(trim(acting_profile.full_name), ''), acting_email, 'New client'), acting_email, acting_profile.phone)
    on conflict (profile_id) do nothing;
  end if;
end;
$$;

grant execute on function public.choose_role(public.user_role) to authenticated;


-- ============================================================
-- 35_supplier_created_only_delete.sql
-- ============================================================

-- Suppliers may only delete (archive) materials/payments THEY created --
-- not admin-entered deliveries or admin-approved bills for the same supplier.
-- Run AFTER 32_supplier_archive.sql.
--
-- 32_supplier_archive.sql scoped the supplier update policy to
-- `supplier_id in (their supplier row)`, which covers every row for that
-- supplier regardless of who entered it -- so a supplier could delete a
-- payment/material the admin/owner created and approved on their behalf.
-- This adds an explicit ownership flag set only by the supplier-facing
-- recordDelivery/generateBill actions, and requires it in the policy.

alter table public.materials add column if not exists created_by_supplier boolean not null default false;
alter table public.payments  add column if not exists created_by_supplier boolean not null default false;

drop policy if exists "supplier_update_own_materials" on public.materials;
create policy "supplier_update_own_materials"
  on public.materials for update
  using (
    created_by_supplier
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  )
  with check (
    created_by_supplier
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );

drop policy if exists "supplier_update_own_payments" on public.payments;
create policy "supplier_update_own_payments"
  on public.payments for update
  using (
    created_by_supplier
    and payee_type = 'supplier'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  )
  with check (
    created_by_supplier
    and payee_type = 'supplier'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );


-- ============================================================
-- 36_showcase.sql
-- ============================================================

-- Public website showcase: the projects shown on devaconstructions.in.
-- Run AFTER 35_supplier_created_only_delete.sql.
--
-- WHY A SEPARATE TABLE, NOT A FLAG ON public.projects
-- ---------------------------------------------------
-- The marketing site reads this with the Supabase ANON key, from a public
-- website, with no login. public.projects carries total_cost and client_id.
-- Exposing that table to anonymous readers — even filtered to "published"
-- rows — puts contract values and the client list one policy mistake away
-- from being on the open internet.
--
-- So the public copy is its own table containing ONLY text meant for
-- strangers to read. There is no column here that could leak commercial
-- information, because there is no such column at all. That is a structural
-- guarantee rather than a promise to be careful.
--
-- The optional project_id link lets a showcase entry point back at the real
-- project for reference, and is deliberately nullable: work completed before
-- the app existed still deserves a place on the website.

create table public.showcase_projects (
  id uuid primary key default gen_random_uuid(),

  -- Public web address: devaconstructions.in/projects/<slug>
  -- Unique, and must not change once published — it is a shared link and a
  -- search result.
  slug text not null unique,

  name text not null,
  location text not null,
  year text not null,
  kind text not null check (kind in ('Residential', 'Commercial', 'Renovation')),
  area text not null,

  -- Optional paragraph shown on the project's own page.
  summary text,

  -- Show on the website home page. The site takes the first three.
  featured boolean not null default false,

  -- Off by default: a half-finished entry must never appear on the live site
  -- just because someone started filling it in.
  published boolean not null default false,

  -- Display order on the website. Lower first.
  sort_order integer not null default 0,

  -- Optional reference back to the operational project. Nullable on purpose.
  project_id uuid references public.projects(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.showcase_projects(published);
create index on public.showcase_projects(sort_order);

create table public.showcase_photos (
  id uuid primary key default gen_random_uuid(),
  showcase_id uuid not null references public.showcase_projects(id) on delete cascade,

  -- Public URL in the existing project-images bucket (paths under showcase/).
  url text not null,

  -- Lower first. The first photo is the cover: it appears on the project's
  -- card and across the top of its page.
  sort_order integer not null default 0,

  created_at timestamptz not null default now()
);

create index on public.showcase_photos(showcase_id);

-- Keep updated_at honest, so the website can tell when content last changed.
create or replace function public.touch_showcase_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger showcase_projects_touch
  before update on public.showcase_projects
  for each row execute function public.touch_showcase_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.showcase_projects enable row level security;
alter table public.showcase_photos   enable row level security;

-- Staff manage everything.
create policy "staff_all_showcase_projects" on public.showcase_projects
  for all using (public.is_staff()) with check (public.is_staff());

create policy "staff_all_showcase_photos" on public.showcase_photos
  for all using (public.is_staff()) with check (public.is_staff());

-- Anonymous read of PUBLISHED rows only. `to anon, authenticated` is what the
-- website uses; unpublished rows stay invisible to it entirely, so a draft
-- cannot be read by guessing an id.
create policy "public_read_published_showcase" on public.showcase_projects
  for select to anon, authenticated
  using (published = true);

-- Photos follow their parent: visible only while that project is published.
create policy "public_read_published_showcase_photos" on public.showcase_photos
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.showcase_projects s
      where s.id = showcase_id and s.published = true
    )
  );

-- ============================================================
-- Seed: the six projects currently hard-coded on the website
-- ============================================================
-- Published so the live site keeps showing exactly what it shows today when
-- it switches over to reading from here. Photos are added through the app.
insert into public.showcase_projects
  (slug, name, location, year, kind, area, featured, published, sort_order)
values
  ('narayanappa-residence',      'Narayanappa Residence',      'Ramgondahalli, Bangalore',  '2026', 'Residential', '4,200 sq. ft.',  true,  true, 10),
  ('koramangala-loft',           'Koramangala Loft',           'Koramangala, Bangalore',    '2025', 'Renovation',  '2,100 sq. ft.',  true,  true, 20),
  ('hosur-warehouse',            'Hosur Industrial Warehouse', 'Hosur Road, Bangalore',     '2025', 'Commercial',  '22,000 sq. ft.', true,  true, 30),
  ('jayanagar-villa',            'Jayanagar Villa',            'Jayanagar, Bangalore',      '2024', 'Residential', '5,800 sq. ft.',  false, true, 40),
  ('indiranagar-office',         'Indiranagar Office Fit-out', 'Indiranagar, Bangalore',    '2024', 'Commercial',  '3,400 sq. ft.',  false, true, 50),
  ('electronic-city-apartments', 'Electronic City Apartments', 'Electronic City, Bangalore','2023', 'Residential', '34,000 sq. ft.', false, true, 60)
on conflict (slug) do nothing;


-- ============================================================
-- 37_showcase_policies_repair.sql
-- ============================================================

-- Repair for 36_showcase.sql.
--
-- 36 was run through the Supabase SQL editor and only partly applied: the
-- tables were created, but the policies and the seed at the end were not.
-- The symptom is a table that exists and answers queries, yet returns zero
-- rows to the anonymous key — RLS is on, and with no SELECT policy the
-- correct behaviour is to show nothing rather than to raise an error.
--
-- Safe to run repeatedly, and safe to run even if 36 fully applied: every
-- statement drops before it creates.

alter table public.showcase_projects enable row level security;
alter table public.showcase_photos   enable row level security;

-- Table-level privileges. RLS decides which ROWS are visible; these decide
-- whether the role may touch the table at all. Both are required.
grant select on public.showcase_projects to anon, authenticated;
grant select on public.showcase_photos   to anon, authenticated;

drop policy if exists "staff_all_showcase_projects" on public.showcase_projects;
create policy "staff_all_showcase_projects" on public.showcase_projects
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff_all_showcase_photos" on public.showcase_photos;
create policy "staff_all_showcase_photos" on public.showcase_photos
  for all using (public.is_staff()) with check (public.is_staff());

-- Anonymous read of PUBLISHED rows only. Unpublished rows stay invisible to
-- the website entirely, so a draft cannot be read by guessing an id.
drop policy if exists "public_read_published_showcase" on public.showcase_projects;
create policy "public_read_published_showcase" on public.showcase_projects
  for select to anon, authenticated
  using (published = true);

-- Photos follow their parent: visible only while that project is published.
drop policy if exists "public_read_published_showcase_photos" on public.showcase_photos;
create policy "public_read_published_showcase_photos" on public.showcase_photos
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.showcase_projects s
      where s.id = showcase_id and s.published = true
    )
  );

-- Check: expect four policy rows, and rowsecurity true for both tables.
select tablename, policyname, roles::text, cmd
from pg_policies
where tablename in ('showcase_projects', 'showcase_photos')
order by tablename, policyname;


-- ============================================================
-- 38_showcase_archive.sql
-- ============================================================

-- Archive for website showcase projects.
-- Run AFTER 37_showcase_policies_repair.sql.
--
-- Matches the soft-delete pattern the rest of the app already uses (see
-- 10_archive.sql): "delete" that can be undone, with the genuinely permanent
-- delete kept as a separate, deliberate action.
--
-- Archiving is not the same as unpublishing, and both are worth having:
--   unpublish  — temporarily off the website, still in the working list.
--                For a project being edited, or held back for a client.
--   archive    — finished with. Out of the working list AND off the website,
--                but recoverable. For old work that no longer represents the
--                firm, where deleting would throw away the write-up and the
--                photographs for no reason.

alter table public.showcase_projects
  add column if not exists archived_at timestamptz;

create index if not exists showcase_projects_archived_at_idx
  on public.showcase_projects(archived_at);

-- The public site must never show an archived project, even one still marked
-- published. Enforcing it here rather than in the website's query means the
-- rule cannot be forgotten by a future caller — the same reason `published`
-- is checked in the policy rather than in the query.
drop policy if exists "public_read_published_showcase" on public.showcase_projects;
create policy "public_read_published_showcase" on public.showcase_projects
  for select to anon, authenticated
  using (published = true and archived_at is null);

-- Photos follow their parent, so they inherit both conditions.
drop policy if exists "public_read_published_showcase_photos" on public.showcase_photos;
create policy "public_read_published_showcase_photos" on public.showcase_photos
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.showcase_projects s
      where s.id = showcase_id
        and s.published = true
        and s.archived_at is null
    )
  );

-- Check: expect the two public_read policies to mention archived_at.
select policyname, qual
from pg_policies
where tablename in ('showcase_projects', 'showcase_photos')
  and policyname like 'public_read%';


-- ============================================================
-- 39_personal_admin_only.sql
-- ============================================================

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


-- ============================================================
-- 40_supplier_delivery_autobill.sql
-- ============================================================

-- Link a supplier bill to the delivery it bills.
--
-- Recording a delivery and billing for it are one real-world event, but the
-- app made them two disconnected forms: a supplier filled in "Record
-- delivery" (a materials row), then had to separately fill in "Generate
-- bill" (a payments row) before the admin's books showed anything owed. If
-- they skipped the second form the goods were on site and the debt was
-- invisible. recordDelivery() now creates the bill itself.
--
-- That needs a link back. Until now the only connection between the two
-- tables was materials.billed (28_material_billed.sql), a one-way boolean
-- saying "something has been paid for this" with no record of which payment.
-- Without a real reference, removing the supplier's "Generate bill" form
-- would leave them able to delete a delivery while its bill stayed behind,
-- with no UI left to remove it.
--
-- Run AFTER 28_material_billed.sql.

alter table public.payments
  add column if not exists material_id uuid references public.materials(id) on delete set null;

-- One bill per delivery, enforced by the database rather than by whichever
-- code path happens to run. Partial so the many legitimately unlinked rows
-- (labour wages, admin-entered bills, every payment predating this column)
-- are unaffected.
create unique index if not exists payments_material_id_key
  on public.payments(material_id) where material_id is not null;

-- No RLS change is needed. supplier_insert_own_payments
-- (26_supplier_bills_auto_approved.sql) already requires status = 'approved',
-- which is what the auto-created bill uses, and supplier_update_own_payments
-- (35_supplier_created_only_delete.sql) already lets a supplier archive a row
-- carrying created_by_supplier = true. Neither policy restricts columns, so
-- material_id passes through both.


-- ============================================================
-- 41_backfill_legacy_supplier_bills.sql
-- ============================================================

-- Link supplier bills raised by the old "Generate bill" form to the deliveries
-- they were for, and flag those deliveries as billed.
--
-- Until 40_supplier_delivery_autobill.sql there was no link between the two
-- tables, and the supplier-facing generateBill() inserted a payments row
-- without touching materials.billed. The admin's "Purchase (optional)" picker
-- on /admin/payments lists materials where billed = false, so every delivery
-- billed through that old form is still sitting in the dropdown inviting a
-- second bill for goods already invoiced.
--
-- Run AFTER 40_supplier_delivery_autobill.sql. Safe to run more than once:
-- both statements skip rows that are already linked or already flagged.

-- Match on project + supplier + exact line total, but only commit the link
-- where it is unambiguous IN BOTH DIRECTIONS -- one candidate material for
-- this payment, and one candidate payment for that material.
--
-- The two-way guard matters. A supplier who delivered two different 200-rupee
-- items to the same site produces two payments and two materials that all
-- match each other; picking a pairing arbitrarily would attach a bill to the
-- wrong delivery. Silently mis-linking money is worse than leaving a row for
-- a human, so ambiguous groups are skipped and reported at the bottom.
with candidate as (
  select
    p.id as payment_id,
    m.id as material_id,
    count(*) over (partition by p.id) as materials_for_payment,
    count(*) over (partition by m.id) as payments_for_material
  from public.payments p
  join public.materials m
    on  m.project_id  = p.project_id
    and m.supplier_id = p.supplier_id
    and m.archived_at is null
    and m.billed = false
    and round(m.quantity * m.unit_cost, 2) = round(p.amount, 2)
  where p.payee_type  = 'supplier'
    and p.material_id is null
    and p.archived_at is null
    and p.supplier_id is not null
    and p.project_id  is not null
)
update public.payments p
   set material_id = c.material_id
  from candidate c
 where p.id = c.payment_id
   and c.materials_for_payment = 1
   and c.payments_for_material = 1;

-- Flag every delivery that now has a bill pointing at it. Separate from the
-- update above so it also repairs any row linked by other means.
update public.materials m
   set billed = true
  from public.payments p
 where p.material_id  = m.id
   and p.payee_type   = 'supplier'
   and p.archived_at is null
   and m.billed = false;

-- What this declined to guess at. An empty result means every legacy supplier
-- bill was matched. Anything listed needs a human: either the amount does not
-- equal any single delivery's line total (a bill covering several deliveries,
-- or a part payment), or several deliveries match it equally well.
select
  p.id,
  p.created_at::date as billed_on,
  s.name             as supplier,
  pr.name            as project,
  p.amount,
  p.description,
  p.status
from public.payments p
left join public.suppliers s  on s.id  = p.supplier_id
left join public.projects  pr on pr.id = p.project_id
where p.payee_type  = 'supplier'
  and p.material_id is null
  and p.archived_at is null
order by p.created_at;


-- ============================================================
-- 42_budget_extensions.sql
-- ============================================================

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


-- ============================================================
-- 43_role_reservations.sql
-- ============================================================

-- Pre-assign roles by email before the person signs up.
--
-- The admin enters an email + role on the Team Access page. When that email
-- signs up (email/password or Google OAuth), handle_new_user() checks this
-- table and assigns the reserved role instead of the default client clamp.
-- The reservation is consumed (deleted) on use so it can't be replayed.

create table if not exists public.role_reservations (
  email text primary key,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

alter table public.role_reservations enable row level security;

create policy "staff_all_role_reservations" on public.role_reservations for all
  using (public.is_staff()) with check (public.is_staff());

-- Update handle_new_user to check for a reservation before clamping.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  reserved public.user_role;
  safe_role public.user_role;
begin
  -- Check if the admin pre-assigned a role for this email.
  select r.role into reserved
    from public.role_reservations r
   where r.email = lower(new.email);

  if reserved is not null then
    safe_role := reserved;
    delete from public.role_reservations where email = lower(new.email);
  else
    safe_role := case requested_role
      when 'client' then 'client'::public.user_role
      when 'supplier' then 'supplier'::public.user_role
      else 'client'::public.user_role
    end;
  end if;

  insert into public.profiles (id, full_name, role, role_pending)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    safe_role,
    reserved is null and requested_role is null
  );
  return new;
end;
$$;


-- ============================================================
-- 44_superadmin_role.sql
-- ============================================================

-- Add superadmin role — sits above admin, has Team Access.
-- Regular admin keeps all other permissions but cannot manage team roles.
--
-- IMPORTANT: Postgres requires ALTER TYPE ADD VALUE to be committed before
-- the new value can be referenced. Run this file in TWO separate executions:
--
--   Step 1: run ONLY the ALTER TYPE line below, then commit.
--   Step 2: run everything from "-- Step 2" onward.

-- Step 1
alter type public.user_role add value if not exists 'superadmin' before 'admin';

-- Step 2 (run after Step 1 is committed)

-- Superadmin is staff.
create or replace function public.is_staff() returns boolean
language sql stable as $$
  select public.current_role() in ('superadmin','admin','manager')
$$;

-- Superadmin counts as admin for all existing admin-gated features.
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select public.current_role() in ('superadmin','admin')
$$;

-- Update handle_new_user: superadmin is never self-serve.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  reserved public.user_role;
  safe_role public.user_role;
begin
  select r.role into reserved
    from public.role_reservations r
   where r.email = lower(new.email);

  if reserved is not null then
    safe_role := reserved;
    delete from public.role_reservations where email = lower(new.email);
  else
    safe_role := case requested_role
      when 'client' then 'client'::public.user_role
      when 'supplier' then 'supplier'::public.user_role
      else 'client'::public.user_role
    end;
  end if;

  insert into public.profiles (id, full_name, role, role_pending)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    safe_role,
    reserved is null and requested_role is null
  );
  return new;
end;
$$;


-- ============================================================
-- 45_labourer_families.sql
-- ============================================================

-- Family grouping for labourers.
-- Labourers sharing the same family_id are a household — when one collects
-- wages, the payment notes who physically received the cash.

alter table public.labourers
  add column if not exists family_id uuid;

create index if not exists labourers_family_id_idx on public.labourers(family_id);

-- Who physically collected the payment (when a family member picks up for another).
alter table public.payments
  add column if not exists collected_by uuid references public.labourers(id) on delete set null;


-- ============================================================
-- 46_overtime_status.sql
-- ============================================================

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


-- ============================================================
-- 47_supplier_advances.sql
-- ============================================================

-- Supplier advance payments: a ledger of deposits and deductions.
-- A positive amount is money given to the supplier (advance deposit).
-- A negative amount is an auto-deduction when the supplier delivers material.

create table public.supplier_advances (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  amount numeric(14,2) not null,
  description text,
  material_id uuid references public.materials(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.supplier_advances(supplier_id);
create index on public.supplier_advances(material_id);

alter table public.supplier_advances enable row level security;

create policy "staff_all_supplier_advances"
  on public.supplier_advances for all
  using (public.is_staff()) with check (public.is_staff());

create policy "supplier_own_advances"
  on public.supplier_advances for select
  using (supplier_id in (select id from public.suppliers where profile_id = auth.uid()));


-- ============================================================
-- 48_supplier_bills_auto_paid.sql
-- ============================================================

-- Supplier-submitted bills settle themselves. Recording the delivery IS the
-- payment event now: the cost comes straight off the supplier's advance
-- ledger, so there is no separate moment for an admin to confirm and no
-- "Mark paid" button left to click. 26_supplier_bills_auto_approved.sql
-- required status = 'approved' on this insert; that check is what made the
-- manual step mandatory, so it moves to 'paid'.
--
-- The advance balance is allowed to go negative. A negative balance is the
-- real "what we still owe this supplier" figure, and is why nothing is lost
-- by dropping the approved→paid pause.
drop policy if exists "supplier_insert_own_payments" on public.payments;
create policy "supplier_insert_own_payments"
  on public.payments for insert
  with check (
    payee_type = 'supplier'
    and status = 'paid'
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );

-- Bills already sitting in 'approved' have no UI left to settle them, so
-- close them out. Deliberately NOT creating matching advance deductions for
-- these: that would rewrite ledger history for money already accounted for.
update public.payments
   set status = 'paid',
       paid_at = coalesce(paid_at, approved_at, created_at)
 where payee_type = 'supplier'
   and status = 'approved'
   and archived_at is null;


-- ============================================================
-- 49_supplier_bill_status_from_advance.sql
-- ============================================================

-- Supersedes 48_supplier_bills_auto_paid.sql.
--
-- 48 wrote every supplier-recorded delivery straight to 'paid' and let the
-- advance ledger run negative to carry the debt. That stated the same debt
-- twice: the bill claimed the money had gone out while the ledger claimed it
-- was still owed. For a supplier who was never given an advance, "Total paid"
-- and "Remaining" both became fiction, and Remaining could only ever read
-- zero because no supplier bill was ever left outstanding.
--
-- The rule now: the advance ledger holds money actually handed over and never
-- drops below zero. A delivery is 'paid' only where an advance covered it --
-- the one case where money genuinely left already. Everything else is
-- 'approved', i.e. a real outstanding bill.
--
-- There is still no approval step and no "Mark paid" button; the status is
-- computed at insert time rather than clicked.
drop policy if exists "supplier_insert_own_payments" on public.payments;
create policy "supplier_insert_own_payments"
  on public.payments for insert
  with check (
    payee_type = 'supplier'
    and status in ('paid', 'approved')
    and supplier_id in (select id from public.suppliers where profile_id = auth.uid())
  );


-- ============================================================
-- 51_supplier_advance_rpcs.sql
-- ============================================================

-- The supplier portal could never write the advance ledger.
--
-- 47_supplier_advances.sql gives a supplier SELECT on supplier_advances and
-- nothing else; the only write policy is staff_all_supplier_advances. So the
-- deduction recordDelivery() attempts from /supplier was silently rejected --
-- the insert's error was never checked -- while the bill it wrote in the same
-- breath was still marked `paid` because the balance covered the delivery.
-- The money left the balance in the app's arithmetic and stayed in it in the
-- table. Deleting that delivery had nothing to give back either.
--
-- Widening the policy is not the fix: a supplier who can insert freely can
-- write a POSITIVE row and claim an advance they were never given. These two
-- functions are the whole of what the portal is allowed to do, and both derive
-- the amount from rows that are already there rather than from the caller.

-- Draw a delivery out of the supplier's advance balance.
--
-- All-or-nothing, the same rule the app applies everywhere (see
-- deductFromSupplierAdvance): a partial deduction would spend the credit while
-- the bill still showed its full amount outstanding. Returns whether the
-- advance covered it, which is what decides the bill's status.
create or replace function public.deduct_supplier_advance_for_material(p_material_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier uuid;
  v_cost numeric;
  v_balance numeric;
begin
  select m.supplier_id, round(coalesce(m.quantity, 0) * coalesce(m.unit_cost, 0), 2)
    into v_supplier, v_cost
    from public.materials m
   where m.id = p_material_id;

  if v_supplier is null or coalesce(v_cost, 0) <= 0 then
    return false;
  end if;

  -- Staff, or the supplier this delivery belongs to. Nobody else.
  if not (
    public.is_staff()
    or exists (
      select 1 from public.suppliers s
       where s.id = v_supplier and s.profile_id = auth.uid()
    )
  ) then
    raise exception 'not allowed to touch this supplier''s advances';
  end if;

  -- Deducting twice for one delivery would eat the advance a second time.
  if exists (
    select 1 from public.supplier_advances a
     where a.material_id = p_material_id and a.amount < 0
  ) then
    return false;
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.supplier_advances where supplier_id = v_supplier;
  if v_balance < v_cost then
    return false;
  end if;

  insert into public.supplier_advances (supplier_id, amount, description, material_id)
  values (v_supplier, -v_cost, 'Auto-deducted for material delivery', p_material_id);
  return true;
end;
$$;

-- Hand the credit back when the delivery is deleted.
--
-- Mirrors refundSupplierAdvanceForMaterial in app/admin/actions.ts: an
-- offsetting row rather than a row deletion (the supplier page renders the
-- ledger as a statement, so a silent removal would move the balance with no
-- line to explain it), and it refunds the material's NET position only while
-- that is still negative, so the money can come back exactly once however many
-- times this is called.
create or replace function public.refund_supplier_advance_for_material(p_material_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier uuid;
  v_net numeric;
  v_live boolean;
begin
  select coalesce(sum(a.amount), 0) into v_net
    from public.supplier_advances a where a.material_id = p_material_id;
  select a.supplier_id into v_supplier
    from public.supplier_advances a where a.material_id = p_material_id limit 1;

  if v_supplier is null or v_net >= 0 then
    return false;
  end if;

  -- A supplier may only undo a delivery that is actually gone -- otherwise
  -- this would be a way to get the credit back while keeping the goods and the
  -- bill marked paid. Staff call it from deleteMaterial(), a beat before the
  -- row disappears, so they are not held to that.
  if not public.is_staff() then
    if not exists (
      select 1 from public.suppliers s
       where s.id = v_supplier and s.profile_id = auth.uid()
    ) then
      raise exception 'not allowed to touch this supplier''s advances';
    end if;

    select (m.archived_at is null) into v_live
      from public.materials m where m.id = p_material_id;
    if coalesce(v_live, false) then
      raise exception 'delete the delivery before refunding its advance';
    end if;
  end if;

  insert into public.supplier_advances (supplier_id, amount, description, material_id)
  values (v_supplier, -v_net, 'Returned to advance — delivery deleted', p_material_id);
  return true;
end;
$$;

revoke execute on function public.deduct_supplier_advance_for_material(uuid) from public;
revoke execute on function public.refund_supplier_advance_for_material(uuid) from public;
grant execute on function public.deduct_supplier_advance_for_material(uuid) to authenticated;
grant execute on function public.refund_supplier_advance_for_material(uuid) to authenticated;
