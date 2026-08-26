-- Link supplier bills raised by the old "Generate bill" form to the deliveries
-- they were for, and flag those deliveries as billed.
--
-- Until 40_supplier_delivery_autobill.sql there was no link between the two
-- tables, and the supplier-facing generateBill() inserted a payments row
-- without touching materials.billed. The admin's "Purchase (optional)" picker
-- on /admin/payments lists materials where billed = false, so every delivery
-- billed through that old form is still sitting in the dropdown inviting a
-- second bill for goods already invoiced.
--
-- Run AFTER 40_supplier_delivery_autobill.sql. Safe to run more than once:
-- both statements skip rows that are already linked or already flagged.

-- Match on project + supplier + exact line total, but only commit the link
-- where it is unambiguous IN BOTH DIRECTIONS -- one candidate material for
-- this payment, and one candidate payment for that material.
--
-- The two-way guard matters. A supplier who delivered two different 200-rupee
-- items to the same site produces two payments and two materials that all
-- match each other; picking a pairing arbitrarily would attach a bill to the
-- wrong delivery. Silently mis-linking money is worse than leaving a row for
-- a human, so ambiguous groups are skipped and reported at the bottom.
with candidate as (
  select
    p.id as payment_id,
    m.id as material_id,
    count(*) over (partition by p.id) as materials_for_payment,
    count(*) over (partition by m.id) as payments_for_material
  from public.payments p
  join public.materials m
    on  m.project_id  = p.project_id
    and m.supplier_id = p.supplier_id
    and m.archived_at is null
    and m.billed = false
    and round(m.quantity * m.unit_cost, 2) = round(p.amount, 2)
  where p.payee_type  = 'supplier'
    and p.material_id is null
    and p.archived_at is null
    and p.supplier_id is not null
    and p.project_id  is not null
)
update public.payments p
   set material_id = c.material_id
  from candidate c
 where p.id = c.payment_id
   and c.materials_for_payment = 1
   and c.payments_for_material = 1;

-- Flag every delivery that now has a bill pointing at it. Separate from the
-- update above so it also repairs any row linked by other means.
update public.materials m
   set billed = true
  from public.payments p
 where p.material_id  = m.id
   and p.payee_type   = 'supplier'
   and p.archived_at is null
   and m.billed = false;

-- What this declined to guess at. An empty result means every legacy supplier
-- bill was matched. Anything listed needs a human: either the amount does not
-- equal any single delivery's line total (a bill covering several deliveries,
-- or a part payment), or several deliveries match it equally well.
select
  p.id,
  p.created_at::date as billed_on,
  s.name             as supplier,
  pr.name            as project,
  p.amount,
  p.description,
  p.status
from public.payments p
left join public.suppliers s  on s.id  = p.supplier_id
left join public.projects  pr on pr.id = p.project_id
where p.payee_type  = 'supplier'
  and p.material_id is null
  and p.archived_at is null
order by p.created_at;
