import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { wageForStatus } from "@/lib/wages";
import { lineTotal } from "@/lib/money";

// Plain row shapes the pure reducer works on. Numeric fields may arrive as
// strings from Postgres, so everything is coerced with Number() below.
type CashMaterial = {
  project_id: string | null;
  quantity: number | string;
  unit_cost: number | string;
  status: string;
  ordered_at: string | null;
  delivered_at: string | null;
  billed: boolean;
};
type CashPayment = {
  project_id: string | null;
  payee_type: string;
  amount: number | string;
  status: string;
  created_at: string | null;
};
type CashAttendance = {
  project_id: string | null;
  status: string;
  labourer_id: string;
  date: string;
};
type CashLabourer = { id: string; daily_wage: number | string };

export type CashFlow = ReturnType<typeof reduceCashFlow> & { daily: DailyCashFlowPoint[] };

// Pure cash-flow reduction over already-fetched rows -- no I/O, so it can be
// unit-tested directly. Deliberately a different number from "Spent" elsewhere
// (materials + labour-only payments, to avoid double-counting against materials
// cost): cash flow asks "what actually left the bank," so materials cost,
// supplier payments and labour payments are each their own outflow category.
// Attendance wages are their own category too -- an accrued cost rather than
// cash paid out, shown so the full outflow picture (including unpaid wage
// liability) is visible in one place.
//
// `from`/`to` are inclusive `YYYY-MM-DD` bounds. Materials are dated by
// delivered_at ?? ordered_at; payments by created_at (date part); attendance by
// its own date. Only paid/approved payments count; returned materials and
// zero-weight (absent) attendance are excluded. Billed materials (paid off via
// the Payments form's linked-purchase picker) are also excluded from materials
// cost, since their amount is already counted under supplier payments -- the
// picker copies the material's line total into the new payments row, so
// counting both would double the outflow for that purchase.
export function reduceCashFlow(
  materials: CashMaterial[],
  payments: CashPayment[],
  attendance: CashAttendance[],
  labourers: CashLabourer[],
  from: string,
  to: string,
) {
  const labourerWage = new Map(labourers.map((l) => [l.id, Number(l.daily_wage)]));

  let materialsCost = 0;
  let supplierPayments = 0;
  let labourPayments = 0;
  let wages = 0;
  const byProjectMaterials = new Map<string, number>();
  const byProjectSupplier = new Map<string, number>();
  const byProjectLabour = new Map<string, number>();
  const byProjectWages = new Map<string, number>();

  for (const m of materials) {
    if (m.status === "returned" || m.billed || !m.project_id) continue;
    const date = m.delivered_at ?? m.ordered_at;
    if (!date || date < from || date > to) continue;
    const amount = lineTotal(m.quantity, m.unit_cost);
    materialsCost += amount;
    byProjectMaterials.set(m.project_id, (byProjectMaterials.get(m.project_id) ?? 0) + amount);
  }
  for (const p of payments) {
    if (!p.project_id || !p.created_at) continue;
    if (p.status !== "paid" && p.status !== "approved") continue;
    const date = p.created_at.slice(0, 10);
    if (date < from || date > to) continue;
    if (p.payee_type === "supplier") {
      supplierPayments += Number(p.amount);
      byProjectSupplier.set(p.project_id, (byProjectSupplier.get(p.project_id) ?? 0) + Number(p.amount));
    } else if (p.payee_type === "labour") {
      labourPayments += Number(p.amount);
      byProjectLabour.set(p.project_id, (byProjectLabour.get(p.project_id) ?? 0) + Number(p.amount));
    }
  }
  for (const a of attendance) {
    if (!a.project_id || a.date < from || a.date > to) continue;
    const amount = wageForStatus(a.status, labourerWage.get(a.labourer_id) ?? 0);
    if (amount <= 0) continue;
    wages += amount;
    byProjectWages.set(a.project_id, (byProjectWages.get(a.project_id) ?? 0) + amount);
  }

  return {
    materialsCost, supplierPayments, labourPayments, wages,
    total: materialsCost + supplierPayments + labourPayments + wages,
    byProjectMaterials, byProjectSupplier, byProjectLabour, byProjectWages,
  };
}

