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
