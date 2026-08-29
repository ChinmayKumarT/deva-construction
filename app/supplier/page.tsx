import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lineTotal } from "@/lib/money";
import { formatDateTime, formatDateOnly } from "@/lib/dateFormat";
import {
  recordDelivery, archiveDelivery, archiveSupplierPayment,
  type RecordDeliveryState,
} from "./actions";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { ResettableForm, FormError } from "@/components/ResettableForm";
import { ProfileMenu } from "@/components/ProfileMenu";

export const revalidate = 60;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-blue-50 text-blue-700 ring-blue-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  ordered: "bg-slate-50 text-slate-600 ring-slate-200",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function SupplierDashboard() {
  const { user } = await requireRole("supplier");
  const supabase = await createSupabaseServerClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("profile_id", user.id)
    .single();

  if (!supplier) {
    return (
      <main className="mx-auto max-w-2xl p-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--brand)" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
          </div>
          <h1 className="text-xl font-semibold">Welcome to Deva Construction</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your account isn&apos;t linked to a supplier record yet. Please contact the admin to get started.
          </p>
        </div>
      </main>
    );
  }

  const [{ data: materials }, { data: payments }, { data: allProjects }] = await Promise.all([
    supabase
      .from("materials")
      .select("id, name, quantity, unit, unit_cost, status, ordered_at, delivered_at, created_by_supplier, projects(id, name)")
      .eq("supplier_id", supplier.id)
      .is("archived_at", null)
      .order("ordered_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, status, description, created_at, created_by_supplier, projects(name)")
      .eq("supplier_id", supplier.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
  ]);

  const deliveredCount = (materials ?? []).filter((m) => m.status === "delivered").length;
  const orderedCount = (materials ?? []).filter((m) => m.status === "ordered").length;
  const pendingPay = (payments ?? [])
    .filter((p) => p.status === "pending" || p.status === "approved")
    .reduce((s, p) => s + Number(p.amount), 0);
  const paidTotal = (payments ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalMaterialValue = (materials ?? []).reduce((s, m) => s + lineTotal(m.quantity, m.unit_cost), 0);

  return (
    <main className="min-h-screen">
      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-[var(--brand)] via-[var(--brand-deep)] to-slate-900 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-white/60">{greeting()},</p>
            <h1 className="mt-0.5 text-xl font-bold text-white sm:text-2xl">{supplier.name}</h1>
          </div>
          <ProfileMenu name={supplier.name} email={user.email ?? ""} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 -mt-10">
        {/* ── Summary Cards ── */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Material Orders"
            value={String(materials?.length ?? 0)}
            sub={`${deliveredCount} delivered · ${orderedCount} ordered`}
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>}
          />
          <SummaryCard
            label="Material Value"
            value={`₹${totalMaterialValue.toLocaleString()}`}
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg>}
          />
          <SummaryCard
            label="Remaining"
            value={`₹${pendingPay.toLocaleString()}`}
            warn={pendingPay > 0}
            sub={pendingPay > 0 ? "Pending / approved" : "All clear"}
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <SummaryCard
            label="Total Paid"
            value={`₹${paidTotal.toLocaleString()}`}
            accent
            sub={totalMaterialValue > 0 ? `${((paidTotal / totalMaterialValue) * 100).toFixed(0)}% of material value` : undefined}
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </section>

        {/* ── Record Delivery ── */}
        <SectionHeader title="Record Delivery" className="mt-8" />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-5 py-4 sm:px-6">
            {(!allProjects || allProjects.length === 0) ? (
              <p className="text-sm text-slate-500">No projects exist yet. Wait for the admin to create one.</p>
            ) : (
              <ResettableForm<RecordDeliveryState>
                action={recordDelivery}
                initialState={{ error: null, success: false }}
                encType="multipart/form-data"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-slate-700">Project (site)</span>
                  <select name="project_id" required className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20">
                    {allProjects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Material</span>
                  <input name="name" required placeholder="e.g. Cement" className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Unit</span>
                  <input name="unit" defaultValue="bag" className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Quantity</span>
                  <input name="quantity" type="number" step="0.01" min="0" required className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Unit cost (₹)</span>
                  <input name="unit_cost" type="number" step="0.01" min="0" required className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20" />
                </label>
                <input type="hidden" name="status" value="delivered" />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Photo (optional)</span>
                  <input
                    type="file"
                    name="image_file"
                    accept="image/*"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-brand-700 file:font-medium"
                  />
                </label>
                <div className="sm:col-span-2 lg:col-span-4">
                  <FormError />
                  <FormSubmitButton className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/25 transition hover:bg-brand-700 active:bg-brand-800">
                    Record delivery
                  </FormSubmitButton>
                </div>
              </ResettableForm>
            )}
          </div>
        </div>

        {/* ── Deliveries ── */}
        <SectionHeader title="Deliveries" count={(materials ?? []).length} className="mt-8" />
        {(materials ?? []).length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No deliveries yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Material</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Project</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Qty</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unit cost</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {materials?.map((m, i) => {
                    const statusCls = STATUS_STYLE[m.status] ?? "bg-slate-50 text-slate-600 ring-slate-200";
                    return (
                      <tr key={m.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                        <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-800">{m.name}</td>
                        {/* @ts-expect-error relation */}
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">{m.projects?.name ?? "—"}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">{Number(m.quantity)} {m.unit}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-600">₹{Number(m.unit_cost).toLocaleString()}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-slate-800">₹{lineTotal(m.quantity, m.unit_cost).toLocaleString()}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusCls}`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDateOnly(m.ordered_at)}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          {m.created_by_supplier ? (
                            <form action={archiveDelivery}>
                              <input type="hidden" name="id" value={m.id} />
                              <FormSubmitButton
                                pendingLabel="…"
                                className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 transition"
                              >
                                Delete
                              </FormSubmitButton>
                            </form>
                          ) : (
                            <span className="text-[11px] text-slate-400">Admin</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-slate-700">Total material value</td>
                    <td className="px-5 py-3 text-right text-sm font-bold tabular-nums text-slate-800">₹{totalMaterialValue.toLocaleString()}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Payments ── */}
        <SectionHeader title="Payment History" count={(payments ?? []).length} className="mt-8" />
        {(payments ?? []).length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No payments yet.
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
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments?.map((p, i) => {
                    const statusCls = STATUS_STYLE[p.status] ?? "bg-slate-50 text-slate-600 ring-slate-200";
                    return (
                      <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDateOnly(p.created_at)}</td>
                        {/* @ts-expect-error relation */}
                        <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-800">{p.projects?.name ?? "—"}</td>
                        <td className="px-5 py-3 text-slate-500">{p.description ?? "—"}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusCls}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-emerald-700">₹{Number(p.amount).toLocaleString()}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          {p.created_by_supplier ? (
                            <form action={archiveSupplierPayment}>
                              <input type="hidden" name="id" value={p.id} />
                              <FormSubmitButton
                                pendingLabel="…"
                                className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 transition"
                              >
                                Delete
                              </FormSubmitButton>
                            </form>
                          ) : (
                            <span className="text-[11px] text-slate-400">Admin</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-slate-700">Total paid</td>
                    <td className="px-5 py-3 text-right text-sm font-bold tabular-nums text-emerald-700">₹{paidTotal.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="h-8" />
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
