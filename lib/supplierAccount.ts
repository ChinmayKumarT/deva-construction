/**
 * The four figures shown for a supplier, derived in one place so the admin
 * list, the supplier detail page and the supplier's own dashboard cannot drift
 * apart. They have drifted twice already.
 *
 * The model, in the owner's words: an advance is money that has left, so it
 * settles what is owed and any surplus leaves you in credit.
 *
 *   Advance balance   money handed over, less what deliveries have consumed.
 *                     Never negative -- it only ever shows real money given.
 *
 *   Lifetime payment  every rupee that has actually left the account.
 *
 *   Remaining         what is still owed. Goes NEGATIVE when advances run
 *                     ahead of deliveries, which reads as "they owe us goods".
 *
 * The subtraction in `lifetimePayment` is the part worth understanding. A bill
 * settled out of an advance is marked paid, but that money was already counted
 * when the advance was handed over -- adding both would count it twice. Every
 * settlement writes a negative ledger row, so subtracting the consumed total
 * removes exactly the double count and nothing else.
 *
 *   advance 1,000, one 200 bill settled from it
 *     -> 1000 (given) + 200 (paid bill) - 200 (consumed) = 1,000  correct
 *     -> without the subtraction:                          1,200  wrong
 */
export type SupplierMoneyInput = {
  payments: { amount: number | string; status: string }[];
  advances: { amount: number | string }[];
};

export type SupplierMoney = {
  /** Bills raised and not yet settled. Never negative. */
  outstanding: number;
  /** Unused credit the supplier is holding. Never negative. */
  advanceBalance: number;
  /** Every rupee that has actually left the account. */
  lifetimePayment: number;
  /** Owed minus credit held. Negative means we are ahead. */
  remaining: number;
};

const n = (v: number | string) => Number(v) || 0;

export function supplierMoney({ payments, advances }: SupplierMoneyInput): SupplierMoney {
  const outstanding = payments
    .filter((p) => p.status === "pending" || p.status === "approved")
    .reduce((s, p) => s + n(p.amount), 0);

  const paidBills = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + n(p.amount), 0);

  const given = advances.filter((a) => n(a.amount) > 0).reduce((s, a) => s + n(a.amount), 0);
  const consumed = advances.filter((a) => n(a.amount) < 0).reduce((s, a) => s - n(a.amount), 0);

  const advanceBalance = given - consumed;

  return {
    outstanding,
    advanceBalance,
    lifetimePayment: given + paidBills - consumed,
    remaining: outstanding - advanceBalance,
  };
}
