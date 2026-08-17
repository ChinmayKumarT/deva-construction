import Link from "next/link";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, CostBox, Field, Select, SubmitButton } from "@/components/admin/Page";
import { DeleteForeverButton } from "@/components/admin/RowActions";
import { createProject, unarchiveProject, deleteProject } from "../actions";

export default async function ProjectsPage(
  props: {
    searchParams: Promise<{ archived?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const showArchived = searchParams.archived === "1";
  const supabase = createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  const projectQuery = supabase
    .from("projects")
    .select(
      "id, name, status, current_stage, completion_pct, total_cost, end_date, original_end_date, extension_reason, next_payment_date, archived_at, clients(name)",
    )
    .order("created_at", { ascending: false });

  const [{ data: projects }, { data: clients }, { count: archivedCount }] = await Promise.all([
    showArchived
      ? projectQuery.not("archived_at", "is", null)
      : projectQuery.is("archived_at", null),
    supabase.from("clients").select("id, name").is("archived_at", null).order("name"),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .not("archived_at", "is", null),
  ]);

  const totalCost = (projects ?? []).reduce((sum, p) => sum + Number(p.total_cost), 0);

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived projects" : "Projects"}
        subtitle={
          showArchived
            ? "These are hidden from all other views. Their materials, payments and updates are retained."
            : "Create and track construction projects/sites."
        }
      />

      <div className="mb-6">
        {showArchived ? (
          <Link href="/admin/projects" className="text-sm font-medium text-brand-700 hover:underline">
            ← Back to active projects
          </Link>
        ) : (
          archivedCount != null && archivedCount > 0 && (
            <Link
              href="/admin/projects?archived=1"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              View {archivedCount} archived project{archivedCount === 1 ? "" : "s"} →
            </Link>
          )
        )}
      </div>

      {!showArchived && (projects ?? []).length > 0 && (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CostBox label="Total cost" value={totalCost} accent />
          {(projects ?? []).map((p) => (
            <Link key={p.id} href={`/admin/projects/${p.id}`}>
              <CostBox label={p.name} value={Number(p.total_cost)} />
            </Link>
          ))}
        </div>
      )}

      {!showArchived && (
        <form action={createProject} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" name="name" required />
          <Select label="Client" name="client_id" defaultValue="none">
            <option value="none">— none —</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Field label="Address" name="address" />
          <Select label="Status" name="status" defaultValue="planned">
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Field label="Current stage" name="current_stage" />
          <Field label="Total cost (₹)" name="total_cost" type="number" step="0.01" min="0" />
          <Field label="Start date" name="start_date" type="date" />
          <Field label="End date" name="end_date" type="date" />
          <Field label="Completion %" name="completion_pct" type="number" step="0.1" min="0" max="100" />
          <div className="sm:col-span-2 lg:col-span-3">
            <SubmitButton>Create project</SubmitButton>
          </div>
        </form>
      )}

      {!showArchived && (projects ?? []).length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
          No projects yet. Create one above.
        </p>
      )}

      {showArchived && (
        (projects ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
            No archived projects.
          </p>
        ) : (
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Restore</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects!.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 font-medium text-sm">{p.name}</div>
                  <p className="mb-3 text-xs text-slate-500">
                    Archived {p.archived_at ? new Date(p.archived_at).toLocaleDateString() : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <form action={unarchiveProject}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                      >
                        Restore
                      </button>
                    </form>
                    {isOwner && (
                      <DeleteForeverButton
                        id={p.id} name={p.name} action={deleteProject}
                        warning="All its materials, payments and progress updates will be deleted too."
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      )}
    </AdminPage>
  );
}
