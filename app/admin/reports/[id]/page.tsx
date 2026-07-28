import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable } from "@/components/admin/Page";
import { PieChart, PieLegend } from "@/components/admin/PieChart";

const BRAND = "#16a34a";
const SPEND = "#F59E0B";
const TRACK = "#E2E8F0";
const OVER_BUDGET = "#DC2626";

export default async function SiteReportPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, completion_pct, total_cost")
    .eq("id", params.id)
    .single();
  if (!project) notFound();

  const [{ data: materials }, { data: payments }] = await Promise.all([
    supabase
      .from("materials")
      .select("id, name, unit, quantity, unit_cost, status, ordered_at, delivered_at")
      .eq("project_id", params.id)
      .is("archived_at", null),
    supabase
      .from("payments")
      .select("id, amount, status, description, payee_type, created_at")
      .eq("project_id", params.id)
      .is("archived_at", null),
  ]);

  const spent =
    (materials ?? [])
      .filter((m) => m.status !== "returned")
      .reduce((sum, m) => sum + Number(m.quantity) * Number(m.unit_cost), 0) +
    (payments ?? [])
      .filter((p) => p.status === "paid" || p.status === "approved")
      .reduce((sum, p) => sum + Number(p.amount), 0);

  const budget = Number(project.total_cost);
  const completionPct = Number(project.completion_pct);
  const spendPct = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 999 : 0;
  const overBudget = budget > 0 && spent > budget;

  const transactions = [
    ...(materials ?? []).map((m) => ({
      date: m.delivered_at ?? m.ordered_at ?? null,
      type: "Material",
      description: `${m.name} (${m.quantity} ${m.unit})`,
      amount: Number(m.quantity) * Number(m.unit_cost),
      status: m.status,
    })),
    ...(payments ?? []).map((p) => ({
      date: p.created_at ?? null,
      type: p.payee_type === "labour" ? "Payment · labour" : "Payment · supplier",
      description: p.description || "—",
      amount: Number(p.amount),
      status: p.status,
    })),
  ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return (
    <AdminPage>
      <Link href="/admin/reports" className="text-sm text-slate-600 hover:underline">← Reports</Link>
      <AdminPageHeader title={project.name} subtitle={`Status: ${project.status}`} />

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Completion vs money spent
          </h2>
          <PieLegend
            items={[
              { label: "Complete", color: BRAND },
              { label: "Remaining work", color: TRACK },
              { label: "Spend", color: overBudget ? OVER_BUDGET : SPEND },
              { label: "Remaining budget", color: TRACK },
            ]}
          />
          <div className="mt-4 flex gap-8">
            <div className="flex flex-col items-center gap-2">
              <PieChart
                slices={[
                  { fraction: completionPct / 100, color: BRAND },
                  { fraction: 1 - completionPct / 100, color: TRACK },
                ]}
              />
              <span className="text-xs text-slate-600">Completion {completionPct.toFixed(0)}%</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              {spendPct > 100 ? (
                <PieChart slices={[{ fraction: 1, color: OVER_BUDGET }]} />
              ) : (
                <PieChart
                  slices={[
                    { fraction: spendPct / 100, color: SPEND },
                    { fraction: 1 - spendPct / 100, color: TRACK },
                  ]}
                />
              )}
              <span className="text-xs text-slate-600">
                {spendPct > 100 ? "Spend over budget" : `Spend ${spendPct.toFixed(0)}%`}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Budget vs spent vs remaining
          </h2>
          <div className="flex items-center gap-6">
            {overBudget ? (
              <PieChart slices={[{ fraction: 1, color: OVER_BUDGET }]} />
            ) : (
              <PieChart
                slices={[
                  { fraction: budget > 0 ? spent / budget : spent > 0 ? 1 : 0, color: BRAND },
                  { fraction: budget > 0 ? 1 - spent / budget : 0, color: TRACK },
                ]}
              />
            )}
            <div>
              {!overBudget && <PieLegend items={[{ label: "Spent", color: BRAND }, { label: "Remaining", color: TRACK }]} />}
              <p className={`mt-2 text-sm ${overBudget ? "text-red-600 font-medium" : "text-slate-600"}`}>
                {overBudget
                  ? `Over budget by ₹${(spent - budget).toLocaleString()}`
                  : `₹${spent.toLocaleString()} of ₹${budget.toLocaleString()} spent · ₹${Math.max(budget - spent, 0).toLocaleString()} remaining`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Transactions ({transactions.length})
      </h2>
      <DataTable
        columns={["Type", "Description", "Date", "Status", "Amount"]}
        rows={transactions.map((t) => [
          t.type,
          t.description,
          t.date ? new Date(t.date).toLocaleDateString() : "no date",
          t.status,
          `₹${t.amount.toLocaleString()}`,
        ])}
        empty="No materials or payments recorded for this site yet."
      />
    </AdminPage>
  );
}
