import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { DeleteForeverButton } from "@/components/admin/RowActions";
import { archiveProject, deleteProject, extendProjectEndDate, setNextPaymentDate, unarchiveProject } from "../../actions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ManageProjectPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, status, current_stage, completion_pct, total_cost, end_date, original_end_date, extension_reason, next_payment_date, next_payment_amount, archived_at, clients(name)",
    )
    .eq("id", params.id)
    .single();
  if (!project) notFound();

  const archived = project.archived_at != null;
  const extended =
    project.original_end_date != null && project.end_date != null && project.end_date > project.original_end_date;

  return (
    <AdminPage>
      <Link href="/admin/projects" className="mb-2 inline-block text-sm text-slate-600 hover:underline">
        ← Projects
      </Link>
      <AdminPageHeader
        title={project.name}
        subtitle={
          // @ts-expect-error relation
          `${project.clients?.name ?? "No client"} · ${project.status} · ${project.current_stage ?? "no stage"} · ${Number(project.completion_pct).toFixed(1)}% complete · ₹${Number(project.total_cost).toLocaleString()}`
        }
      />

      <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-6">
        {archived ? (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Archived {project.archived_at ? new Date(project.archived_at).toLocaleDateString() : ""}. Hidden from
              all other views. Its materials, payments and updates are retained.
            </p>
            <div className="flex items-center gap-2">
              <form action={unarchiveProject}>
                <input type="hidden" name="id" value={project.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Restore
                </button>
              </form>
              {isOwner && (
                <DeleteForeverButton
                  id={project.id}
                  name={project.name}
                  action={deleteProject}
                  warning="All its materials, payments and progress updates will be deleted too."
                />
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-slate-500">
              Finish: {project.end_date ?? "not set"}
              {project.original_end_date ? ` (originally ${project.original_end_date})` : ""}
            </p>
            {extended && (
              <p className="mb-2 text-sm font-medium text-red-600">
                Extended from {project.original_end_date}
                {project.extension_reason ? ` · ${project.extension_reason}` : ""}
              </p>
            )}

            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Link
                href={`/admin/projects/${project.id}/edit`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Edit
              </Link>
              <form action={archiveProject}>
                <input type="hidden" name="id" value={project.id} />
                <button
                  type="submit"
                  title={`Hide ${project.name} from all views. Its materials, payments and updates are kept and it can be restored.`}
                  className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  Archive
                </button>
              </form>
            </div>

            <form action={extendProjectEndDate} className="pb-4">
              <input type="hidden" name="id" value={project.id} />
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Extend finish date</span>
                  <input
                    type="date"
                    name="end_date"
                    defaultValue={project.end_date ?? ""}
                    required
                    className="rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-sm flex-1 min-w-[8rem]">
                  <span className="mb-1 block text-slate-600">Reason (optional)</span>
                  <input
                    type="text"
                    name="reason"
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Save
                </button>
              </div>
            </form>

            <form action={setNextPaymentDate} className="border-t border-slate-100 pt-4">
              <input type="hidden" name="id" value={project.id} />
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Next payment date</span>
                  <input
                    type="date"
                    name="next_payment_date"
                    defaultValue={project.next_payment_date ?? ""}
                    className="rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Amount due (optional)</span>
                  <input
                    type="number" step="0.01" min="0"
                    name="next_payment_amount"
                    defaultValue={project.next_payment_amount ?? ""}
                    className="w-32 rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Save
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                If an amount is set, a client payment only clears this reminder once the full amount has been paid
                (a partial payment lowers the remaining balance instead). Left blank, any payment clears it.
              </p>
            </form>
          </>
        )}
      </div>
    </AdminPage>
  );
}
