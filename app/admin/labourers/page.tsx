import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, SubmitButton } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, ManageCard, ManageSection, RestoreAction, RowActions } from "@/components/admin/RowActions";
import { AssignLabourerForm } from "@/components/admin/AssignLabourerForm";
import { CategoryField } from "@/components/admin/CategoryField";
import { assignLabourer, createLabourer, archiveLabourer, unarchiveLabourer, deleteLabourer } from "../actions";

export default async function LabourersPage(
  props: {
    searchParams: Promise<{ archived?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const showArchived = searchParams.archived === "1";
  const supabase = await createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  const base = supabase
    .from("labourers")
    .select("id, name, phone, daily_wage, active, category, profile_id, archived_at")
    .order("created_at", { ascending: false });

  const [{ data: labourers }, { data: projects }, { data: assignments }, { count: archivedCount }] =
    await Promise.all([
      showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
      supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
      supabase
        .from("project_labourers")
        .select("labourer_id, project_id, projects(name)")
        .is("unassigned_at", null),
      supabase.from("labourers").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
    ]);

  const currentSite = new Map(
    (assignments ?? []).map((a) => [
      a.labourer_id,
      // @ts-expect-error relation
      a.projects?.name as string | undefined,
    ]),
  );

  const rows =
    labourers?.map((l) => [
      l.name,
      l.category ?? "—",
      l.phone,
      `₹${Number(l.daily_wage).toLocaleString()}`,
      currentSite.get(l.id) ?? "—",
      l.active ? "active" : "inactive",
    ]) ?? [];

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived labourers" : "Labourers"}
        subtitle={
          showArchived
            ? "Hidden from lists, attendance and assignment. Their attendance and wage history is kept."
            : "Workers on site."
        }
      />

      <div className="mb-6">
        <ArchivedToggle basePath="/admin/labourers" showArchived={showArchived} archivedCount={archivedCount ?? 0} label="labourers" />
      </div>

      {!showArchived && (
        <form action={createLabourer} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" name="name" required />
          <CategoryField label="Category" name="category" />
          <Field label="Phone" name="phone" type="tel" maxLength={10} />
          <Field label="Daily wage (₹)" name="daily_wage" type="number" step="0.01" min="0" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="active" defaultChecked />
            Active
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <SubmitButton>Add labourer</SubmitButton>
          </div>
        </form>
      )}

      <DataTable
        columns={["Name", "Category", "Phone", "Daily wage", "Current site", "Status"]}
        rows={rows}
        empty={showArchived ? "No archived labourers." : "No labourers yet."}
      />

      {labourers && labourers.length > 0 && (
        <ManageSection showArchived={showArchived}>
          {labourers.map((l) => (
            <ManageCard key={l.id} title={l.name}>
              {showArchived ? (
                <div className="flex items-center gap-2">
                  <RestoreAction id={l.id} action={unarchiveLabourer} />
                  {isOwner && (
                    <DeleteForeverButton
                      id={l.id} name={l.name} action={deleteLabourer}
                      warning="Their entire attendance and wage history will be deleted too."
                    />
                  )}
                </div>
              ) : (
                <RowActions
                  editHref={`/admin/labourers/${l.id}/edit`}
                  id={l.id}
                  name={l.name}
                  archiveAction={archiveLabourer}
                />
              )}
            </ManageCard>
          ))}
        </ManageSection>
      )}

      {!showArchived && labourers && labourers.length > 0 && projects && projects.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Assign to project</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {labourers.filter((l) => l.active).map((l) => (
              <AssignLabourerForm
                key={l.id}
                labourerId={l.id}
                labourerName={l.name}
                currentSite={currentSite.get(l.id) ?? "unassigned"}
                projects={projects ?? []}
                action={assignLabourer}
              />
            ))}
          </div>
        </section>
      )}
    </AdminPage>
  );
}
