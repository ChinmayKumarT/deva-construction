import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, Field, Select, SubmitButton } from "@/components/admin/Page";
import { updateLabourer } from "../../../actions";

export default async function EditLabourerPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const [{ data: labourer }, { data: profiles }, { data: labourers }] = await Promise.all([
    supabase.from("labourers").select("id, name, phone, daily_wage, active, profile_id").eq("id", params.id).single(),
    supabase.from("profiles").select("id, full_name").eq("role", "labour"),
    supabase.from("labourers").select("id, profile_id"),
  ]);
  if (!labourer) notFound();

  const takenByOthers = new Set(
    (labourers ?? []).filter((l) => l.id !== labourer.id).map((l) => l.profile_id).filter(Boolean),
  );
  const options = (profiles ?? []).filter((p) => !takenByOthers.has(p.id));

  return (
    <AdminPage>
      <Link href="/admin/labourers" className="text-sm text-slate-600 hover:underline">← Labourers</Link>
      <AdminPageHeader title={`Edit ${labourer.name}`} subtitle="Update this labourer's details." />
      <form action={updateLabourer} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="id" value={labourer.id} />
        <Field label="Name" name="name" required defaultValue={labourer.name} />
        <Field label="Phone" name="phone" defaultValue={labourer.phone ?? ""} />
        <Field label="Daily wage (₹)" name="daily_wage" type="number" step="0.01" defaultValue={labourer.daily_wage ?? 0} />
        <Select label="Link to login (optional)" name="profile_id" defaultValue={labourer.profile_id ?? "none"}>
          <option value="none">— none —</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 8)}</option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="active" defaultChecked={labourer.active} />
          Active
        </label>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
          <SubmitButton>Save changes</SubmitButton>
          <Link href="/admin/labourers" className="text-sm text-slate-600 hover:underline">Cancel</Link>
        </div>
      </form>
      <p className="mt-4 text-xs text-slate-500">
        Unticking “Active” keeps them in lists but excludes them from attendance and assignment.
        Archiving hides them entirely — their attendance history is kept either way.
      </p>
    </AdminPage>
  );
}
