/**
 * The four figures shown for a supplier, derived in one place so the admin
 * list, the supplier detail page and the supplier's own dashboard cannot drift
 * apart. They have drifted twice already.
 *
 * The model, in the owner's words: an advance is money that has left, so it
 * settles what is owed and any surplus leaves you in credit.
 *
 *   Advance balance   money handed over, less what bills have taken from it.
 *                     Never negative -- it only ever shows real money given.
 *
 *   Lifetime payment  every rupee that has actually left the account.
 *
 *   Remaining         what is still owed, and never less than zero. Once an
 *                     advance has cleared the bills there is nothing owed, so
 *                     Remaining rests at 0 and the surplus shows as advance
 *                     balance instead -- credit belongs in one place, not as a
 *                     negative in another.
 *
 * An advance settles a bill as far as it goes. A 400 balance against a 1,000
 * bill leaves the balance at 0 and 600 owing -- not 400 sitting in hand while
 * Remaining already reads 600, which is the same money shown in two places.
 *
 * That partial settlement is why every consumption row names the bill it went
 * to (`payment_id`, see 52_partial_advance_application.sql). A bill's own
 * amount is not what is owed on it; what is owed is that amount less what the
 * advance has already put against it. Without the link the two could only be
 * guessed at from totals, which is why the rule used to be all-or-nothing.
 *
 * The subtraction in `lifetimePayment` is the other part worth understanding.
 * A bill settled out of an advance is marked paid, but that money was already
 * counted when the advance was handed over -- adding both would count it
 * twice. So the consumption tied to PAID bills is subtracted back out, and
 * only that: credit sitting against a bill still owing has not been counted
 * anywhere else.
 *
 *   advance 1,000, one 200 bill settled from it
 *     -> 1000 (given) + 200 (paid bill) - 200 (consumed) = 1,000  correct
 *     -> without the subtraction:                          1,200  wrong
 */
export type SupplierMoneyInput = {
  payments: { id?: string | null; amount: number | string; status: string }[];
  advances: { amount: number | string; payment_id?: string | null; material_id?: string | null }[];
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

export function supplierMoney({ payments, advances }: SupplierMoneyInput): SupplierMoney {
  // What the advance has already put against each bill. Positive rows against
  // a bill are refunds (a deleted delivery handing its credit back), so this
  // is the net, not the sum of the deductions.
  const appliedTo = new Map<string, number>();
  // Consumption from before bills were linked, and settlements of bills that
  // no longer exist. The old rule only ever settled a bill in full, so this
  // credit belongs to bills that were marked paid.
  let unlinkedConsumed = 0;

  for (const a of advances) {
    const amt = n(a.amount);
    if (a.payment_id) {
      appliedTo.set(a.payment_id, (appliedTo.get(a.payment_id) ?? 0) - amt);
    } else if (amt < 0) {
      unlinkedConsumed -= amt;
    }
  }

  const applied = (p: { id?: string | null }) =>
    (p.id ? appliedTo.get(p.id) ?? 0 : 0);

  const outstanding = payments
    .filter((p) => p.status === "pending" || p.status === "approved")
    .reduce((s, p) => s + Math.max(0, n(p.amount) - applied(p)), 0);

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
