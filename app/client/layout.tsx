import { requireRole } from "@/lib/guard";
import { Sidebar, type NavGroup } from "@/components/Sidebar";

const GROUPS: NavGroup[] = [
  {
    items: [{ href: "/client", label: "Dashboard", icon: "home" }],
  },
  {
    title: "Activity",
    items: [
      { href: "/client#updates", label: "Updates", icon: "updates" },
      { href: "/client#payments", label: "Payments", icon: "payments" },
    ],
  },
  {
    title: "Insights",
    items: [{ href: "/client/reports", label: "Reports", icon: "reports" }],
  },
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("client");
  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar role="client" email={user.email ?? ""} groups={GROUPS} homeHref="/client" />
      <section className="flex-1 min-w-0 min-h-screen overflow-x-hidden">{children}</section>
    </div>
  );
}
