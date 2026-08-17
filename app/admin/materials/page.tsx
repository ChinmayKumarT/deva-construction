import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, CostBox, Field, Select, SubmitButton } from "@/components/admin/Page";
import { CategoryField } from "@/components/admin/CategoryField";
import { createMaterial } from "../actions";
import { lineTotal } from "@/lib/money";

// Without this, Next.js can cache the underlying Supabase fetch and serve a
// stale render when navigating between filtered/unfiltered views of this page
// (e.g. "Clear filter" appearing to do nothing).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function MaterialsIndexPage(
  props: {
    searchParams: Promise<{ archived?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const showArchived = searchParams.archived === "1";
  const supabase = await createSupabaseServerClient();

  const [{ data: projects }, { data: materials }, { data: suppliers }, { count: archivedCount }] = await Promise.all([
    supabase.from("projects").select("id, name, status").is("archived_at", null).order("name"),
    showArchived
      ? supabase.from("materials").select("id, project_id, quantity, unit_cost, status").not("archived_at", "is", null)
      : supabase.from("materials").select("id, project_id, quantity, unit_cost, status").is("archived_at", null),
    supabase.from("suppliers").select("id, name").is("archived_at", null).order("name"),
    supabase.from("materials").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
  ]);

  const byProject = new Map<string, { count: number; spend: number }>();
  let unassignedCount = 0;
  let unassignedSpend = 0;
  for (const m of materials ?? []) {
    const spend = m.status === "returned" ? 0 : lineTotal(m.quantity, m.unit_cost);
    if (m.project_id) {
      const cur = byProject.get(m.project_id) ?? { count: 0, spend: 0 };
      byProject.set(m.project_id, { count: cur.count + 1, spend: cur.spend + spend });
    } else {
      unassignedCount++;
      unassignedSpend += spend;
    }
  }

  const suffix = showArchived ? "?archived=1" : "";
  const totalCost = Array.from(byProject.values()).reduce((sum, s) => sum + s.spend, 0) + unassignedSpend;

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived materials" : "Materials"}
        subtitle={
          showArchived
            ? "Pick a site to see its archived materials."
            : "Pick a site to see what's ordered, delivered, and how much it costs."
        }
      />

      {!showArchived && archivedCount ? (
        <div className="mb-6">
          <Link href="/admin/materials?archived=1" className="text-sm font-medium text-brand-700 hover:underline">
            View {archivedCount} archived {archivedCount === 1 ? "material" : "materials"} →
          </Link>
        </div>
      ) : showArchived ? (
        <div className="mb-6">
          <Link href="/admin/materials" className="text-sm font-medium text-brand-700 hover:underline">
            ← Back to active materials
          </Link>
        </div>
      ) : null}

      {!showArchived && (
        <form action={createMaterial} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Material name" name="name" required />
          <Select label="Project" name="project_id" defaultValue="none">
            <option value="none">— none —</option>
            {(projects ?? []).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </Select>
          <Select label="Supplier" name="supplier_id" defaultValue="none">
            <option value="none">— none —</option>
            {suppliers?.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </Select>
          <Field label="Quantity" name="quantity" type="number" step="0.01" min="0" required />
          <Field label="Unit (kg, bag, m³…)" name="unit" defaultValue="unit" />
          <Field label="Unit cost (₹)" name="unit_cost" type="number" step="0.01" min="0" required />
          <Select label="Status" name="status" defaultValue="ordered">
            <option value="ordered">Ordered</option>
            <option value="delivered">Delivered</option>
            <option value="returned">Returned</option>
          </Select>
          <CategoryField label="Work category" name="work_category" />
          <div className="sm:col-span-2 lg:col-span-3">
            <SubmitButton>Add material</SubmitButton>
          </div>
        </form>
      )}

      {!showArchived && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CostBox label="Total cost" value={totalCost} accent />
          {(projects ?? []).length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
              No projects yet.
            </p>
          )}
          {(projects ?? []).map((p) => (
            <Link key={p.id} href={`/admin/materials/${p.id}`}>
              <CostBox label={p.name} value={byProject.get(p.id)?.spend ?? 0} />
            </Link>
          ))}
          {unassignedCount > 0 && (
            <Link href="/admin/materials/unassigned">
              <CostBox label="No project" value={unassignedSpend} />
            </Link>
          )}
        </div>
      )}

      {showArchived && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
              No projects yet.
            </p>
          )}
          {(projects ?? []).map((p) => {
            const stats = byProject.get(p.id) ?? { count: 0, spend: 0 };
            return (
              <Link
                key={p.id}
                href={`/admin/materials/${p.id}${suffix}`}
                className="rounded-xl border border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold">{p.name}</div>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    {p.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {stats.count} {stats.count === 1 ? "material" : "materials"} archived
                </p>
                <p className="mt-3 text-sm font-medium text-brand-700">View materials →</p>
              </Link>
            );
          })}

          {unassignedCount > 0 && (
            <Link
              href={`/admin/materials/unassigned${suffix}`}
              className="rounded-xl border border-dashed border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
            >
              <div className="font-semibold text-slate-700">No project</div>
              <p className="mt-2 text-sm text-slate-600">
                {unassignedCount} {unassignedCount === 1 ? "material" : "materials"} archived
              </p>
              <p className="mt-3 text-sm font-medium text-brand-700">View materials →</p>
            </Link>
          )}
        </div>
      )}
    </AdminPage>
  );
}
