import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { wageForStatus } from "@/lib/wages";
import { lineTotal } from "@/lib/money";

export default async function AdminOverview() {
  const supabase = createSupabaseServerClient();

  const [
    totalProjects,
    activeProjects,
    pendingPayments,
    labourCount,
    costAgg,
    completionAgg,
    materialStock,
    { data: allProjects },
    { data: allMaterials },
    { data: allPayments },
    { data: allAttendance },
    { data: allLabourers },
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("projects").select("*", { count: "exact", head: true }).is("archived_at", null).eq("status", "active"),
    supabase.from("payments").select("amount", { count: "exact" }).is("archived_at", null).in("status", ["pending", "approved"]),
    supabase.from("labourers").select("*", { count: "exact", head: true }).is("archived_at", null).eq("active", true),
    supabase.from("projects").select("total_cost").is("archived_at", null),
    supabase.from("projects").select("completion_pct, status").is("archived_at", null).neq("status", "cancelled"),
    supabase.from("materials").select("quantity, status").is("archived_at", null).eq("status", "delivered"),
    supabase.from("projects").select("id, name, total_cost").is("archived_at", null),
    supabase.from("materials").select("project_id, quantity, unit_cost, status").is("archived_at", null),
    supabase.from("payments").select("project_id, amount, status, payee_type").is("archived_at", null),
    supabase.from("attendance").select("project_id, status, labourer_id"),
    supabase.from("labourers").select("id, daily_wage"),
  ]);

  const totalCost = (costAgg.data ?? []).reduce((s, r) => s + Number(r.total_cost ?? 0), 0);
  const pendingTotal = (pendingPayments.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const completion =
    completionAgg.data && completionAgg.data.length > 0
      ? completionAgg.data.reduce((s, r) => s + Number(r.completion_pct ?? 0), 0) / completionAgg.data.length
      : 0;
  const stock = (materialStock.data ?? []).reduce((s, r) => s + Number(r.quantity ?? 0), 0);

  const labourerWage = new Map((allLabourers ?? []).map((l) => [l.id, Number(l.daily_wage)]));
  const spentByProject = new Map<string, number>();
  for (const p of allProjects ?? []) spentByProject.set(p.id, 0);
  for (const m of allMaterials ?? []) {
    if (!m.project_id || m.status === "returned") continue;
    spentByProject.set(m.project_id, (spentByProject.get(m.project_id) ?? 0) + lineTotal(m.quantity, m.unit_cost));
  }
  for (const pay of allPayments ?? []) {
    if (!pay.project_id || (pay.status !== "paid" && pay.status !== "approved") || pay.payee_type !== "labour") continue;
    spentByProject.set(pay.project_id, (spentByProject.get(pay.project_id) ?? 0) + Number(pay.amount));
  }
  for (const a of allAttendance ?? []) {
    if (!a.project_id) continue;
    spentByProject.set(a.project_id, (spentByProject.get(a.project_id) ?? 0) + wageForStatus(a.status, labourerWage.get(a.labourer_id) ?? 0));
  }

  const overBudget: { id: string; name: string; pct: number }[] = [];
  const nearBudget: { id: string; name: string; pct: number }[] = [];
  for (const p of allProjects ?? []) {
    const budget = Number(p.total_cost);
    if (budget <= 0) continue;
    const spent = spentByProject.get(p.id) ?? 0;
    const pct = (spent / budget) * 100;
    if (pct >= 100) overBudget.push({ id: p.id, name: p.name, pct });
    else if (pct >= 80) nearBudget.push({ id: p.id, name: p.name, pct });
  }

  const metrics: { label: string; value: string; accent?: boolean; warn?: boolean; danger?: boolean }[] = [
    { label: "Total Projects", value: String(totalProjects.count ?? 0) },
    { label: "Active Projects", value: String(activeProjects.count ?? 0), accent: true },
    { label: "Total Cost", value: `₹${totalCost.toLocaleString()}` },
    { label: "Pending Payments", value: `₹${pendingTotal.toLocaleString()}` },
    { label: "Material Stock", value: stock.toLocaleString() },
    { label: "Labour Count", value: String(labourCount.count ?? 0) },
    { label: "Completion %", value: `${completion.toFixed(1)}%` },
    { label: "Over Budget", value: String(overBudget.length), danger: overBudget.length > 0 },
  ];

  return (
    <AdminPage>
      <AdminPageHeader title="Overview" subtitle="Live metrics across all projects." />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`rounded-lg border bg-white p-5 transition hover:shadow-sm ${
              m.danger ? "border-red-200" : m.warn ? "border-amber-200" : "border-[var(--line)] hover:border-brand/30"
            }`}
          >
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{m.label}</div>
            <div className={`mt-2 text-2xl font-semibold tabular-nums ${
              m.danger ? "text-red-600" : m.warn ? "text-amber-600" : m.accent ? "text-brand-600" : "text-ink"
            }`}>
              {m.value}
            </div>
          </div>
        ))}
      </section>

      {(overBudget.length > 0 || nearBudget.length > 0) && (
        <section className="mt-6 space-y-3">
          {overBudget.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="font-semibold mb-1">Over budget</div>
              {overBudget.map((p) => (
                <div key={p.id}>
                  <Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  {" — "}{p.pct.toFixed(0)}% spent
                </div>
              ))}
            </div>
          )}
          {nearBudget.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-semibold mb-1">Approaching budget</div>
              {nearBudget.map((p) => (
                <div key={p.id}>
                  <Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  {" — "}{p.pct.toFixed(0)}% spent
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </AdminPage>
  );
}
