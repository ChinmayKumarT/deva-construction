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
