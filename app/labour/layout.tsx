import { requireRole } from "@/lib/guard";
import { Sidebar, type NavGroup } from "@/components/Sidebar";

// Labourers don't manage anything in the app -- their site manager records
// attendance and wages on their behalf -- so there's nothing to navigate to.
const GROUPS: NavGroup[] = [
  {
    items: [{ href: "/labour", label: "Home", icon: "home" }],
  },
];

export default async function LabourLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("labour");
  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      <Sidebar role="labour" email={user.email ?? ""} groups={GROUPS} homeHref="/labour" />
      <section className="flex-1 min-w-0 min-h-screen overflow-x-hidden">{children}</section>
    </div>
  );
}
