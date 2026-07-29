import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, Field, Select, SubmitButton } from "@/components/admin/Page";
import { updatePayment } from "../../../actions";
import { WORK_CATEGORIES } from "@/lib/workCategories";

export default async function EditPaymentPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const [{ data: payment }, { data: projects }, { data: suppliers }, { data: labourers }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("id, amount, status, payee_type, description, project_id, supplier_id, labourer_id, work_category")
        .eq("id", params.id)
        .single(),
      supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
      supabase.from("suppliers").select("id, name").is("archived_at", null).order("name"),
      supabase.from("labourers").select("id, name").is("archived_at", null).order("name"),
    ]);
  if (!payment) notFound();

  return (
    <AdminPage>
      <Link href="/admin/payments" className="text-sm text-slate-600 hover:underline">← Payments</Link>
      <AdminPageHeader
        title="Edit payment"
        subtitle={`Currently ${payment.status}. Status is changed with the approve / pay buttons, not here.`}
      />
      <form action={updatePayment} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="id" value={payment.id} />
        <Select label="Payee type" name="payee_type" defaultValue={payment.payee_type}>
          <option value="supplier">Supplier (bill)</option>
          <option value="labour">Labourer (wages)</option>
        </Select>
        <Select label="Project" name="project_id" defaultValue={payment.project_id ?? "none"}>
          <option value="none">— none —</option>
          {projects?.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </Select>
        <Field label="Amount (₹)" name="amount" type="number" step="0.01" required defaultValue={payment.amount ?? 0} />
        <Select label="Supplier" name="supplier_id" defaultValue={payment.supplier_id ?? "none"}>
          <option value="none">— if labour, leave —</option>
          {suppliers?.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
        <Select label="Labourer" name="labourer_id" defaultValue={payment.labourer_id ?? "none"}>
          <option value="none">— if supplier, leave —</option>
          {labourers?.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
        </Select>
        <Field label="Description" name="description" defaultValue={payment.description ?? ""} />
        <Select label="Work category" name="work_category" defaultValue={payment.work_category ?? ""}>
          <option value="">— none —</option>
          {WORK_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
        </Select>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
          <SubmitButton>Save changes</SubmitButton>
          <Link href="/admin/payments" className="text-sm text-slate-600 hover:underline">Cancel</Link>
        </div>
      </form>
      <p className="mt-4 text-xs text-slate-500">
        Pick the payee that matches the payee type — the database requires exactly one, so the
        other is cleared automatically on save.
      </p>
    </AdminPage>
  );
}
