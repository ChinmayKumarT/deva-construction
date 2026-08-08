"use client";

import { useState } from "react";
import { WORK_CATEGORIES } from "@/lib/workCategories";

export const OTHER_CATEGORY = "__other__";

// Same fixed list as the plain Select (keeps the "Spend by work category"
// report from fragmenting into typo'd near-duplicates for the common
// cases), but with an escape hatch: picking "Other..." reveals a text
// input for whatever category doesn't fit the list. Only one of the two
// controls carries the `name` at a time, so the form always submits a
// single clean value under the given field name either way.
export function CategoryField({
  label = "Category",
  name = "category",
  defaultValue = "",
}: {
  label?: string;
  name?: string;
  defaultValue?: string;
}) {
  const isKnown = (WORK_CATEGORIES as readonly string[]).includes(defaultValue);
  const [rawSelect, setRawSelect] = useState(isKnown ? defaultValue : defaultValue ? OTHER_CATEGORY : "");
  const [otherValue, setOtherValue] = useState(isKnown ? "" : defaultValue);
  const isOther = rawSelect === OTHER_CATEGORY;

  return (
    <div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">{label}</span>
        <select
          name={isOther ? undefined : name}
          value={rawSelect}
          onChange={(e) => setRawSelect(e.target.value)}
          className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          <option value="">— none —</option>
          {WORK_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          <option value={OTHER_CATEGORY}>Other…</option>
        </select>
      </label>
      {isOther && (
        <input
          name={name}
          value={otherValue}
          onChange={(e) => setOtherValue(e.target.value)}
          placeholder="Enter category"
          required
          className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      )}
    </div>
  );
}
