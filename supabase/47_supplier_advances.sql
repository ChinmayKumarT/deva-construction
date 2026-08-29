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
