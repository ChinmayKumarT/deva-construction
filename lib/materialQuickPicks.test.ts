import { describe, it, expect } from "vitest";
import { materialQuickPicks } from "./materialQuickPicks";

const m = (name: string, unit: string) => ({ name, unit });
const c = (name: string, unit: string, description?: string) => ({ name, unit, description });

describe("materialQuickPicks", () => {
  it("returns nothing for a supplier with no catalog and no history", () => {
    expect(materialQuickPicks([], [])).toEqual([]);
  });

  it("lists the admin price list first, alphabetically", () => {
    const picks = materialQuickPicks([c("Sand", "m3"), c("Cement", "bag", "OPC 53, Ultratech")], []);
    expect(picks.map((p) => p.name)).toEqual(["Cement", "Sand"]);
    expect(picks.every((p) => p.source === "catalog")).toBe(true);
    expect(picks[0].description).toBe("OPC 53, Ultratech");
  });

  it("ranks history by how often the material was delivered", () => {
    const picks = materialQuickPicks([], [
      m("Sand", "m3"),
      m("Cement", "bag"),
      m("Cement", "bag"),
      m("Cement", "bag"),
    ]);
    expect(picks.map((p) => p.name)).toEqual(["Cement", "Sand"]);
    expect(picks[0].count).toBe(3);
    expect(picks[1].count).toBe(1);
  });

  it("gives a history pick no description -- only the price list has one", () => {
    const picks = materialQuickPicks([], [m("Cement", "bag")]);
    expect(picks[0].source).toBe("history");
    expect(picks[0].description).toBeNull();
  });

  it("breaks a frequency tie in favour of the more recent material", () => {
    const picks = materialQuickPicks([], [m("Steel", "kg"), m("Bricks", "nos")]);
    expect(picks.map((p) => p.name)).toEqual(["Steel", "Bricks"]);
  });

  it("treats differing case and whitespace as the same material", () => {
    const picks = materialQuickPicks([], [m(" cement ", "Bag"), m("Cement", "bag")]);
    expect(picks).toHaveLength(1);
    expect(picks[0].count).toBe(2);
    expect(picks[0].name).toBe("cement"); // display casing from the most recent row
  });

  it("does not repeat a material the price list already covers", () => {
    const picks = materialQuickPicks(
      [c("Cement", "bag", "OPC 53, Ultratech")],
      [m("CEMENT", "BAG"), m("Sand", "m3")],
    );
    expect(picks.map((p) => p.name)).toEqual(["Cement", "Sand"]);
    expect(picks[0].description).toBe("OPC 53, Ultratech"); // the catalog entry wins
    expect(picks[1].source).toBe("history");
  });

  it("still separates the same name delivered in a different unit", () => {
    const picks = materialQuickPicks([], [m("Sand", "m3"), m("Sand", "trip")]);
    expect(picks).toHaveLength(2);
  });

  it("treats a blank description as none rather than an empty chip", () => {
    expect(materialQuickPicks([c("Cement", "bag", "   ")], [])[0].description).toBeNull();
  });

  it("falls back to a usable unit and drops nameless rows", () => {
    const picks = materialQuickPicks([], [m("Cement", "  "), m("   ", "bag")]);
    expect(picks).toHaveLength(1);
    expect(picks[0].unit).toBe("unit");
  });

  it("caps the list at the limit", () => {
    const history = ["a", "b", "c", "d", "e"].map((n) => m(n, "unit"));
    expect(materialQuickPicks([], history, 3)).toHaveLength(3);
  });
});
