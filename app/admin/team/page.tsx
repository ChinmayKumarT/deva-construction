import { redirect } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, AdminContent } from "@/components/admin/Page";
import { TeamAccessClient } from "@/components/admin/TeamAccessClient";

export default async function TeamAccessPage() {
  const { role, isOwner } = await requireRole(["superadmin", "admin", "manager"]);
  if (role !== "superadmin" && !isOwner) redirect("/admin");

  const supabase = await createSupabaseServerClient();
  const [{ data: profiles }, { data: reservations }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, is_owner").order("full_name"),
    supabase.from("role_reservations").select("email, role, created_at").order("created_at", { ascending: false }),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Team access"
        subtitle="Only you can grant admin or manager access. Everyone else signs up as client or supplier."
      />
      <AdminContent>
      <TeamAccessClient profiles={profiles ?? []} reservations={reservations ?? []} />
      </AdminContent>
    </AdminPage>
  );
}
