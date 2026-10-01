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

/**
 * Superadmin or the owner -- the people who run Team access and the public
 * website. Anyone else on staff is sent back to /admin. The database enforces
 * the same rule (is_owner_or_superadmin()); this is only the page-level net.
 */
export async function requireOwnerOrSuperadmin() {
  const session = await requireRole(["superadmin", "admin", "manager"]);
  if (session.role !== "superadmin" && !session.isOwner) redirect("/admin");
  return session;
}
