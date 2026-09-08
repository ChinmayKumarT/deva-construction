-- One-off repair. Not part of setup_all.sql -- nothing to repair on a fresh
-- database.
--
-- 52 changed the rule going forward: an advance settles a bill as far as it
-- goes. Balances already sitting in the ledger were left where the old
-- all-or-nothing rule put them -- a 400 advance against a 1,000 bill still
-- reading 400 in hand and 600 owing, which is the report that prompted the
-- change. This applies them once, exactly as apply_supplier_advance_to_bill
-- would have, oldest bill first.
--
-- Written out longhand rather than calling that function because it checks
-- auth.uid()/is_staff(), and the SQL editor is neither.
--
-- Safe to run more than once: a second run finds every balance already
-- applied and does nothing.
do $$
declare
  r_supplier record;
  r_bill record;
  v_balance numeric;
  v_applied numeric;
  v_owed numeric;
  v_apply numeric;
begin
  for r_supplier in
    select distinct supplier_id from public.supplier_advances
  loop
    select coalesce(sum(amount), 0) into v_balance
      from public.supplier_advances where supplier_id = r_supplier.supplier_id;

    for r_bill in
      select p.id, p.amount, p.description, p.material_id
        from public.payments p
       where p.supplier_id = r_supplier.supplier_id
         and p.payee_type = 'supplier'
         and p.status in ('pending', 'approved')
         and p.archived_at is null
       order by p.created_at
    loop
      exit when v_balance <= 0;

      select coalesce(sum(-a.amount), 0) into v_applied
        from public.supplier_advances a where a.payment_id = r_bill.id;

      v_owed := round(coalesce(r_bill.amount, 0), 2) - v_applied;
      continue when v_owed <= 0;

      v_apply := least(v_balance, v_owed);

      insert into public.supplier_advances
        (supplier_id, amount, description, material_id, payment_id)
      values (
        r_supplier.supplier_id, -v_apply,
        'Settled from advance: ' || coalesce(r_bill.description, 'bill'),
        r_bill.material_id, r_bill.id
      );

      if v_apply >= v_owed then
        update public.payments
           set status = 'paid', paid_at = coalesce(paid_at, now())
         where id = r_bill.id;
      end if;

      v_balance := v_balance - v_apply;
    end loop;
  end loop;
end $$;

-- What the books look like afterwards. Advance balance should never be
-- negative, and a supplier holding credit should have no bill still owing.
select s.name,
       coalesce(sum(a.amount), 0) as advance_balance,
       (select coalesce(sum(p.amount), 0)
          from public.payments p
         where p.supplier_id = s.id
           and p.payee_type = 'supplier'
           and p.status in ('pending', 'approved')
           and p.archived_at is null) as bills_outstanding
  from public.suppliers s
  left join public.supplier_advances a on a.supplier_id = s.id
 group by s.id, s.name
 having coalesce(sum(a.amount), 0) <> 0
 order by s.name;
