import { describe, it, expect, vi, afterEach } from "vitest";
import { reduceAttendance, defaultAttendanceRange } from "./attendance";

const labourers = [
  { id: "l1", name: "Ravi", daily_wage: 800, category: "mason" },
  { id: "l2", name: "Suresh", daily_wage: 1000, category: "helper" },
];

describe("reduceAttendance", () => {
  it("counts each status and weights daysWorked/wages accordingly", () => {
    const attendance = [
      { labourer_id: "l1", project_id: "p1", date: "2026-07-10", status: "present" },
      { labourer_id: "l1", project_id: "p1", date: "2026-07-11", status: "half_day" },
      { labourer_id: "l1", project_id: "p1", date: "2026-07-12", status: "absent" },
    ];
    const [summary] = reduceAttendance(attendance, [labourers[0]], "2026-07-01", "2026-07-31");
    expect(summary).toEqual({
      labourerId: "l1",
      name: "Ravi",
      category: "mason",
      present: 1,
      halfDay: 1,
      absent: 1,
      daysWorked: 1.5,
      wages: 1200, // 800 (present) + 400 (half day) + 0 (absent)
    });
  });

  it("excludes rows outside the from/to range but includes the inclusive bounds", () => {
    const attendance = [
      { labourer_id: "l1", project_id: "p1", date: "2026-06-30", status: "present" }, // before range
      { labourer_id: "l1", project_id: "p1", date: "2026-07-01", status: "present" }, // lower bound
      { labourer_id: "l1", project_id: "p1", date: "2026-07-31", status: "present" }, // upper bound
      { labourer_id: "l1", project_id: "p1", date: "2026-08-01", status: "present" }, // after range
    ];
    const [summary] = reduceAttendance(attendance, [labourers[0]], "2026-07-01", "2026-07-31");
    expect(summary.present).toBe(2);
    expect(summary.wages).toBe(1600);
  });

  it("summarizes multiple labourers independently", () => {
    const attendance = [
      { labourer_id: "l1", project_id: "p1", date: "2026-07-10", status: "present" },
      { labourer_id: "l2", project_id: "p1", date: "2026-07-10", status: "half_day" },
    ];
    const summaries = reduceAttendance(attendance, labourers, "2026-07-01", "2026-07-31");
    expect(summaries).toEqual([
      { labourerId: "l1", name: "Ravi", category: "mason", present: 1, halfDay: 0, absent: 0, daysWorked: 1, wages: 800 },
      { labourerId: "l2", name: "Suresh", category: "helper", present: 0, halfDay: 1, absent: 0, daysWorked: 0.5, wages: 500 },
    ]);
  });

  it("returns zeroed summaries when there are no attendance rows in range", () => {
    const summaries = reduceAttendance([], labourers, "2026-07-01", "2026-07-31");
    expect(summaries).toEqual([
      { labourerId: "l1", name: "Ravi", category: "mason", present: 0, halfDay: 0, absent: 0, daysWorked: 0, wages: 0 },
      { labourerId: "l2", name: "Suresh", category: "helper", present: 0, halfDay: 0, absent: 0, daysWorked: 0, wages: 0 },
    ]);
  });
});

describe("defaultAttendanceRange", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first of the current month (local) through today (local)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 23, 30)); // July 15 2026, 11:30pm local
    expect(defaultAttendanceRange()).toEqual({ fromStr: "2026-07-01", toStr: "2026-07-15" });
  });
});
