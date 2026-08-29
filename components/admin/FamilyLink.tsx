"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/admin/SubmitButton";

type Labourer = { id: string; name: string; familyId: string | null };

const FAMILY_COLORS = [
  { bg: "bg-violet-50", ring: "ring-violet-200", text: "text-violet-700", dot: "bg-violet-500", selBorder: "border-violet-400", selBg: "bg-violet-100" },
  { bg: "bg-sky-50", ring: "ring-sky-200", text: "text-sky-700", dot: "bg-sky-500", selBorder: "border-sky-400", selBg: "bg-sky-100" },
  { bg: "bg-amber-50", ring: "ring-amber-200", text: "text-amber-700", dot: "bg-amber-500", selBorder: "border-amber-400", selBg: "bg-amber-100" },
  { bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", selBorder: "border-emerald-400", selBg: "bg-emerald-100" },
  { bg: "bg-rose-50", ring: "ring-rose-200", text: "text-rose-700", dot: "bg-rose-500", selBorder: "border-rose-400", selBg: "bg-rose-100" },
  { bg: "bg-teal-50", ring: "ring-teal-200", text: "text-teal-700", dot: "bg-teal-500", selBorder: "border-teal-400", selBg: "bg-teal-100" },
] as const;

function getFamilyColor(index: number) {
  return FAMILY_COLORS[index % FAMILY_COLORS.length];
}

export function buildFamilyColorMap(labourers: { familyId: string | null }[]) {
  const ids = Array.from(new Set(labourers.map((l) => l.familyId).filter(Boolean) as string[]));
  return new Map(ids.map((fid, i) => [fid, i]));
}

export function LinkFamilyForm({
  labourers,
  action,
}: {
  labourers: Labourer[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const colorMap = buildFamilyColorMap(labourers);

  const familyGroups = new Map<string, Labourer[]>();
  const unlinked: Labourer[] = [];
  for (const l of labourers) {
    if (l.familyId) {
      const arr = familyGroups.get(l.familyId) ?? [];
      arr.push(l);
      familyGroups.set(l.familyId, arr);
    } else {
      unlinked.push(l);
    }
  }
  const families = new Map<string, Labourer[]>();
  for (const [fid, members] of familyGroups) {
    if (members.length >= 2) {
      families.set(fid, members);
    } else {
      unlinked.push(...members);
    }
  }

  const unlinkedIds = new Set(unlinked.map((l) => l.id));
  const submittableIds = Array.from(selected).filter((id) => unlinkedIds.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(fd: FormData) {
    await action(fd);
    setSelected(new Set());
  }

  return (
    <form action={handleSubmit}>
      {submittableIds.map((id) => (
        <input key={id} type="hidden" name="labourer_id" value={id} />
      ))}

      <p className="mb-3 text-sm text-slate-600">
        Select two or more labourers to link as family. Family members can collect each other&apos;s wages.
      </p>

      {families.size > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Existing families</p>
          {Array.from(families.entries()).map(([fid, members]) => {
            const c = getFamilyColor(colorMap.get(fid) ?? 0);
            return (
              <div key={fid} className={`flex flex-wrap items-center gap-2 rounded-lg p-2.5 ${c.bg} ring-1 ring-inset ${c.ring}`}>
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.dot} shrink-0`} />
                {members.map((l) => (
                  <span key={l.id} className={`px-2.5 py-1 text-sm ${c.text}`}>
                    {l.name}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {unlinked.length > 0 && (
        <div className="mb-3">
          {families.size > 0 && (
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Not in a family</p>
          )}
          <div className="flex flex-wrap gap-2">
            {unlinked.map((l) => (
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
              </button>
            ))}
          </div>
        </div>
      )}

      {submittableIds.length >= 2 && <SubmitButton>Link as family</SubmitButton>}
      {submittableIds.length === 1 && (
        <p className="text-xs text-amber-600">Select at least one more person.</p>
      )}
    </form>
  );
}

export function FamilyBadge({ members, colorIndex }: { members: string[]; colorIndex?: number }) {
  const c = getFamilyColor(colorIndex ?? 0);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${c.text} ${c.bg} ring-1 ring-inset ${c.ring}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} />
      Family: {members.join(", ")}
    </span>
  );
}
