-- An advance now settles a bill as far as it goes.
--
-- The rule used to be all-or-nothing: the credit was consumed only when it
-- covered the WHOLE delivery, because a part-settled bill would otherwise show
-- its full amount outstanding while the credit had already been spent -- the
-- same debt counted twice.
--
-- That protected the arithmetic and misread the money. With a 400 balance and
-- a 1,000 delivery the owner expects the advance to go to zero and 600 to be
-- left owing; instead the advance sat at 400 and Remaining showed 600, which
-- reads as though the 400 were both still in hand and already applied.
--
-- The double count is fixed properly here instead: every consumption row now
-- names the bill it went to (payment_id), so a bill's outstanding amount is
-- its own amount less what the advance has already put against it. Nothing has
-- to be assumed from totals.

alter table public.supplier_advances
  add column if not exists payment_id uuid references public.payments(id) on delete set null;

create index if not exists supplier_advances_payment_id_idx
  on public.supplier_advances(payment_id);

-- Existing consumption rows were written against a delivery, and a delivery
-- has at most one bill (payments.material_id is unique -- see
-- 40_supplier_delivery_autobill.sql), so the link is recoverable.
update public.supplier_advances a
   set payment_id = p.id
  from public.payments p
 where a.payment_id is null
   and a.amount < 0
   and a.material_id is not null
   and p.material_id = a.material_id;

-- Put as much of the supplier's advance balance against one bill as it will
-- take, and mark the bill paid if that clears it.
--
-- Every path that settles a bill from an advance goes through here -- the
-- admin's own purchase billing, a supplier recording their delivery, and the
-- moment an advance is handed over against bills already raised. One rule, in
-- one place: the three used to hold three copies of it.
--
-- Returns the amount applied.
create or replace function public.apply_supplier_advance_to_bill(p_payment_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier uuid;
  v_amount numeric;
  v_status text;
  v_material uuid;
  v_description text;
  v_applied numeric;
  v_owed numeric;
  v_balance numeric;
  v_apply numeric;
begin
  select p.supplier_id, p.amount, p.status, p.material_id, p.description
    into v_supplier, v_amount, v_status, v_material, v_description
    from public.payments p
   where p.id = p_payment_id
     and p.payee_type = 'supplier'
     and p.archived_at is null;

  if v_supplier is null or v_status not in ('pending', 'approved') then
    return 0;
  end if;

  -- Staff, or the supplier the bill belongs to. Nobody else.
  if not (
    public.is_staff()
    or exists (
      select 1 from public.suppliers s
       where s.id = v_supplier and s.profile_id = auth.uid()
    )
  ) then
    raise exception 'not allowed to touch this supplier''s advances';
  end if;

  -- Net, not just the deductions: a refund written when the delivery was
  -- deleted (refund_supplier_advance_for_material) carries the same
  -- payment_id, and giving the money back has to give the debt back with it.
  select coalesce(sum(-a.amount), 0) into v_applied
    from public.supplier_advances a
   where a.payment_id = p_payment_id;

  v_owed := round(coalesce(v_amount, 0), 2) - v_applied;
  if v_owed <= 0 then
    return 0;
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.supplier_advances where supplier_id = v_supplier;
  if v_balance <= 0 then
    return 0;
  end if;

  -- As far as it goes, and no further: the ledger holds money actually handed
  -- over, so the balance stops at zero rather than going negative. What is
  -- still owed is carried by the bill.
  v_apply := least(v_balance, v_owed);

  insert into public.supplier_advances (supplier_id, amount, description, material_id, payment_id)
  values (
    v_supplier, -v_apply,
    'Settled from advance: ' || coalesce(v_description, 'bill'),
    v_material, p_payment_id
  );

  if v_apply >= v_owed then
    update public.payments
       set status = 'paid', paid_at = coalesce(paid_at, now())
     where id = p_payment_id;
  end if;

  return v_apply;
end;
$$;

-- Superseded by apply_supplier_advance_to_bill: it keyed off the delivery and
-- could only ever settle the whole of it.
drop function if exists public.deduct_supplier_advance_for_material(uuid);

revoke execute on function public.apply_supplier_advance_to_bill(uuid) from public;
grant execute on function public.apply_supplier_advance_to_bill(uuid) to authenticated;

-- The refund now names the bill as well, so undoing a delivery undoes what its
-- advance had put against the bill. Otherwise a bill that outlives its deleted
-- delivery -- they are two separate buttons -- would keep looking part-settled
-- with the money already handed back.
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
  v_payment uuid;
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

  select a.payment_id into v_payment
    from public.supplier_advances a
   where a.material_id = p_material_id and a.payment_id is not null
   limit 1;

  -- A bill settled out of the advance was flipped to paid. Handing the money
  -- back makes it owed again, so it cannot stay paid.
  if v_payment is not null then
    update public.payments
       set status = 'approved', paid_at = null
     where id = v_payment and status = 'paid' and archived_at is null;
  end if;

  insert into public.supplier_advances (supplier_id, amount, description, material_id, payment_id)
  values (v_supplier, -v_net, 'Returned to advance — delivery deleted', p_material_id, v_payment);
  return true;
end;
$$;
