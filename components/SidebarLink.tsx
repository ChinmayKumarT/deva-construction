"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/admin" && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      className={
        "block rounded-md px-3 py-2 text-sm transition-colors " +
        (isActive
          ? "bg-brand text-white font-medium"
          : "text-forest-100/85 hover:bg-white/5 hover:text-white")
      }
    >
      {label}
    </Link>
  );
}
