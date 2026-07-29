import { createSupabaseServerClient } from "@/lib/supabase/server";
import { wageForStatus } from "@/lib/wages";

// Shared cash-flow calculation for app/admin/cashflow and the per-project
// section on app/admin/reports/[id]. Deliberately a different number from
// "Spent" elsewhere in the app (materials + labour-only payments, to avoid
// double-counting against materials cost) -- cash flow asks "what actually
// left the bank," so materials cost, supplier payments and labour payments
// are each their own outflow category rather than blended into one figure.
// Attendance wages are included as their own category too -- they're an
// accrued cost rather than cash paid out, but shown here on request so the
// full outflow picture (including unpaid wage liability) is visible in one
// place, same as the "Spent" figure on the reports page.
export async function computeCashFlow(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  from: string,
  to: string,
  projectId?: string,
) {
  let materialsQuery = supabase
    .from("materials")
    .select("project_id, quantity, unit_cost, status, ordered_at, delivered_at")
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
  const labourerWage = new Map((labourers ?? []).map((l) => [l.id, Number(l.daily_wage)]));

  let materialsCost = 0;
  let supplierPayments = 0;
  let labourPayments = 0;
  let wages = 0;
  const byProjectMaterials = new Map<string, number>();
  const byProjectSupplier = new Map<string, number>();
  const byProjectLabour = new Map<string, number>();
  const byProjectWages = new Map<string, number>();

  for (const m of materials ?? []) {
    if (m.status === "returned" || !m.project_id) continue;
    const date = m.delivered_at ?? m.ordered_at;
    if (!date || date < from || date > to) continue;
    const amount = Number(m.quantity) * Number(m.unit_cost);
    materialsCost += amount;
    byProjectMaterials.set(m.project_id, (byProjectMaterials.get(m.project_id) ?? 0) + amount);
  }
  for (const p of payments ?? []) {
    if (!p.project_id || !p.created_at) continue;
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
  for (const a of attendance ?? []) {
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

export function defaultCashFlowRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { fromStr: from.toISOString().slice(0, 10), toStr: now.toISOString().slice(0, 10) };
}
