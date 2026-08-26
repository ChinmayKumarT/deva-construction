"use client";

import { useEffect, useState } from "react";
import { WORK_CATEGORIES } from "@/lib/workCategories";

export const OTHER_CATEGORY = "__other__";

export function CategoryField({
  label = "Category",
  name = "category",
  defaultValue = "",
}: {
  label?: string;
  name?: string;
  defaultValue?: string;
}) {
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/custom-categories")
      .then((r) => r.ok ? r.json() : [])
      .then((data: string[]) => setCustomCategories(data))
      .catch(() => {});
  }, []);

  const allKnown = [...WORK_CATEGORIES, ...customCategories];
  const isKnown = allKnown.includes(defaultValue);
  const [rawSelect, setRawSelect] = useState(isKnown ? defaultValue : defaultValue ? OTHER_CATEGORY : "");
  const [otherValue, setOtherValue] = useState(isKnown ? "" : defaultValue);
  const isOther = rawSelect === OTHER_CATEGORY;

  useEffect(() => {
    if (customCategories.length > 0 && defaultValue && rawSelect === OTHER_CATEGORY) {
      if (customCategories.includes(defaultValue)) {
        setRawSelect(defaultValue);
        setOtherValue("");
      }
    }
  }, [customCategories, defaultValue, rawSelect]);

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
          {customCategories.length > 0 && (
            <optgroup label="Custom">
              {customCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </optgroup>
          )}
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
