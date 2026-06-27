"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut, deleteAccount } from "@/app/actions/auth";
import { useTransition } from "react";

type NavItem = { href: string; label: string; icon: IconName };

export type IconName =
  | "overview" | "projects" | "clients" | "suppliers" | "labourers"
  | "materials" | "costs" | "attendance" | "payments" | "updates" | "reports"
  | "menu" | "signout" | "trash";

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview" },
  { href: "/admin/projects", label: "Projects", icon: "projects" },
  { href: "/admin/clients", label: "Clients", icon: "clients" },
  { href: "/admin/suppliers", label: "Suppliers", icon: "suppliers" },
  { href: "/admin/labourers", label: "Labourers", icon: "labourers" },
  { href: "/admin/materials", label: "Materials", icon: "materials" },
  { href: "/admin/costs", label: "Cost tracking", icon: "costs" },
  { href: "/admin/attendance", label: "Attendance", icon: "attendance" },
  { href: "/admin/payments", label: "Payments", icon: "payments" },
  { href: "/admin/updates", label: "Project updates", icon: "updates" },
  { href: "/admin/reports", label: "Reports", icon: "reports" },
];

export function Sidebar({ role, email }: { role: string; email: string }) {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={
        "sticky top-0 h-screen bg-forest text-forest-100 flex flex-col transition-[width] duration-200 " +
        (open ? "w-[240px]" : "w-[68px]")
      }
    >
      <div className="px-3 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white px-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white text-sm font-semibold shrink-0">
            B
          </span>
          {open && <span className="text-sm font-semibold tracking-wide">Builder</span>}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          className="rounded-md p-1.5 text-forest-100/70 hover:text-white hover:bg-white/5"
        >
          <Icon name="menu" />
        </button>
      </div>

      {open && (
        <div className="px-5 pb-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-forest-100/60 capitalize">{role}</p>
          <p className="truncate text-sm text-white/90">{email}</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {NAV.map((n) => (
          <SidebarLink key={n.href} item={n} open={open} />
        ))}
      </nav>

      <div className="border-t border-white/10 p-2 space-y-1">
        <SignOutRow open={open} />
        <DeleteRow open={open} />
      </div>
    </aside>
  );
}

function SidebarLink({ item, open }: { item: NavItem; open: boolean }) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
  return (
    <Link
      href={item.href}
      title={open ? undefined : item.label}
      className={
        "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors " +
        (isActive
          ? "bg-brand text-white font-medium"
          : "text-forest-100/85 hover:bg-white/5 hover:text-white")
      }
    >
      <span className="shrink-0"><Icon name={item.icon} /></span>
      {open && <span className="truncate">{item.label}</span>}
      {!open && (
        <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-forest-950 px-2 py-1 text-xs text-white opacity-0 shadow-lg group-hover:opacity-100 z-50">
          {item.label}
        </span>
      )}
    </Link>
  );
}

function SignOutRow({ open }: { open: boolean }) {
  return (
    <form action={signOut} title={open ? undefined : "Sign out"}>
      <button
        type="submit"
        className="group relative w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-forest-100/85 hover:bg-white/5 hover:text-white"
      >
        <span className="shrink-0"><Icon name="signout" /></span>
        {open && <span>Sign out</span>}
        {!open && (
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-forest-950 px-2 py-1 text-xs text-white opacity-0 shadow-lg group-hover:opacity-100 z-50">
            Sign out
          </span>
        )}
      </button>
    </form>
  );
}

function DeleteRow({ open }: { open: boolean }) {
  const [show, setShow] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <button
        onClick={() => setShow(true)}
        title={open ? undefined : "Delete account"}
        className="group relative w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-red-300/80 hover:bg-red-500/10 hover:text-red-200"
      >
        <span className="shrink-0"><Icon name="trash" /></span>
        {open && <span>Delete account</span>}
        {!open && (
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-forest-950 px-2 py-1 text-xs text-white opacity-0 shadow-lg group-hover:opacity-100 z-50">
            Delete account
          </span>
        )}
      </button>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg text-slate-900">
            <h2 className="text-lg font-semibold">Delete your account?</h2>
            <p className="mt-2 text-sm text-slate-600">
              This is permanent. Your login is deleted and you are signed out.
              Business records stay with the company but are unlinked from you.
            </p>
            <p className="mt-3 text-sm">
              Type <code className="rounded bg-slate-100 px-1">DELETE</code> to confirm:
            </p>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setShow(false); setConfirm(""); }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={confirm !== "DELETE" || pending}
                onClick={() => start(() => deleteAccount())}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Icon({ name }: { name: IconName }) {
  const props = {
    width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.75,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "overview":
      return (<svg {...props}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>);
    case "projects":
      return (<svg {...props}><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/></svg>);
    case "clients":
      return (<svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>);
    case "suppliers":
      return (<svg {...props}><path d="M3 7h13l4 4v6h-2"/><path d="M3 7v10h12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>);
    case "labourers":
      return (<svg {...props}><circle cx="12" cy="7" r="3"/><path d="M6 22v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3"/><path d="M9 4l3-2 3 2"/></svg>);
    case "materials":
      return (<svg {...props}><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/><path d="M3 19l9 5 9-5"/></svg>);
    case "costs":
      return (<svg {...props}><path d="M3 3v18h18"/><path d="M7 16l4-4 3 3 6-7"/></svg>);
    case "attendance":
      return (<svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M9 14l2 2 4-4"/></svg>);
    case "payments":
      return (<svg {...props}><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20"/><path d="M6 16h4"/></svg>);
    case "updates":
      return (<svg {...props}><path d="M21 11.5a8.5 8.5 0 1 1-3-6.5"/><path d="M21 4v6h-6"/></svg>);
    case "reports":
      return (<svg {...props}><path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H4z"/><path d="M14 4v6h6"/><path d="M8 14h8M8 18h6"/></svg>);
    case "menu":
      return (<svg {...props}><path d="M4 6h16M4 12h16M4 18h16"/></svg>);
    case "signout":
      return (<svg {...props}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M15 12H5"/></svg>);
    case "trash":
      return (<svg {...props}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/></svg>);
  }
}
