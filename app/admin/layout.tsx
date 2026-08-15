import { requireRole } from "@/lib/guard";
import { Sidebar, type NavGroup } from "@/components/Sidebar";

function buildGroups(isOwner: boolean): NavGroup[] {
  return [
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
      items: [
        { href: "/admin/reports", label: "Reports", icon: "reports" },
        { href: "/admin/cashflow", label: "Cash flow", icon: "reports" },
        ...(isOwner
          ? [
              { href: "/admin/team", label: "Team access", icon: "team" as const },
              { href: "/admin/backup", label: "Backup", icon: "reports" as const },
            ]
          : []),
      ],
    },
    {
      title: "Personal",
      items: [{ href: "/admin/personal", label: "Personal", icon: "wallet" }],
    },
  ];
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, isOwner } = await requireRole(["admin", "manager"]);
  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar role={role ?? "admin"} email={user.email ?? ""} groups={buildGroups(isOwner)} homeHref="/admin" />
      <section className="flex-1 min-h-screen">{children}</section>
    </div>
  );
}
