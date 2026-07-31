import { describe, it, expect } from "vitest";
import { csvCell, toCsv, slug, buildSiteCsv, buildSummaryCsv, buildCashFlowCsv } from "./reportCsv";

describe("csvCell", () => {
  it("leaves a plain value unquoted", () => {
    expect(csvCell("cement")).toBe("cement");
    expect(csvCell(7500)).toBe("7500");
  });

  it("quotes and doubles quotes when a comma or quote is present", () => {
    expect(csvCell("brick, red")).toBe('"brick, red"');
    expect(csvCell('12" pipe')).toBe('"12"" pipe"');
  });

  it("quotes values containing newlines", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv", () => {
  it("joins cells with commas and rows with CRLF", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
  });

  it("renders an empty row as a blank line (section separator)", () => {
    expect(toCsv([["a"], [], ["b"]])).toBe("a\r\n\r\nb");
  });
});

describe("slug", () => {
  it("lowercases and hyphenates", () => {
    expect(slug("Mysore Villa 2")).toBe("mysore-villa-2");
  });
  it("falls back to 'report' for empty/punctuation-only names", () => {
    expect(slug("   ")).toBe("report");
    expect(slug("!!!")).toBe("report");
  });
});

describe("buildSiteCsv", () => {
  it("emits the header and one row per transaction with numeric amounts", () => {
    const csv = buildSiteCsv({
      name: "Mysore",
      transactions: [
        { date: "2026-07-29", type: "Material", description: "cement (20 bags)", amount: 7500, status: "delivered" },
        { date: "2026-07-28", type: "Wage · attendance", description: "l1 (present)", amount: 800, status: "present" },
      ],
    });
    expect(csv).toBe(
      "Type,Description,Date,Status,Amount\r\n" +
        "Material,cement (20 bags),2026-07-29,delivered,7500\r\n" +
        "Wage · attendance,l1 (present),2026-07-28,present,800",
    );
  });

  it("quotes a description that contains a comma", () => {
    const csv = buildSiteCsv({
      name: "S",
      transactions: [{ date: "d", type: "Material", description: "brick, red", amount: 100, status: "ok" }],
    });
    expect(csv).toContain('Material,"brick, red",d,ok,100');
  });
});

describe("buildSummaryCsv", () => {
  it("lays out sites, a blank separator, then the labour table", () => {
    const csv = buildSummaryCsv({
      sites: [{ name: "Mysore", status: "active", completionPct: 30, budget: 100000, spent: 47100 }],
      labour: [{ name: "l1", days: "5.0", earn: "₹4,000" }],
    });
    expect(csv).toBe(
      "Site,Status,Completion %,Budget,Spent\r\n" +
        "Mysore,active,30.0,100000,47100\r\n" +
        "\r\n" +
        "Labourer,Days worked (last 7),Wages earned\r\n" +
        'l1,5.0,"₹4,000"', // earn has a comma -> quoted
    );
  });
});

describe("buildCashFlowCsv", () => {
  it("emits per-project rows with a computed total column", () => {
    const csv = buildCashFlowCsv({
      from: "2026-07-01",
      to: "2026-07-30",
      projects: [{ name: "Mysore", materials: 0, supplier: 42600, labour: 800, wages: 12000 }],
    });
    expect(csv).toBe(
      "Project,Materials,Supplier payments,Labour payments,Wages (attendance),Total\r\n" +
        "Mysore,0,42600,800,12000,55400", // 42600 + 800 + 12000
    );
  });
});
