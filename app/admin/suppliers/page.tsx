import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, Select, SubmitButton } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, ManageCard, ManageSection, RestoreAction, RowActions } from "@/components/admin/RowActions";
import { createSupplier, archiveSupplier, unarchiveSupplier, deleteSupplier } from "../actions";

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

  const rows = suppliers?.map((s) => [s.name, s.email, s.phone, s.profile_id ? "linked" : "no login"]) ?? [];

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
          <Field label="Phone" name="phone" />
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

      <DataTable
        columns={["Name", "Email", "Phone", "Login"]}
        rows={rows}
        empty={showArchived ? "No archived suppliers." : "No suppliers yet."}
      />

      {suppliers && suppliers.length > 0 && (
        <ManageSection showArchived={showArchived}>
          {suppliers.map((s) => (
            <ManageCard key={s.id} title={s.name}>
              {showArchived ? (
                <div className="flex items-center gap-2">
                  <RestoreAction id={s.id} action={unarchiveSupplier} />
                  {isOwner && <DeleteForeverButton id={s.id} name={s.name} action={deleteSupplier} />}
                </div>
              ) : (
                <RowActions
                  editHref={`/admin/suppliers/${s.id}/edit`}
                  id={s.id}
                  name={s.name}
                  archiveAction={archiveSupplier}
                />
              )}
            </ManageCard>
          ))}
        </ManageSection>
      )}
    </AdminPage>
  );
}
