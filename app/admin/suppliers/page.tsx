import Link from "next/link";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, ManageCard, ManageSection, RestoreAction } from "@/components/admin/RowActions";
import { CreateSupplierForm } from "@/components/admin/CreateSupplierForm";
import { createSupplier, unarchiveSupplier, deleteSupplier } from "../actions";

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

  const [{ data: suppliers }, { data: profiles }, { count: archivedCount }, { data: materials }, { data: payments }] = await Promise.all([
    showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
    supabase.from("profiles").select("id, full_name").eq("role", "supplier"),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
    supabase.from("materials").select("supplier_id, status").is("archived_at", null),
    supabase.from("payments").select("supplier_id, amount, status").is("archived_at", null).eq("payee_type", "supplier"),
  ]);

  const linked = new Set((suppliers ?? []).map((s) => s.profile_id).filter(Boolean));
  const unlinkedProfiles = (profiles ?? []).filter((p) => !linked.has(p.id));

  const deliveriesBySupplier = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.status !== "delivered" || !m.supplier_id) continue;
    deliveriesBySupplier.set(m.supplier_id, (deliveriesBySupplier.get(m.supplier_id) ?? 0) + 1);
  }
  const pendingBySupplier = new Map<string, number>();
  for (const p of payments ?? []) {
    if ((p.status !== "pending" && p.status !== "approved") || !p.supplier_id) continue;
    pendingBySupplier.set(p.supplier_id, (pendingBySupplier.get(p.supplier_id) ?? 0) + Number(p.amount));
  }

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
          {(suppliers ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/admin/suppliers/${s.id}`}
              className="rounded-xl border border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
            >
              <div className="font-semibold">{s.name}</div>
              <p className="mt-2 text-sm text-slate-600">
                {s.email ?? "No email"} · {s.phone ?? "No phone"}
              </p>
              <div className="mt-3 flex gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Deliveries</div>
                  <div className="text-sm font-semibold">{deliveriesBySupplier.get(s.id) ?? 0}</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Pending</div>
                  <div className="text-sm font-semibold text-amber-700">₹{(pendingBySupplier.get(s.id) ?? 0).toLocaleString()}</div>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium text-brand-700">Manage →</p>
            </Link>
          ))}
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
    </AdminPage>
  );
}
