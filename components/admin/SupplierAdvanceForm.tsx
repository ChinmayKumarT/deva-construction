"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/admin/SubmitButton";

export function SupplierAdvanceForm({
  action,
  suppliers,
}: {
  action: (fd: FormData) => Promise<void>;
  suppliers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 flex items-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 px-5 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50 hover:border-blue-400"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        Give advance to supplier
      </button>
    );
  }

  return (
    <form
      action={action}
      onSubmit={() => setTimeout(() => setOpen(false), 100)}
      className="mb-6 rounded-xl border border-blue-200 bg-blue-50/30 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Give advance to supplier</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Supplier</span>
          <select
            name="supplier_id"
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition hover:border-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Pick supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount</span>
          <input
            name="amount"
            type="number"
            min="1"
            step="1"
            required
            placeholder="₹"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition hover:border-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Note (optional)</span>
          <input
            name="description"
            type="text"
            placeholder="e.g. Advance for cement"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition hover:border-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
      </div>

      <div className="mt-4">
        <SubmitButton>Give advance</SubmitButton>
      </div>
    </form>
  );
}
