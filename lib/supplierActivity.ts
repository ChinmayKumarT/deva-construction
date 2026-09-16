import { lineTotal } from "@/lib/money";

/**
 * A read-only, human-readable activity log for one supplier's account: every
 * money movement in time order, with the running Remaining and Advance balance
 * *after* each one. It is derived from the same rows lib/supplierAccount.ts
 * reads (deliveries, advances, payments), so the last event's figures reconcile
 * exactly with the Remaining / Advance shown at the top of the supplier page --
 * this is the "how did we get here" trail, not a second source of truth.
 *
 * Why the running figures line up: advance balance is max(0, sum of all ledger
 * amounts), and outstanding is the sum of delivery costs less what advances and
 * payments have put against them -- both are plain cumulative sums, so replaying
 * them in time order lands on the same totals supplierMoney() computes in one
 * shot. Remaining is max(0, outstanding - advance) at each step.
 */
export type SupplierActivityKind =
  | "delivery"
  | "advance_given"
  | "advance_settled"
  | "advance_returned"
  | "payment"
  | "bill";

export type SupplierActivityEvent = {
  at: string;
  kind: SupplierActivityKind;
  label: string;
  /** Transaction size, always positive; the label and kind carry direction. */
  amount: number;
  /** Running figures AFTER this event. */
  remaining: number;
  advance: number;
};

type ActivityMaterial = {
  name?: string | null;
  unit?: string | null;
  quantity: number | string;
  unit_cost: number | string;
  status: string;
  ordered_at?: string | null;
  delivered_at?: string | null;
};
type ActivityPayment = {
  amount: number | string;
  status: string;
  description?: string | null;
  created_at: string | null;
  material_id?: string | null;
};
type ActivityAdvance = {
  amount: number | string;
  description?: string | null;
  created_at: string | null;
  material_id?: string | null;
  payment_id?: string | null;
};

const n = (v: number | string) => Number(v) || 0;

export function supplierActivity(
  materials: ActivityMaterial[],
  payments: ActivityPayment[],
  advances: ActivityAdvance[],
): SupplierActivityEvent[] {
  type Raw = {
    at: string;
    kind: SupplierActivityKind;
    label: string;
    amount: number;
    dOut: number; // change to outstanding
    dAdv: number; // change to advance balance
  };
  const raw: Raw[] = [];

  for (const m of materials) {
    if (m.status === "returned") continue;
    const cost = lineTotal(m.quantity, m.unit_cost);
    if (cost <= 0) continue;
    raw.push({
      at: m.delivered_at ?? m.ordered_at ?? "",
      kind: "delivery",
      label: `Delivery recorded${m.name ? ` — ${m.name}` : ""}`,
      amount: cost,
      dOut: cost,
      dAdv: 0,
    });
  }

  for (const a of advances) {
    const amt = n(a.amount);
    const at = a.created_at ?? "";
    if (amt < 0) {
      // Advance drawn down against a delivery (or a legacy bill).
      raw.push({ at, kind: "advance_settled", label: a.description || "Settled from advance", amount: -amt, dOut: amt, dAdv: amt });
    } else if (a.material_id || a.payment_id) {
      // Credit handed back when a settled delivery was deleted.
      raw.push({ at, kind: "advance_returned", label: a.description || "Advance returned", amount: amt, dOut: amt, dAdv: amt });
    } else {
      // Money handed over.
      raw.push({ at, kind: "advance_given", label: a.description || "Advance given", amount: amt, dOut: 0, dAdv: amt });
    }
  }

  for (const p of payments) {
    const amt = n(p.amount);
    const at = p.created_at ?? "";
    if (p.status === "paid") {
      if (p.material_id) {
        raw.push({ at, kind: "payment", label: p.description ? `Paid — ${p.description}` : "Delivery paid", amount: amt, dOut: -amt, dAdv: 0 });
      } else {
        raw.push({ at, kind: "payment", label: p.description || "Payment", amount: amt, dOut: 0, dAdv: 0 });
      }
    } else if (p.status === "pending" || p.status === "approved") {
      raw.push({ at, kind: "bill", label: p.description || "Bill raised", amount: amt, dOut: amt, dAdv: 0 });
    }
  }

  // Oldest first to accumulate; rows with no timestamp sort to the front.
  raw.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));

  let out = 0;
  let adv = 0;
  return raw.map((r) => {
    out += r.dOut;
    adv += r.dAdv;
    const advance = Math.max(0, adv);
    return {
      at: r.at,
      kind: r.kind,
      label: r.label,
      amount: r.amount,
      advance,
      remaining: Math.max(0, out - advance),
    };
  });
}
