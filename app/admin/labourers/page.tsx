import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, Select, SubmitButton } from "@/components/admin/Page";
import { assignLabourer, createLabourer } from "../actions";

export default async function LabourersPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: labourers }, { data: profiles }, { data: projects }, { data: assignments }] = await Promise.all([
    supabase
      .from("labourers")
      .select("id, name, phone, daily_wage, active, profile_id")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").eq("role", "labour"),
    supabase.from("projects").select("id, name").order("name"),
    supabase
      .from("project_labourers")
      .select("labourer_id, project_id, projects(name)")
      .is("unassigned_at", null),
  ]);

  const linked = new Set((labourers ?? []).map((l) => l.profile_id).filter(Boolean));
  const unlinkedProfiles = (profiles ?? []).filter((p) => !linked.has(p.id));
  const currentSite = new Map(
    (assignments ?? []).map((a) => [
      a.labourer_id,
      // @ts-expect-error relation
      a.projects?.name as string | undefined,
    ]),
  );

  const rows =
    labourers?.map((l) => [
      l.name,
      l.phone,
      `₹${Number(l.daily_wage).toLocaleString()}`,
      currentSite.get(l.id) ?? "—",
      l.active ? "active" : "inactive",
      l.profile_id ? "linked" : "no login",
    ]) ?? [];

  return (
    <AdminPage>
      <AdminPageHeader title="Labourers" subtitle="Workers on site." />

      <form action={createLabourer} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name" name="name" required />
        <Field label="Phone" name="phone" />
        <Field label="Daily wage (₹)" name="daily_wage" type="number" step="0.01" />
        <Select label="Link to login (optional)" name="profile_id" defaultValue="none">
          <option value="none">— none —</option>
          {unlinkedProfiles.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 8)}</option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="active" defaultChecked />
          Active
        </label>
        <div className="sm:col-span-2 lg:col-span-3">
          <SubmitButton>Add labourer</SubmitButton>
        </div>
      </form>

      <DataTable
        columns={["Name", "Phone", "Daily wage", "Current site", "Status", "Login"]}
        rows={rows}
        empty="No labourers yet."
      />

      {labourers && labourers.length > 0 && projects && projects.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Assign to project</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {labourers.filter((l) => l.active).map((l) => (
              <form key={l.id} action={assignLabourer} className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
                <input type="hidden" name="labourer_id" value={l.id} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">{l.name}</div>
                  <div className="text-xs text-slate-500">currently: {currentSite.get(l.id) ?? "unassigned"}</div>
                </div>
                <select
                  name="project_id"
                  defaultValue="none"
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="none" disabled>— project —</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
                  Assign
                </button>
              </form>
            ))}
          </div>
        </section>
      )}
    </AdminPage>
  );
}
