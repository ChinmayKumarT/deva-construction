"use client";

import { useMemo, useState } from "react";
import { setUserRole } from "@/app/admin/actions";

type Profile = { id: string; full_name: string | null; role: string; is_owner: boolean };

const ROLES = ["client", "supplier", "labour", "manager", "admin"];

export function TeamAccessClient({ profiles }: { profiles: Profile[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.full_name ?? "").toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.id.toLowerCase().startsWith(q),
    );
  }, [profiles, query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or role"
        className="mb-4 w-full max-w-sm rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-forest-50 text-left text-[11px] uppercase tracking-wider text-forest-800/70">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Current role</th>
              <th className="px-4 py-3 font-medium">Set role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">No matches.</td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-[var(--line)] hover:bg-forest-50/50">
                <td className="px-4 py-3 text-slate-700">{p.full_name || p.id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-slate-700">
                  {p.role}
                  {p.is_owner && <span className="ml-2 text-xs text-slate-400">· owner</span>}
                </td>
                <td className="px-4 py-3">
                  <form action={setUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="target_id" value={p.id} />
                    <select
                      name="new_role"
                      defaultValue={p.role}
                      className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
