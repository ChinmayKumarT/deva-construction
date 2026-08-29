import Image from "next/image";
import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateOnly } from "@/lib/dateFormat";
import { PieChart } from "@/components/admin/PieChart";
import { dailyTotalsFromDatedAmounts } from "@/lib/paymentsChart";
import { toCumulative } from "@/lib/cashflow";
import { CashFlowTrendChart } from "@/components/admin/CashFlowTrendChart";

export const revalidate = 60;

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  completed: "bg-blue-50 text-blue-700 ring-blue-200",
  on_hold: "bg-amber-50 text-amber-700 ring-amber-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

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
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--brand)" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
          </div>
          <h1 className="text-xl font-semibold">Welcome to Deva Construction</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your account isn&apos;t linked to a client record yet. Please contact the admin to get started.
          </p>
        </div>
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
          .limit(10),
        supabase
          .from("client_payments")
          .select("id, amount, description, paid_on, project_id")
          .in("project_id", projectIds)
          .is("archived_at", null)
          .order("paid_on", { ascending: false }),
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

  const totalBudget = (projects ?? []).reduce((s, p) => s + Number(p.total_cost), 0);
  const totalPaid = (clientPayments ?? []).reduce((s, cp) => s + Number(cp.amount), 0);
  const nextPayment = (projects ?? []).find((p) => p.next_payment_date);
  const activeCount = (projects ?? []).filter((p) => p.status === "active").length;

  return (
    <main className="min-h-screen">
      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-[var(--brand)] via-[var(--brand-deep)] to-slate-900 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-medium text-white/60">{greeting()},</p>
          <h1 className="mt-0.5 text-xl font-bold text-white sm:text-2xl">{client.name}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 -mt-10">
        {/* ── Summary Cards ── */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Active Projects"
            value={String(activeCount)}
            sub={`${(projects ?? []).length} total`}
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" /></svg>}
          />
          <SummaryCard
            label="Total Budget"
            value={`₹${totalBudget.toLocaleString()}`}
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg>}
          />
          <SummaryCard
            label="Total Paid"
            value={`₹${totalPaid.toLocaleString()}`}
            sub={totalBudget > 0 ? `${((totalPaid / totalBudget) * 100).toFixed(0)}% of budget` : undefined}
            accent
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
          />
          <SummaryCard
            label="Next Payment"
            value={nextPayment?.next_payment_amount != null ? `₹${Number(nextPayment.next_payment_amount).toLocaleString()}` : "—"}
            sub={nextPayment?.next_payment_date ?? "No upcoming"}
            warn={!!nextPayment}
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>}
          />
        </section>

        {(projects ?? []).length === 0 ? (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-500">No projects linked to your account yet.</p>
          </div>
        ) : (
          <>
            {/* ── Projects ── */}
            <SectionHeader title="Your Projects" count={(projects ?? []).length} className="mt-8" />
            <div className="space-y-4">
              {projects!.map((p) => {
                const received = receivedByProject.get(p.id) ?? 0;
                const budget = Number(p.total_cost);
                const remaining = budget - received;
                const pct = Number(p.completion_pct);
                const labourCounts = labourCategoryCountsByProject.get(p.id);
                const projectChangeOrders = changeOrdersByProject.get(p.id) ?? [];
                const projectPayments = paymentsByProject.get(p.id) ?? [];
                const projectTrend = toCumulative(dailyTotalsFromDatedAmounts(projectPayments));
                const statusCls = STATUS_STYLE[p.status] ?? "bg-slate-50 text-slate-600 ring-slate-200";

                return (
                  <article key={p.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {/* Card header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 sm:px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand-700">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{p.name}</h3>
                          <p className="text-xs text-slate-500">
                            Stage: {p.current_stage ?? "—"}
                            {(p.start_date || p.end_date) && (
                              <span className="ml-2 text-slate-400">
                                {p.start_date ?? "—"} → {p.end_date ?? "—"}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.agreement_image_url && (
                          <a
                            href={p.agreement_image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand/30 hover:text-brand-700"
                          >
                            View agreement
                          </a>
                        )}
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusCls}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>

                    <div className="px-5 py-4 sm:px-6">
                      {/* Progress */}
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-600">Construction progress</span>
                          <span className="font-semibold text-brand-700">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                          />
                        </div>
                      </div>

                      {/* Finance row */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          {received > 0 && (
                            <PieChart
                              slices={[
                                { fraction: received, color: "#635bff" },
                                { fraction: Math.max(remaining, 0), color: "#E2E8F0" },
                              ]}
                              size={32}
                            />
                          )}
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-400">Budget</div>
                            <div className="text-xs font-semibold text-slate-800">₹{budget.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-emerald-600">Paid</div>
                          <div className="text-xs font-semibold text-emerald-700">₹{received.toLocaleString()}</div>
                        </div>
                        <div className="rounded-lg bg-amber-50 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-amber-600">Remaining</div>
                          <div className="text-xs font-semibold text-amber-700">₹{Math.max(remaining, 0).toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Payment trend mini chart */}
                      {projectTrend.length > 0 && (
                        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                          <CashFlowTrendChart daily={projectTrend} width={400} height={50} />
                        </div>
                      )}

                      {/* Extension warning */}
                      {p.original_end_date && p.end_date && p.end_date > p.original_end_date && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth="2" className="mt-0.5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008Z" /></svg>
                          <div className="text-xs text-red-700">
                            <span className="font-semibold">Timeline extended</span> — was {p.original_end_date}, now {p.end_date}
                            {p.extension_reason && <span className="text-red-600"> ({p.extension_reason})</span>}
                          </div>
                        </div>
                      )}

                      {/* Next payment due */}
                      {p.next_payment_date && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth="2" className="shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                          <span className="text-xs font-medium text-amber-800">
                            Next payment due: {p.next_payment_date}
                            {p.next_payment_amount != null && ` — ₹${Number(p.next_payment_amount).toLocaleString()}`}
                          </span>
                        </div>
                      )}

                      {/* Bottom row: labour + change orders */}
                      {(labourCounts?.size ?? 0) > 0 || projectChangeOrders.length > 0 ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {labourCounts && labourCounts.size > 0 && (
                            <div>
                              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Labour on site</div>
                              <div className="flex flex-wrap gap-1">
                                {Array.from(labourCounts.entries()).map(([category, count]) => (
                                  <span
                                    key={category}
                                    className="rounded-md bg-brand/5 px-2 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand/10"
                                  >
                                    {category} &middot; {count}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {projectChangeOrders.length > 0 && (
                            <div>
                              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Additional work</div>
                              <ul className="space-y-0.5">
                                {projectChangeOrders.map((co) => (
                                  <li key={co.id} className="text-[11px] text-slate-600">
                                    <span className="font-medium text-slate-800">{co.description}</span>
                                    <span className="text-slate-400"> &middot; {formatDateOnly(co.created_at)}</span>
                                    {Number(co.extra_cost) > 0 && (
                                      <span className="ml-1 font-medium text-amber-700">+₹{Number(co.extra_cost).toLocaleString()}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* ── Site Updates ── */}
            <div id="updates">
              <SectionHeader title="Site Updates" count={(updates ?? []).length} className="mt-8" />
              {(updates ?? []).length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                  No updates posted yet.
                </div>
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200 sm:left-[18px]" />
                  {updates?.map((u, i) => (
                    <div key={u.id} className="relative flex gap-3 pb-4">
                      <div className="relative z-10 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white bg-brand/10 text-brand-700 shadow-sm">
                        {u.image_url ? (
                          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                        ) : (
                          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.862-.373c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">{projectName.get(u.project_id!) ?? "—"}</span>
                            {u.stage && (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{u.stage}</span>
                            )}
                          </div>
                          <time className="text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time>
                        </div>
                        {u.note && <p className="mt-2 text-sm leading-relaxed text-slate-600">{u.note}</p>}
                        {u.image_url && (
                          <div className="mt-3">
                            <Image
                              src={u.image_url} alt="" width={640} height={480} loading="lazy"
                              className="max-h-64 w-auto rounded-xl border border-slate-100 object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Payments ── */}
            <div id="payments">
              <SectionHeader title="Payment History" count={(clientPayments ?? []).length} className="mt-8" />
              {(clientPayments ?? []).length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date</th>
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Project</th>
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</th>
                          <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientPayments?.map((cp, i) => (
                          <tr key={cp.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                            <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDateOnly(cp.paid_on)}</td>
                            <td className="px-5 py-3 font-medium text-slate-800">{projectName.get(cp.project_id!) ?? "—"}</td>
                            <td className="px-5 py-3 text-slate-500">{cp.description ?? "—"}</td>
                            <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-emerald-700">₹{Number(cp.amount).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50">
                          <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-slate-700">Total paid</td>
                          <td className="px-5 py-3 text-right text-sm font-bold tabular-nums text-emerald-700">₹{totalPaid.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer link ── */}
            <div className="mt-12 mb-8 text-center">
              <Link
                href="/client/reports"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-700 hover:shadow-lg"
              >
                View detailed reports
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, sub, accent, warn, icon }: {
  label: string; value: string; sub?: string; accent?: boolean; warn?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-3.5 shadow-sm transition hover:shadow-md ${
      warn ? "border-amber-200" : accent ? "border-emerald-200" : "border-slate-200"
    }`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
        <div className={`${warn ? "text-amber-500" : accent ? "text-emerald-500" : "text-slate-400"}`}>{icon}</div>
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${
        warn ? "text-amber-700" : accent ? "text-emerald-700" : "text-slate-800"
      }`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, count, className = "" }: { title: string; count?: number; className?: string }) {
  return (
    <div className={`mb-4 flex items-center gap-3 ${className}`}>
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      {count != null && count > 0 && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-500">{count}</span>
      )}
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
