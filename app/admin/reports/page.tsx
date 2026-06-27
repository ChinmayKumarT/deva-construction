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
    supabase.from("projects").select("id, name, status, total_cost, completion_pct"),
    supabase.from("materials").select("project_id, quantity, unit_cost, status"),
    supabase.from("payments").select("project_id, amount, status, payee_type"),
    supabase.from("attendance").select("date, status, labourer_id"),
    supabase.from("labourers").select("id, name, daily_wage"),
  ]);

  // ---- Project summary ----
  const projectSpent = new Map<string, number>();
  const materialsByProject = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.status === "returned" || !m.project_id) continue;
    const cost = Number(m.quantity) * Number(m.unit_cost);
    materialsByProject.set(m.project_id, (materialsByProject.get(m.project_id) ?? 0) + cost);
    projectSpent.set(m.project_id, (projectSpent.get(m.project_id) ?? 0) + cost);
  }
  for (const p of payments ?? []) {
    if (!p.project_id) continue;
    if (p.status !== "paid" && p.status !== "approved") continue;
    projectSpent.set(p.project_id, (projectSpent.get(p.project_id) ?? 0) + Number(p.amount));
  }

  const projectRows =
    projects?.map((p) => {
      const spent = projectSpent.get(p.id) ?? 0;
      return [
        p.name,
        p.status,
        `${Number(p.completion_pct).toFixed(1)}%`,
        `₹${Number(p.total_cost).toLocaleString()}`,
        `₹${spent.toLocaleString()}`,
        `₹${(Number(p.total_cost) - spent).toLocaleString()}`,
      ];
    }) ?? [];

  // ---- Payment summary ----
  const paymentSummary = (["pending", "approved", "paid", "rejected"] as const).map((s) => {
    const rows = (payments ?? []).filter((p) => p.status === s);
    const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    return [s, String(rows.length), `₹${total.toLocaleString()}`];
  });

  // ---- Attendance last 7 days ----
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
      <AdminPageHeader title="Reports" subtitle="Aggregate views across the business." />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Projects: budget vs spend</h2>
      <DataTable
        columns={["Project", "Status", "Completion", "Budget", "Spent", "Remaining"]}
        rows={projectRows}
        empty="No projects yet."
      />

      <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Payments by status</h2>
      <DataTable
        columns={["Status", "Count", "Total"]}
        rows={paymentSummary}
        empty="No payments yet."
      />

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
