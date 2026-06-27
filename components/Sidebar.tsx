"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { signOut, deleteAccount } from "@/app/actions/auth";

export type IconName =
  | "overview" | "projects" | "clients" | "suppliers" | "labourers"
  | "materials" | "costs" | "attendance" | "payments" | "updates" | "reports"
  | "menu" | "signout" | "trash" | "home" | "delivery" | "bill" | "wallet"
  | "calendar-check" | "photo";

export type NavItem = { href: string; label: string; icon: IconName };
export type NavGroup = { title?: string; items: NavItem[] };

export function Sidebar({
  role,
  email,
  groups,
  homeHref = "/",
}: {
  role: string;
  email: string;
  groups: NavGroup[];
  homeHref?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const rail = groups.flatMap((g) => g.items);

  return (
    <aside
      className={
        "sticky top-0 h-screen bg-[#0f0f0f] text-white flex flex-col z-40 transition-[width] duration-150 " +
        (expanded ? "w-[240px]" : "w-[72px]")
      }
    >
      {/* Header */}
      <div className="flex items-center h-14 px-2 shrink-0">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label="Toggle sidebar"
          className="inline-flex items-center justify-center h-10 w-10 rounded-full hover:bg-white/10"
        >
          <Icon name="menu" size={22} />
        </button>
        {expanded && (
          <Link href={homeHref} className="ml-1 flex items-baseline gap-1.5">
            <span className="inline-flex items-center justify-center h-7 w-9 rounded-md bg-brand">
              <BrandMark />
            </span>
            <span className="text-[18px] font-semibold leading-none tracking-tight">
              Deva <span className="font-normal text-white/85">Construction</span>
            </span>
            <sup className="ml-0.5 text-[10px] font-medium uppercase tracking-wider text-white/60">{role}</sup>
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 pb-3">
        {expanded
          ? groups.map((g, i) => (
              <ExpandedGroup key={i} group={g} showDivider={i > 0} />
            ))
          : rail.map((item) => <RailRow key={item.href} item={item} />)}
      </nav>

      <div className="border-t border-white/10 px-2 py-2 shrink-0">
        {expanded ? (
          <>
            <ExpandedAction icon="signout" label="Sign out" action={signOut} />
            <ExpandedDelete />
            <div className="px-3 pt-3 pb-1">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 capitalize">{role}</p>
              <p className="truncate text-xs text-white/75 mt-0.5">{email}</p>
            </div>
          </>
        ) : (
          <>
            <RailAction icon="signout" label="Sign out" action={signOut} />
            <RailDelete />
          </>
        )}
      </div>
    </aside>
  );
}

/* ---------- Expanded mode ---------- */

function ExpandedGroup({ group, showDivider }: { group: NavGroup; showDivider: boolean }) {
  return (
    <div className={showDivider ? "border-t border-white/10 pt-3 mt-3" : "mt-2"}>
      {group.title && (
        <h3 className="px-3 mb-1 text-base font-medium text-white">{group.title}</h3>
      )}
      {group.items.map((item) => (
        <ExpandedRow key={item.href} item={item} />
      ))}
    </div>
  );
}

function ExpandedRow({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = isItemActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={
        "flex items-center gap-6 px-3 h-10 rounded-lg text-sm transition-colors " +
        (isActive ? "bg-white/15 font-medium" : "text-white/90 hover:bg-white/10")
      }
    >
      <Icon name={item.icon} size={22} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function ExpandedAction({
  icon, label, action,
}: { icon: IconName; label: string; action: (fd: FormData) => Promise<void> }) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="w-full flex items-center gap-6 px-3 h-10 rounded-lg text-sm text-white/90 hover:bg-white/10"
      >
        <Icon name={icon} size={22} />
        <span>{label}</span>
      </button>
    </form>
  );
}

function ExpandedDelete() {
  const [show, setShow] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="w-full flex items-center gap-6 px-3 h-10 rounded-lg text-sm text-red-300/90 hover:bg-red-500/10 hover:text-red-200"
      >
        <Icon name="trash" size={22} />
        <span>Delete account</span>
      </button>
      <DeleteDialog show={show} setShow={setShow} confirm={confirm} setConfirm={setConfirm} pending={pending} start={start} />
    </>
  );
}

/* ---------- Rail (collapsed) mode ---------- */

function RailRow({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = isItemActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      title={item.label}
      className={
        "flex flex-col items-center justify-center py-3 my-0.5 rounded-lg transition-colors " +
        (isActive ? "bg-white/15" : "text-white/90 hover:bg-white/10")
      }
    >
      <Icon name={item.icon} size={24} />
      <span className={"mt-1.5 text-[10px] leading-none " + (isActive ? "font-medium" : "")}>
        {item.label}
      </span>
    </Link>
  );
}

function RailAction({
  icon, label, action,
}: { icon: IconName; label: string; action: (fd: FormData) => Promise<void> }) {
  return (
    <form action={action}>
      <button
        type="submit"
        title={label}
        className="w-full flex flex-col items-center justify-center py-3 my-0.5 rounded-lg text-white/90 hover:bg-white/10"
      >
        <Icon name={icon} size={24} />
        <span className="mt-1.5 text-[10px] leading-none">{label}</span>
      </button>
    </form>
  );
}

function RailDelete() {
  const [show, setShow] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <button
        onClick={() => setShow(true)}
        title="Delete account"
        className="w-full flex flex-col items-center justify-center py-3 my-0.5 rounded-lg text-red-300/85 hover:bg-red-500/10 hover:text-red-200"
      >
        <Icon name="trash" size={24} />
        <span className="mt-1.5 text-[10px] leading-none">Delete</span>
      </button>
      <DeleteDialog show={show} setShow={setShow} confirm={confirm} setConfirm={setConfirm} pending={pending} start={start} />
    </>
  );
}

function DeleteDialog({
  show, setShow, confirm, setConfirm, pending, start,
}: {
  show: boolean; setShow: (v: boolean) => void;
  confirm: string; setConfirm: (v: string) => void;
  pending: boolean; start: (cb: () => void) => void;
}) {
  if (!show) return null;
  return (
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
  );
}

/* ---------- Helpers ---------- */

function isItemActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  // Only treat as active for deeper paths when href has segments past role root.
  const roleRoots = ["/admin", "/client", "/supplier", "/labour"];
  if (roleRoots.includes(href)) return false;
  return pathname.startsWith(href);
}

