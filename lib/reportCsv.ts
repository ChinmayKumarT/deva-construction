// Pure CSV builders for the Reports exports. Kept separate from the client
// component (components/admin/ReportCsv.tsx) so the content -- escaping,
// numeric formatting, row structure -- is unit-testable without a DOM. The
// component just wraps these in a Blob download.
//
// Amounts are emitted as bare numbers (no currency symbol, no thousands
// separators) so a spreadsheet treats them as numbers, not text.

export type SiteCsvInput = {
  name: string;
  transactions: { date: string; type: string; description: string; amount: number; status: string }[];
};
export type SummaryCsvInput = {
  sites: { name: string; status: string; completionPct: number; budget: number; spent: number }[];
  labour: { name: string; days: string; earn: string }[];
};
export type CashFlowCsvInput = {
  from: string;
  to: string;
  projects: { name: string; materials: number; labour: number; wages: number }[];
};
export type AttendanceCsvInput = {
  from: string;
  to: string;
  labourers: {
    name: string;
    category: string | null;
    present: number;
    halfDay: number;
    absent: number;
    daysWorked: number;
    wages: number;
  }[];
};

/** Escape one CSV cell per RFC 4180: quote when it holds a comma, quote or
 *  newline, and double any embedded quotes. */
export function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Join rows into a CSV string (CRLF line endings, per RFC 4180). */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Filesystem-safe slug for a report filename. */
export function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";
}

/** Per-site report: the transactions ledger. */
export function buildSiteCsv(site: SiteCsvInput): string {
  return toCsv([
    ["Type", "Description", "Date", "Status", "Amount"],
    ...site.transactions.map((t) => [t.type, t.description, t.date, t.status, t.amount]),
  ]);
}

/** Reports summary: sites, then the last-7-days labour table. */
export function buildSummaryCsv(data: SummaryCsvInput): string {
  return toCsv([
    ["Site", "Status", "Completion %", "Budget", "Spent"],
    ...data.sites.map((s) => [s.name, s.status, s.completionPct.toFixed(1), s.budget, s.spent]),
    [],
    ["Labourer", "Days worked (last 7)", "Wages earned"],
    ...data.labour.map((l) => [l.name, l.days, l.earn]),
  ]);
}

/** Cash flow: per-project outflow breakdown. */
export function buildCashFlowCsv(data: CashFlowCsvInput): string {
  return toCsv([
    ["Project", "Materials", "Labour payments", "Wages (attendance)", "Total"],
    ...data.projects.map((p) => [
      p.name,
      p.materials,
      p.labour,
      p.wages,
      p.materials + p.labour + p.wages,
    ]),
  ]);
}

/** Attendance summary: per-labourer counts, days worked and wages earned over a date range. */
export function buildAttendanceCsv(data: AttendanceCsvInput): string {
  return toCsv([
    ["Labourer", "Category", "Present", "Half day", "Absent", "Days worked", "Wages earned"],
    ...data.labourers.map((l) => [
      l.name,
      l.category ?? "",
      l.present,
      l.halfDay,
      l.absent,
      l.daysWorked,
      l.wages,
    ]),
  ]);
}
