import { describe, it, expect } from "vitest";
import { WAGE_FACTOR, wageForStatus, wageDueKey, computeWagesDue } from "./wages";

describe("wageForStatus", () => {
  it("pays the full daily wage when present", () => {
    expect(wageForStatus("present", 800)).toBe(800);
  });

  it("pays half the daily wage for a half day", () => {
    expect(wageForStatus("half_day", 800)).toBe(400);
  });

  it("pays nothing when absent", () => {
    expect(wageForStatus("absent", 800)).toBe(0);
  });

  it("pays nothing for an unknown status", () => {
    expect(wageForStatus("holiday", 800)).toBe(0);
  });

  it("uses the documented factor table", () => {
    expect(WAGE_FACTOR).toEqual({ present: 1, half_day: 0.5, absent: 0 });
  });
});

describe("wageDueKey", () => {
  it("joins project and labourer with a pipe", () => {
    expect(wageDueKey("proj-1", "lab-1")).toBe("proj-1|lab-1");
  });

  it("keeps different pairs distinct", () => {
    expect(wageDueKey("p", "a")).not.toBe(wageDueKey("p", "b"));
  });
});

describe("computeWagesDue", () => {
  const wages = new Map([
    ["lab-1", 800],
    ["lab-2", 1000],
  ]);

  it("sums attendance wages per project/labourer", () => {
    const due = computeWagesDue(
      [
        { project_id: "proj-1", labourer_id: "lab-1", status: "present" },
        { project_id: "proj-1", labourer_id: "lab-1", status: "half_day" },
      ],
      [],
      wages,
    );
    expect(due[wageDueKey("proj-1", "lab-1")]).toBe(1200); // 800 + 400
  });

  it("subtracts labour payments already made for that pair", () => {
    const due = computeWagesDue(
      [
        { project_id: "proj-1", labourer_id: "lab-1", status: "present" },
        { project_id: "proj-1", labourer_id: "lab-1", status: "present" },
      ],
      [{ project_id: "proj-1", payee_type: "labour", labourer_id: "lab-1", amount: 500, status: "paid" }],
      wages,
    );
    expect(due[wageDueKey("proj-1", "lab-1")]).toBe(1100); // 1600 - 500
  });

  it("treats pending and approved payments as claimed too (not just paid)", () => {
    const due = computeWagesDue(
      [{ project_id: "proj-1", labourer_id: "lab-1", status: "present" }],
      [
        { project_id: "proj-1", payee_type: "labour", labourer_id: "lab-1", amount: 300, status: "pending" },
        { project_id: "proj-1", payee_type: "labour", labourer_id: "lab-1", amount: 200, status: "approved" },
      ],
      wages,
    );
    expect(due[wageDueKey("proj-1", "lab-1")]).toBe(300); // 800 - 300 - 200
  });

  it("ignores rejected payments", () => {
    const due = computeWagesDue(
      [{ project_id: "proj-1", labourer_id: "lab-1", status: "present" }],
      [{ project_id: "proj-1", payee_type: "labour", labourer_id: "lab-1", amount: 500, status: "rejected" }],
      wages,
    );
    expect(due[wageDueKey("proj-1", "lab-1")]).toBe(800);
  });

  it("ignores supplier payments", () => {
    const due = computeWagesDue(
      [{ project_id: "proj-1", labourer_id: "lab-1", status: "present" }],
      [{ project_id: "proj-1", payee_type: "supplier", labourer_id: null, amount: 500, status: "paid" }],
      wages,
    );
    expect(due[wageDueKey("proj-1", "lab-1")]).toBe(800);
  });

  it("never goes negative when overpaid", () => {
    const due = computeWagesDue(
      [{ project_id: "proj-1", labourer_id: "lab-1", status: "present" }],
      [{ project_id: "proj-1", payee_type: "labour", labourer_id: "lab-1", amount: 5000, status: "paid" }],
      wages,
    );
    expect(due[wageDueKey("proj-1", "lab-1")]).toBe(0);
  });

  it("skips attendance rows with no project", () => {
    const due = computeWagesDue(
      [{ project_id: null, labourer_id: "lab-1", status: "present" }],
      [],
      wages,
    );
    expect(due).toEqual({});
  });

  it("treats an unknown labourer's wage as zero", () => {
    const due = computeWagesDue(
      [{ project_id: "proj-1", labourer_id: "ghost", status: "present" }],
      [],
      wages,
    );
    expect(due[wageDueKey("proj-1", "ghost")]).toBeUndefined(); // 0 wage -> not added
  });

  it("keeps separate projects and labourers independent", () => {
    const due = computeWagesDue(
      [
        { project_id: "proj-1", labourer_id: "lab-1", status: "present" },
        { project_id: "proj-2", labourer_id: "lab-2", status: "present" },
      ],
      [],
      wages,
    );
    expect(due[wageDueKey("proj-1", "lab-1")]).toBe(800);
    expect(due[wageDueKey("proj-2", "lab-2")]).toBe(1000);
  });
});
