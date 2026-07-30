import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/admin/Page";
import { PieChart, PieLegend } from "@/components/admin/PieChart";
import { DownloadSitePdfButton } from "@/components/admin/ReportPdf";
import { lineTotal } from "@/lib/money";

const BRAND = "#16a34a";
const SPEND = "#F59E0B";
const TRACK = "#E2E8F0";
const OVER_BUDGET = "#DC2626";

export default async function ClientSiteReportPage({ params }: { params: { id: string } }) {
  const { user } = await requireRole("client");
  const supabase = createSupabaseServerClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!client) notFound();

  const [{ data: project }, { data: materials }, { data: payments }, { data: updates }, { data: wageTotals }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, name, status, completion_pct, total_cost, address, current_stage, end_date, original_end_date, extension_reason, client_id",
        )
        .eq("id", params.id)
        .eq("client_id", client.id)
        .single(),
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
      supabase
        .from("project_updates")
        .select("id, stage, note, image_url, created_at")
        .eq("project_id", params.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      // Attendance wages for this project (total only, no labourer detail) via a
      // security-definer RPC -- clients can't read the attendance table directly.
      supabase.rpc("my_project_wage_totals"),
    ]);
  if (!project) notFound();

  const wages = Number(
    ((wageTotals ?? []) as { project_id: string; wage_total: number }[]).find(
      (w) => w.project_id === params.id,
    )?.wage_total ?? 0,
  );

  const spent =
    (materials ?? [])
      .filter((m) => m.status !== "returned")
      .reduce((sum, m) => sum + lineTotal(m.quantity, m.unit_cost), 0) +
    (payments ?? [])
      // Labour only: supplier payments settle already-counted material costs.
      .filter((p) => (p.status === "paid" || p.status === "approved") && p.payee_type === "labour")
      .reduce((sum, p) => sum + Number(p.amount), 0) +
    wages;

  const budget = Number(project.total_cost);
  const completionPct = Number(project.completion_pct);
  const spendPct = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 999 : 0;
  const overBudget = budget > 0 && spent > budget;

  const transactions = [
    ...(materials ?? []).map((m) => ({
      date: m.delivered_at ?? m.ordered_at ?? null,
      type: "Material",
      description: `${m.name} (${m.quantity} ${m.unit})`,
      amount: lineTotal(m.quantity, m.unit_cost),
      status: m.status,
    })),
    ...(payments ?? []).map((p) => ({
      date: p.created_at ?? null,
      type: p.payee_type === "labour" ? "Payment · labour" : "Payment · supplier",
      description: p.description || "—",
      amount: Number(p.amount),
      status: p.status,
    })),
    // One aggregate line, not per-labourer -- clients don't see individual
    // worker attendance, just the total labour-wage cost on their project.
    ...(wages > 0
      ? [{ date: null, type: "Labour wages", description: "Wages accrued from attendance", amount: wages, status: "" }]
      : []),
  ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const extended =
    project.original_end_date != null && project.end_date != null && project.end_date > project.original_end_date;

  const pdfSite = {
    name: project.name,
    status: project.status,
    completionPct,
    budget,
    spent,
    detail: {
      client: null,
      address: project.address,
      stage: project.current_stage,
      startDate: null,
      endDate: project.end_date,
      extended,
      originalEndDate: project.original_end_date,
      extensionReason: project.extension_reason,
    },
    transactions: transactions.map((t) => ({
      date: t.date ? new Date(t.date).toLocaleDateString() : "no date",
      type: t.type,
      description: t.description,
      amount: t.amount,
      status: t.status,
    })),
    updates: (updates ?? []).map((u) => ({
      stage: u.stage,
      note: u.note,
      date: u.created_at ? new Date(u.created_at).toLocaleDateString() : "no date",
      imageUrl: u.image_url,
    })),
  };

  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/client/reports" className="text-sm text-slate-600 hover:underline">← Reports</Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Report</p>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Status: {project.status}</p>
        </div>
        <DownloadSitePdfButton site={pdfSite} />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
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
        empty="No materials or payments recorded for this project yet."
      />
    </main>
  );
}
