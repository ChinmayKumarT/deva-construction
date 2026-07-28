import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, Field, Select, SubmitButton } from "@/components/admin/Page";
import { updateProject } from "../../../actions";

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const [{ data: project }, { data: clients }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, client_id, address, status, current_stage, completion_pct, total_cost, start_date, end_date",
      )
      .eq("id", params.id)
      .single(),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  if (!project) notFound();

  return (
    <AdminPage>
      <Link href="/admin/projects" className="text-sm text-slate-600 hover:underline">
        ← Projects
      </Link>
      <AdminPageHeader title={`Edit ${project.name}`} subtitle="Update this project's details." />

      <form
        action={updateProject}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input type="hidden" name="id" value={project.id} />
        <Field label="Name" name="name" required defaultValue={project.name} />
        <Select label="Client" name="client_id" defaultValue={project.client_id ?? "none"}>
          <option value="none">— none —</option>
          {clients?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Field label="Address" name="address" defaultValue={project.address ?? ""} />
        <Select label="Status" name="status" defaultValue={project.status}>
          <option value="planned">Planned</option>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Field label="Current stage" name="current_stage" defaultValue={project.current_stage ?? ""} />
        <Field
          label="Total cost (₹)" name="total_cost" type="number" step="0.01"
          defaultValue={project.total_cost ?? 0}
        />
        <Field label="Start date" name="start_date" type="date" defaultValue={project.start_date ?? ""} />
        <Field label="End date" name="end_date" type="date" defaultValue={project.end_date ?? ""} />
        <Field
          label="Completion %" name="completion_pct" type="number" step="0.1"
          defaultValue={project.completion_pct ?? 0}
        />
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
          <SubmitButton>Save changes</SubmitButton>
          <Link href="/admin/projects" className="text-sm text-slate-600 hover:underline">
            Cancel
          </Link>
        </div>
      </form>

      <p className="mt-4 text-xs text-slate-500">
        Changing the end date here does not record an extension. Use “Extend finish date” on the
        Projects page so the client sees what changed and why.
      </p>
    </AdminPage>
  );
}
