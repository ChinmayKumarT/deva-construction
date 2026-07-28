import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable } from "@/components/admin/Page";

export default async function ReportsPage() {
  const supabase = createSupabaseServerClient();

  const [
    { data: projects },
    { data: materials },
    { data: payments },
    { data: attendance },
    { data: labourers },
  ] = await Promise.all([
    supabase.from("projects").select("id, name, status, total_cost, completion_pct").is("archived_at", null).order("name"),
    supabase.from("materials").select("project_id, quantity, unit_cost, status"),
    supabase.from("payments").select("project_id, amount, status"),
    supabase.from("attendance").select("date, status, labourer_id"),
    supabase.from("labourers").select("id, name, daily_wage"),
  ]);

  // ---- Per-site spend, for the site list ----
  const projectSpent = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.status === "returned" || !m.project_id) continue;
    projectSpent.set(
      m.project_id,
      (projectSpent.get(m.project_id) ?? 0) + Number(m.quantity) * Number(m.unit_cost),
    );
  }
  for (const p of payments ?? []) {
    if (!p.project_id) continue;
    if (p.status !== "paid" && p.status !== "approved") continue;
    projectSpent.set(p.project_id, (projectSpent.get(p.project_id) ?? 0) + Number(p.amount));
  }

  // ---- Attendance last 7 days (web-only extra, no Android equivalent) ----
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const wageFactor = { present: 1, half_day: 0.5, absent: 0 } as const;
  const labourerWage = new Map((labourers ?? []).map((l) => [l.id, Number(l.daily_wage)]));
  const labourerName = new Map((labourers ?? []).map((l) => [l.id, l.name]));
  const weeklyDays = new Map<string, number>();
  const weeklyEarn = new Map<string, number>();
  for (const a of attendance ?? []) {
    if (a.date < cutoffStr) continue;
    const factor = wageFactor[a.status as keyof typeof wageFactor] ?? 0;
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

  return (
    <AdminPage>
      <AdminPageHeader title="Reports" subtitle="Pick a site to see its own report and transactions." />

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
