"use client";

import { useState, useTransition } from "react";
import { signOut, deleteAccount } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Sign out
      </button>
    </form>
  );
}

export function DeleteAccountButton() {
  const [show, setShow] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        Delete account
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
