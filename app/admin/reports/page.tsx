import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable } from "@/components/admin/Page";
import { DownloadSummaryPdfButton } from "@/components/admin/ReportPdf";
import { DownloadSummaryCsvButton } from "@/components/admin/ReportCsv";
import { WAGE_FACTOR, wageForStatus } from "@/lib/wages";
import { lineTotal } from "@/lib/money";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();

  const [
    { data: projects },
    { data: materials },
    { data: payments },
    { data: attendance },
    { data: labourers },
  ] = await Promise.all([
    supabase.from("projects").select("id, name, status, total_cost, completion_pct").is("archived_at", null).order("name"),
    supabase.from("materials").select("project_id, quantity, unit_cost, status").is("archived_at", null),
    supabase.from("payments").select("project_id, amount, status, payee_type").is("archived_at", null),
    supabase.from("attendance").select("date, status, labourer_id, project_id"),
    supabase.from("labourers").select("id, name, daily_wage").is("archived_at", null),
  ]);

  const labourerWage = new Map((labourers ?? []).map((l) => [l.id, Number(l.daily_wage)]));
  const labourerName = new Map((labourers ?? []).map((l) => [l.id, l.name]));

  // ---- Per-site spend, for the site list ----
  const projectSpent = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.status === "returned" || !m.project_id) continue;
    projectSpent.set(
      m.project_id,
      (projectSpent.get(m.project_id) ?? 0) + lineTotal(m.quantity, m.unit_cost),
    );
  }
  for (const p of payments ?? []) {
    if (!p.project_id) continue;
    if (p.status !== "paid" && p.status !== "approved") continue;
    // Labour only: supplier payments settle already-counted material costs.
    if (p.payee_type !== "labour") continue;
    projectSpent.set(p.project_id, (projectSpent.get(p.project_id) ?? 0) + Number(p.amount));
  }
  for (const a of attendance ?? []) {
    if (!a.project_id) continue;
    const wage = wageForStatus(a.status, labourerWage.get(a.labourer_id) ?? 0);
    projectSpent.set(a.project_id, (projectSpent.get(a.project_id) ?? 0) + wage);
  }

  // ---- Attendance last 7 days (web-only extra, no Android equivalent) ----
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const weeklyDays = new Map<string, number>();
  const weeklyEarn = new Map<string, number>();
  for (const a of attendance ?? []) {
    if (a.date < cutoffStr) continue;
    const factor = WAGE_FACTOR[a.status] ?? 0;
    weeklyDays.set(a.labourer_id, (weeklyDays.get(a.labourer_id) ?? 0) + factor);
    weeklyEarn.set(
      a.labourer_id,
      (weeklyEarn.get(a.labourer_id) ?? 0) + factor * (labourerWage.get(a.labourer_id) ?? 0),
    );
  }
  const attendanceRows = Array.from(weeklyDays, ([id, days]) => [
    labourerName.get(id) ?? "—",
    days.toFixed(1),
    `₹${(weeklyEarn.get(id) ?? 0).toLocaleString()}`,
  ]);

  const pdfData = {
    sites: (projects ?? []).map((p) => ({
      name: p.name,
      status: p.status,
      completionPct: Number(p.completion_pct),
      budget: Number(p.total_cost),
      spent: projectSpent.get(p.id) ?? 0,
    })),
    labour: attendanceRows.map(([name, days, earn]) => ({ name, days, earn })),
  };

  return (
    <AdminPage>
      <div className="mb-2 flex items-start justify-between gap-4">
        <AdminPageHeader title="Reports" subtitle="Pick a site to see its own report and transactions." />
        <div className="flex gap-2">
          <DownloadSummaryCsvButton data={pdfData} />
          <DownloadSummaryPdfButton data={pdfData} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(projects ?? []).length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
            No projects yet.
          </p>
        )}
        {(projects ?? []).map((p) => {
          const spent = projectSpent.get(p.id) ?? 0;
          return (
            <Link
              key={p.id}
              href={`/admin/reports/${p.id}`}
              className="rounded-xl border border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
            >
              <div className="flex items-baseline justify-between">
                <div className="font-semibold">{p.name}</div>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                  {p.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {Number(p.completion_pct).toFixed(1)}% complete
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Budget ₹{Number(p.total_cost).toLocaleString()} · Spent ₹{spent.toLocaleString()}
              </p>
              <p className="mt-3 text-sm font-medium text-brand-700">View report →</p>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Labour: last 7 days
      </h2>
      <DataTable
        columns={["Labourer", "Days worked", "Wages earned"]}
        rows={attendanceRows}
        empty="No attendance recorded in the last 7 days."
      />
    </AdminPage>
  );
}
