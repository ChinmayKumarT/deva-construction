import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, Select, SubmitButton } from "@/components/admin/Page";
import { createClient as createClientAction } from "../actions";

export default async function ClientsPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: clients }, { data: profiles }] = await Promise.all([
    supabase.from("clients").select("id, name, email, phone, profile_id").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, role").eq("role", "client"),
  ]);

  const linkedProfileIds = new Set((clients ?? []).map((c) => c.profile_id).filter(Boolean));
  const unlinkedProfiles = (profiles ?? []).filter((p) => !linkedProfileIds.has(p.id));

  const rows = clients?.map((c) => [c.name, c.email, c.phone, c.profile_id ? "linked" : "no login"]) ?? [];

  return (
    <AdminPage>
      <AdminPageHeader title="Clients" subtitle="People paying for a project." />

      <form action={createClientAction} className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name" name="name" required />
        <Field label="Email" name="email" type="email" />
        <Field label="Phone" name="phone" />
        <Field label="Address" name="address" />
        <Select label="Link to login (optional)" name="profile_id" defaultValue="none">
          <option value="none">— none —</option>
          {unlinkedProfiles.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 8)}</option>
          ))}
        </Select>
        <div className="sm:col-span-2 lg:col-span-3">
          <SubmitButton>Add client</SubmitButton>
        </div>
      </form>

      <DataTable
        columns={["Name", "Email", "Phone", "Login"]}
        rows={rows}
        empty="No clients yet."
      />
    </AdminPage>
  );
}
