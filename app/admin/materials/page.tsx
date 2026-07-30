import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, Select, SubmitButton } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, ManageCard, ManageSection, RestoreAction, RowActions } from "@/components/admin/RowActions";
import { createMaterial, markMaterialDelivered, archiveMaterial, unarchiveMaterial, deleteMaterial } from "../actions";
import { WORK_CATEGORIES } from "@/lib/workCategories";
import { lineTotal } from "@/lib/money";

// Without this, Next.js can cache the underlying Supabase fetch and serve a
// stale render when navigating between filtered/unfiltered views of this page
// (e.g. "Clear filter" appearing to do nothing).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: { archived?: string; project?: string };
}) {
  const showArchived = searchParams.archived === "1";
  const projectFilter = searchParams.project ?? null;
  const supabase = createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  let base = supabase
    .from("materials")
    .select("id, name, unit, quantity, unit_cost, status, work_category, ordered_at, archived_at, projects(name), suppliers(name)")
    .order("ordered_at", { ascending: false });
  if (projectFilter) base = base.eq("project_id", projectFilter);

  const [{ data: materials }, { data: projects }, { data: suppliers }, { count: archivedCount }] =
    await Promise.all([
      showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
      supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
      supabase.from("suppliers").select("id, name").is("archived_at", null).order("name"),
      supabase.from("materials").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
    ]);

  const filteredProjectName = projectFilter
    ? projects?.find((p) => p.id === projectFilter)?.name ?? "selected project"
    : null;

  const rows =
    materials?.map((m) => [
      m.name,
      // @ts-expect-error relation
      m.projects?.name ?? "—",
      // @ts-expect-error relation
      m.suppliers?.name ?? "—",
      `${Number(m.quantity)} ${m.unit}`,
      `₹${Number(m.unit_cost).toLocaleString()}`,
      `₹${lineTotal(m.quantity, m.unit_cost).toLocaleString()}`,
      m.status,
      m.work_category ?? "—",
    ]) ?? [];

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived materials" : "Materials"}
        subtitle={
          showArchived
            ? "Hidden from lists and excluded from cost totals."
            : "Track what's ordered, delivered, and how much it costs."
        }
      />

      {filteredProjectName && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800">
          <span>Showing materials for <strong>{filteredProjectName}</strong>{showArchived ? " (archived)" : ""}.</span>
          <a href="/admin/materials" className="font-medium hover:underline">Clear filter</a>
        </div>
      )}

      <div className="mb-6">
        <ArchivedToggle basePath={projectFilter ? `/admin/materials?project=${projectFilter}` : "/admin/materials"} showArchived={showArchived} archivedCount={archivedCount ?? 0} label="materials" />
      </div>

      {!showArchived && (
        <form action={createMaterial} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Material name" name="name" required />
          <Select label="Project" name="project_id" defaultValue={projectFilter ?? "none"}>
            <option value="none" disabled>— choose —</option>
            {projects?.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </Select>
          <Select label="Supplier" name="supplier_id" defaultValue="none">
            <option value="none">— none —</option>
            {suppliers?.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </Select>
          <Field label="Quantity" name="quantity" type="number" step="0.01" required />
          <Field label="Unit (kg, bag, m³…)" name="unit" defaultValue="unit" />
          <Field label="Unit cost (₹)" name="unit_cost" type="number" step="0.01" required />
          <Select label="Status" name="status" defaultValue="ordered">
            <option value="ordered">Ordered</option>
            <option value="delivered">Delivered</option>
            <option value="returned">Returned</option>
          </Select>
          <Select label="Work category" name="work_category" defaultValue="">
            <option value="">— none —</option>
            {WORK_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
          </Select>
          <div className="sm:col-span-2 lg:col-span-3">
            <SubmitButton>Add material</SubmitButton>
          </div>
        </form>
      )}

      <DataTable
        columns={["Material", "Project", "Supplier", "Qty", "Unit cost", "Line total", "Status", "Category"]}
        rows={rows}
        empty={showArchived ? "No archived materials." : "No materials recorded yet."}
      />

      {materials && materials.length > 0 && (
        <ManageSection showArchived={showArchived}>
          {materials.map((m) => (
            <ManageCard key={m.id} title={m.name}>
              {showArchived ? (
                <div className="flex items-center gap-2">
                  <RestoreAction id={m.id} action={unarchiveMaterial} />
                  {isOwner && <DeleteForeverButton id={m.id} name={m.name} action={deleteMaterial} />}
                </div>
              ) : (
                <RowActions
                  editHref={`/admin/materials/${m.id}/edit`}
                  id={m.id}
                  name={m.name}
                  archiveAction={archiveMaterial}
                />
              )}
            </ManageCard>
          ))}
        </ManageSection>
      )}

      {!showArchived && materials && materials.some((m) => m.status === "ordered") && (
        <section className="mt-8">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Mark as delivered</h3>
          <div className="flex flex-wrap gap-2">
            {materials
              .filter((m) => m.status === "ordered")
              .map((m) => (
                <form key={m.id} action={markMaterialDelivered}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    {m.name} →  delivered
                  </button>
                </form>
              ))}
          </div>
        </section>
      )}
    </AdminPage>
  );
}
