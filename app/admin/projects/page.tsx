import Link from "next/link";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, Select, SubmitButton } from "@/components/admin/Page";
import { DeleteForeverButton } from "@/components/admin/RowActions";
import { createProject, extendProjectEndDate, setNextPaymentDate, archiveProject, unarchiveProject, deleteProject } from "../actions";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { archived?: string };
}) {
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

  const rows =
    projects?.map((p) => [
      p.name,
      // @ts-expect-error supabase relation
      p.clients?.name ?? "—",
      p.status,
      p.current_stage,
      `${Number(p.completion_pct).toFixed(1)}%`,
      `₹${Number(p.total_cost).toLocaleString()}`,
    ]) ?? [];

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
          <Field label="Total cost (₹)" name="total_cost" type="number" step="0.01" />
          <Field label="Start date" name="start_date" type="date" />
          <Field label="End date" name="end_date" type="date" />
          <Field label="Completion %" name="completion_pct" type="number" step="0.1" />
          <div className="sm:col-span-2 lg:col-span-3">
            <SubmitButton>Create project</SubmitButton>
          </div>
        </form>
      )}

      <DataTable
        columns={["Name", "Client", "Status", "Stage", "Completion", "Total cost"]}
        rows={rows}
        empty={showArchived ? "No archived projects." : "No projects yet. Create one above."}
      />

      {projects && projects.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {showArchived ? "Restore" : "Manage"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const extended =
                p.original_end_date != null && p.end_date != null && p.end_date > p.original_end_date;
              return (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 font-medium text-sm">{p.name}</div>

                  {showArchived ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-xs text-slate-500">
                        Finish: {p.end_date ?? "not set"}
                        {p.original_end_date ? ` (originally ${p.original_end_date})` : ""}
                      </p>
                      {extended && (
                        <p className="mb-2 text-xs font-medium text-red-600">
                          Extended from {p.original_end_date}
                          {p.extension_reason ? ` · ${p.extension_reason}` : ""}
                        </p>
                      )}

                      <div className="mb-3 flex items-center gap-2">
                        <Link
                          href={`/admin/projects/${p.id}/edit`}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </Link>
                        <ArchiveButton id={p.id} name={p.name} />
                      </div>

                      <form action={extendProjectEndDate} className="border-t border-slate-100 pt-3">
                        <input type="hidden" name="id" value={p.id} />
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="text-xs">
                            <span className="mb-1 block text-slate-600">Extend finish date</span>
                            <input
                              type="date"
                              name="end_date"
                              defaultValue={p.end_date ?? ""}
                              required
                              className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
                            />
                          </label>
                          <label className="text-xs flex-1 min-w-[8rem]">
                            <span className="mb-1 block text-slate-600">Reason (optional)</span>
                            <input
                              type="text"
                              name="reason"
                              className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                          >
                            Save
                          </button>
                        </div>
                      </form>

                      <form action={setNextPaymentDate} className="mt-3 border-t border-slate-100 pt-3">
                        <input type="hidden" name="id" value={p.id} />
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="text-xs">
                            <span className="mb-1 block text-slate-600">Next payment date</span>
                            <input
                              type="date"
                              name="next_payment_date"
                              defaultValue={p.next_payment_date ?? ""}
                              className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </AdminPage>
  );
}

function ArchiveButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={archiveProject}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        title={`Hide ${name} from all views. Its materials, payments and updates are kept and it can be restored.`}
        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
      >
        Archive
      </button>
    </form>
  );
}
