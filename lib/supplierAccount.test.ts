import { describe, it, expect } from "vitest";
import { supplierMoney } from "./supplierAccount";

// A delivery settled from an advance writes a negative ledger row naming the
// bill it went to. These helpers keep the cases below readable.
const advance = (amount: number) => ({ amount });
const applied = (amount: number, billId: string) => ({
  amount: -amount,
  payment_id: billId,
  material_id: "m1",
});
const refunded = (amount: number, billId: string) => ({
  amount,
  payment_id: billId,
  material_id: "m1",
});

describe("supplierMoney", () => {
  it("spends the advance down to zero against a bigger bill", () => {
    // The owner's case: 400 in hand, a 1,000 delivery arrives. The advance is
    // gone and 600 is owed -- not 400 still showing as credit while Remaining
    // already reads 600, which is the same money in two places.
    const m = supplierMoney({
      payments: [{ id: "b1", amount: 1000, status: "approved" }],
      advances: [advance(400), applied(400, "b1")],
    });
    expect(m.advanceBalance).toBe(0);
    expect(m.remaining).toBe(600);
    expect(m.outstanding).toBe(600);
    // The 400 genuinely left the account when it was handed over.
    expect(m.lifetimePayment).toBe(400);
  });

  it("keeps the surplus as credit when the advance covers the bill", () => {
    const m = supplierMoney({
      payments: [{ id: "b1", amount: 200, status: "paid" }],
      advances: [advance(1000), applied(200, "b1")],
    });
    expect(m.advanceBalance).toBe(800);
    expect(m.remaining).toBe(0);
    // Not 1,200: the 200 was already counted when the advance was handed over.
    expect(m.lifetimePayment).toBe(1000);
  });

  it("counts a part-settled bill once when it is finally paid off", () => {
    const m = supplierMoney({
      payments: [{ id: "b1", amount: 1000, status: "paid" }],
      advances: [advance(400), applied(400, "b1")],
    });
    expect(m.advanceBalance).toBe(0);
    expect(m.remaining).toBe(0);
    expect(m.lifetimePayment).toBe(1000);
  });

  it("hands the debt back with the credit when a delivery is deleted", () => {
    const m = supplierMoney({
      payments: [{ id: "b1", amount: 1000, status: "approved" }],
      advances: [advance(400), applied(400, "b1"), refunded(400, "b1")],
    });
    // The refund is credit coming back, not a second advance handed over.
    expect(m.advanceBalance).toBe(400);
    expect(m.lifetimePayment).toBe(400);
    // And the bill owes its whole amount again.
    expect(m.outstanding).toBe(1000);
    expect(m.remaining).toBe(600);
  });

  it("lets several advances chip away at one bill", () => {
    const m = supplierMoney({
      payments: [{ id: "b1", amount: 1000, status: "approved" }],
      advances: [advance(400), applied(400, "b1"), advance(300), applied(300, "b1")],
    });
    expect(m.advanceBalance).toBe(0);
    expect(m.remaining).toBe(300);
    expect(m.lifetimePayment).toBe(700);
  });

  it("still reads ledger rows written before bills were linked", () => {
    // The old rule only ever settled a bill in full, so an unlinked
    // consumption row belongs to a bill that was marked paid.
    const m = supplierMoney({
      payments: [{ id: "b1", amount: 200, status: "paid" }],
      advances: [advance(1000), { amount: -200 }],
    });
    expect(m.advanceBalance).toBe(800);
    expect(m.lifetimePayment).toBe(1000);
  });

  it("owes the full bill when there is no advance", () => {
    const m = supplierMoney({
      payments: [{ id: "b1", amount: 1000, status: "approved" }],
      advances: [],
    });
    expect(m.advanceBalance).toBe(0);
    expect(m.remaining).toBe(1000);
    expect(m.lifetimePayment).toBe(0);
  });

  it("never reports a negative balance or a negative remaining", () => {
    const m = supplierMoney({
      payments: [{ id: "b1", amount: 100, status: "approved" }],
      advances: [advance(500), applied(100, "b1")],
    });
    expect(m.remaining).toBe(0);
    expect(m.advanceBalance).toBe(400);
  });
});
