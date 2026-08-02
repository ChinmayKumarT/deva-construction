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
