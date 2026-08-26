import { redirect } from "next/navigation";
import { getSessionAndRole, type Role } from "@/lib/supabase/server";

export async function requireRole(expected: Role | Role[]) {
  const { user, role, isOwner } = await getSessionAndRole();
  if (!user) redirect("/");
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!role || !allowed.includes(role)) {
    const dest = role === "superadmin" || role === "manager" ? "/admin" : role ? `/${role}` : "/";
    redirect(dest);
  }
  return { user, role, isOwner };
}
