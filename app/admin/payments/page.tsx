import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, CostBox } from "@/components/admin/Page";
import { CashFlowBarChart } from "@/components/admin/CashFlowBarChart";
import { CashFlowTrendChart } from "@/components/admin/CashFlowTrendChart";
import { PieChart, PieLegend } from "@/components/admin/PieChart";
import { CreatePaymentForm } from "@/components/admin/PaymentForm";
import { byProjectTotals, payeeTypeSplitByProject, dailyPaymentTotals } from "@/lib/paymentsChart";
import { toCumulative } from "@/lib/cashflow";
import { computeWagesDueFromAccrued } from "@/lib/wages";
import { createPayment } from "../actions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const SUPPLIER_COLOR = "#F59E0B";
const LABOUR_COLOR = "#0EA5E9";

export default async function PaymentsIndexPage({
  searchParams,
}: {
  searchParams: { archived?: string };
}) {
  const showArchived = searchParams.archived === "1";
  const supabase = createSupabaseServerClient();

  const [
    { data: projects }, { data: payments }, { count: archivedCount },
    { data: suppliers }, { data: labourers }, { data: materials }, { data: assignments },
    { data: allLabourPayments }, { data: wageAccrued },
  ] = await Promise.all([
    supabase.from("projects").select("id, name, status").is("archived_at", null).order("name"),
    showArchived
      ? supabase.from("payments").select("id, project_id, amount, status, payee_type, created_at").not("archived_at", "is", null)
      : supabase.from("payments").select("id, project_id, amount, status, payee_type, created_at").is("archived_at", null),
    supabase.from("payments").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
    supabase.from("suppliers").select("id, name").is("archived_at", null).order("name"),
    supabase.from("labourers").select("id, name").is("archived_at", null).order("name"),
    supabase
      .from("materials")
      .select("id, name, unit, quantity, unit_cost, work_category, supplier_id, project_id")
      .is("archived_at", null)
      .neq("status", "returned")
      .eq("billed", false)
      .order("ordered_at", { ascending: false }),
    supabase.from("project_labourers").select("labourer_id, project_id").is("unassigned_at", null),
    supabase
      .from("payments")
      .select("project_id, payee_type, labourer_id, amount, status")
      .is("archived_at", null)
      .eq("payee_type", "labour"),
    // Pre-summed per (project, labourer) in Postgres instead of fetching the
    // entire attendance table just to add it up client-side -- see
    // supabase/29_staff_wage_accrued.sql.
    supabase.rpc("staff_labourer_wage_accrued"),
  ]);

  const wageDue = computeWagesDueFromAccrued(wageAccrued ?? [], allLabourPayments ?? []);

  const byProject = new Map<string, { count: number; spend: number }>();
  let unassignedCount = 0;
  let unassignedSpend = 0;
  for (const p of payments ?? []) {
    const spend = p.status === "rejected" ? 0 : Number(p.amount);
    if (p.project_id) {
      const cur = byProject.get(p.project_id) ?? { count: 0, spend: 0 };
      byProject.set(p.project_id, { count: cur.count + 1, spend: cur.spend + spend });
    } else {
      unassignedCount++;
      unassignedSpend += spend;
    }
  }

  const suffix = showArchived ? "?archived=1" : "";
  const totalCost = Array.from(byProject.values()).reduce((sum, s) => sum + s.spend, 0) + unassignedSpend;

  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const chartProjectTotals = byProjectTotals(payments ?? []);
  const chartBars = Array.from(chartProjectTotals.entries()).map(([id, value]) => ({
    label: projectName.get(id) ?? "No project",
    value,
    color: "#16a34a",
  }));
  const payeeSplitByProject = payeeTypeSplitByProject(payments ?? []);
  const cumulativeDaily = toCumulative(dailyPaymentTotals(payments ?? []));

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived payments" : "Payments"}
        subtitle={
          showArchived
            ? "Pick a site to see its archived payments."
            : "Pick a site to see its bills and wages. Pending → approved → paid."
        }
      />

      {!showArchived && archivedCount ? (
        <div className="mb-6">
          <Link href="/admin/payments?archived=1" className="text-sm font-medium text-brand-700 hover:underline">
            View {archivedCount} archived {archivedCount === 1 ? "payment" : "payments"} →
          </Link>
        </div>
      ) : null}

      {!showArchived && (
        <CreatePaymentForm
          action={createPayment}
          projects={projects ?? []}
          suppliers={suppliers ?? []}
          labourers={labourers ?? []}
          materials={materials ?? []}
          assignments={assignments ?? []}
          wageDue={wageDue}
        />
      )}

      {showArchived ? (
        <div className="mb-6">
          <Link href="/admin/payments" className="text-sm font-medium text-brand-700 hover:underline">
            ← Back to active payments
          </Link>
        </div>
      ) : null}

      {!showArchived && payments && payments.length > 0 && (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {cumulativeDaily.length > 0 && (
            <div className="rounded-xl border border-[var(--line)] bg-white p-5 lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Payments over time
              </h2>
              <CashFlowTrendChart daily={cumulativeDaily} />
            </div>
          )}
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Spend by project</h2>
            <CashFlowBarChart bars={chartBars} />
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Labour vs supplier</h2>
            {payeeSplitByProject.size === 0 ? (
              <p className="text-xs text-slate-500">No paid/approved payments yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from(payeeSplitByProject.entries()).map(([id, { labour, supplier }]) => (
                  <div key={id} className="flex items-center gap-3">
                    <PieChart
                      slices={[
                        { fraction: labour, color: LABOUR_COLOR },
                        { fraction: supplier, color: SUPPLIER_COLOR },
                      ]}
                      size={64}
                    />
                    <div>
                      <div className="text-sm font-medium text-ink">{projectName.get(id) ?? "No project"}</div>
                      <PieLegend
                        items={[
                          { label: `Labour · ₹${labour.toLocaleString()}`, color: LABOUR_COLOR },
                          { label: `Supplier · ₹${supplier.toLocaleString()}`, color: SUPPLIER_COLOR },
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!showArchived && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CostBox label="Total cost" value={totalCost} accent />
          {(projects ?? []).length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
              No projects yet.
            </p>
          )}
          {(projects ?? []).map((p) => (
            <Link key={p.id} href={`/admin/payments/${p.id}`}>
              <CostBox label={p.name} value={byProject.get(p.id)?.spend ?? 0} />
            </Link>
          ))}
          {unassignedCount > 0 && (
            <Link href="/admin/payments/unassigned">
              <CostBox label="No project" value={unassignedSpend} />
            </Link>
          )}
        </div>
      )}

      {showArchived && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
              No projects yet.
            </p>
          )}
          {(projects ?? []).map((p) => {
            const stats = byProject.get(p.id) ?? { count: 0, spend: 0 };
            return (
              <Link
                key={p.id}
                href={`/admin/payments/${p.id}${suffix}`}
                className="rounded-xl border border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold">{p.name}</div>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    {p.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {stats.count} {stats.count === 1 ? "payment" : "payments"} archived
                </p>
                <p className="mt-3 text-sm font-medium text-brand-700">View payments →</p>
              </Link>
            );
          })}

          {unassignedCount > 0 && (
            <Link
              href={`/admin/payments/unassigned${suffix}`}
              className="rounded-xl border border-dashed border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
            >
              <div className="font-semibold text-slate-700">No project</div>
              <p className="mt-2 text-sm text-slate-600">
                {unassignedCount} {unassignedCount === 1 ? "payment" : "payments"} archived
              </p>
              <p className="mt-3 text-sm font-medium text-brand-700">View payments →</p>
            </Link>
          )}
        </div>
      )}
    </AdminPage>
  );
}
