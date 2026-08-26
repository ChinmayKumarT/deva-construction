-- Family grouping for labourers.
-- Labourers sharing the same family_id are a household — when one collects
-- wages, the payment notes who physically received the cash.

alter table public.labourers
  add column if not exists family_id uuid;

create index if not exists labourers_family_id_idx on public.labourers(family_id);

-- Who physically collected the payment (when a family member picks up for another).
alter table public.payments
  add column if not exists collected_by uuid references public.labourers(id) on delete set null;
