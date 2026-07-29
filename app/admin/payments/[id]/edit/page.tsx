import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { EditPaymentForm } from "@/components/admin/PaymentForm";
import { updatePayment } from "../../../actions";

export default async function EditPaymentPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const [{ data: payment }, { data: projects }, { data: suppliers }, { data: labourers }, { data: materials }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("id, amount, status, payee_type, description, project_id, supplier_id, labourer_id, work_category")
        .eq("id", params.id)
        .single(),
      supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
      supabase.from("suppliers").select("id, name").is("archived_at", null).order("name"),
      supabase.from("labourers").select("id, name").is("archived_at", null).order("name"),
      supabase
        .from("materials")
        .select("id, name, unit, quantity, unit_cost, work_category, supplier_id, project_id")
        .is("archived_at", null)
        .neq("status", "returned")
        .order("ordered_at", { ascending: false }),
    ]);
  if (!payment) notFound();

  return (
    <AdminPage>
      <Link href="/admin/payments" className="text-sm text-slate-600 hover:underline">← Payments</Link>
      <AdminPageHeader
        title="Edit payment"
        subtitle={`Currently ${payment.status}. Status is changed with the approve / pay buttons, not here.`}
      />
      <EditPaymentForm
        action={updatePayment}
        projects={projects ?? []}
        suppliers={suppliers ?? []}
        labourers={labourers ?? []}
        materials={materials ?? []}
        paymentId={payment.id}
        cancelHref="/admin/payments"
        initial={{
          payeeType: payment.payee_type,
          projectId: payment.project_id ?? "none",
          amount: String(payment.amount ?? 0),
          supplierId: payment.supplier_id ?? "none",
          labourerId: payment.labourer_id ?? "none",
          description: payment.description ?? "",
          workCategory: payment.work_category ?? "",
        }}
      />
      <p className="mt-4 text-xs text-slate-500">
        Pick the payee that matches the payee type — the database requires exactly one, so the
        other is cleared automatically on save.
      </p>
    </AdminPage>
  );
}
