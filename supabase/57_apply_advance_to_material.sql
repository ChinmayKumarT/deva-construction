-- Apply a supplier's advance to a delivered PURCHASE, not a bill.
--
-- Deliveries no longer raise a bill (see the supplier-auto-billing brain page):
-- the unpaid material is the debt. This is the material-side twin of
-- apply_supplier_advance_to_bill (52_partial_advance_application.sql): it puts
-- as much of the supplier's advance balance against one purchase as the
-- purchase needs, writes a negative ledger row naming the material (material_id
-- set, payment_id left null), and marks the material settled (`billed = true`)
-- once the advance has covered the whole of it -- which is what drops it out of
-- the Payments "Purchase" picker and shows it as "paid from advance".
--
-- Runs from every delivery path (the supplier's own recordDelivery, the admin
-- material form, marking an ordered material delivered) and again whenever an
-- advance is handed over, so credit given after a purchase still reaches it.
--
-- Returns the amount applied.
create or replace function public.apply_supplier_advance_to_material(p_material_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier uuid;
  v_status text;
  v_billed boolean;
  v_name text;
  v_cost numeric;
  v_applied numeric;
  v_owed numeric;
  v_balance numeric;
  v_apply numeric;
begin
  select m.supplier_id, m.status, m.billed, m.name,
         round(coalesce(m.quantity, 0) * coalesce(m.unit_cost, 0), 2)
    into v_supplier, v_status, v_billed, v_name, v_cost
    from public.materials m
   where m.id = p_material_id
     and m.archived_at is null;

  -- Nothing to do for a returned purchase, one already settled, or one with no
  -- supplier to draw an advance from.
  if v_supplier is null or coalesce(v_billed, false) or v_status = 'returned' then
    return 0;
  end if;

  -- Staff, or the supplier the purchase belongs to. Nobody else.
  if not (
    public.is_staff()
    or exists (
      select 1 from public.suppliers s
       where s.id = v_supplier and s.profile_id = auth.uid()
    )
  ) then
    raise exception 'not allowed to touch this supplier''s advances';
  end if;

  -- What the advance has already put against this material (net of any refund).
  -- Only material-linked rows -- a bill settlement (payment_id set) is a
  -- different thing and must not be swept in here.
  select coalesce(sum(-a.amount), 0) into v_applied
    from public.supplier_advances a
   where a.material_id = p_material_id
     and a.payment_id is null;

  v_owed := coalesce(v_cost, 0) - v_applied;
  if v_owed <= 0 then
    -- Already covered (e.g. an earlier run). Make sure it reads as settled.
    update public.materials set billed = true
     where id = p_material_id and coalesce(billed, false) = false;
    return 0;
  end if;

  select coalesce(sum(amount), 0) into v_balance
    from public.supplier_advances where supplier_id = v_supplier;
  if v_balance <= 0 then
    return 0;
  end if;

  -- As far as it goes, and no further: the ledger holds money actually handed
  -- over, so the balance stops at zero. What is still owed stays on the
  -- purchase and keeps showing in the picker.
  v_apply := least(v_balance, v_owed);

  insert into public.supplier_advances (supplier_id, amount, description, material_id, payment_id)
  values (
    v_supplier, -v_apply,
    'Settled from advance: ' || coalesce(v_name, 'purchase'),
    p_material_id, null
  );

  -- Fully covered -> the purchase is paid from advance and leaves the picker.
  if v_applied + v_apply >= v_cost then
    update public.materials set billed = true where id = p_material_id;
  end if;

  return v_apply;
end;
$$;

revoke execute on function public.apply_supplier_advance_to_material(uuid) from public;
grant execute on function public.apply_supplier_advance_to_material(uuid) to authenticated;

-- Settle the supplier's open purchases from a balance just handed over, oldest
-- first, each taking as much as it needs. The mirror of the bill path in
-- giveSupplierAdvance -- a delivery already on the books when the advance
-- arrives still gets covered.
create or replace function public.settle_supplier_purchases_from_advance(p_supplier_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material uuid;
  v_balance numeric;
begin
  if not (
    public.is_staff()
    or exists (
      select 1 from public.suppliers s
       where s.id = p_supplier_id and s.profile_id = auth.uid()
    )
  ) then
    raise exception 'not allowed to touch this supplier''s advances';
  end if;

  for v_material in
    select m.id
      from public.materials m
     where m.supplier_id = p_supplier_id
       and m.archived_at is null
       and coalesce(m.billed, false) = false
       and m.status <> 'returned'
     order by coalesce(m.delivered_at, m.ordered_at, m.created_at) asc
  loop
    select coalesce(sum(amount), 0) into v_balance
      from public.supplier_advances where supplier_id = p_supplier_id;
    exit when v_balance <= 0;
    perform public.apply_supplier_advance_to_material(v_material);
  end loop;
end;
$$;

revoke execute on function public.settle_supplier_purchases_from_advance(uuid) from public;
grant execute on function public.settle_supplier_purchases_from_advance(uuid) to authenticated;
