import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, Field, Select, SubmitButton } from "@/components/admin/Page";
import { postProjectUpdate } from "../actions";

export default async function UpdatesPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: updates }, { data: projects }] = await Promise.all([
    supabase
      .from("project_updates")
      .select("id, stage, note, image_url, created_at, projects(name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader title="Project updates" subtitle="Post progress notes and site photos visible to the client." />

      <form action={postProjectUpdate} encType="multipart/form-data" className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Select label="Project" name="project_id" defaultValue="none">
          <option value="none" disabled>— choose —</option>
          {projects?.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </Select>
        <Field label="Stage (e.g. Foundation, Slab)" name="stage" />
        <Field label="Completion %" name="completion_pct" type="number" step="0.1" />
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

      <ul className="space-y-4">
        {(updates ?? []).length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No updates posted yet.
          </li>
        )}
        {updates?.map((u) => (
          <li key={u.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-baseline justify-between">
              {/* @ts-expect-error relation */}
              <div className="font-medium">{u.projects?.name ?? "—"}</div>
              <div className="text-xs text-slate-500">{new Date(u.created_at).toLocaleString()}</div>
            </div>
            {u.stage && <div className="mt-1 text-sm text-slate-600">Stage: <span className="font-medium">{u.stage}</span></div>}
            {u.note && <p className="mt-2 text-sm text-slate-700">{u.note}</p>}
            {u.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.image_url} alt="Site update" className="mt-3 max-h-72 rounded-lg border border-slate-200 object-cover" />
            )}
          </li>
        ))}
      </ul>
    </AdminPage>
  );
}
