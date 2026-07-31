import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { DeleteForeverButton } from "@/components/admin/RowActions";
import { archiveSupplier, deleteSupplier, unarchiveSupplier } from "../../actions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ManageSupplierPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name, email, phone, profile_id, archived_at")
    .eq("id", params.id)
    .single();
  if (!supplier) notFound();

  const archived = supplier.archived_at != null;

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
    </AdminPage>
  );
}
