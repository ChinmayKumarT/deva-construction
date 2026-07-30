import { describe, it, expect } from "vitest";
import { reduceCashFlow, defaultCashFlowRange } from "./cashflow";

const RANGE = ["2026-01-01", "2026-12-31"] as const;
const labourers = [
  { id: "lab-1", daily_wage: 800 },
  { id: "lab-2", daily_wage: 1000 },
];

function material(over: Partial<Parameters<typeof reduceCashFlow>[0][number]> = {}) {
  return {
    project_id: "proj-1",
    quantity: 1,
    unit_cost: 100,
    status: "delivered",
    ordered_at: "2026-03-01",
    delivered_at: "2026-03-05",
    ...over,
  };
}

describe("reduceCashFlow — materials", () => {
  it("sums quantity × unit_cost for in-range materials", () => {
    const cf = reduceCashFlow([material({ quantity: 3, unit_cost: 50 })], [], [], labourers, ...RANGE);
    expect(cf.materialsCost).toBe(150);
    expect(cf.byProjectMaterials.get("proj-1")).toBe(150);
  });

  it("excludes returned materials", () => {
    const cf = reduceCashFlow([material({ status: "returned" })], [], [], labourers, ...RANGE);
    expect(cf.materialsCost).toBe(0);
  });

  it("coerces string numerics from Postgres", () => {
    const cf = reduceCashFlow([material({ quantity: "2", unit_cost: "250" })], [], [], labourers, ...RANGE);
    expect(cf.materialsCost).toBe(500);
  });

  it("dates by delivered_at when present, else ordered_at", () => {
    // delivered_at is out of range, so this is excluded even though ordered_at is in range.
    const cf = reduceCashFlow(
      [material({ ordered_at: "2026-03-01", delivered_at: "2030-01-01" })],
      [], [], labourers, ...RANGE,
    );
    expect(cf.materialsCost).toBe(0);
  });

  it("falls back to ordered_at when delivered_at is null", () => {
    const cf = reduceCashFlow(
      [material({ ordered_at: "2026-03-01", delivered_at: null })],
      [], [], labourers, ...RANGE,
    );
    expect(cf.materialsCost).toBe(100);
  });

  it("excludes materials outside the date range", () => {
    const cf = reduceCashFlow(
      [material({ ordered_at: "2020-01-01", delivered_at: "2020-01-01" })],
      [], [], labourers, ...RANGE,
    );
    expect(cf.materialsCost).toBe(0);
  });
});

describe("reduceCashFlow — payments", () => {
  const pay = (over = {}) => ({
    project_id: "proj-1",
    payee_type: "supplier",
    amount: 1000,
    status: "paid",
    created_at: "2026-04-10T09:00:00Z",
    ...over,
  });

  it("buckets supplier and labour payments separately", () => {
    const cf = reduceCashFlow(
      [],
      [pay({ payee_type: "supplier", amount: 1000 }), pay({ payee_type: "labour", amount: 400 })],
      [], labourers, ...RANGE,
    );
    expect(cf.supplierPayments).toBe(1000);
    expect(cf.labourPayments).toBe(400);
  });

  it("counts only paid/approved payments", () => {
    const cf = reduceCashFlow(
      [],
      [pay({ status: "pending" }), pay({ status: "rejected" }), pay({ status: "approved", amount: 250 })],
      [], labourers, ...RANGE,
    );
    expect(cf.supplierPayments).toBe(250);
  });

  it("dates payments by the date part of created_at", () => {
    const cf = reduceCashFlow([], [pay({ created_at: "2020-04-10T09:00:00Z" })], [], labourers, ...RANGE);
    expect(cf.supplierPayments).toBe(0);
  });
});

describe("reduceCashFlow — attendance wages", () => {
  it("weights wages by attendance status", () => {
    const cf = reduceCashFlow(
      [], [],
      [
        { project_id: "proj-1", labourer_id: "lab-1", status: "present", date: "2026-05-01" },
        { project_id: "proj-1", labourer_id: "lab-1", status: "half_day", date: "2026-05-02" },
        { project_id: "proj-1", labourer_id: "lab-1", status: "absent", date: "2026-05-03" },
      ],
      labourers, ...RANGE,
    );
    expect(cf.wages).toBe(1200); // 800 + 400 + 0
    expect(cf.byProjectWages.get("proj-1")).toBe(1200);
  });

  it("excludes attendance outside the range", () => {
    const cf = reduceCashFlow(
      [], [],
      [{ project_id: "proj-1", labourer_id: "lab-1", status: "present", date: "2020-05-01" }],
      labourers, ...RANGE,
    );
    expect(cf.wages).toBe(0);
  });
});

describe("reduceCashFlow — totals and separation", () => {
  it("totals all four categories and keeps projects separate", () => {
    const cf = reduceCashFlow(
      [material({ project_id: "proj-1", quantity: 1, unit_cost: 100 })],
      [
        { project_id: "proj-1", payee_type: "supplier", amount: 100, status: "paid", created_at: "2026-04-01T00:00:00Z" },
        { project_id: "proj-2", payee_type: "labour", amount: 200, status: "paid", created_at: "2026-04-01T00:00:00Z" },
      ],
      [{ project_id: "proj-2", labourer_id: "lab-1", status: "present", date: "2026-05-01" }],
      labourers, ...RANGE,
    );
    expect(cf.materialsCost).toBe(100);
    expect(cf.supplierPayments).toBe(100);
    expect(cf.labourPayments).toBe(200);
    expect(cf.wages).toBe(800);
    expect(cf.total).toBe(1200);
    expect(cf.byProjectMaterials.get("proj-1")).toBe(100);
    expect(cf.byProjectLabour.get("proj-2")).toBe(200);
    expect(cf.byProjectWages.get("proj-2")).toBe(800);
    expect(cf.byProjectMaterials.get("proj-2")).toBeUndefined();
  });

  it("returns all zeros for empty input", () => {
    const cf = reduceCashFlow([], [], [], [], ...RANGE);
    expect(cf.total).toBe(0);
    expect(cf.byProjectMaterials.size).toBe(0);
  });
});

describe("defaultCashFlowRange", () => {
  it("spans the first of the current month to today, as YYYY-MM-DD", () => {
    const { fromStr, toStr } = defaultCashFlowRange();
    expect(fromStr).toMatch(/^\d{4}-\d{2}-01$/);
    expect(toStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fromStr <= toStr).toBe(true);
  });
});
