import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, CostBox } from "@/components/admin/Page";
import { AutoSubmitFileInput } from "@/components/admin/AutoSubmitFileInput";
import { DeleteForeverButton } from "@/components/admin/RowActions";
import { wageForStatus } from "@/lib/wages";
import { lineTotal } from "@/lib/money";
import {
  archiveProject,
  deleteProject,
  extendProjectEndDate,
  removeProjectAgreement,
  setNextPaymentDate,
  unarchiveProject,
  uploadProjectAgreement,
} from "../../actions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ManageProjectPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  const [{ data: project }, { data: materials }, { data: payments }, { data: attendance }, { data: labourers }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, name, status, current_stage, completion_pct, total_cost, end_date, original_end_date, extension_reason, next_payment_date, next_payment_amount, agreement_image_url, archived_at, clients(id, name, email, phone)",
        )
        .eq("id", params.id)
        .single(),
      supabase.from("materials").select("quantity, unit_cost, status").eq("project_id", params.id).is("archived_at", null),
      supabase.from("payments").select("amount, status, payee_type").eq("project_id", params.id).is("archived_at", null),
      supabase.from("attendance").select("status, labourer_id").eq("project_id", params.id),
      supabase.from("labourers").select("id, daily_wage"),
    ]);
  if (!project) notFound();

  const archived = project.archived_at != null;
  const extended =
    project.original_end_date != null && project.end_date != null && project.end_date > project.original_end_date;

  // Same "spent" definition as the Costs and Reports pages: materials +
  // labour payments + attendance wages. Supplier payments are excluded --
  // they settle a cost already counted via the material's own line total.
  const labourerWage = new Map((labourers ?? []).map((l) => [l.id, Number(l.daily_wage)]));
  const materialsCost = (materials ?? [])
    .filter((m) => m.status !== "returned")
    .reduce((sum, m) => sum + lineTotal(m.quantity, m.unit_cost), 0);
  const labourPaid = (payments ?? [])
    .filter((p) => (p.status === "paid" || p.status === "approved") && p.payee_type === "labour")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const wages = (attendance ?? []).reduce(
    (sum, a) => sum + wageForStatus(a.status, labourerWage.get(a.labourer_id) ?? 0),
    0,
  );
  const spent = materialsCost + labourPaid + wages;
  const budget = Number(project.total_cost);

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

      <div className="mb-6 grid max-w-xl gap-3 sm:grid-cols-3">
        <CostBox label="Budget" value={budget} />
        <CostBox label="Spent" value={spent} />
        <CostBox label="Remaining" value={budget - spent} accent />
      </div>

      <div className="mb-6 flex max-w-xl items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        {
          project.clients ? (
            <>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Client</div>
                {/* @ts-expect-error relation */}
                <div className="mt-1 font-medium text-ink">{project.clients.name}</div>
                <div className="mt-0.5 text-sm text-slate-600">
                  {/* @ts-expect-error relation */}
                  {project.clients.phone ?? "No phone"} · {project.clients.email ?? "No email"}
                </div>
              </div>
              <Link
                // @ts-expect-error relation
                href={`/admin/clients/${project.clients.id}`}
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                View client →
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">No client assigned to this project.</p>
          )
        }
      </div>

      <div className="mb-6 max-w-xl rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">Agreement</div>
        {project.agreement_image_url ? (
          <>
            <a href={project.agreement_image_url} target="_blank" rel="noreferrer">
              <Image
                src={project.agreement_image_url} alt="" width={640} height={480} loading="lazy"
                className="max-h-96 w-auto rounded-lg border border-slate-200 object-cover"
              />
            </a>
            {!archived && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action={uploadProjectAgreement}>
                  <input type="hidden" name="project_id" value={project.id} />
                  <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                    Replace
                    <AutoSubmitFileInput name="image_file" className="hidden" />
                  </label>
                </form>
                <form action={removeProjectAgreement}>
                  <input type="hidden" name="project_id" value={project.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </form>
              </div>
            )}
          </>
        ) : archived ? (
          <p className="text-sm text-slate-500">No agreement on file.</p>
        ) : (
          <form action={uploadProjectAgreement} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="project_id" value={project.id} />
            <input
              type="file" accept="image/*" name="image_file" required
              className="text-sm text-slate-600 file:mr-2 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-100"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Upload
            </button>
          </form>
        )}
      </div>

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
