import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable } from "@/components/admin/Page";

export default async function CostsPage() {
  const supabase = createSupabaseServerClient();

  const [{ data: projects }, { data: materials }, { data: payments }] = await Promise.all([
    supabase.from("projects").select("id, name, total_cost, status").order("name"),
    supabase.from("materials").select("project_id, quantity, unit_cost, status"),
    supabase.from("payments").select("project_id, amount, status, payee_type"),
  ]);

  const byProject = new Map<string, { materials: number; labour: number; supplierPaid: number }>();
  for (const p of projects ?? []) byProject.set(p.id, { materials: 0, labour: 0, supplierPaid: 0 });

  for (const m of materials ?? []) {
    if (!m.project_id || m.status === "returned") continue;
    const row = byProject.get(m.project_id);
    if (row) row.materials += Number(m.quantity) * Number(m.unit_cost);
  }

  for (const pay of payments ?? []) {
    if (!pay.project_id) continue;
    if (pay.status !== "paid" && pay.status !== "approved") continue;
    const row = byProject.get(pay.project_id);
    if (!row) continue;
    if (pay.payee_type === "labour") row.labour += Number(pay.amount);
    else row.supplierPaid += Number(pay.amount);
  }

  let totalBudget = 0;
  let totalSpent = 0;

  const rows =
    projects?.map((p) => {
      const c = byProject.get(p.id)!;
      const spent = c.materials + c.labour;
      const budget = Number(p.total_cost);
      totalBudget += budget;
      totalSpent += spent;
      const remaining = budget - spent;
      return [
        p.name,
        p.status,
        `₹${budget.toLocaleString()}`,
        `₹${c.materials.toLocaleString()}`,
        `₹${c.labour.toLocaleString()}`,
        `₹${spent.toLocaleString()}`,
        `₹${remaining.toLocaleString()}`,
      ];
    }) ?? [];

  return (
    <AdminPage>
      <AdminPageHeader title="Cost tracking" subtitle="Budget vs spend across all projects." />

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Total budget" value={`₹${totalBudget.toLocaleString()}`} />
        <Stat label="Total spent" value={`₹${totalSpent.toLocaleString()}`} />
        <Stat label="Remaining" value={`₹${(totalBudget - totalSpent).toLocaleString()}`} />
      </section>

      <DataTable
        columns={["Project", "Status", "Budget", "Materials", "Labour", "Spent", "Remaining"]}
        rows={rows}
        empty="Create a project first."
      />

      <p className="mt-4 text-xs text-slate-500">
        Spend includes <strong>approved</strong> and <strong>paid</strong> payments. Pending payments are not counted.
        Materials marked <strong>returned</strong> are excluded.
      </p>
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
