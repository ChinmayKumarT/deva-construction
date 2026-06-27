import { requireRole } from "@/lib/guard";
import { Sidebar, type NavGroup } from "@/components/Sidebar";

const GROUPS: NavGroup[] = [
  {
    items: [{ href: "/labour", label: "Dashboard", icon: "home" }],
  },
  {
    title: "My work",
    items: [
      { href: "/labour#mark", label: "Mark today", icon: "calendar-check" },
      { href: "/labour#history", label: "History", icon: "updates" },
      { href: "/labour#wage", label: "Wage", icon: "wallet" },
    ],
  },
];

export default async function LabourLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("labour");
  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar role="labour" email={user.email ?? ""} groups={GROUPS} homeHref="/labour" />
      <section className="flex-1 min-h-screen">{children}</section>
    </div>
  );
}
