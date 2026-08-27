import { roundMoney } from "@/lib/money";

export const WAGE_FACTOR: Record<string, number> = { present: 1, half_day: 0.5, overtime: 1.5, absent: 0 };

export function wageForStatus(status: string, dailyWage: number): number {
  // Rounded to paise: a half day of an odd wage (e.g. 0.5 * 825.01) would
  // otherwise carry a third decimal into every downstream total.
  return roundMoney((WAGE_FACTOR[status] ?? 0) * dailyWage);
}

export function wageDueKey(projectId: string, labourerId: string): string {
  return `${projectId}|${labourerId}`;
}

type LabourPayment = {
  project_id: string | null;
  payee_type: string;
  labourer_id: string | null;
  amount: number;
  status: string;
};

// Nets a project/labourer's accrued wage total against whatever labour
// payments already exist for that pair (any non-rejected status counts as
// claimed, so a pending payment isn't double-suggested), then clamps to 0
// so an overpayment never shows as a negative amount due. Shared by both
// computeWagesDue (raw attendance rows) and computeWagesDueFromAccrued
// (pre-summed in Postgres) below.
function netAndClamp(due: Record<string, number>, payments: LabourPayment[]): Record<string, number> {
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

// How much is still owed to a labourer for a project: total wage accrued from
// attendance, minus whatever labour payments already exist for that pair.
// Used to auto-fill the amount when creating a wage payment for a specific
// labourer/project.
export function computeWagesDue(
  attendance: { project_id: string | null; labourer_id: string; status: string }[],
  payments: LabourPayment[],
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
  return netAndClamp(due, payments);
}

// Same result as computeWagesDue, but starting from wage totals already
// summed per (project, labourer) pair -- e.g. by the
// staff_labourer_wage_accrued() Postgres function (see
// supabase/29_staff_wage_accrued.sql) -- instead of raw attendance rows.
// Lets a page skip fetching the entire (ever-growing) attendance table just
// to compute this.
export function computeWagesDueFromAccrued(
  accrued: { project_id: string | null; labourer_id: string; accrued: number }[],
  payments: LabourPayment[],
): Record<string, number> {
  const due: Record<string, number> = {};
  for (const a of accrued) {
    if (!a.project_id || a.accrued <= 0) continue;
    const key = wageDueKey(a.project_id, a.labourer_id);
    due[key] = (due[key] ?? 0) + Number(a.accrued);
  }
  return netAndClamp(due, payments);
}
