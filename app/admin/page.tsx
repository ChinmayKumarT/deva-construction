import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";

type Metric = { label: string; value: string };

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
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("payments").select("amount", { count: "exact" }).in("status", ["pending", "approved"]),
    supabase.from("labourers").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("projects").select("total_cost"),
    supabase.from("projects").select("completion_pct, status").neq("status", "cancelled"),
    supabase.from("materials").select("quantity, status").eq("status", "delivered"),
  ]);

  const totalCost = (costAgg.data ?? []).reduce((s, r) => s + Number(r.total_cost ?? 0), 0);
  const pendingTotal = (pendingPayments.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const completion =
    completionAgg.data && completionAgg.data.length > 0
      ? completionAgg.data.reduce((s, r) => s + Number(r.completion_pct ?? 0), 0) / completionAgg.data.length
      : 0;
  const stock = (materialStock.data ?? []).reduce((s, r) => s + Number(r.quantity ?? 0), 0);

  const metrics: { label: string; value: string; accent?: boolean; icon?: string }[] = [
    { label: "Total Projects", value: String(totalProjects.count ?? 0) },
    { label: "Active Projects", value: String(activeProjects.count ?? 0), accent: true },
    { label: "Total Cost", value: `₹${totalCost.toLocaleString()}` },
    { label: "Pending Payments", value: `₹${pendingTotal.toLocaleString()}` },
    { label: "Material Stock", value: stock.toLocaleString() },
    { label: "Labour Count", value: String(labourCount.count ?? 0) },
    { label: "Completion %", value: `${completion.toFixed(1)}%` },
  ];

  return (
    <AdminPage>
      <AdminPageHeader title="Overview" subtitle="Live metrics across all projects." />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={
              "rounded-xl p-5 transition " +
              (m.accent
                ? "bg-brand text-white shadow-sm"
                : "border border-[var(--line)] bg-white hover:border-brand/40")
            }
          >
            <div
              className={
                "text-[11px] uppercase tracking-[0.12em] " +
                (m.accent ? "text-white/80" : "text-slate-500")
              }
            >
              {m.label}
            </div>
            <div className={"mt-2 text-2xl font-semibold " + (m.accent ? "text-white" : "text-ink")}>
              {m.value}
            </div>
          </div>
        ))}
      </section>
    </AdminPage>
  );
}
