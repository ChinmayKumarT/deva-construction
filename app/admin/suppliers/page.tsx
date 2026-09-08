import Link from "next/link";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, AdminContent } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, ManageCard, ManageSection, RestoreAction } from "@/components/admin/RowActions";
import { CreateSupplierForm } from "@/components/admin/CreateSupplierForm";
import { createSupplier, unarchiveSupplier, deleteSupplier } from "../actions";
import { supplierMoney } from "@/lib/supplierAccount";

// Signups happen outside this app, so a newly created profile has to appear
// in the "Link to login" list (and in Team access) without waiting for a
// cache to expire. revalidatePath only covers writes made from in here.
export const dynamic = "force-dynamic";

export default async function SuppliersPage(
  props: {
    searchParams: Promise<{ archived?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const showArchived = searchParams.archived === "1";
  const supabase = await createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  const base = supabase
    .from("suppliers")
    .select("id, name, email, phone, profile_id, archived_at")
    .order("created_at", { ascending: false });

  const [{ data: suppliers }, { data: profiles }, { count: archivedCount }, { data: materials }, { data: payments }, { data: advances }] = await Promise.all([
    showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
    supabase.rpc("admin_list_profiles_with_email", { p_role: "supplier" }),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
    supabase.from("materials").select("supplier_id, status").is("archived_at", null),
    supabase.from("payments").select("id, supplier_id, amount, status").is("archived_at", null).eq("payee_type", "supplier"),
    supabase.from("supplier_advances").select("supplier_id, amount, payment_id, material_id"),
  ]);

  const linked = new Set((suppliers ?? []).map((s) => s.profile_id).filter(Boolean));
  const unlinkedProfiles = ((profiles ?? []) as { id: string; full_name: string | null; email: string | null; phone: string | null }[])
    .filter((p) => !linked.has(p.id));

  const deliveriesBySupplier = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.status !== "delivered" || !m.supplier_id) continue;
    deliveriesBySupplier.set(m.supplier_id, (deliveriesBySupplier.get(m.supplier_id) ?? 0) + 1);
  }
  // One shared derivation per supplier, so these cards agree with the detail
  // page and the supplier's own dashboard. See lib/supplierAccount.ts.
  const paymentsBySupplier = new Map<string, { id: string; amount: number; status: string }[]>();
  for (const p of payments ?? []) {
    if (!p.supplier_id) continue;
    const list = paymentsBySupplier.get(p.supplier_id) ?? [];
    list.push({ id: p.id, amount: Number(p.amount), status: p.status });
    paymentsBySupplier.set(p.supplier_id, list);
  }
  const advancesBySupplier = new Map<string, { amount: number; payment_id: string | null; material_id: string | null }[]>();
  for (const a of advances ?? []) {
    if (!a.supplier_id) continue;
    const list = advancesBySupplier.get(a.supplier_id) ?? [];
    list.push({ amount: Number(a.amount), payment_id: a.payment_id, material_id: a.material_id });
    advancesBySupplier.set(a.supplier_id, list);
  }
  const moneyFor = (id: string) =>
    supplierMoney({
      payments: paymentsBySupplier.get(id) ?? [],
      advances: advancesBySupplier.get(id) ?? [],
    });

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived suppliers" : "Suppliers"}
        subtitle={
          showArchived
            ? "Hidden from lists and dropdowns. Their past materials and payments are kept."
            : "Vendors who deliver materials."
        }
      />
      <AdminContent>

      <div className="mb-6">
        <ArchivedToggle basePath="/admin/suppliers" showArchived={showArchived} archivedCount={archivedCount ?? 0} label="suppliers" />
      </div>

      {!showArchived && (
        <CreateSupplierForm action={createSupplier} unlinkedProfiles={unlinkedProfiles} />
      )}

      {!showArchived && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(suppliers ?? []).length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
              No suppliers yet. Add one above.
            </p>
          )}
          {(suppliers ?? []).map((s) => {
            const m = moneyFor(s.id);
            return (
            <Link
              key={s.id}
              href={`/admin/suppliers/${s.id}`}
              className="rounded-xl border border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
            >
              <div className="font-semibold">{s.name}</div>
              <p className="mt-2 text-sm text-slate-600">
                {s.email ?? "No email"} · {s.phone ?? "No phone"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Deliveries</div>
                  <div className="text-sm font-semibold">{deliveriesBySupplier.get(s.id) ?? 0}</div>
                </div>
                {/* Amber only while money is genuinely owed, so a settled
                    supplier shows a quiet zero rather than a warning colour. */}
                <div className={`rounded-lg border px-3 py-2 ${
                  m.remaining > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className={`text-[10px] font-medium uppercase tracking-wide ${
                    m.remaining > 0 ? "text-amber-700" : "text-slate-500"}`}>Remaining</div>
                  <div className={`text-sm font-semibold ${
                    m.remaining > 0 ? "text-amber-700" : ""}`}>₹{m.remaining.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">Lifetime payment</div>
                  <div className="text-sm font-semibold text-emerald-700">₹{m.lifetimePayment.toLocaleString()}</div>
                </div>
                {/* Blue only when they are actually holding credit, so a card
                    with no advance stays quiet instead of showing a coloured
                    zero. Same treatment as the supplier detail page. */}
                <div
                  className={`rounded-lg border px-3 py-2 ${
                    m.advanceBalance > 0
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div
                    className={`text-[10px] font-medium uppercase tracking-wide ${
                      m.advanceBalance > 0 ? "text-blue-700" : "text-slate-500"
                    }`}
                  >
                    Advance
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      m.advanceBalance > 0 ? "text-blue-700" : ""
                    }`}
                  >
                    ₹{m.advanceBalance.toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium text-brand-700">Manage →</p>
            </Link>
            );
          })}
        </div>
      )}

      {showArchived && (
        (suppliers ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
            No archived suppliers.
          </p>
        ) : (
          <ManageSection showArchived={showArchived}>
            {suppliers!.map((s) => (
              <ManageCard key={s.id} title={s.name}>
                <div className="flex items-center gap-2">
                  <RestoreAction id={s.id} action={unarchiveSupplier} />
                  {isOwner && <DeleteForeverButton id={s.id} name={s.name} action={deleteSupplier} />}
                </div>
              </ManageCard>
            ))}
          </ManageSection>
        )
      )}
      </AdminContent>
    </AdminPage>
  );
}
