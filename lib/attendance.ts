import { WAGE_FACTOR, wageForStatus } from "@/lib/wages";

// Plain row shapes the pure reducer works on. Numeric fields may arrive as
// strings from Postgres, so daily_wage is coerced with Number() below.
type AttendanceRow = {
  labourer_id: string;
  project_id: string | null;
  date: string;
  status: string;
};
type AttendanceLabourer = {
  id: string;
  name: string;
  daily_wage: number | string;
  category: string | null;
};

export type AttendanceSummary = ReturnType<typeof reduceAttendance>[number];

// Pure per-labourer attendance summary over an inclusive `from`/`to` date
// range -- no I/O, so it can be unit-tested directly. `daysWorked` is the
// WAGE_FACTOR-weighted count (present = 1, half_day = 0.5, absent = 0), kept
// separate from `wages` (the rupee amount via wageForStatus) since one is a
// day count and the other is money.
export function reduceAttendance(
  attendance: AttendanceRow[],
  labourers: AttendanceLabourer[],
  from: string,
  to: string,
) {
  return labourers.map((l) => {
    const dailyWage = Number(l.daily_wage);
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let daysWorked = 0;
    let wages = 0;

    for (const a of attendance) {
      if (a.labourer_id !== l.id) continue;
      if (a.date < from || a.date > to) continue;
      if (a.status === "present") present++;
      else if (a.status === "half_day") halfDay++;
      else if (a.status === "absent") absent++;
      daysWorked += WAGE_FACTOR[a.status] ?? 0;
      wages += wageForStatus(a.status, dailyWage);
    }

    return {
      labourerId: l.id,
      name: l.name,
      category: l.category,
      present,
      halfDay,
      absent,
      daysWorked,
      wages,
    };
  });
}

// Format a Date as YYYY-MM-DD from its LOCAL calendar parts. Going through
// toISOString() here would be a bug: it converts to UTC first, so in any
// timezone east of UTC (e.g. IST) local midnight on the 1st lands on the
// previous month's last day, shifting the default range back a day.
function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultAttendanceRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { fromStr: ymdLocal(from), toStr: ymdLocal(now) };
}
