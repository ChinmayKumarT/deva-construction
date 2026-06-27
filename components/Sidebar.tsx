"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { signOut, deleteAccount } from "@/app/actions/auth";

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
  { href: "/admin/labourers", label: "Labour", icon: "labourers" },
  { href: "/admin/materials", label: "Materials", icon: "materials" },
  { href: "/admin/costs", label: "Costs", icon: "costs" },
  { href: "/admin/attendance", label: "Attendance", icon: "attendance" },
  { href: "/admin/payments", label: "Payments", icon: "payments" },
  { href: "/admin/updates", label: "Updates", icon: "updates" },
  { href: "/admin/reports", label: "Reports", icon: "reports" },
];

export function Sidebar({ role, email }: { role: string; email: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Backdrop when expanded (closes on click, YouTube-like) */}
      {expanded && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setExpanded(false)}
        />
      )}

      <aside
        className={
          "sticky top-0 h-screen bg-forest text-forest-100 flex flex-col z-40 transition-[width] duration-150 " +
          (expanded ? "w-[240px]" : "w-[76px]")
        }
      >
        {/* Header: hamburger + brand */}
        <div className="flex items-center h-14 px-3 border-b border-white/5">
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label="Toggle sidebar"
            className="inline-flex items-center justify-center h-10 w-10 rounded-full text-forest-100 hover:bg-white/10"
          >
            <Icon name="menu" size={22} />
          </button>
          {expanded && (
            <Link href="/admin" className="ml-2 flex items-center gap-2 text-white">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white text-sm font-semibold">B</span>
              <span className="text-sm font-semibold tracking-wide">Builder</span>
            </Link>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-1.5">
          {NAV.map((n) => (
            <NavRow key={n.href} item={n} expanded={expanded} />
          ))}
        </nav>

        <div className="border-t border-white/10 py-1.5">
          <ActionRow icon="signout" label="Sign out" expanded={expanded} action={signOut} />
          <DeleteRow expanded={expanded} />
          {expanded && (
            <div className="px-4 py-2 border-t border-white/5 mt-1">
              <p className="text-[10px] uppercase tracking-[0.14em] text-forest-100/50 capitalize">{role}</p>
              <p className="truncate text-xs text-white/80 mt-0.5">{email}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function NavRow({ item, expanded }: { item: NavItem; expanded: boolean }) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));

  if (expanded) {
    return (
      <Link
        href={item.href}
        className={
          "flex items-center gap-5 mx-1.5 h-10 px-3 rounded-lg text-sm transition-colors " +
          (isActive
            ? "bg-white/10 text-white font-medium"
            : "text-forest-100 hover:bg-white/5")
        }
      >
        <Icon name={item.icon} size={22} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  // Rail mode: icon centered + small label underneath
  return (
    <Link
      href={item.href}
      className={
        "flex flex-col items-center justify-center mx-1 my-0.5 py-3 rounded-lg transition-colors " +
        (isActive
          ? "bg-white/10 text-white"
          : "text-forest-100 hover:bg-white/5")
      }
      title={item.label}
    >
      <Icon name={item.icon} size={22} />
      <span className={"mt-1.5 text-[10px] leading-none tracking-wide " + (isActive ? "font-medium" : "")}>
        {item.label}
      </span>
    </Link>
  );
}

function ActionRow({
  icon, label, expanded, action,
}: {
  icon: IconName; label: string; expanded: boolean;
  action: (fd: FormData) => Promise<void>;
}) {
  if (expanded) {
    return (
      <form action={action}>
        <button
          type="submit"
          className="w-full flex items-center gap-5 mx-1.5 h-10 px-3 rounded-lg text-sm text-forest-100 hover:bg-white/5"
        >
          <Icon name={icon} size={22} />
          <span>{label}</span>
        </button>
      </form>
    );
  }
  return (
    <form action={action}>
      <button
        type="submit"
        title={label}
        className="w-full flex flex-col items-center justify-center mx-1 my-0.5 py-3 rounded-lg text-forest-100 hover:bg-white/5"
      >
        <Icon name={icon} size={22} />
        <span className="mt-1.5 text-[10px] leading-none tracking-wide">{label}</span>
      </button>
    </form>
  );
}

function DeleteRow({ expanded }: { expanded: boolean }) {
  const [show, setShow] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  const Trigger = expanded ? (
    <button
      onClick={() => setShow(true)}
      className="w-full flex items-center gap-5 mx-1.5 h-10 px-3 rounded-lg text-sm text-red-300/85 hover:bg-red-500/10 hover:text-red-200"
    >
      <Icon name="trash" size={22} />
      <span>Delete account</span>
    </button>
  ) : (
    <button
      onClick={() => setShow(true)}
      title="Delete account"
      className="w-full flex flex-col items-center justify-center mx-1 my-0.5 py-3 rounded-lg text-red-300/85 hover:bg-red-500/10 hover:text-red-200"
    >
      <Icon name="trash" size={22} />
      <span className="mt-1.5 text-[10px] leading-none tracking-wide">Delete</span>
    </button>
  );

  return (
    <>
      {Trigger}
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

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
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
