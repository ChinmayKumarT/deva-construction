import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, Field, Select, SubmitButton } from "@/components/admin/Page";
import { createShowcaseProject, setShowcasePublished } from "./actions";

/**
 * Website — the projects shown publicly on devaconstructions.in.
 *
 * Separate from /admin/projects on purpose. That page is the operational
 * record: costs, client, completion. This one is what strangers see, and the
 * two are stored apart so commercial figures cannot reach the public site.
 * See supabase/36_showcase.sql.
 */

export const metadata = { title: "Website" };

export default async function WebsitePage() {
  const supabase = await createSupabaseServerClient();
  const { data: projects } = await supabase
    .from("showcase_projects")
    .select("id, slug, name, location, year, kind, area, featured, published, sort_order")
    .order("sort_order", { ascending: true });

  const { data: photoRows } = await supabase.from("showcase_photos").select("showcase_id");
  const photoCount = new Map<string, number>();
  for (const r of photoRows ?? []) {
    photoCount.set(r.showcase_id, (photoCount.get(r.showcase_id) ?? 0) + 1);
  }

  const live = projects?.filter((p) => p.published).length ?? 0;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Website"
        subtitle={
          <>
            Projects shown on devaconstructions.in. {live} live
            {projects && projects.length !== live ? `, ${projects.length - live} draft` : ""}.
            Changes appear on the website within a minute of publishing.
          </>
        }
      />

      <div className="mb-8 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Photos</th>
              <th className="px-4 py-3">Home page</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {projects?.map((p) => {
              const photos = photoCount.get(p.id) ?? 0;
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/website/${p.id}`} className="font-medium text-ink hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {p.location} · {p.year} · {p.area}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.kind}</td>
                  <td className="px-4 py-3">
                    {photos === 0 ? (
                      <span className="text-amber-600">None yet</span>
                    ) : (
                      <span className="text-slate-600">{photos}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.featured ? "Featured" : "—"}</td>
                  <td className="px-4 py-3">
                    {p.published ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        Live
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/website/${p.id}`}
                        className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <form action={setShowcasePublished}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="published" value={p.published ? "false" : "true"} />
                        <SubmitButton>{p.published ? "Unpublish" : "Publish"}</SubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!projects?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No projects on the website yet. Add the first one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        action={createShowcaseProject}
        className="grid gap-4 rounded-xl border border-[var(--line)] bg-white p-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="sm:col-span-2 lg:col-span-3">
          <h2 className="text-base font-semibold text-ink">Add a project to the website</h2>
          <p className="mt-1 text-sm text-slate-500">
            It is saved as a draft. Add photos, check it over, then publish.
          </p>
        </div>
        <Field label="Project name" name="name" required />
        <Field label="Location" name="location" required />
        <Field label="Year" name="year" required maxLength={4} />
        <Select label="Category" name="kind" defaultValue="Residential">
          <option value="Residential">Residential</option>
          <option value="Commercial">Commercial / industrial</option>
          <option value="Renovation">Renovation / interiors</option>
        </Select>
        <Field label="Area" name="area" required />
        <Field label="Order (lower shows first)" name="sort_order" type="number" defaultValue={100} />
        <div className="sm:col-span-2 lg:col-span-3">
          <SubmitButton>Add project</SubmitButton>
        </div>
      </form>
    </AdminPage>
  );
}