/* ---------- Brand mark ---------- */

function BrandMark() {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden="true">
      <path d="M2 11h18v2H2z" fill="#fff" />
      <path d="M4 11V8a7 7 0 0 1 14 0v3" fill="#fff" />
      <rect x="10" y="3" width="2" height="6" fill="#16a34a" />
    </svg>
  );
}

/* ---------- Icons ---------- */

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.75,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "overview":
    case "home":
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
    case "calendar-check":
      return (<svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M9 14l2 2 4-4"/></svg>);
    case "payments":
    case "wallet":
      return (<svg {...props}><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20"/><path d="M6 16h4"/></svg>);
    case "updates":
      return (<svg {...props}><path d="M21 11.5a8.5 8.5 0 1 1-3-6.5"/><path d="M21 4v6h-6"/></svg>);
    case "reports":
      return (<svg {...props}><path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H4z"/><path d="M14 4v6h6"/><path d="M8 14h8M8 18h6"/></svg>);
    case "delivery":
      return (<svg {...props}><path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="17.5" cy="18.5" r="1.5"/></svg>);
    case "bill":
      return (<svg {...props}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>);
    case "photo":
      return (<svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-10 9"/></svg>);
    case "menu":
      return (<svg {...props}><path d="M4 6h16M4 12h16M4 18h16"/></svg>);
    case "signout":
      return (<svg {...props}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M15 12H5"/></svg>);
    case "trash":
      return (<svg {...props}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/></svg>);
  }
}
