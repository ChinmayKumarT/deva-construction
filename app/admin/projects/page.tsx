import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, Select, SubmitButton } from "@/components/admin/Page";
import { createProject, extendProjectEndDate } from "../actions";

export default async function ProjectsPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, status, current_stage, completion_pct, total_cost, end_date, original_end_date, extension_reason, clients(name)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
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
      <AdminPageHeader title="Projects" subtitle="Create and track construction projects/sites." />

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

      <DataTable
        columns={["Name", "Client", "Status", "Stage", "Completion", "Total cost"]}
        rows={rows}
        empty="No projects yet. Create one above."
      />

      {projects && projects.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Extend finish date
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const extended =
                p.original_end_date != null && p.end_date != null && p.end_date > p.original_end_date;
              return (
                <form
                  key={p.id}
                  action={extendProjectEndDate}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <div className="mb-2 font-medium text-sm">{p.name}</div>
                  <p className="mb-2 text-xs text-slate-500">
                    Current: {p.end_date ?? "not set"}
                    {p.original_end_date ? ` (originally ${p.original_end_date})` : ""}
                  </p>
                  {extended && (
                    <p className="mb-2 text-xs font-medium text-red-600">
                      Extended from {p.original_end_date}
                      {p.extension_reason ? ` · ${p.extension_reason}` : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs">
                      <span className="mb-1 block text-slate-600">New finish date</span>
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
              );
            })}
          </div>
        </section>
      )}
    </AdminPage>
  );
}
