"use client";

// CSV export for the Reports section, sitting alongside the PDF buttons.
// Plain client-side Blob download, no dependencies -- an accountant can open
// the raw rows in a spreadsheet and sum/pivot them. Amounts are written as
// bare numbers (no currency symbol, no thousands separators) so the
// spreadsheet treats them as numbers, not text.

import { downloadSitePdf, downloadSummaryPdf, downloadCashFlowPdf } from "./ReportPdf";

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  // Quote when the value contains a comma, quote or newline; escape embedded
  // quotes by doubling them (RFC 4180).
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function downloadCsv(filename: string, csv: string) {
  // Prepend a UTF-8 BOM so Excel renders ₹ and non-ASCII names correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";
}

const btnClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100";

// ---- Per-site report: the transactions ledger ----
export function DownloadSiteCsvButton({ site }: { site: Parameters<typeof downloadSitePdf>[0] }) {
  function onClick() {
    const rows: (string | number)[][] = [
      ["Type", "Description", "Date", "Status", "Amount"],
      ...site.transactions.map((t) => [t.type, t.description, t.date, t.status, t.amount]),
    ];
    downloadCsv(`${slug(site.name)}-report.csv`, toCsv(rows));
  }
  return <button type="button" onClick={onClick} className={btnClass}>Download CSV</button>;
}

// ---- Reports summary: sites, then the last-7-days labour table ----
export function DownloadSummaryCsvButton({ data }: { data: Parameters<typeof downloadSummaryPdf>[0] }) {
  function onClick() {
    const rows: (string | number)[][] = [
      ["Site", "Status", "Completion %", "Budget", "Spent"],
      ...data.sites.map((s) => [s.name, s.status, s.completionPct.toFixed(1), s.budget, s.spent]),
      [],
      ["Labourer", "Days worked (last 7)", "Wages earned"],
      ...data.labour.map((l) => [l.name, l.days, l.earn]),
    ];
    downloadCsv("reports-summary.csv", toCsv(rows));
  }
  return <button type="button" onClick={onClick} className={btnClass}>Download CSV</button>;
}

// ---- Cash flow: per-project outflow breakdown ----
export function DownloadCashFlowCsvButton({ data }: { data: Parameters<typeof downloadCashFlowPdf>[0] }) {
  function onClick() {
    const rows: (string | number)[][] = [
      ["Project", "Materials", "Supplier payments", "Labour payments", "Wages (attendance)", "Total"],
      ...data.projects.map((p) => [
        p.name,
        p.materials,
        p.supplier,
        p.labour,
        p.wages,
        p.materials + p.supplier + p.labour + p.wages,
      ]),
    ];
    downloadCsv(`cash-flow-${data.from}-to-${data.to}.csv`, toCsv(rows));
  }
  return <button type="button" onClick={onClick} className={btnClass}>Download CSV</button>;
}
