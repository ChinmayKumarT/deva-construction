"use client";

import { useRef, useState } from "react";
import type { QuickPick } from "@/lib/materialQuickPicks";

export const MATERIAL_DATALIST_ID = "material-quick-picks";

// One tap fills in the material, its unit and its rate, so a supplier who
// delivers the same cement three times a week stops retyping it three times a
// week. Quantity is deliberately left alone -- it is the one field that really
// does change every delivery -- and every field stays editable afterwards: an
// agreed rate is a sensible default, not a lock.
//
// The form's inputs are uncontrolled (see components/ResettableForm.tsx, which
// resets them by remounting on `key`), so this reaches them through the DOM
// rather than lifting all four fields into React state. Living inside the form
// also means the chip selection clears along with the fields after a
// successful submit, for free.
export function MaterialQuickPicks({ picks }: { picks: QuickPick[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);

  if (picks.length === 0) return null;

  function apply(pick: QuickPick) {
    const form = ref.current?.closest("form");
    if (!form) return;

    const set = (field: string, value: string) => {
      const el = form.elements.namedItem(field);
      if (el instanceof HTMLInputElement) el.value = value;
    };
    set("name", pick.name);
    set("unit", pick.unit);
    set("unit_cost", String(pick.unitCost));

    setActive(keyOf(pick));

    // Land the cursor on the only thing still left to type.
    const qty = form.elements.namedItem("quantity");
    if (qty instanceof HTMLInputElement) {
      qty.focus();
      qty.select();
    }
  }

  return (
    <div ref={ref} className="sm:col-span-2 lg:col-span-4">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">Frequent materials</span>
        <span className="text-[11px] text-slate-400">tap to fill</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {picks.map((pick) => {
          const key = keyOf(pick);
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => apply(pick)}
              aria-pressed={selected}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                selected
                  ? "border-brand bg-brand/5 text-brand-800"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {/* A filled dot marks a rate the office agreed, rather than one
                  inferred from what this supplier last charged. */}
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  pick.source === "catalog" ? "bg-brand" : "bg-slate-300"
                }`}
                title={pick.source === "catalog" ? "Agreed price list" : "From your past deliveries"}
              />
              <span className="font-medium text-slate-800">{pick.name}</span>
              <span className="text-slate-400">·</span>
              <span>{pick.unit}</span>
              {pick.unitCost > 0 && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="tabular-nums">₹{pick.unitCost.toLocaleString()}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Typing gets the same list as tapping. */}
      <datalist id={MATERIAL_DATALIST_ID}>
        {dedupeNames(picks).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}

function keyOf(pick: QuickPick) {
  return `${pick.name}|${pick.unit}`;
}

// The same material in two units is two chips but only one autocomplete entry.
function dedupeNames(picks: QuickPick[]) {
  return [...new Set(picks.map((p) => p.name))];
}
