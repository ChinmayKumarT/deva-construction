"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions/auth";

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
      >
        Delete account
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Delete your account?</h2>
            <p className="mt-2 text-sm text-slate-600">
              This is permanent. Your login is deleted and you are signed out. Business records
              stay with the company but are unlinked from you.
            </p>
            <p className="mt-3 text-sm text-slate-700">
              Type <code className="rounded bg-slate-100 px-1">DELETE</code> to confirm:
            </p>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setOpen(false);
                  setConfirm("");
                }}
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
