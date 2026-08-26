import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { DeleteForeverButton } from "@/components/admin/RowActions";
import { archiveSupplier, deleteSupplier, unarchiveSupplier, archiveMaterial, archivePayment } from "../../actions";
import { lineTotal } from "@/lib/money";
import { formatDateTime } from "@/lib/dateFormat";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const MATERIAL_STATUS_STYLE: Record<string, string> = {
  ordered: "bg-amber-50 text-amber-700 border-amber-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  returned: "bg-red-50 text-red-700 border-red-200",
};

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function StatBox({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${className ?? "border-slate-200 bg-white"}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

export default async function ManageSupplierPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  const [{ data: supplier }, { data: materials }, { data: payments }] = await Promise.all([
    supabase.from("suppliers").select("id, name, email, phone, profile_id, archived_at").eq("id", params.id).single(),
    supabase
      .from("materials")
      .select("id, name, unit, quantity, unit_cost, status, ordered_at, projects(name)")
      .eq("supplier_id", params.id)
      .is("archived_at", null)
      .order("ordered_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, status, description, created_at")
      .eq("supplier_id", params.id)
      .eq("payee_type", "supplier")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (!supplier) notFound();

  const archived = supplier.archived_at != null;
  const deliveredCount = (materials ?? []).filter((m) => m.status === "delivered").length;
  const pending = (payments ?? []).filter((p) => p.status === "pending" || p.status === "approved").reduce((a, p) => a + Number(p.amount), 0);
  const received = (payments ?? []).filter((p) => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);

  return (
    <AdminPage>
      <Link href="/admin/suppliers" className="mb-2 inline-block text-sm text-slate-600 hover:underline">
        ← Suppliers
      </Link>
      <AdminPageHeader
        title={supplier.name}
        subtitle={
          `${supplier.email ?? "No email"} · ${supplier.phone ?? "No phone"} · ${supplier.profile_id ? "linked to a login" : "no login"}`
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <StatBox label="Deliveries" value={String(deliveredCount)} />
        <StatBox label="Remaining" value={`₹${pending.toLocaleString()}`} className="border-amber-200 bg-amber-50 text-amber-700" />
        <StatBox label="Received" value={`₹${received.toLocaleString()}`} className="border-emerald-200 bg-emerald-50 text-emerald-700" />
      </div>

      <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-6">
        {archived ? (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Archived {supplier.archived_at ? new Date(supplier.archived_at).toLocaleDateString() : ""}. Hidden
              from lists and dropdowns. Their past materials and payments are kept.
            </p>
            <div className="flex items-center gap-2">
              <form action={unarchiveSupplier}>
                <input type="hidden" name="id" value={supplier.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Restore
                </button>
              </form>
              {isOwner && <DeleteForeverButton id={supplier.id} name={supplier.name} action={deleteSupplier} />}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/suppliers/${supplier.id}/edit`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Edit
            </Link>
            <form action={archiveSupplier}>
              <input type="hidden" name="id" value={supplier.id} />
              <button
                type="submit"
                title={`Hide ${supplier.name} from lists and dropdowns. Its past materials and payments are kept and it can be restored.`}
                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              >
                Archive
              </button>
            </form>
          </div>
        )}
      </div>

      <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Deliveries</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Material</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(materials ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No deliveries recorded yet.</td></tr>
            )}
            {materials?.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-600">{m.ordered_at ? new Date(m.ordered_at).toLocaleDateString() : "—"}</td>
                {/* @ts-expect-error relation */}
                <td className="px-4 py-2">{m.projects?.name ?? "—"}</td>
                <td className="px-4 py-2">{m.name} <span className="text-xs text-slate-500">({m.quantity} {m.unit})</span></td>
                <td className="px-4 py-2 font-medium">₹{lineTotal(m.quantity, m.unit_cost).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-md border px-2 py-0.5 text-xs ${MATERIAL_STATUS_STYLE[m.status] ?? ""}`}>{m.status}</span>
                </td>
                <td className="px-4 py-2">
                  <form action={archiveMaterial}>
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      type="submit"
                      title={`Delete ${m.name}`}
                      className="rounded-md border border-red-200 bg-white px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Payments</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No payments recorded yet.</td></tr>
            )}
            {payments?.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-600">{formatDateTime(p.created_at)}</td>
                <td className="px-4 py-2 text-slate-600">{p.description ?? "—"}</td>
                <td className="px-4 py-2 font-medium">₹{Number(p.amount).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-md border px-2 py-0.5 text-xs ${PAYMENT_STATUS_STYLE[p.status] ?? ""}`}>{p.status}</span>
                </td>
                <td className="px-4 py-2">
                  <form action={archivePayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      title={`Delete payment of ₹${Number(p.amount).toLocaleString()}`}
                      className="rounded-md border border-red-200 bg-white px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
