import Link from "next/link";
import { createSupabaseServerClient, getSessionAndRole } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, AdminContent } from "@/components/admin/Page";
import { ArchivedToggle, DeleteForeverButton, ManageCard, ManageSection, RestoreAction } from "@/components/admin/RowActions";
import { CreateClientForm } from "@/components/admin/CreateClientForm";
import { createClient as createClientAction, unarchiveClient, deleteClient } from "../actions";

export default async function ClientsPage(
  props: {
    searchParams: Promise<{ archived?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const showArchived = searchParams.archived === "1";
  const supabase = await createSupabaseServerClient();
  const { isOwner } = await getSessionAndRole();

  const base = supabase
    .from("clients")
    .select("id, name, email, phone, profile_id, archived_at")
    .order("created_at", { ascending: false });

  const [{ data: clients }, { data: profiles }, { count: archivedCount }] = await Promise.all([
    showArchived ? base.not("archived_at", "is", null) : base.is("archived_at", null),
    supabase.rpc("admin_list_profiles_with_email", { p_role: "client" }),
    supabase.from("clients").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
  ]);

  const linkedProfileIds = new Set((clients ?? []).map((c) => c.profile_id).filter(Boolean));
  const unlinkedProfiles = ((profiles ?? []) as { id: string; full_name: string | null; email: string | null; phone: string | null }[])
    .filter((p) => !linkedProfileIds.has(p.id));

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived clients" : "Clients"}
        subtitle={showArchived ? "Hidden from lists. Their projects are unaffected." : "People paying for a project."}
      />
      <AdminContent>

      <div className="mb-6">
        <ArchivedToggle basePath="/admin/clients" showArchived={showArchived} archivedCount={archivedCount ?? 0} label="clients" />
      </div>

      {!showArchived && (
        <CreateClientForm action={createClientAction} unlinkedProfiles={unlinkedProfiles} />
      )}

      {!showArchived && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(clients ?? []).length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
              No clients yet. Add one above.
            </p>
          )}
          {(clients ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/admin/clients/${c.id}`}
              className="rounded-xl border border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
            >
              <div className="font-semibold">{c.name}</div>
              <p className="mt-2 text-sm text-slate-600">
                {c.email ?? "No email"} · {c.phone ?? "No phone"}
              </p>
              <p className="mt-3 text-sm font-medium text-brand-700">Manage →</p>
            </Link>
          ))}
        </div>
      )}

      {showArchived && (
        (clients ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
            No archived clients.
          </p>
        ) : (
          <ManageSection showArchived={showArchived}>
            {clients!.map((c) => (
              <ManageCard key={c.id} title={c.name}>
                <div className="flex items-center gap-2">
                  <RestoreAction id={c.id} action={unarchiveClient} />
                  {isOwner && <DeleteForeverButton id={c.id} name={c.name} action={deleteClient} />}
                </div>
              </ManageCard>
            ))}
          </ManageSection>
        )
      )}
      </AdminContent>
    </AdminPage>
  );
}
