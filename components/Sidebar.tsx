"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, Fragment } from "react";
import { signOut } from "@/app/actions/auth";

export type IconName =
  | "overview" | "projects" | "clients" | "suppliers" | "labourers"
  | "materials" | "costs" | "attendance" | "payments" | "updates" | "reports"
  | "menu" | "signout" | "trash" | "home" | "delivery" | "bill" | "wallet"
  | "calendar-check" | "photo" | "team" | "search";

export type NavItem = { href: string; label: string; icon: IconName };
export type NavGroup = { title?: string; items: NavItem[] };

export function Sidebar({
  groups,
  homeHref = "/",
}: {
  role: string;
  email: string;
  groups: NavGroup[];
  homeHref?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="fixed top-3 left-3 z-50 flex lg:hidden items-center justify-center h-10 w-10 rounded-full bg-white shadow-md border border-slate-200 text-slate-500"
        >
          <Icon name="menu" size={22} />
        </button>
      )}

      {/* Desktop: expandable sidebar */}
      <aside
        className={
          "hidden lg:flex h-screen sticky top-0 z-40 flex-col bg-white/80 backdrop-blur-md border-r border-slate-200/60 py-3 shrink-0 transition-all duration-200 " +
          (expanded ? "w-[220px]" : "w-[56px] items-center")
        }
      >
        <div className={"flex items-center mb-3 " + (expanded ? "px-4 justify-between" : "justify-center")}>
          <Link href={homeHref} className="flex items-center gap-2.5 rounded-xl transition hover:scale-105">
            <Image
              src="/icon.png" alt="Deva" width={30} height={30}
              className="rounded-lg shrink-0" style={{ objectFit: "contain" }}
            />
            {expanded && (
              <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                Deva <span className="font-normal text-slate-500">Construction</span>
              </span>
            )}
          </Link>
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
        </div>

        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            title="Expand sidebar"
            className="flex items-center justify-center h-9 w-9 rounded-xl text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 mb-2"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        )}

        <nav className={"flex-1 flex flex-col gap-0.5 overflow-y-auto no-scrollbar w-full " + (expanded ? "px-3" : "items-center px-1.5")}>
          {groups.map((g, gi) => (
            <Fragment key={gi}>
              {gi > 0 && (expanded
                ? <div className="h-px bg-slate-200/80 my-2" />
                : <div className="w-6 h-px bg-slate-200/80 my-2" />
              )}
              {expanded && g.title && (
                <h3 className="px-3 mb-1 mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {g.title}
                </h3>
              )}
              {g.items.map((item) => {
                const active = isItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={expanded ? undefined : item.label}
                    className={
                      (expanded
                        ? "flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-colors "
                        : "flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-150 "
                      ) +
                      (active
                        ? "bg-brand/10 text-brand-700 shadow-sm shadow-brand/10" + (expanded ? " font-medium" : "")
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-700")
                    }
                  >
                    <Icon name={item.icon} size={20} />
                    {expanded && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </Fragment>
          ))}
        </nav>

        <form action={signOut} className={"mt-2 " + (expanded ? "px-3" : "")}>
          <button
            type="submit"
            title="Sign out"
            className={
              (expanded
                ? "flex w-full items-center gap-3 px-3 h-10 rounded-xl text-sm "
                : "flex items-center justify-center h-9 w-9 rounded-xl "
              ) +
              "text-slate-400 transition-all hover:bg-red-50 hover:text-red-500"
            }
          >
            <Icon name="signout" size={20} />
            {expanded && <span>Sign out</span>}
          </button>
        </form>
      </aside>

      {/* Mobile: slide-out panel */}
      <aside
        aria-hidden={!mobileOpen}
        className={
          "fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transition-transform duration-200 ease-out lg:hidden flex flex-col " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none")
        }
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-100 shrink-0">
          <Link
            href={homeHref}
            className="flex items-center gap-2.5"
            onClick={() => setMobileOpen(false)}
          >
            <Image
              src="/icon.png" alt="" width={28} height={28}
              className="rounded-lg" style={{ objectFit: "contain" }}
            />
            <span className="text-sm font-semibold text-slate-800">
              Deva <span className="font-normal text-slate-500">Construction</span>
            </span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {groups.map((g, gi) => (
            <div key={gi} className={gi > 0 ? "border-t border-slate-100 mt-2 pt-2" : ""}>
              {g.title && (
                <h3 className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {g.title}
                </h3>
              )}
              {g.items.map((item) => {
                const active = isItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={
                      "flex items-center gap-3 px-3 h-10 rounded-xl text-sm transition-colors " +
                      (active
                        ? "bg-brand/10 text-brand-700 font-medium"
                        : "text-slate-600 hover:bg-slate-50")
                    }
                  >
                    <Icon name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 px-3 py-3 shrink-0">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-3 h-10 rounded-xl text-sm text-slate-600 hover:bg-red-50 hover:text-red-500"
            >
              <Icon name="signout" size={20} />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function isItemActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  const roleRoots = ["/admin", "/client", "/supplier", "/labour"];
  if (roleRoots.includes(href)) return false;
  return pathname.startsWith(href);
}

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
    case "team":
      return (<svg {...props}><circle cx="9" cy="8" r="3"/><path d="M3 21c0-3.5 3-5.5 6-5.5s6 2 6 5.5"/><circle cx="18" cy="9" r="2.2"/><path d="M15.5 15.2c1.8.4 3.5 1.8 3.5 4.3"/></svg>);
    case "search":
      return (<svg {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>);
  }
}
