import { roundMoney } from "@/lib/money";

// Present = full daily wage, half day = 50%, absent = 0.
export const WAGE_FACTOR: Record<string, number> = { present: 1, half_day: 0.5, absent: 0 };

export function wageForStatus(status: string, dailyWage: number): number {
  // Rounded to paise: a half day of an odd wage (e.g. 0.5 * 825.01) would
  // otherwise carry a third decimal into every downstream total.
  return roundMoney((WAGE_FACTOR[status] ?? 0) * dailyWage);
}

export function wageDueKey(projectId: string, labourerId: string): string {
  return `${projectId}|${labourerId}`;
}

// How much is still owed to a labourer for a project: total wage accrued from
// attendance, minus whatever labour payments already exist for that pair
// (any non-rejected status counts as claimed, so a pending payment isn't
// double-suggested). Used to auto-fill the amount when creating a wage
// payment for a specific labourer/project.
export function computeWagesDue(
  attendance: { project_id: string | null; labourer_id: string; status: string }[],
  payments: { project_id: string | null; payee_type: string; labourer_id: string | null; amount: number; status: string }[],
  labourerWage: Map<string, number>,
): Record<string, number> {
  const due: Record<string, number> = {};
  for (const a of attendance) {
    if (!a.project_id) continue;
    const wage = wageForStatus(a.status, labourerWage.get(a.labourer_id) ?? 0);
    if (wage <= 0) continue;
    const key = wageDueKey(a.project_id, a.labourer_id);
    due[key] = (due[key] ?? 0) + wage;
  }
  for (const p of payments) {
    if (!p.project_id || !p.labourer_id || p.payee_type !== "labour" || p.status === "rejected") continue;
    const key = wageDueKey(p.project_id, p.labourer_id);
    due[key] = (due[key] ?? 0) - Number(p.amount);
  }
  for (const key of Object.keys(due)) {
    due[key] = Math.max(0, due[key]);
  }
  return due;
}
