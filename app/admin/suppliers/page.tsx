import Link from "next/link";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, Field, Select, SubmitButton } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, ManageCard, ManageSection, RestoreAction } from "@/components/admin/RowActions";
import { createSupplier, unarchiveSupplier, deleteSupplier } from "../actions";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: { archived?: string };
}) {
  const showArchived = searchParams.archived === "1";
  const supabase = createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  const base = supabase
    .from("suppliers")
    .select("id, name, email, phone, profile_id, archived_at")
    .order("created_at", { ascending: false });

  const [{ data: suppliers }, { data: profiles }, { count: archivedCount }] = await Promise.all([
    showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
    supabase.from("profiles").select("id, full_name").eq("role", "supplier"),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
  ]);

  const linked = new Set((suppliers ?? []).map((s) => s.profile_id).filter(Boolean));
  const unlinkedProfiles = (profiles ?? []).filter((p) => !linked.has(p.id));

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
        <form action={createSupplier} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" name="name" required />
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" maxLength={10} />
          <Field label="Address" name="address" />
          <Select label="Link to login (optional)" name="profile_id" defaultValue="none">
            <option value="none">— none —</option>
            {unlinkedProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 8)}</option>
            ))}
          </Select>
          <div className="sm:col-span-2 lg:col-span-3">
            <SubmitButton>Add supplier</SubmitButton>
          </div>
        </form>
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
