import type { DailyCashFlowPoint } from "@/lib/cashflow";

// Pure aggregation over `payments` rows for the admin Payments index page's
// charts. Deliberately separate from lib/cashflow.ts's computeCashFlow,
// which conflates materials cost and attendance wages into "outflow" --
// this page is specifically about the payments table, not the broader
// cash-flow picture. Only paid/approved payments count, matching cash
// flow's own convention for "real" outflow (pending/rejected aren't money
// that's actually moved).
type ChartPayment = {
  project_id: string | null;
  payee_type: string;
  amount: number | string;
  status: string;
  created_at: string | null;
};

export function byProjectTotals(payments: ChartPayment[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of payments) {
    if (!p.project_id || (p.status !== "paid" && p.status !== "approved")) continue;
    totals.set(p.project_id, (totals.get(p.project_id) ?? 0) + Number(p.amount));
  }
  return totals;
}

export function payeeTypeSplit(payments: ChartPayment[]): { labour: number; supplier: number } {
  let labour = 0;
  let supplier = 0;
  for (const p of payments) {
    if (p.status !== "paid" && p.status !== "approved") continue;
    if (p.payee_type === "labour") labour += Number(p.amount);
    else if (p.payee_type === "supplier") supplier += Number(p.amount);
  }
  return { labour, supplier };
}

// Every day between the data's own earliest and latest payment gets an
// entry (even 0), so the trend line stays continuous. Returns an empty
// array if there are no dated payments at all.
export function dailyPaymentTotals(payments: ChartPayment[]): DailyCashFlowPoint[] {
  const dated = payments
    .filter((p) => p.created_at && (p.status === "paid" || p.status === "approved"))
    .map((p) => ({ date: p.created_at!.slice(0, 10), amount: Number(p.amount) }));
  return dailyTotalsFromDatedAmounts(dated);
}

// Generic version of the same day-bucketing: given a flat list of
// {date, amount} entries (any source -- outgoing payments, client
// payments, anything dated), buckets by day and fills every day between
// the data's own earliest and latest entry (even 0s), so a trend line
// stays continuous instead of jumping between sparse days. Empty input
// returns an empty array rather than a single degenerate point.
export function dailyTotalsFromDatedAmounts(rows: { date: string; amount: number }[]): DailyCashFlowPoint[] {
  if (rows.length === 0) return [];

  const byDate = new Map<string, number>();
  for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.amount);

  const dates = Array.from(byDate.keys()).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];

  const points: DailyCashFlowPoint[] = [];
  let cur = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cur <= end) {
    const d = ymdLocal(cur);
    points.push({ date: d, total: byDate.get(d) ?? 0 });
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
  }
  return points;
}

// Same local-date formatting as lib/cashflow.ts -- toISOString() would
// shift the date backward in any timezone east of UTC.
function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
