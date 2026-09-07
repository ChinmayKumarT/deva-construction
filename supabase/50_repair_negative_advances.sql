-- ONE-OFF REPAIR for data written while 48_supplier_bills_auto_paid.sql was
-- in force. Run 49_supplier_bill_status_from_advance.sql first.
--
-- READ THIS BEFORE RUNNING. It changes rows that represent real money.
-- Run STEP 0 on its own, look at what it reports, and only then run STEP 1
-- and STEP 2. They are written to be run together, in one go, in that order.
--
-- What went wrong: every supplier-recorded delivery deducted its full cost
-- from the advance ledger AND marked its bill 'paid'. Where no advance
-- existed, that invented a payment and drove the balance negative. This
-- undoes exactly those deductions and puts the affected bills back to
-- 'approved' (outstanding), which is what they always were.
--
-- Genuine advances handed to a supplier are never touched: only rows written
-- automatically by a delivery ('Auto-deducted%') are removed, newest first,
-- and only for suppliers whose balance is currently below zero.


-- ============================================================
-- STEP 0 -- PREVIEW. Changes nothing. Run this first.
-- ============================================================
with ledger as (
  select supplier_id, sum(amount) as balance
  from public.supplier_advances group by supplier_id
),
negative as (select * from ledger where balance < 0)
select s.name           as supplier,
       n.balance        as current_balance,
       count(a.id)      as auto_deductions_on_file,
       sum(-a.amount)   as total_auto_deducted
  from negative n
  join public.suppliers s on s.id = n.supplier_id
  left join public.supplier_advances a
         on a.supplier_id = n.supplier_id
        and a.amount < 0
        and a.description like 'Auto-deducted%'
 group by s.name, n.balance
 order by n.balance;


-- ============================================================
-- STEP 1 -- undo the deductions that pushed a balance below zero.
-- ============================================================
create temporary table _repair_undone as
with ledger as (
  select supplier_id, sum(amount) as balance
  from public.supplier_advances group by supplier_id
),
negative as (select supplier_id, balance from ledger where balance < 0),
deductions as (
  select a.id, a.supplier_id, a.amount, a.material_id, n.balance,
         sum(-a.amount) over (
           partition by a.supplier_id
           order by a.created_at desc
           rows between unbounded preceding and current row
         ) as undone_running
    from public.supplier_advances a
    join negative n on n.supplier_id = a.supplier_id
   where a.amount < 0
     and a.description like 'Auto-deducted%'
)
-- Keep undoing, newest first, until the balance is back to zero or above.
select id, supplier_id, material_id
  from deductions
 where undone_running + amount < -balance;

delete from public.supplier_advances
 where id in (select id from _repair_undone);


-- ============================================================
-- STEP 2 -- the bills those deductions were settling are outstanding again.
-- ============================================================
update public.payments p
   set status  = 'approved',
       paid_at = null
  from _repair_undone r
 where p.material_id = r.material_id
   and p.payee_type  = 'supplier'
   and p.status      = 'paid'
   and p.archived_at is null;

-- What the repair did.
select (select count(*) from _repair_undone) as deductions_undone;

drop table _repair_undone;
