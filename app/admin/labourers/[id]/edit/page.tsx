import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, Field, Select, SubmitButton } from "@/components/admin/Page";
import { updateLabourer } from "../../../actions";
import { WORK_CATEGORIES } from "@/lib/workCategories";

export default async function EditLabourerPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: labourer } = await supabase
    .from("labourers")
    .select("id, name, phone, daily_wage, active, category")
    .eq("id", params.id)
    .single();
  if (!labourer) notFound();

  return (
    <AdminPage>
      <Link href="/admin/labourers" className="text-sm text-slate-600 hover:underline">← Labourers</Link>
      <AdminPageHeader title={`Edit ${labourer.name}`} subtitle="Update this labourer's details." />
      <form action={updateLabourer} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="id" value={labourer.id} />
        <Field label="Name" name="name" required defaultValue={labourer.name} />
        <Select label="Category" name="category" defaultValue={labourer.category ?? ""}>
          <option value="">— none —</option>
          {WORK_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
        </Select>
        <Field label="Phone" name="phone" defaultValue={labourer.phone ?? ""} />
        <Field label="Daily wage (₹)" name="daily_wage" type="number" step="0.01" min="0" defaultValue={labourer.daily_wage ?? 0} />
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
