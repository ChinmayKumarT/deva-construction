import Link from "next/link";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, RestoreAction } from "@/components/admin/RowActions";
import { CreatePaymentForm } from "@/components/admin/PaymentForm";
import {
  approvePayment, createPayment, markPaymentPaid, rejectPayment,
  archivePayment, unarchivePayment, deletePayment,
} from "../actions";

// Without this, Next.js can cache the underlying Supabase fetch and serve a
// stale render when navigating between filtered/unfiltered views of this page
// (e.g. "Clear filter" appearing to do nothing).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { archived?: string; project?: string };
}) {
  const showArchived = searchParams.archived === "1";
  const projectFilter = searchParams.project ?? null;
  const supabase = createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  let base = supabase
    .from("payments")
    .select("id, amount, status, payee_type, description, created_at, archived_at, projects(name), suppliers(name), labourers(name)")
    .order("created_at", { ascending: false });
  if (projectFilter) base = base.eq("project_id", projectFilter);

  const [{ data: payments }, { data: projects }, { data: suppliers }, { data: labourers }, { data: materials }, { count: archivedCount }] =
    await Promise.all([
      showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
      supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
      supabase.from("suppliers").select("id, name").is("archived_at", null).order("name"),
      supabase.from("labourers").select("id, name").is("archived_at", null).order("name"),
      supabase
        .from("materials")
        .select("id, name, unit, quantity, unit_cost, work_category, supplier_id, project_id")
        .is("archived_at", null)
        .neq("status", "returned")
        .order("ordered_at", { ascending: false }),
      supabase.from("payments").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
    ]);

  const filteredProjectName = projectFilter
    ? projects?.find((p) => p.id === projectFilter)?.name ?? "selected project"
    : null;

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived payments" : "Payments"}
        subtitle={
          showArchived
            ? "Hidden from lists and excluded from cost totals."
            : "Bills and wages. Pending → approved → paid."
        }
      />

      {filteredProjectName && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800">
          <span>Showing payments for <strong>{filteredProjectName}</strong>{showArchived ? " (archived)" : ""}.</span>
          <a href="/admin/payments" className="font-medium hover:underline">Clear filter</a>
        </div>
      )}

      <div className="mb-6">
        <ArchivedToggle basePath={projectFilter ? `/admin/payments?project=${projectFilter}` : "/admin/payments"} showArchived={showArchived} archivedCount={archivedCount ?? 0} label="payments" />
      </div>

      {!showArchived && (
        <CreatePaymentForm
          action={createPayment}
          projects={projects ?? []}
          suppliers={suppliers ?? []}
          labourers={labourers ?? []}
          materials={materials ?? []}
          defaultProjectId={projectFilter ?? "none"}
        />
      )}

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
