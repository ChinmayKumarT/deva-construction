import { requireRole } from "@/lib/guard";
import { Sidebar, type NavGroup } from "@/components/Sidebar";

const GROUPS: NavGroup[] = [
  { items: [{ href: "/admin", label: "Overview", icon: "overview" }] },
  {
    title: "Manage",
    items: [
      { href: "/admin/projects", label: "Projects", icon: "projects" },
      { href: "/admin/clients", label: "Clients", icon: "clients" },
      { href: "/admin/suppliers", label: "Suppliers", icon: "suppliers" },
      { href: "/admin/labourers", label: "Labour", icon: "labourers" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/materials", label: "Materials", icon: "materials" },
      { href: "/admin/costs", label: "Costs", icon: "costs" },
      { href: "/admin/attendance", label: "Attendance", icon: "attendance" },
      { href: "/admin/payments", label: "Payments", icon: "payments" },
      { href: "/admin/updates", label: "Updates", icon: "updates" },
    ],
  },
  {
    title: "Insights",
    items: [{ href: "/admin/reports", label: "Reports", icon: "reports" }],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireRole(["admin", "manager"]);
  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar role={role ?? "admin"} email={user.email ?? ""} groups={GROUPS} homeHref="/admin" />
      <section className="flex-1 min-h-screen">{children}</section>
    </div>
  );
}
