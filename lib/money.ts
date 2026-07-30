// Money is stored exactly in the DB (numeric(x,2)), but the app reads values
// into JS `number` and does arithmetic in IEEE-754 float. Multiplying or
// weighting money there can produce sub-paisa artifacts (e.g. 2.5 * 33.33 =
// 83.32499999999999), which then accumulate and show up in totals. These
// helpers round at the multiplication boundary so every derived figure is
// exact to the paisa. Mirrored in Android as roundMoney()/lineTotal() in
// ui/Format.kt.

/** Round a rupee value to 2 decimals (paise). */
export function roundMoney(n: number): number {
  // + Number.EPSILON nudges values like 1.005 that sit just below the tie so
  // they round up as a person would expect, instead of down due to float repr.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** A material line total (quantity x unit cost), rounded to paise. */
export function lineTotal(quantity: number | string, unitCost: number | string): number {
  return roundMoney(Number(quantity) * Number(unitCost));
}
