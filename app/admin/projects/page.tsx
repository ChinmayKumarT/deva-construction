import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, Select, SubmitButton } from "@/components/admin/Page";
import { createProject } from "../actions";

export default async function ProjectsPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, current_stage, completion_pct, total_cost, clients(name)")
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
    </AdminPage>
  );
}
