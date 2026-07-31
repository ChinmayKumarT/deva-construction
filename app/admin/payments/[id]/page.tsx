import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, RestoreAction } from "@/components/admin/RowActions";
import { CreatePaymentForm } from "@/components/admin/PaymentForm";
import { computeWagesDue } from "@/lib/wages";
import {
  approvePayment, createPayment, markPaymentPaid, rejectPayment,
  archivePayment, unarchivePayment, deletePayment,
} from "../../actions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export default async function ProjectPaymentsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { archived?: string };
}) {
  const showArchived = searchParams.archived === "1";
  const isUnassigned = params.id === "unassigned";
  const supabase = createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  let base = supabase
    .from("payments")
    .select("id, amount, status, payee_type, description, created_at, archived_at, suppliers(name), labourers(name)")
    .order("created_at", { ascending: false });
  base = isUnassigned ? base.is("project_id", null) : base.eq("project_id", params.id);

  let archivedCountQuery = supabase.from("payments").select("id", { count: "exact", head: true }).not("archived_at", "is", null);
  archivedCountQuery = isUnassigned ? archivedCountQuery.is("project_id", null) : archivedCountQuery.eq("project_id", params.id);

  const [
    { data: project }, { data: payments }, { data: projects }, { data: suppliers }, { data: labourers },
    { data: materials }, { data: assignments }, { data: allLabourPayments }, { data: attendance },
    { count: archivedCount },
  ] = await Promise.all([
    isUnassigned
      ? Promise.resolve({ data: null as { id: string; name: string } | null })
      : supabase.from("projects").select("id, name").eq("id", params.id).single(),
    showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
    supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
    supabase.from("suppliers").select("id, name").is("archived_at", null).order("name"),
    supabase.from("labourers").select("id, name, daily_wage").is("archived_at", null).order("name"),
    supabase
      .from("materials")
      .select("id, name, unit, quantity, unit_cost, work_category, supplier_id, project_id")
      .is("archived_at", null)
      .neq("status", "returned")
      .order("ordered_at", { ascending: false }),
    supabase.from("project_labourers").select("labourer_id, project_id").is("unassigned_at", null),
    supabase
      .from("payments")
      .select("project_id, payee_type, labourer_id, amount, status")
      .is("archived_at", null)
      .eq("payee_type", "labour"),
    supabase.from("attendance").select("project_id, labourer_id, status"),
    archivedCountQuery,
  ]);

  if (!isUnassigned && !project) notFound();

  const title = isUnassigned ? "Payments with no project" : project!.name;
  const basePath = `/admin/payments/${params.id}`;

  const labourerWage = new Map((labourers ?? []).map((l) => [l.id, Number(l.daily_wage)]));
  const wageDue = computeWagesDue(attendance ?? [], allLabourPayments ?? [], labourerWage);

  return (
    <AdminPage>
      <Link href="/admin/payments" className="mb-2 inline-block text-sm text-slate-600 hover:underline">
        ← All payments
      </Link>
      <AdminPageHeader
        title={showArchived ? `${title} (archived)` : title}
        subtitle={
          showArchived
            ? "Hidden from lists and excluded from cost totals."
            : "Bills and wages. Pending → approved → paid."
        }
      />

      <div className="mb-6">
        <ArchivedToggle basePath={basePath} showArchived={showArchived} archivedCount={archivedCount ?? 0} label="payments" />
      </div>

      {!showArchived && !isUnassigned && (
        <CreatePaymentForm
          action={createPayment}
          projects={projects ?? []}
          suppliers={suppliers ?? []}
          labourers={labourers ?? []}
          materials={materials ?? []}
          assignments={assignments ?? []}
          wageDue={wageDue}
          fixedProject={{ id: project!.id, name: project!.name }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Payee</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                {showArchived ? "No archived payments." : "No payments recorded for this project yet."}
              </td></tr>
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
                  <td className="px-4 py-2 font-medium">₹{Number(p.amount).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_STYLE[p.status] ?? ""}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.description ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {showArchived ? (
                        <>
                          <RestoreAction id={p.id} action={unarchivePayment} />
                          {isOwner && (
                            <DeleteForeverButton
                              id={p.id}
                              name={`this ${p.payee_type} payment`}
                              action={deletePayment}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          {p.status === "pending" && (
                            <>
                              <ActionButton id={p.id} action={approvePayment} label="Approve" />
                              <ActionButton id={p.id} action={rejectPayment} label="Reject" variant="ghost" />
                            </>
                          )}
                          {p.status === "approved" && (
                            <ActionButton id={p.id} action={markPaymentPaid} label="Mark paid" />
                          )}
                          <Link
                            href={`/admin/payments/${p.id}/edit`}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </Link>
                          <ActionButton id={p.id} action={archivePayment} label="Archive" variant="ghost" />
                        </>
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
