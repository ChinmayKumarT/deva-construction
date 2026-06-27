import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { signOut } from "@/app/actions/auth";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";

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
    <div className="min-h-screen grid grid-cols-[220px_1fr]">
      <aside className="border-r border-slate-200 bg-white p-4">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 capitalize">{role}</p>
          <p className="truncate text-sm text-slate-700">{user.email}</p>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
        <div className="mt-2"><DeleteAccountButton /></div>
      </aside>
      <section>{children}</section>
    </div>
  );
}
