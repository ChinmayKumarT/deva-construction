import { requireRole } from "@/lib/guard";
import { Sidebar, type NavGroup } from "@/components/Sidebar";

function buildGroups(canTeamAccess: boolean, isManager: boolean): NavGroup[] {
  const insightItems: NavGroup["items"] = [
    ...(isManager
      ? []
      : [
          { href: "/admin/reports", label: "Reports", icon: "reports" as const },
          { href: "/admin/cashflow", label: "Cash flow", icon: "reports" as const },
          { href: "/admin/profitloss", label: "Profit & Loss", icon: "costs" as const },
        ]),
    ...(canTeamAccess
      ? [
          { href: "/admin/team", label: "Team access", icon: "team" as const },
          { href: "/admin/backup", label: "Backup", icon: "reports" as const },
        ]
      : []),
  ];

  return [
    { items: [
      { href: "/admin", label: "Overview", icon: "overview" },
      { href: "/admin/search", label: "Search", icon: "search" },
    ] },
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
        ...(isManager
          ? []
          : [{ href: "/admin/costs", label: "Costs", icon: "costs" as const }]),
        { href: "/admin/attendance", label: "Attendance", icon: "attendance" },
        { href: "/admin/payments", label: "Payments", icon: "payments" },
        { href: "/admin/updates", label: "Updates", icon: "updates" },
      ],
    },
    ...(insightItems.length ? [{ title: "Insights", items: insightItems }] : []),
    {
      title: "Website",
      items: [{ href: "/admin/website", label: "Projects shown online", icon: "photo" }],
    },
    ...(isManager
      ? []
      : [
          {
            title: "Personal",
            items: [
              { href: "/admin/personal", label: "Personal", icon: "wallet" as const },
            ],
          },
        ]),
  ];
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, isOwner } = await requireRole(["superadmin", "admin", "manager"]);
  const canTeamAccess = role === "superadmin" || isOwner;
  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar
        role={role ?? "admin"}
        email={user.email ?? ""}
        groups={buildGroups(canTeamAccess, role === "manager")}
        homeHref="/admin"
      />
      <section className="flex-1 min-w-0 min-h-screen overflow-x-hidden">{children}</section>
    </div>
  );
}
