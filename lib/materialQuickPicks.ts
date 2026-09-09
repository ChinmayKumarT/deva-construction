// One-tap presets for the supplier's Record Delivery form.
//
// Recording a delivery used to mean retyping the material name, its unit and
// its rate every single time -- there is no material master table in this app,
// a delivery row just carries its own free-text name. This merges the two
// places a sensible preset can come from:
//
//   * the admin's price list for this supplier (supplier_materials), and
//   * the supplier's own delivery history, ranked by how often they record it.
//
// The catalog goes first because those are the rates the office actually
// agreed. History fills the remaining slots with anything the office has not
// pinned yet, so a supplier gets useful chips on day one either way.
//
// Kept pure and mirrored in Kotlin (materialQuickPicks in
// android/.../data/Models.kt) so both platforms rank the chips identically --
// same list, same order, on the phone and on the web.

export type QuickPick = {
  name: string;
  unit: string;
  unitCost: number;
  source: "catalog" | "history";
  /** How many past deliveries this pick came from. 0 for catalog-only entries. */
  count: number;
};

type Row = {
  name?: string | null;
  unit?: string | null;
  unit_cost?: number | string | null;
};

/** Supabase hands numerics back as strings often enough to not trust the type. */
function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n as number) ? (n as number) : 0;
}

/**
 * "Cement" / "bag" and " cement " / "Bag" are the same material as far as a
 * supplier is concerned, so they must collapse into one chip rather than
 * showing up twice with different casing.
 */
function keyOf(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
}

/**
 * @param catalog admin-set price list rows for this supplier
 * @param history the supplier's own past deliveries, MOST RECENT FIRST --
 *   both callers already order by ordered_at desc, and this relies on it: the
 *   rate and the display casing come from the first row seen for a material,
 *   which is therefore the latest rate they charged.
 * @param limit how many chips to return
 */
export function materialQuickPicks(
  catalog: Row[],
  history: Row[],
  limit = 8,
): QuickPick[] {
  const picks: QuickPick[] = [];
  const seen = new Set<string>();

  for (const row of catalog) {
    const name = (row.name ?? "").trim();
    if (!name) continue;
    const unit = (row.unit ?? "").trim() || "unit";
    const key = keyOf(name, unit);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push({ name, unit, unitCost: num(row.unit_cost), source: "catalog", count: 0 });
  }

  picks.sort((a, b) => a.name.localeCompare(b.name));

  // Group the history in one pass. Insertion order is most-recent-first, which
  // is what breaks ties between two materials delivered the same number of
  // times -- the one delivered more recently is the better guess.
  const grouped = new Map<string, QuickPick>();
  for (const row of history) {
    const name = (row.name ?? "").trim();
    if (!name) continue;
    const unit = (row.unit ?? "").trim() || "unit";
    const key = keyOf(name, unit);
    if (seen.has(key)) continue; // the catalog already covers it, at the agreed rate
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, { name, unit, unitCost: num(row.unit_cost), source: "history", count: 1 });
    }
  }

  const byFrequency = [...grouped.values()];
  const order = new Map([...grouped.keys()].map((k, i) => [k, i]));
  byFrequency.sort(
    (a, b) => b.count - a.count || order.get(keyOf(a.name, a.unit))! - order.get(keyOf(b.name, b.unit))!,
  );

  return [...picks, ...byFrequency].slice(0, Math.max(0, limit));
}
