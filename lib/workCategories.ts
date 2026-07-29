// Fixed list (not freeform text) so the "Spend by work category" breakdown
// on the report page doesn't fragment into near-duplicate categories from
// typos. Mirrored in Android as WorkCategories in ui/dashboards/AdminScreens.kt.
export const WORK_CATEGORIES = [
  "Carpenter",
  "Plumber",
  "Electrician",
  "Bar bender",
  "Civil worker",
  "Painter",
  "Tiles",
] as const;
