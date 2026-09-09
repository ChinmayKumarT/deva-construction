import { describe, it, expect } from "vitest";
import { materialQuickPicks } from "./materialQuickPicks";

const m = (name: string, unit: string, unit_cost: number | string) => ({ name, unit, unit_cost });

describe("materialQuickPicks", () => {
  it("returns nothing for a supplier with no catalog and no history", () => {
    expect(materialQuickPicks([], [])).toEqual([]);
  });

  it("lists the admin price list first, alphabetically", () => {
    const picks = materialQuickPicks([m("Sand", "m3", 1800), m("Cement", "bag", 380)], []);
    expect(picks.map((p) => p.name)).toEqual(["Cement", "Sand"]);
    expect(picks.every((p) => p.source === "catalog")).toBe(true);
    expect(picks[0].unitCost).toBe(380);
  });

  it("ranks history by how often the material was delivered", () => {
    const picks = materialQuickPicks([], [
      m("Sand", "m3", 1800),
      m("Cement", "bag", 380),
      m("Cement", "bag", 375),
      m("Cement", "bag", 370),
    ]);
    expect(picks.map((p) => p.name)).toEqual(["Cement", "Sand"]);
    expect(picks[0].count).toBe(3);
    expect(picks[1].count).toBe(1);
  });

  it("takes the rate from the most recent delivery, not the oldest", () => {
    // Callers pass history most-recent-first (ordered_at desc).
    const picks = materialQuickPicks([], [m("Cement", "bag", 400), m("Cement", "bag", 380)]);
    expect(picks[0].unitCost).toBe(400);
  });

  it("breaks a frequency tie in favour of the more recent material", () => {
    const picks = materialQuickPicks([], [m("Steel", "kg", 62), m("Bricks", "nos", 9)]);
    expect(picks.map((p) => p.name)).toEqual(["Steel", "Bricks"]);
  });

  it("treats differing case and whitespace as the same material", () => {
    const picks = materialQuickPicks([], [m(" cement ", "Bag", 380), m("Cement", "bag", 375)]);
    expect(picks).toHaveLength(1);
    expect(picks[0].count).toBe(2);
    expect(picks[0].name).toBe("cement"); // display casing from the most recent row
  });

  it("does not repeat a material the price list already covers", () => {
    const picks = materialQuickPicks(
      [m("Cement", "bag", 380)],
      [m("CEMENT", "BAG", 999), m("Sand", "m3", 1800)],
    );
    expect(picks.map((p) => p.name)).toEqual(["Cement", "Sand"]);
    expect(picks[0].unitCost).toBe(380); // the agreed rate wins over the delivered one
    expect(picks[1].source).toBe("history");
  });

  it("still separates the same name delivered in a different unit", () => {
    const picks = materialQuickPicks([], [m("Sand", "m3", 1800), m("Sand", "trip", 6000)]);
    expect(picks).toHaveLength(2);
  });

  it("parses a numeric rate that arrives as a string", () => {
    expect(materialQuickPicks([m("Cement", "bag", "380.50")], [])[0].unitCost).toBe(380.5);
  });

  it("falls back to a usable unit and drops nameless rows", () => {
    const picks = materialQuickPicks([], [m("Cement", "  ", 380), m("   ", "bag", 10)]);
    expect(picks).toHaveLength(1);
    expect(picks[0].unit).toBe("unit");
  });

  it("caps the list at the limit", () => {
    const history = ["a", "b", "c", "d", "e"].map((n) => m(n, "unit", 1));
    expect(materialQuickPicks([], history, 3)).toHaveLength(3);
  });
});
