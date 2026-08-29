"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { signOut, deleteAccount } from "@/app/actions/auth";

export function ProfileMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white ring-2 ring-white/30 transition hover:bg-white/30 hover:ring-white/50"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand-700">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">{name}</div>
                <div className="truncate text-xs text-slate-400">{email}</div>
              </div>
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                Supplier
              </span>
            </div>
          </div>

          <div className="p-1.5">
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M15 12H5"/></svg>
                Sign out
              </button>
            </form>
            <button
              onClick={() => { setOpen(false); setShowDelete(true); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/></svg>
              Delete account
            </button>
          </div>
        </div>
      )}

      {showDelete && (
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
                onClick={() => { setShowDelete(false); setConfirm(""); }}
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
    </div>
  );
}
