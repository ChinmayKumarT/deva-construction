import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateBill, recordDelivery } from "./actions";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export default async function SupplierDashboard() {
  const { user } = await requireRole("supplier");
  const supabase = createSupabaseServerClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("profile_id", user.id)
    .single();

  if (!supplier) {
    return (
      <main className="mx-auto max-w-2xl p-10">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-3 text-slate-600">
          Your account isn't linked to a supplier record yet. Ask the admin to link you in the Suppliers page.
        </p>
      </main>
    );
  }

  const [{ data: materials }, { data: payments }, { data: allProjects }] = await Promise.all([
    supabase
      .from("materials")
      .select("id, name, quantity, unit, unit_cost, status, ordered_at, delivered_at, projects(id, name)")
      .eq("supplier_id", supplier.id)
      .order("ordered_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, status, description, created_at, projects(name)")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const deliveredCount = (materials ?? []).filter((m) => m.status === "delivered").length;
  const pendingPay = (payments ?? [])
    .filter((p) => p.status === "pending" || p.status === "approved")
    .reduce((s, p) => s + Number(p.amount), 0);
  const paidTotal = (payments ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);

  // Distinct projects where the supplier has delivered something — for the bill form.
  const projectMap = new Map<string, string>();
  for (const m of materials ?? []) {
    // @ts-expect-error relation
    if (m.projects?.id) projectMap.set(m.projects.id, m.projects.name);
  }
  const billableProjects = Array.from(projectMap, ([id, name]) => ({ id, name }));

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Supplier dashboard</p>
          <h1 className="text-2xl font-bold">{supplier.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Material orders" value={String(materials?.length ?? 0)} />
        <Stat label="Delivered" value={String(deliveredCount)} />
        <Stat label="Pending payments" value={`₹${pendingPay.toLocaleString()}`} />
        <Stat label="Total received" value={`₹${paidTotal.toLocaleString()}`} />
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Record delivery</h2>
        {(!allProjects || allProjects.length === 0) ? (
          <p className="text-sm text-slate-600">No projects exist yet. Wait for the admin to create one.</p>
        ) : (
          <form action={recordDelivery} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Project (site)</span>
              <select name="project_id" required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                {allProjects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Material</span>
              <input name="name" required placeholder="e.g. Cement" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Unit</span>
              <input name="unit" defaultValue="bag" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Quantity</span>
              <input name="quantity" type="number" step="0.01" required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Unit cost (₹)</span>
              <input name="unit_cost" type="number" step="0.01" required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Status</span>
              <select name="status" defaultValue="delivered" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="ordered">Ordered</option>
                <option value="delivered">Delivered</option>
              </select>
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Record delivery
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Generate bill</h2>
        {billableProjects.length === 0 ? (
          <p className="text-sm text-slate-600">You haven't been assigned to any project yet.</p>
        ) : (
          <form action={generateBill} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Project</span>
              <select name="project_id" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                {billableProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Amount (₹)</span>
              <input
                type="number"
                step="0.01"
                name="amount"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Description</span>
              <input
                name="description"
                placeholder="e.g. Invoice #123 – cement delivery"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-4">
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Submit bill
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Deliveries</h2>
        <Table
          columns={["Material", "Project", "Qty", "Unit cost", "Line total", "Status", "Ordered"]}
          rows={
            materials?.map((m) => [
              m.name,
              // @ts-expect-error relation
              m.projects?.name ?? "—",
              `${Number(m.quantity)} ${m.unit}`,
              `₹${Number(m.unit_cost).toLocaleString()}`,
              `₹${(Number(m.quantity) * Number(m.unit_cost)).toLocaleString()}`,
              m.status,
              new Date(m.ordered_at).toLocaleDateString(),
            ]) ?? []
          }
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Payments</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No bills submitted.</td></tr>
              )}
              {payments?.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">{new Date(p.created_at).toLocaleDateString()}</td>
                  {/* @ts-expect-error relation */}
                  <td className="px-4 py-2 text-slate-600">{p.projects?.name ?? "—"}</td>
                  <td className="px-4 py-2 font-medium">₹{Number(p.amount).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_STYLE[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: (string | number | null)[][] }) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Nothing yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>{columns.map((c) => <th key={c} className="px-4 py-2 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {r.map((cell, j) => <td key={j} className="px-4 py-2 text-slate-700">{cell ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
