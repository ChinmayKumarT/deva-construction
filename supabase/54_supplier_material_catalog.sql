-- An admin-managed price list per supplier: the materials this supplier
-- usually delivers, with their agreed unit and rate.
--
-- Deliberately NOT a foreign key from materials. A delivery row still carries
-- its own free-text name/unit/unit_cost, so a supplier can always deliver
-- something that is not on the list, and removing a list entry never orphans
-- or rewrites a past delivery. This table only feeds the one-tap quick picks
-- above the Record Delivery form -- it is a typing shortcut, not a constraint.

create table public.supplier_materials (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  unit text not null default 'unit',
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- Case-insensitive, and only over live rows: archiving "Cement / bag" has to
-- leave the name free for a later entry at a new rate.
create unique index supplier_materials_unique_live
  on public.supplier_materials (supplier_id, lower(name), lower(unit))
  where archived_at is null;

create index supplier_materials_supplier_live
  on public.supplier_materials (supplier_id)
  where archived_at is null;

alter table public.supplier_materials enable row level security;

create policy "staff_all_supplier_materials"
  on public.supplier_materials for all
  using (public.is_staff()) with check (public.is_staff());

-- Read-only for the supplier: the office sets the agreed rates, the portal
-- only offers them as a prefill. No RPC needed here (unlike
-- supplier_advances, see 51_supplier_advance_rpcs.sql) because nothing on the
-- supplier side ever writes to this table.
create policy "supplier_own_materials"
  on public.supplier_materials for select
  using (supplier_id in (select id from public.suppliers where profile_id = auth.uid()));
