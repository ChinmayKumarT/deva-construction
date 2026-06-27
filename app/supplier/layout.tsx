import { requireRole } from "@/lib/guard";
import { Sidebar, type NavGroup } from "@/components/Sidebar";

const GROUPS: NavGroup[] = [
  {
    items: [{ href: "/supplier", label: "Dashboard", icon: "home" }],
  },
  {
    title: "Activity",
    items: [
      { href: "/supplier#deliveries", label: "Deliveries", icon: "delivery" },
      { href: "/supplier#bills", label: "Bills", icon: "bill" },
    ],
  },
];

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("supplier");
  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar role="supplier" email={user.email ?? ""} groups={GROUPS} homeHref="/supplier" />
      <section className="flex-1 min-h-screen">{children}</section>
    </div>
  );
}
