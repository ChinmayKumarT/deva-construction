import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, BudgetAlert } from "@/components/admin/Page";
import { wageForStatus } from "@/lib/wages";
import { lineTotal } from "@/lib/money";

export const revalidate = 60;

export default async function CostsPage() {
  // Budget vs spend per project. The sidebar hides this for managers, but a
  // hidden link is not a permission — guard the route.
  const { role } = await requireRole(["superadmin", "admin", "manager"]);
  if (role === "manager") redirect("/admin");

  const supabase = await createSupabaseServerClient();

  const [{ data: projects }, { data: materials }, { data: payments }, { data: attendance }, { data: labourers }] =
    await Promise.all([
      supabase.from("projects").select("id, name, total_cost, status").is("archived_at", null).order("name"),
      supabase.from("materials").select("project_id, quantity, unit_cost, status").is("archived_at", null),
      supabase.from("payments").select("project_id, amount, status, payee_type").is("archived_at", null),
      supabase.from("attendance").select("project_id, status, labourer_id"),
      supabase.from("labourers").select("id, daily_wage"),
    ]);

  const labourerWage = new Map((labourers ?? []).map((l) => [l.id, Number(l.daily_wage)]));

  const byProject = new Map<
    string,
    { materials: number; labour: number; supplierPaid: number; wages: number; materialCount: number; paymentCount: number }
  >();
  for (const p of projects ?? [])
    byProject.set(p.id, { materials: 0, labour: 0, supplierPaid: 0, wages: 0, materialCount: 0, paymentCount: 0 });

  for (const m of materials ?? []) {
    if (!m.project_id) continue;
    const row = byProject.get(m.project_id);
    if (!row) continue;
    row.materialCount += 1;
    if (m.status === "returned") continue;
    row.materials += lineTotal(m.quantity, m.unit_cost);
  }

  for (const pay of payments ?? []) {
    if (!pay.project_id) continue;
    const row = byProject.get(pay.project_id);
    if (!row) continue;
    row.paymentCount += 1;
    if (pay.status !== "paid" && pay.status !== "approved") continue;
    if (pay.payee_type === "labour") row.labour += Number(pay.amount);
    else row.supplierPaid += Number(pay.amount);
  }

  for (const a of attendance ?? []) {
    if (!a.project_id) continue;
    const row = byProject.get(a.project_id);
    if (!row) continue;
    row.wages += wageForStatus(a.status, labourerWage.get(a.labourer_id) ?? 0);
  }

  let totalBudget = 0;
  let totalSpent = 0;
  const overBudgetProjects: { name: string; budget: number; spent: number }[] = [];
  const nearBudgetProjects: { name: string; budget: number; spent: number }[] = [];

  const rows =
    projects?.map((p) => {
      const c = byProject.get(p.id)!;
      const spent = c.materials + c.wages;
      const budget = Number(p.total_cost);
      totalBudget += budget;
      totalSpent += spent;
      const remaining = budget - spent;
      if (budget > 0) {
        const pct = spent / budget;
        if (pct >= 1) overBudgetProjects.push({ name: p.name, budget, spent });
        else if (pct >= 0.8) nearBudgetProjects.push({ name: p.name, budget, spent });
      }
      return [
        p.name,
        p.status,
        `₹${budget.toLocaleString()}`,
        `₹${c.materials.toLocaleString()}`,
        `₹${c.wages.toLocaleString()}`,
        `₹${spent.toLocaleString()}`,
        `₹${remaining.toLocaleString()}`,
      ];
    }) ?? [];

  return (
    <AdminPage>
      <AdminPageHeader title="Cost tracking" subtitle="Budget vs spend across all projects." />

      <BudgetAlert budget={totalBudget} spent={totalSpent} />

      {overBudgetProjects.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-semibold">{overBudgetProjects.length} project{overBudgetProjects.length > 1 ? "s" : ""} over budget:</span>{" "}
          {overBudgetProjects.map((p) => `${p.name} (${((p.spent / p.budget) * 100).toFixed(0)}%)`).join(", ")}
        </div>
      )}
      {nearBudgetProjects.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">{nearBudgetProjects.length} project{nearBudgetProjects.length > 1 ? "s" : ""} approaching budget:</span>{" "}
          {nearBudgetProjects.map((p) => `${p.name} (${((p.spent / p.budget) * 100).toFixed(0)}%)`).join(", ")}
        </div>
      )}

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Total budget" value={`₹${totalBudget.toLocaleString()}`} />
        <Stat label="Total spent" value={`₹${totalSpent.toLocaleString()}`} />
        <Stat label="Remaining" value={`₹${(totalBudget - totalSpent).toLocaleString()}`} />
      </section>

      <DataTable
        columns={["Project", "Status", "Budget", "Materials", "Wages", "Spent", "Remaining"]}
        rows={rows}
        empty="Create a project first."
      />

      <p className="mt-4 text-xs text-slate-500">
        Spend includes materials cost plus wages accrued from marked
        attendance (present = full daily wage, half day = 50%, overtime = 150%). Materials marked{" "}
        <strong>returned</strong> are excluded.
      </p>

      {projects && projects.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Adjust costs</h2>
          <p className="mb-4 text-xs text-slate-500">
            Edit a project&apos;s budget, or jump to its materials and payments to correct or clear an entry.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const c = byProject.get(p.id)!;
              return (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-1 font-medium text-sm">{p.name}</div>
                  <div className="mb-3 text-xs text-slate-500">
                    Budget ₹{Number(p.total_cost).toLocaleString()}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/projects/${p.id}/edit`}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Edit budget
                    </Link>
                    <Link
                      href={`/admin/materials/${p.id}`}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Materials ({c.materialCount})
                    </Link>
                    <Link
                      href={`/admin/payments/${p.id}`}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Payments ({c.paymentCount})
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </AdminPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
