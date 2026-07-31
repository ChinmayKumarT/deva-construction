// Materials (ordered_at/delivered_at) and payments (created_at) are
// timestamptz columns -- they carry a real time of day, so reports and
// listings should show it. Attendance is a plain `date` column with no
// time component at all, so formatting it with formatDateTime would show
// a fabricated midnight time; use formatDateOnly for that.

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "no date";
  return new Date(iso).toLocaleString();
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "no date";
  return new Date(iso).toLocaleDateString();
}
