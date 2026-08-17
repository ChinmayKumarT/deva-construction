import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, Field, Select, SubmitButton } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, RestoreAction } from "@/components/admin/RowActions";
import { postProjectUpdate, archiveProjectUpdate, unarchiveProjectUpdate, deleteProjectUpdate } from "../actions";

export default async function UpdatesPage(
  props: {
    searchParams: Promise<{ archived?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const showArchived = searchParams.archived === "1";
  const supabase = await createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  const base = supabase
    .from("project_updates")
    .select("id, stage, note, image_url, created_at, archived_at, projects(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const [{ data: updates }, { data: projects }, { count: archivedCount }] = await Promise.all([
    showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
    supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
    supabase.from("project_updates").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived updates" : "Project updates"}
        subtitle={
          showArchived
            ? "Hidden from admin and from the client's dashboard."
            : "Post progress notes and site photos visible to the client."
        }
      />

      <div className="mb-6">
        <ArchivedToggle basePath="/admin/updates" showArchived={showArchived} archivedCount={archivedCount ?? 0} label="updates" />
      </div>

      {!showArchived && (
        <form action={postProjectUpdate} encType="multipart/form-data" className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Project" name="project_id" defaultValue="none">
            <option value="none" disabled>— choose —</option>
            {projects?.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </Select>
          <Field label="Stage (e.g. Foundation, Slab)" name="stage" />
          <Field label="Completion %" name="completion_pct" type="number" step="0.1" min="0" max="100" />
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Photo (upload)</span>
            <input
              type="file"
              name="image_file"
              accept="image/*"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5"
            />
          </label>
          <Field label="…or image URL" name="image_url" />
          <label className="block text-sm sm:col-span-2 lg:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Note</span>
            <textarea
              name="note"
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              placeholder="e.g. Slab pouring completed on east side; curing for 7 days."
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <SubmitButton>Post update</SubmitButton>
          </div>
        </form>
      )}

      <ul className="space-y-4">
        {(updates ?? []).length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {showArchived ? "No archived updates." : "No updates posted yet."}
          </li>
        )}
        {updates?.map((u) => {
          // @ts-expect-error relation
          const projectName: string = u.projects?.name ?? "—";
          return (
          <li key={u.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-baseline justify-between">
              <div className="font-medium">{projectName}</div>
              <div className="text-xs text-slate-500">{new Date(u.created_at).toLocaleString()}</div>
            </div>
            {u.stage && <div className="mt-1 text-sm text-slate-600">Stage: <span className="font-medium">{u.stage}</span></div>}
            {u.note && <p className="mt-2 text-sm text-slate-700">{u.note}</p>}
            {u.image_url && (
              <Image
                src={u.image_url} alt="Site update" width={640} height={480} loading="lazy"
                className="mt-3 max-h-72 w-auto rounded-lg border border-slate-200 object-cover"
              />
            )}
            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
              {showArchived ? (
                <>
                  <RestoreAction id={u.id} action={unarchiveProjectUpdate} />
                  {isOwner && (
                    <DeleteForeverButton id={u.id} name={`this update (${projectName})`} action={deleteProjectUpdate} />
                  )}
                </>
              ) : (
                <>
                  <Link
                    href={`/admin/updates/${u.id}/edit`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    Edit
                  </Link>
                  <form action={archiveProjectUpdate}>
                    <input type="hidden" name="id" value={u.id} />
                    <button
                      type="submit"
                      title="Hide this update from admin and the client. Nothing is deleted."
                      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                    >
                      Archive
                    </button>
                  </form>
                </>
              )}
            </div>
          </li>
          );
        })}
      </ul>
    </AdminPage>
  );
}