export type DailyCashFlowPoint = { date: string; total: number };

// Same rows, same rules as reduceCashFlow, but bucketed by day instead of
// summed into one total -- this is what the trend chart plots. Every day in
// the range gets an entry (even 0), so the line stays continuous instead of
// jumping between the sparse days something actually happened.
export function dailyCashFlowTotals(
  materials: CashMaterial[],
  payments: CashPayment[],
  attendance: CashAttendance[],
  labourers: CashLabourer[],
  from: string,
  to: string,
): DailyCashFlowPoint[] {
  const labourerWage = new Map(labourers.map((l) => [l.id, Number(l.daily_wage)]));
  const byDate = new Map<string, number>();
  const add = (date: string, amount: number) => byDate.set(date, (byDate.get(date) ?? 0) + amount);

  for (const m of materials) {
    if (m.status === "returned" || m.billed || !m.project_id) continue;
    const date = m.delivered_at ?? m.ordered_at;
    if (!date) continue;
    const d = date.slice(0, 10);
    if (d < from || d > to) continue;
    add(d, lineTotal(m.quantity, m.unit_cost));
  }
  for (const p of payments) {
    if (!p.project_id || !p.created_at) continue;
    if (p.status !== "paid" && p.status !== "approved") continue;
    const d = p.created_at.slice(0, 10);
    if (d < from || d > to) continue;
    add(d, Number(p.amount));
  }
  for (const a of attendance) {
    if (!a.project_id || a.date < from || a.date > to) continue;
    const amount = wageForStatus(a.status, labourerWage.get(a.labourer_id) ?? 0);
    if (amount > 0) add(a.date, amount);
  }

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

/** Running total over daily points -- what the trend chart's line actually plots. */
export function toCumulative(daily: DailyCashFlowPoint[]): DailyCashFlowPoint[] {
  let running = 0;
  return daily.map((d) => {
    running += d.total;
    return { date: d.date, total: running };
  });
}

// Shared cash-flow calculation for app/admin/cashflow and the per-project
// section on app/admin/reports/[id]. Fetches the rows, then delegates the math
// to reduceCashFlow above.
export async function computeCashFlow(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  from: string,
  to: string,
  projectId?: string,
): Promise<CashFlow> {
  let materialsQuery = supabase
    .from("materials")
    .select("project_id, quantity, unit_cost, status, ordered_at, delivered_at, billed")
    .is("archived_at", null);
  let paymentsQuery = supabase
    .from("payments")
    .select("project_id, payee_type, amount, status, created_at")
    .is("archived_at", null)
    .in("status", ["paid", "approved"]);
  let attendanceQuery = supabase
    .from("attendance")
    .select("project_id, status, labourer_id, date");

  if (projectId) {
    materialsQuery = materialsQuery.eq("project_id", projectId);
    paymentsQuery = paymentsQuery.eq("project_id", projectId);
    attendanceQuery = attendanceQuery.eq("project_id", projectId);
  }

  const [{ data: materials }, { data: payments }, { data: attendance }, { data: labourers }] = await Promise.all([
    materialsQuery,
    paymentsQuery,
    attendanceQuery,
    supabase.from("labourers").select("id, daily_wage"),
  ]);

  const m = (materials ?? []) as CashMaterial[];
  const p = (payments ?? []) as CashPayment[];
  const a = (attendance ?? []) as CashAttendance[];
  const l = (labourers ?? []) as CashLabourer[];

  return {
    ...reduceCashFlow(m, p, a, l, from, to),
    daily: dailyCashFlowTotals(m, p, a, l, from, to),
  };
}

// Format a Date as YYYY-MM-DD from its LOCAL calendar parts. Going through
// toISOString() here would be a bug: it converts to UTC first, so in any
// timezone east of UTC (e.g. IST) local midnight on the 1st lands on the
// previous month's last day, shifting the default range back a day.
function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultCashFlowRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { fromStr: ymdLocal(from), toStr: ymdLocal(now) };
}
