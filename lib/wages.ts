// Present = full daily wage, half day = 50%, absent = 0.
export const WAGE_FACTOR: Record<string, number> = { present: 1, half_day: 0.5, absent: 0 };

export function wageForStatus(status: string, dailyWage: number): number {
  return (WAGE_FACTOR[status] ?? 0) * dailyWage;
}
