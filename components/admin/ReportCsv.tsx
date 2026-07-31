"use client";

// CSV export buttons for the Reports section, sitting alongside the PDF
// buttons. The CSV *content* is built by the pure helpers in lib/reportCsv.ts
// (unit-tested); this file only wraps them in a browser Blob download.

import { downloadSitePdf, downloadSummaryPdf, downloadCashFlowPdf, downloadAttendancePdf } from "./ReportPdf";
import { buildSiteCsv, buildSummaryCsv, buildCashFlowCsv, buildAttendanceCsv, slug } from "@/lib/reportCsv";

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

const btnClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100";

export function DownloadSiteCsvButton({ site }: { site: Parameters<typeof downloadSitePdf>[0] }) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(`${slug(site.name)}-report.csv`, buildSiteCsv(site))}
      className={btnClass}
    >
      Download CSV
    </button>
  );
}

export function DownloadSummaryCsvButton({ data }: { data: Parameters<typeof downloadSummaryPdf>[0] }) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv("reports-summary.csv", buildSummaryCsv(data))}
      className={btnClass}
    >
      Download CSV
    </button>
  );
}

export function DownloadCashFlowCsvButton({ data }: { data: Parameters<typeof downloadCashFlowPdf>[0] }) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(`cash-flow-${data.from}-to-${data.to}.csv`, buildCashFlowCsv(data))}
      className={btnClass}
    >
      Download CSV
    </button>
  );
}

export function DownloadAttendanceCsvButton({ data }: { data: Parameters<typeof downloadAttendancePdf>[0] }) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(`attendance-${data.from}-to-${data.to}.csv`, buildAttendanceCsv(data))}
      className={btnClass}
    >
      Download CSV
    </button>
  );
}
