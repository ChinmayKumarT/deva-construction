"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/admin/Page";

type Labourer = { id: string; name: string; familyId: string | null };

export function LinkFamilyForm({
  labourers,
  action,
}: {
  labourers: Labourer[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action}>
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="labourer_id" value={id} />
      ))}
      <p className="mb-2 text-sm text-slate-600">
        Select two or more labourers to link as family. Family members can collect each other's wages.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {labourers.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => toggle(l.id)}
            className={
              "rounded-lg border px-3 py-1.5 text-sm transition-colors " +
              (selected.has(l.id)
                ? "border-brand bg-brand/10 text-brand-700 font-medium"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
            }
          >
            {l.name}
            {l.familyId && <span className="ml-1 text-[10px] text-slate-400">👨‍👩‍👦</span>}
          </button>
        ))}
      </div>
      {selected.size >= 2 && <SubmitButton>Link as family</SubmitButton>}
      {selected.size === 1 && (
        <p className="text-xs text-amber-600">Select at least one more person.</p>
      )}
    </form>
  );
}

export function FamilyBadge({ members }: { members: string[] }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
      Family: {members.join(", ")}
    </span>
  );
}
