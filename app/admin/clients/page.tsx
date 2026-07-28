import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, Select, SubmitButton } from "@/components/admin/Page";
import { ArchivedToggle, ManageCard, ManageSection, RestoreAction, RowActions } from "@/components/admin/RowActions";
import { createClient as createClientAction, archiveClient, unarchiveClient } from "../actions";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { archived?: string };
}) {
  const showArchived = searchParams.archived === "1";
  const supabase = createSupabaseServerClient();

  const base = supabase
    .from("clients")
    .select("id, name, email, phone, profile_id, archived_at")
    .order("created_at", { ascending: false });

  const [{ data: clients }, { data: profiles }, { count: archivedCount }] = await Promise.all([
    showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
    supabase.from("profiles").select("id, full_name, role").eq("role", "client"),
    supabase.from("clients").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
  ]);

  const linkedProfileIds = new Set((clients ?? []).map((c) => c.profile_id).filter(Boolean));
  const unlinkedProfiles = (profiles ?? []).filter((p) => !linkedProfileIds.has(p.id));

  const rows = clients?.map((c) => [c.name, c.email, c.phone, c.profile_id ? "linked" : "no login"]) ?? [];

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived clients" : "Clients"}
        subtitle={showArchived ? "Hidden from lists. Their projects are unaffected." : "People paying for a project."}
      />

      <div className="mb-6">
        <ArchivedToggle basePath="/admin/clients" showArchived={showArchived} archivedCount={archivedCount ?? 0} label="clients" />
      </div>

      {!showArchived && (
        <form action={createClientAction} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
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
            <SubmitButton>Add client</SubmitButton>
          </div>
        </form>
      )}

      <DataTable
        columns={["Name", "Email", "Phone", "Login"]}
        rows={rows}
        empty={showArchived ? "No archived clients." : "No clients yet."}
      />

      {clients && clients.length > 0 && (
        <ManageSection showArchived={showArchived}>
          {clients.map((c) => (
            <ManageCard key={c.id} title={c.name}>
              {showArchived ? (
                <RestoreAction id={c.id} action={unarchiveClient} />
              ) : (
                <RowActions
                  editHref={`/admin/clients/${c.id}/edit`}
                  id={c.id}
                  name={c.name}
                  archiveAction={archiveClient}
                />
              )}
            </ManageCard>
          ))}
        </ManageSection>
      )}
    </AdminPage>
  );
}
