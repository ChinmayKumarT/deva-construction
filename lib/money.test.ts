import { describe, it, expect } from "vitest";
import { roundMoney, lineTotal } from "./money";

describe("roundMoney", () => {
  it("rounds a float artifact to a clean 2-decimal value", () => {
    // 2.5 * 33.33 = 83.32499999999999 in IEEE-754
    expect(roundMoney(2.5 * 33.33)).toBe(83.32);
  });

  it("resolves the classic 0.1 + 0.2 drift", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it("rounds a half-paisa up", () => {
    expect(roundMoney(1.005)).toBe(1.01);
  });

  it("leaves already-clean values untouched", () => {
    expect(roundMoney(1200)).toBe(1200);
    expect(roundMoney(412.5)).toBe(412.5);
  });

  it("rounds down below the tie", () => {
    expect(roundMoney(1.004)).toBe(1);
  });

  it("handles zero", () => {
    expect(roundMoney(0)).toBe(0);
  });
});

describe("lineTotal", () => {
  it("multiplies quantity by unit cost and rounds to paise", () => {
    expect(lineTotal(2.5, 33.33)).toBe(83.32);
  });

  it("coerces string inputs (as Postgres numeric arrives)", () => {
    expect(lineTotal("3", "50.00")).toBe(150);
  });

  it("is exact for whole quantities", () => {
    expect(lineTotal(20, 375)).toBe(7500);
  });

  it("returns 0 for a zero quantity", () => {
    expect(lineTotal(0, 999.99)).toBe(0);
  });
});
