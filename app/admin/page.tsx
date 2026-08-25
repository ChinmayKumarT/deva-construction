import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { wageForStatus } from "@/lib/wages";
import { lineTotal } from "@/lib/money";

function monthRange(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const start = d.toISOString().slice(0, 10);
  d.setMonth(d.getMonth() + 1);
  const end = d.toISOString().slice(0, 10);
  return { start, end };
}

export default async function AdminOverview() {
  // Managers get the operational half of this dashboard only — no rupee
  // figures and no budget-performance callouts. See the metrics array below.
  const { role } = await requireRole(["admin", "manager"]);
  const isManager = role === "manager";

  const supabase = await createSupabaseServerClient();
  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);

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
    projectsThisMonth,
    projectsLastMonth,
    paymentsThisMonth,
    paymentsLastMonth,
    materialsThisMonth,
    materialsLastMonth,
    attendanceThisMonth,
    attendanceLastMonth,
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
    supabase.from("projects").select("*", { count: "exact", head: true }).is("archived_at", null).gte("created_at", thisMonth.start).lt("created_at", thisMonth.end),
    supabase.from("projects").select("*", { count: "exact", head: true }).is("archived_at", null).gte("created_at", lastMonth.start).lt("created_at", lastMonth.end),
    supabase.from("payments").select("amount").is("archived_at", null).gte("created_at", thisMonth.start).lt("created_at", thisMonth.end),
    supabase.from("payments").select("amount").is("archived_at", null).gte("created_at", lastMonth.start).lt("created_at", lastMonth.end),
    supabase.from("materials").select("quantity, unit_cost").is("archived_at", null).gte("created_at", thisMonth.start).lt("created_at", thisMonth.end),
    supabase.from("materials").select("quantity, unit_cost").is("archived_at", null).gte("created_at", lastMonth.start).lt("created_at", lastMonth.end),
    supabase.from("attendance").select("*", { count: "exact", head: true }).gte("created_at", thisMonth.start).lt("created_at", thisMonth.end),
    supabase.from("attendance").select("*", { count: "exact", head: true }).gte("created_at", lastMonth.start).lt("created_at", lastMonth.end),
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

  const payThisSum = (paymentsThisMonth.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const payLastSum = (paymentsLastMonth.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const matThisSum = (materialsThisMonth.data ?? []).reduce((s, r) => s + lineTotal(r.quantity, r.unit_cost), 0);
  const matLastSum = (materialsLastMonth.data ?? []).reduce((s, r) => s + lineTotal(r.quantity, r.unit_cost), 0);
  const spendThis = payThisSum + matThisSum;
  const spendLast = payLastSum + matLastSum;

  type Trend = { delta: number; label: string } | null;
  function trend(current: number, previous: number): Trend {
    const diff = current - previous;
    if (diff === 0 && previous === 0) return null;
    if (previous === 0) return { delta: 100, label: `+${current} new` };
    const pct = Math.round((diff / previous) * 100);
    return { delta: pct, label: `${pct >= 0 ? "+" : ""}${pct}% vs last month` };
  }

  type Metric = { label: string; value: string; accent?: boolean; warn?: boolean; danger?: boolean; trend?: Trend };

  // Money metrics — total budget, monthly spend, outstanding payments — plus
  // the over-budget count, which is budget performance expressed as a
  // headline number. Admins and owners see all of it; managers see none of
  // it. What's left is genuinely operational: how many projects, how much
  // stock, who turned up, how far along the work is.
  const moneyMetrics: Metric[] = [
    { label: "Total Cost", value: `₹${totalCost.toLocaleString()}` },
    { label: "Spending", value: `₹${spendThis.toLocaleString()}`, trend: trend(spendThis, spendLast) },
    { label: "Pending Payments", value: `₹${pendingTotal.toLocaleString()}` },
  ];

  const metrics: Metric[] = [
    { label: "Total Projects", value: String(totalProjects.count ?? 0), trend: trend(projectsThisMonth.count ?? 0, projectsLastMonth.count ?? 0) },
    { label: "Active Projects", value: String(activeProjects.count ?? 0), accent: true },
    ...(isManager ? [] : moneyMetrics),
    { label: "Material Stock", value: stock.toLocaleString() },
    { label: "Attendance", value: String(attendanceThisMonth.count ?? 0), trend: trend(attendanceThisMonth.count ?? 0, attendanceLastMonth.count ?? 0) },
    { label: "Labour Count", value: String(labourCount.count ?? 0) },
    { label: "Completion %", value: `${completion.toFixed(1)}%` },
    ...(isManager
      ? []
      : [{ label: "Over Budget", value: String(overBudget.length), danger: overBudget.length > 0 }]),
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
            {m.trend && (
              <div className={`mt-1.5 text-xs font-medium ${
                m.trend.delta > 0 ? "text-emerald-600" : m.trend.delta < 0 ? "text-red-500" : "text-slate-400"
              }`}>
                {m.trend.delta > 0 ? "↑" : m.trend.delta < 0 ? "↓" : "→"} {m.trend.label}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Budget-performance banners: "Site A — 105% spent". Same reasoning as
          the money metrics above, so managers don't get these either. */}
      {!isManager && (overBudget.length > 0 || nearBudget.length > 0) && (
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
