import { createSupabaseServerClient } from "@/lib/supabase/server";

// Shared cash-flow calculation for app/admin/cashflow and the per-project
// section on app/admin/reports/[id]. Deliberately a different number from
// "Spent" elsewhere in the app (materials + labour-only payments, to avoid
// double-counting against materials cost) -- cash flow asks "what actually
// left the bank," so materials cost, supplier payments and labour payments
// are each their own outflow category rather than blended into one figure.
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

  if (projectId) {
    materialsQuery = materialsQuery.eq("project_id", projectId);
    paymentsQuery = paymentsQuery.eq("project_id", projectId);
  }

  const [{ data: materials }, { data: payments }] = await Promise.all([materialsQuery, paymentsQuery]);

  let materialsCost = 0;
  let supplierPayments = 0;
  let labourPayments = 0;
  const byProjectMaterials = new Map<string, number>();
  const byProjectSupplier = new Map<string, number>();
  const byProjectLabour = new Map<string, number>();

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

  return {
    materialsCost, supplierPayments, labourPayments,
    total: materialsCost + supplierPayments + labourPayments,
    byProjectMaterials, byProjectSupplier, byProjectLabour,
  };
}

export function defaultCashFlowRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { fromStr: from.toISOString().slice(0, 10), toStr: now.toISOString().slice(0, 10) };
}
