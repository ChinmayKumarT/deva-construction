import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, Select, SubmitButton } from "@/components/admin/Page";
import { createMaterial, markMaterialDelivered } from "../actions";

export default async function MaterialsPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: materials }, { data: projects }, { data: suppliers }] = await Promise.all([
    supabase
      .from("materials")
      .select("id, name, unit, quantity, unit_cost, status, ordered_at, projects(name), suppliers(name)")
      .order("ordered_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  const rows =
    materials?.map((m) => [
      m.name,
      // @ts-expect-error relation
      m.projects?.name ?? "—",
      // @ts-expect-error relation
      m.suppliers?.name ?? "—",
      `${Number(m.quantity)} ${m.unit}`,
      `₹${Number(m.unit_cost).toLocaleString()}`,
      `₹${(Number(m.quantity) * Number(m.unit_cost)).toLocaleString()}`,
      m.status,
    ]) ?? [];

  return (
    <AdminPage>
      <AdminPageHeader title="Materials" subtitle="Track what's ordered, delivered, and how much it costs." />

      <form action={createMaterial} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Material name" name="name" required />
        <Select label="Project" name="project_id" defaultValue="none">
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
        <div className="sm:col-span-2 lg:col-span-3">
          <SubmitButton>Add material</SubmitButton>
        </div>
      </form>

      <DataTable
        columns={["Material", "Project", "Supplier", "Qty", "Unit cost", "Line total", "Status"]}
        rows={rows}
        empty="No materials recorded yet."
      />

      {materials && materials.some((m) => m.status === "ordered") && (
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
