import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { signOut } from "@/app/actions/auth";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { SidebarLink } from "@/components/SidebarLink";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/labourers", label: "Labourers" },
  { href: "/admin/materials", label: "Materials" },
  { href: "/admin/costs", label: "Cost tracking" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/updates", label: "Project updates" },
  { href: "/admin/reports", label: "Reports" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireRole(["admin", "manager"]);
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-[var(--bg)]">
      <aside className="sticky top-0 h-screen bg-forest text-forest-100 flex flex-col">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2 text-white">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white text-sm font-semibold">B</span>
            <span className="text-sm font-semibold tracking-wide">Builder</span>
          </div>
          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-forest-100/60 capitalize">{role}</p>
            <p className="truncate text-sm text-white/90">{user.email}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
          {NAV.map((n) => (
            <SidebarLink key={n.href} href={n.href} label={n.label} />
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-4 space-y-2">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md border border-white/15 bg-transparent px-3 py-1.5 text-sm text-forest-100 hover:bg-white/5"
            >
              Sign out
            </button>
          </form>
          <DeleteAccountButton />
        </div>
      </aside>

      <section className="bg-[var(--bg)] min-h-screen">{children}</section>
    </div>
  );
}
