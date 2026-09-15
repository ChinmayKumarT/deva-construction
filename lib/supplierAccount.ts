import { lineTotal } from "@/lib/money";

/**
 * The four figures shown for a supplier, derived in one place so the admin
 * list, the supplier detail page and the supplier's own dashboard cannot drift
 * apart. They have drifted twice already.
 *
 * The model, in the owner's words: an advance is money that has left, so it
 * settles what is owed and any surplus leaves you in credit.
 *
 *   Advance balance   money handed over, less what purchases have taken from
 *                     it. Never negative -- it only ever shows real money given.
 *
 *   Lifetime payment  every rupee that has actually left the account.
 *
 *   Remaining         what is still owed, and never less than zero. Once an
 *                     advance has cleared what is owed there is nothing left, so
 *                     Remaining rests at 0 and the surplus shows as advance
 *                     balance instead -- credit belongs in one place, not as a
 *                     negative in another.
 *
 * What "owed" is made of, since Sep 2026 (see supplier-auto-billing brain page):
 * a delivery no longer raises a bill. The unpaid purchase IS the debt. So
 * `outstanding` is the sum of two disjoint things:
 *   - open purchases  -- delivered materials not yet settled (`billed = false`),
 *     each owing its line total less whatever advance has been put against it
 *     (material-linked ledger rows, `material_id` set and `payment_id` null).
 *   - legacy / ad-hoc bills -- `payments` rows still pending/approved, each
 *     owing its amount less the advance put against it (`payment_id`). These are
 *     old auto-created bills and manual supplier bills the owner types in.
 * The two never overlap: a purchase that has a bill is `billed = true`, so it is
 * counted through the bill, not the material.
 *
 * An advance settles a purchase as far as it goes. A 400 balance against a
 * 1,000 purchase leaves the balance at 0 and 600 owing -- not 400 sitting in
 * hand while Remaining already reads 600, which is the same money twice.
 *
 * That partial settlement is why every consumption row names what it went to
 * (`material_id`, or `payment_id` for a bill; see 52/57_*.sql). What is owed on
 * a purchase is its line total less what the advance has already put against it.
 *
 * The subtraction in `lifetimePayment` is the other part worth understanding.
 * A legacy BILL settled out of an advance was marked paid at its full amount,
 * but that money was already counted when the advance was handed over -- adding
 * both would count it twice, so the consumption tied to PAID bills is
 * subtracted back out. Purchases settled from advance never create a payment
 * row at all, so there is nothing to subtract there: the money shows once, as
 * the advance given.
 *
 *   advance 1,000, one 200 bill settled from it
 *     -> 1000 (given) + 200 (paid bill) - 200 (consumed) = 1,000  correct
 *     -> without the subtraction:                          1,200  wrong
 */
export type SupplierMoneyInput = {
  payments: { id?: string | null; amount: number | string; status: string }[];
  advances: { amount: number | string; payment_id?: string | null; material_id?: string | null }[];
  /** Open purchases -- a supplier's delivered materials that are not yet
   *  settled. Each is a debt in its own right now that deliveries no longer
   *  raise a bill. Pass the supplier's materials; settled (`billed`) and
   *  returned ones are ignored here. */
  materials?: {
    id: string;
    quantity: number | string;
    unit_cost: number | string;
    status: string;
    billed?: boolean | null;
  }[];
};

export type SupplierMoney = {
  /** Bills raised and not yet settled, net of credit already put against
   *  them. Never negative. */
  outstanding: number;
  /** Unused credit the supplier is holding. Never negative. */
  advanceBalance: number;
  /** Every rupee that has actually left the account. */
  lifetimePayment: number;
  /** Owed, after credit is applied. Never negative -- surplus credit shows
   *  as advanceBalance instead. */
  remaining: number;
};

const n = (v: number | string) => Number(v) || 0;

/**
 * Net advance put against each material (`material_id` set, `payment_id` null).
 * Positive rows are refunds handing credit back, so this is the net. Shared so
 * the pages can badge a purchase as "paid from advance" using the exact figure
 * the money math uses.
 */
export function advanceAppliedByMaterial(
  advances: SupplierMoneyInput["advances"],
): Map<string, number> {
  const applied = new Map<string, number>();
  for (const a of advances) {
    if (a.material_id && !a.payment_id) {
      applied.set(a.material_id, (applied.get(a.material_id) ?? 0) - n(a.amount));
    }
  }
  return applied;
}

export function supplierMoney({ payments, advances, materials }: SupplierMoneyInput): SupplierMoney {
  // What the advance has already put against each bill. Positive rows against
  // a bill are refunds (a deleted delivery handing its credit back), so this
  // is the net, not the sum of the deductions.
  const appliedTo = new Map<string, number>();
  // Net advance put against each open purchase, keyed by material_id.
  const appliedToMaterial = new Map<string, number>();
  // Consumption from before bills were linked, and settlements of bills that
  // no longer exist. The old rule only ever settled a bill in full, so this
  // credit belongs to bills that were marked paid.
  let unlinkedConsumed = 0;

  for (const a of advances) {
    const amt = n(a.amount);
    if (a.payment_id) {
      appliedTo.set(a.payment_id, (appliedTo.get(a.payment_id) ?? 0) - amt);
    } else if (a.material_id) {
      // A purchase settled from advance -- linked to the material, not a bill.
      appliedToMaterial.set(a.material_id, (appliedToMaterial.get(a.material_id) ?? 0) - amt);
    } else if (amt < 0) {
      unlinkedConsumed -= amt;
    }
  }

  const applied = (p: { id?: string | null }) =>
    (p.id ? appliedTo.get(p.id) ?? 0 : 0);

  // Two disjoint sources of "owed": legacy/ad-hoc bills still pending or
  // approved, and open purchases that never became a bill. A purchase with a
  // bill is billed=true, so it is counted through the bill below, not here.
  const billOutstanding = payments
    .filter((p) => p.status === "pending" || p.status === "approved")
    .reduce((s, p) => s + Math.max(0, n(p.amount) - applied(p)), 0);

  const materialOutstanding = (materials ?? [])
    .filter((m) => !m.billed && m.status !== "returned")
    .reduce(
      (s, m) => s + Math.max(0, lineTotal(m.quantity, m.unit_cost) - (appliedToMaterial.get(m.id) ?? 0)),
      0,
    );

  const outstanding = billOutstanding + materialOutstanding;

  const paid = payments.filter((p) => p.status === "paid");
  const paidBills = paid.reduce((s, p) => s + n(p.amount), 0);
  const consumedAgainstPaid = paid.reduce((s, p) => s + applied(p), 0) + unlinkedConsumed;

  // A row is one of two things: money handed over (positive, tied to nothing),
  // or credit moving against a bill (tied to one, negative when applied and
  // positive when a deleted delivery hands it back). Counting a refund as
  // money given would report it as a second advance.
  const linked = (a: { amount: number | string; payment_id?: string | null; material_id?: string | null }) =>
    Boolean(a.payment_id || a.material_id);

  const given = advances
    .filter((a) => n(a.amount) > 0 && !linked(a))
    .reduce((s, a) => s + n(a.amount), 0);
  const consumed = advances
    .filter((a) => linked(a) || n(a.amount) < 0)
    .reduce((s, a) => s - n(a.amount), 0);

  const advanceBalance = Math.max(0, given - consumed);

  return {
    outstanding,
    advanceBalance,
    lifetimePayment: given + paidBills - consumedAgainstPaid,
    remaining: Math.max(0, outstanding - advanceBalance),
  };
}
