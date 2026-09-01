"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions/auth";

/**
 * The person icon on the "not linked yet" screens. Hovering or clicking it
 * reveals whatever we hold about the signed-in account, so someone waiting to
 * be linked can read back their own details to the admin.
 *
 * It also carries Sign out, and that is load-bearing rather than a
 * convenience: those screens are a dead end otherwise. `/` redirects a signed
 * in user to their own dashboard and requireRole() bounces them back here
 * from everywhere else, so without this control the only way out of an
 * unlinked account is to clear cookies.
 */
export function AccountDetailsPopover({
  name,
  email,
  phone,
  role = "Supplier",
}: {
  name: string;
  email: string;
  phone?: string | null;
  role?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative mx-auto mb-4 w-16"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 transition hover:bg-brand/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--brand)" strokeWidth="1.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
        </svg>
        <span className="sr-only">Your account details</span>
      </button>

      {open && (
        // The wrapper's padding bridges the gap to the icon so moving the
        // pointer down onto the card doesn't count as leaving it.
        <div className="absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-2">
          <div role="dialog" aria-label="Your account details" className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl">
            <div className="truncate text-sm font-semibold text-slate-800">{name}</div>
            <span className="mt-1.5 inline-flex items-center rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
              {role}
            </span>

            <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Email</dt>
                <dd className="truncate text-sm text-slate-700">{email || "Not on file"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Phone</dt>
                <dd className="truncate text-sm text-slate-700">
                  {phone || <span className="text-slate-400">Not on file</span>}
                </dd>
              </div>
            </dl>

            <form action={signOut} className="mt-3 border-t border-slate-100 pt-3">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M15 12H5"/></svg>
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
