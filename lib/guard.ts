import { redirect } from "next/navigation";
import { getSessionAndRole, type Role } from "@/lib/supabase/server";

export async function requireRole(expected: Role | Role[]) {
  const { user, role } = await getSessionAndRole();
  if (!user) redirect("/");
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!role || !allowed.includes(role)) redirect(role ? `/${role}` : "/");
  return { user, role };
}
