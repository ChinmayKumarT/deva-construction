import { redirect } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { TeamAccessClient } from "@/components/admin/TeamAccessClient";

export default async function TeamAccessPage() {
  const { isOwner } = await requireRole(["admin", "manager"]);
  if (!isOwner) redirect("/admin");

  const supabase = createSupabaseServerClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_owner")
    .order("full_name");

  return (
    <AdminPage>
      <AdminPageHeader
        title="Team access"
        subtitle="Only you can grant admin or manager access. Everyone else signs up as client, supplier or labour."
      />
      <TeamAccessClient profiles={profiles ?? []} />
    </AdminPage>
  );
}
