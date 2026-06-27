import { requireRole } from "@/lib/guard";
import { Sidebar } from "@/components/Sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireRole(["admin", "manager"]);
  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar role={role ?? "admin"} email={user.email ?? ""} />
      <section className="flex-1 min-h-screen">{children}</section>
    </div>
  );
}
