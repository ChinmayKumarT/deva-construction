import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable } from "@/components/admin/Page";
import { wageForStatus } from "@/lib/wages";
import { lineTotal } from "@/lib/money";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ProfitLossPage() {
  const supabase = createSupabaseServerClient();

  const [
    { data: projects },
    { data: materials },
    { data: payments },
    { data: attendance },
    { data: labourers },
    { data: clientPayments },
  ] = await Promise.all([
    supabase.from("projects").select("id, name, total_cost, status").is("archived_at", null).order("name"),
    supabase.from("materials").select("project_id, quantity, unit_cost, status").is("archived_at", null),
    supabase.from("payments").select("project_id, amount, status, payee_type").is("archived_at", null),
    supabase.from("attendance").select("project_id, status, labourer_id"),
    supabase.from("labourers").select("id, daily_wage"),
    supabase.from("client_payments").select("project_id, amount").is("archived_at", null),
  ]);

  const labourerWage = new Map((labourers ?? []).map((l) => [l.id, Number(l.daily_wage)]));

  const spentByProject = new Map<string, { materials: number; labour: number; wages: number }>();
  const receivedByProject = new Map<string, number>();

  for (const p of projects ?? []) {
    spentByProject.set(p.id, { materials: 0, labour: 0, wages: 0 });
    receivedByProject.set(p.id, 0);
  }

  for (const m of materials ?? []) {
    if (!m.project_id || m.status === "returned") continue;
    const row = spentByProject.get(m.project_id);
    if (row) row.materials += lineTotal(m.quantity, m.unit_cost);
  }

  for (const pay of payments ?? []) {
    if (!pay.project_id) continue;
    const row = spentByProject.get(pay.project_id);
    if (!row) continue;
    if (pay.status !== "paid" && pay.status !== "approved") continue;
    if (pay.payee_type === "labour") row.labour += Number(pay.amount);
  }

  for (const a of attendance ?? []) {
    if (!a.project_id) continue;
    const row = spentByProject.get(a.project_id);
    if (row) row.wages += wageForStatus(a.status, labourerWage.get(a.labourer_id) ?? 0);
  }

  for (const cp of clientPayments ?? []) {
    if (!cp.project_id) continue;
    receivedByProject.set(cp.project_id, (receivedByProject.get(cp.project_id) ?? 0) + Number(cp.amount));
  }

  let totalReceived = 0;
  let totalSpent = 0;
  let totalBudget = 0;

  const rows = projects?.map((p) => {
    const c = spentByProject.get(p.id)!;
    const spent = c.materials + c.labour + c.wages;
    const received = receivedByProject.get(p.id) ?? 0;
    const profit = received - spent;
    const budget = Number(p.total_cost);
    totalReceived += received;
    totalSpent += spent;
    totalBudget += budget;
    return [
      p.name,
      p.status,
      `₹${budget.toLocaleString()}`,
      `₹${received.toLocaleString()}`,
      `₹${spent.toLocaleString()}`,
      profit >= 0 ? `₹${profit.toLocaleString()}` : `-₹${Math.abs(profit).toLocaleString()}`,
      budget > 0 ? `${((received / budget) * 100).toFixed(0)}%` : "—",
    ];
  }) ?? [];

  const totalProfit = totalReceived - totalSpent;

  return (
    <AdminPage>
      <AdminPageHeader title="Profit & Loss" subtitle="Revenue collected vs costs incurred per project." />

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total budget" value={`₹${totalBudget.toLocaleString()}`} />
        <Stat label="Received from clients" value={`₹${totalReceived.toLocaleString()}`} color="text-emerald-700" />
        <Stat label="Total spent" value={`₹${totalSpent.toLocaleString()}`} color="text-red-700" />
        <Stat
          label="Net profit / loss"
          value={totalProfit >= 0 ? `₹${totalProfit.toLocaleString()}` : `-₹${Math.abs(totalProfit).toLocaleString()}`}
          color={totalProfit >= 0 ? "text-emerald-700" : "text-red-700"}
          highlight
        />
      </section>

      {totalReceived > 0 && totalSpent > 0 && (
        <div className="mb-8 rounded-xl border border-[var(--line)] bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">Revenue vs Spending</div>
          <div className="space-y-3">
            <Bar label="Received" value={totalReceived} max={Math.max(totalReceived, totalSpent)} color="bg-emerald-500" />
            <Bar label="Spent" value={totalSpent} max={Math.max(totalReceived, totalSpent)} color="bg-red-400" />
          </div>
        </div>
      )}

      <DataTable
        columns={["Project", "Status", "Budget", "Received", "Spent", "Profit / Loss", "Collected %"]}
        rows={rows}
        empty="No projects yet."
      />

      <p className="mt-4 text-xs text-slate-500">
        <strong>Received</strong> = client payments recorded for this project.{" "}
        <strong>Spent</strong> = materials + approved/paid labour payments + attendance wages.{" "}
        <strong>Collected %</strong> = what percentage of the budget has been collected from the client.
      </p>
    </AdminPage>
  );
}

function Stat({ label, value, color, highlight }: { label: string; value: string; color?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${highlight ? "border-brand/30 ring-1 ring-brand/10" : "border-slate-200"}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${color ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-sm text-slate-600">{label}</div>
      <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-28 text-right text-sm font-medium tabular-nums">₹{value.toLocaleString()}</div>
    </div>
  );
}
