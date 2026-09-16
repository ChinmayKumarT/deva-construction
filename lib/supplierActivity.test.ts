import { describe, it, expect } from "vitest";
import { supplierActivity } from "./supplierActivity";
import { supplierMoney } from "./supplierAccount";

const delivery = (name: string, total: number, at: string, status = "delivered") => ({
  name,
  unit: "unit",
  quantity: total,
  unit_cost: 1,
  status,
  ordered_at: at,
});

describe("supplierActivity", () => {
  it("orders events and tracks running remaining and advance", () => {
    const events = supplierActivity(
      [delivery("Cement", 1000, "2026-09-01")],
      [],
      [{ amount: 400, description: "Advance", created_at: "2026-09-02" }],
    );
    expect(events.map((e) => e.kind)).toEqual(["delivery", "advance_given"]);
    // After delivery: owed 1000, no advance.
    expect(events[0]).toMatchObject({ remaining: 1000, advance: 0 });
    // After advance: 400 credit applies against the 1000 owed.
    expect(events[1]).toMatchObject({ remaining: 600, advance: 400 });
  });

  it("shows a delivery settled from advance dropping remaining to zero", () => {
    const events = supplierActivity(
      [delivery("Sand", 600, "2026-09-01")],
      [],
      [
        { amount: 1000, description: "Advance", created_at: "2026-08-30" },
        { amount: -600, description: "Settled from advance: Sand", material_id: "m1", created_at: "2026-09-01" },
      ],
    );
    const last = events[events.length - 1];
    expect(last.kind).toBe("advance_settled");
    expect(last.remaining).toBe(0);
    expect(last.advance).toBe(400);
  });

  it("reconciles its final figures with supplierMoney", () => {
    // A part-covered delivery, later paid in cash.
    const materials = [{ id: "m1", quantity: 1000, unit_cost: 1, status: "delivered", billed: true }];
    const payments = [{ amount: 600, status: "paid", material_id: "m1", created_at: "2026-09-05" }];
    const advances = [
      { amount: 400, created_at: "2026-09-01" },
      { amount: -400, material_id: "m1", created_at: "2026-09-02" },
    ];

    const money = supplierMoney({ payments, advances, materials });
    const events = supplierActivity(
      [{ ...materials[0], name: "Steel", unit: "kg", ordered_at: "2026-09-02" }],
      payments,
      advances,
    );
    const last = events[events.length - 1];
    expect(last.remaining).toBe(money.remaining);
    expect(last.advance).toBe(money.advanceBalance);
    expect(last.remaining).toBe(0);
  });

  it("ignores returned deliveries", () => {
    const events = supplierActivity([delivery("Returned", 500, "2026-09-01", "returned")], [], []);
    expect(events).toHaveLength(0);
  });
});
