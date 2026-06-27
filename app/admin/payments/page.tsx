import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, Field, Select, SubmitButton } from "@/components/admin/Page";
import { approvePayment, createPayment, markPaymentPaid, rejectPayment } from "../actions";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export default async function PaymentsPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: payments }, { data: projects }, { data: suppliers }, { data: labourers }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, status, payee_type, description, created_at, projects(name), suppliers(name), labourers(name)")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("labourers").select("id, name").order("name"),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader title="Payments" subtitle="Bills and wages. Pending → approved → paid." />

      <form action={createPayment} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Select label="Payee type" name="payee_type" defaultValue="supplier">
          <option value="supplier">Supplier (bill)</option>
          <option value="labour">Labourer (wages)</option>
        </Select>
        <Select label="Project" name="project_id" defaultValue="none">
          <option value="none">— none —</option>
          {projects?.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </Select>
        <Field label="Amount (₹)" name="amount" type="number" step="0.01" required />
        <Select label="Supplier" name="supplier_id" defaultValue="none">
          <option value="none">— if labour, leave —</option>
          {suppliers?.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
        <Select label="Labourer" name="labourer_id" defaultValue="none">
          <option value="none">— if supplier, leave —</option>
          {labourers?.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
        </Select>
        <Field label="Description" name="description" />
        <div className="sm:col-span-2 lg:col-span-3">
          <SubmitButton>Create payment</SubmitButton>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Payee</th>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No payments yet.</td></tr>
            )}
            {payments?.map((p) => {
              const payeeName =
                // @ts-expect-error relation
                p.payee_type === "supplier" ? p.suppliers?.name : p.labourers?.name;
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-600">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    {payeeName ?? "—"} <span className="text-xs text-slate-500">({p.payee_type})</span>
                  </td>
                  {/* @ts-expect-error relation */}
                  <td className="px-4 py-2 text-slate-600">{p.projects?.name ?? "—"}</td>
                  <td className="px-4 py-2 font-medium">₹{Number(p.amount).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_STYLE[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.description ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {p.status === "pending" && (
                        <>
                          <ActionButton id={p.id} action={approvePayment} label="Approve" />
                          <ActionButton id={p.id} action={rejectPayment} label="Reject" variant="ghost" />
                        </>
                      )}
                      {p.status === "approved" && (
                        <ActionButton id={p.id} action={markPaymentPaid} label="Mark paid" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}

function ActionButton({
  id,
  action,
  label,
  variant = "primary",
}: {
  id: string;
  action: (fd: FormData) => Promise<void>;
  label: string;
  variant?: "primary" | "ghost";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        className={
          "rounded-md border px-2 py-1 text-xs " +
          (variant === "primary"
            ? "border-slate-800 bg-slate-900 text-white hover:bg-slate-800"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100")
        }
      >
        {label}
      </button>
    </form>
  );
}
