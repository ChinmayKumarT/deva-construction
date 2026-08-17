import Image from "next/image";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateOnly } from "@/lib/dateFormat";
import { CashFlowBarChart } from "@/components/admin/CashFlowBarChart";
import { CashFlowTrendChart } from "@/components/admin/CashFlowTrendChart";
import { PieChart, PieLegend } from "@/components/admin/PieChart";
import { dailyTotalsFromDatedAmounts } from "@/lib/paymentsChart";
import { toCumulative } from "@/lib/cashflow";

const RECEIVED_COLOR = "#635bff";
const REMAINING_COLOR = "#E2E8F0";

export default async function ClientDashboard() {
  const { user } = await requireRole("client");
  const supabase = await createSupabaseServerClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("profile_id", user.id)
    .single();

  if (!client) {
    return (
      <main className="mx-auto max-w-2xl p-10">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-3 text-slate-600">
          Your account isn't linked to a client record yet. Ask the admin to link you in the Clients page.
        </p>
      </main>
    );
  }

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, status, current_stage, completion_pct, total_cost, start_date, end_date, original_end_date, extension_reason, next_payment_date, next_payment_amount, agreement_image_url",
    )
    .eq("client_id", client.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  const [{ data: updates }, { data: clientPayments }, { data: projectLabourers }, { data: changeOrders }] = projectIds.length
    ? await Promise.all([
        supabase
          .from("project_updates")
          .select("id, stage, note, image_url, created_at, project_id")
          .in("project_id", projectIds)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("client_payments")
          .select("id, amount, description, paid_on, project_id")
          .in("project_id", projectIds)
          .is("archived_at", null)
          .order("paid_on", { ascending: false }),
        // Which labourers worked each project (names/trade only, no wages) --
        // security-definer RPC, clients can't read the attendance table.
        supabase.rpc("my_project_labourers"),
        supabase
          .from("project_change_orders")
          .select("id, project_id, description, extra_cost, created_at")
          .in("project_id", projectIds)
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const receivedByProject = new Map<string, number>();
  const paymentsByProject = new Map<string, { date: string; amount: number }[]>();
  for (const cp of clientPayments ?? []) {
    if (!cp.project_id) continue;
    receivedByProject.set(cp.project_id, (receivedByProject.get(cp.project_id) ?? 0) + Number(cp.amount));
    const list = paymentsByProject.get(cp.project_id) ?? [];
    list.push({ date: cp.paid_on, amount: Number(cp.amount) });
    paymentsByProject.set(cp.project_id, list);
  }

  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));

  // Category + headcount, not individual names -- clients want to know
  // coverage, not who specifically is on site.
  const labourCategoryCountsByProject = new Map<string, Map<string, number>>();
  for (const l of (projectLabourers ?? []) as { project_id: string; category: string | null }[]) {
    if (!l.project_id) continue;
    const label = l.category ?? "Uncategorized";
    const counts = labourCategoryCountsByProject.get(l.project_id) ?? new Map<string, number>();
    counts.set(label, (counts.get(label) ?? 0) + 1);
    labourCategoryCountsByProject.set(l.project_id, counts);
  }

  const changeOrdersByProject = new Map<string, { id: string; description: string; extra_cost: number; created_at: string }[]>();
  for (const co of changeOrders ?? []) {
    if (!co.project_id) continue;
    const list = changeOrdersByProject.get(co.project_id) ?? [];
    list.push(co);
    changeOrdersByProject.set(co.project_id, list);
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Client dashboard</p>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      {(projects ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No projects are linked to your account yet.
        </p>
      ) : (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your projects</h2>
          <section className="grid gap-4 sm:grid-cols-2">
            {projects!.map((p) => {
              const received = receivedByProject.get(p.id) ?? 0;
              const budget = Number(p.total_cost);
              const remaining = budget - received;
              const labourCounts = labourCategoryCountsByProject.get(p.id);
              const projectChangeOrders = changeOrdersByProject.get(p.id) ?? [];
              const projectPayments = paymentsByProject.get(p.id) ?? [];
              const projectTrend = toCumulative(dailyTotalsFromDatedAmounts(projectPayments));
              return (
                <article key={p.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-baseline justify-between">
                    <div className="font-semibold">{p.name}</div>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Stage: <span className="font-medium">{p.current_stage ?? "—"}</span>
                  </p>
                  {p.agreement_image_url && (
                    <a
                      href={p.agreement_image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline"
                    >
                      View agreement →
                    </a>
                  )}
                  <div className="mt-3">
                    <ProgressBar pct={Number(p.completion_pct)} />
                    <div className="mt-1 text-xs text-slate-500">{Number(p.completion_pct).toFixed(1)}% complete</div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Cell label="Budget" value={`₹${budget.toLocaleString()}`} />
                    <Cell label="Remaining" value={`₹${remaining.toLocaleString()}`} />
                  </dl>
                  {received > 0 && (
                    <div className="mt-3 flex items-center gap-4">
                      <PieChart
                        slices={[
                          { fraction: received, color: RECEIVED_COLOR },
                          { fraction: Math.max(remaining, 0), color: REMAINING_COLOR },
                        ]}
                        size={56}
                      />
                      <PieLegend
                        items={[
                          { label: `Paid · ₹${received.toLocaleString()}`, color: RECEIVED_COLOR },
                          { label: `Remaining · ₹${Math.max(remaining, 0).toLocaleString()}`, color: REMAINING_COLOR },
                        ]}
                      />
                    </div>
                  )}
                  {projectTrend.length > 0 && (
                    <div className="mt-3">
                      <CashFlowTrendChart daily={projectTrend} width={260} height={90} />
                    </div>
                  )}
                  {(p.start_date || p.end_date) && (
                    <p className="mt-3 text-xs text-slate-500">
                      {p.start_date ?? "—"} → {p.end_date ?? "—"}
                    </p>
                  )}
                  {p.original_end_date && p.end_date && p.end_date > p.original_end_date && (
                    <div className="mt-2 text-xs font-medium text-red-600">
                      Finish date extended: was {p.original_end_date}, now {p.end_date}
                      {p.extension_reason && (
                        <div className="mt-0.5 font-normal text-slate-500">
                          Reason: {p.extension_reason}
                        </div>
                      )}
                    </div>
                  )}
                  {p.next_payment_date && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                      Next payment due: {p.next_payment_date}
                      {p.next_payment_amount != null && ` · ₹${Number(p.next_payment_amount).toLocaleString()}`}
                    </div>
                  )}
                  {labourCounts && labourCounts.size > 0 && (
                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Labour on site</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {Array.from(labourCounts.entries()).map(([category, count]) => (
                          <span
                            key={category}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                          >
                            {category} · {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {projectChangeOrders.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Additional work requested</div>
                      <ul className="mt-1.5 space-y-1.5">
                        {projectChangeOrders.map((co) => (
                          <li key={co.id} className="text-xs text-slate-600">
                            <span className="font-medium text-slate-800">{co.description}</span>
                            {" · "}
                            {formatDateOnly(co.created_at)}
                            {Number(co.extra_cost) > 0 && ` · +₹${Number(co.extra_cost).toLocaleString()}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent updates</h2>
          <ul className="space-y-4">
            {(updates ?? []).length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No updates posted yet.
              </li>
            )}
            {updates?.map((u) => (
              <li key={u.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-baseline justify-between">
                  <div className="font-medium">{projectName.get(u.project_id!) ?? "—"}</div>
                  <div className="text-xs text-slate-500">{new Date(u.created_at).toLocaleString()}</div>
                </div>
                {u.stage && <div className="mt-1 text-sm text-slate-600">Stage: <span className="font-medium">{u.stage}</span></div>}
                {u.note && <p className="mt-2 text-sm text-slate-700">{u.note}</p>}
                {u.image_url && (
                  <div className="mt-3">
                    <Image
                      src={u.image_url} alt="" width={640} height={480} loading="lazy"
                      className="max-h-72 w-auto rounded-lg border border-slate-200 object-cover"
                    />
                    <a
                      href={`${u.image_url}?download`}
                      className="mt-1.5 inline-block text-xs font-medium text-brand-700 hover:underline"
                    >
                      Download photo
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Payment timeline</h2>
          {clientPayments && clientPayments.length > 0 && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
              <CashFlowBarChart
                bars={clientPayments.map((cp) => ({
                  label: formatDateOnly(cp.paid_on),
                  value: Number(cp.amount),
                  color: RECEIVED_COLOR,
                }))}
              />
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {(clientPayments ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No payments yet.</td></tr>
                )}
                {clientPayments?.map((cp) => (
                  <tr key={cp.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-600">{formatDateOnly(cp.paid_on)}</td>
                    <td className="px-4 py-2 text-slate-600">{projectName.get(cp.project_id!) ?? "—"}</td>
                    <td className="px-4 py-2 font-medium">₹{Number(cp.amount).toLocaleString()}</td>
                    <td className="px-4 py-2 text-slate-600">{cp.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full bg-emerald-500" style={{ width: `${clamped}%` }} />
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-medium text-slate-800">{value}</div>
    </div>
  );
}
