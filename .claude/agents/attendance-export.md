---
name: attendance-export
description: Implements CSV/PDF export for the web Attendance admin page, mirroring the existing Reports/Cash-flow export pattern (lib/reportCsv.ts pure builders + components/admin/ReportCsv.tsx Blob download + components/admin/ReportPdf.tsx jsPDF). Use this agent when asked to add or update attendance download/export functionality.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

You are implementing a CSV + PDF export for the **Attendance** admin page in this Next.js/Supabase construction-management app ("Deva Construction"), mirroring the export pattern already used by Reports and Cash Flow. This is a **web-only** feature (this repo has no Android attendance export equivalent to keep in sync with — check `android/` only if asked).

## Context you need

- `app/admin/attendance/page.tsx` currently only shows **one day at a time** (date query param, defaults to today) with per-labourer mark buttons (present/half_day/absent). It has no date-range summary and no export.
- `lib/wages.ts` exports `WAGE_FACTOR` (`{present: 1, half_day: 0.5, absent: 0}`) and `wageForStatus(status, dailyWage)` (rounds via `lib/money.ts`'s `roundMoney`). Use these — do not reimplement wage weighting.
- `lib/cashflow.ts` has the pattern to copy for date-range handling: a pure reducer function (unit-testable, no I/O) called by an async fetcher, plus `defaultCashFlowRange()` which returns `{fromStr, toStr}` for "first of this month" to "today" using **local calendar parts** (`ymdLocal()`), not `toISOString()` — there was a real timezone bug here before (UTC+5:30 shifts the 1st back a day). Copy this local-date approach exactly.
- `lib/reportCsv.ts` has pure CSV builders (`csvCell`, `toCsv`, `slug`, `buildSiteCsv`, `buildSummaryCsv`, `buildCashFlowCsv`) with matching tests in `lib/reportCsv.test.ts`. `toCsv` join rows with CRLF; `csvCell` quotes per RFC 4180.
- `components/admin/ReportCsv.tsx` is a thin "use client" wrapper: builds the CSV string via the pure builder, wraps it in a `Blob(["﻿" + csv], {type: "text/csv;charset=utf-8;"})` (UTF-8 BOM so Excel renders correctly), and triggers a download via a temporary `<a>` element. Follow this exact pattern for a new `DownloadAttendanceCsvButton`.
- `components/admin/ReportPdf.tsx` is a thin "use client" wrapper using `jspdf` + `jspdf-autotable` (already a dependency — check `package.json` if unsure), with a shared `buildPdf()` / `header()` helper and, for cash flow, a simple hand-drawn `<canvas>` bar chart (`cashFlowChartImage`) embedded as a PNG via `doc.addImage`. Follow this pattern for a new `downloadAttendancePdf` — a simple bar chart of "days worked" or "wages earned" per labourer, plus an `autoTable` with the same columns as the CSV.
- `app/admin/cashflow/page.tsx` is the UI pattern to copy: a `<form method="get">` with `Field` (from `components/admin/Page.tsx`) for `from`/`to` date inputs + a submit button + a "Clear filter" link, download buttons in the top-right, summary cards, and a `DataTable`.

## What to build

1. **`lib/attendance.ts`** (new) — a pure, unit-testable reducer mirroring `lib/cashflow.ts`'s shape:
   - Input: attendance rows (`{labourer_id, project_id, date, status}`), labourer rows (`{id, name, daily_wage, category}`), a `from`/`to` inclusive date range.
   - Output: per-labourer summary — `{ labourerId, name, category, present: number, halfDay: number, absent: number, daysWorked: number, wages: number }` (`daysWorked` is the weighted sum via `WAGE_FACTOR`; `wages` via `wageForStatus`).
   - Export `defaultAttendanceRange()` reusing the exact `ymdLocal()` local-date logic from `lib/cashflow.ts` (copy, don't import a private helper — it's not exported).
   - Write `lib/attendance.test.ts` covering: date filtering (inclusive bounds), each status's weight, multiple labourers, empty range, and the default-range function returning correct local dates (guard against the timezone regression class described above).

2. **`lib/reportCsv.ts`** — add `AttendanceCsvInput` type and `buildAttendanceCsv(data)` pure builder (columns: `Labourer, Category, Present, Half day, Absent, Days worked, Wages earned`), plus a filename via the existing `slug()`. Add matching tests to `lib/reportCsv.test.ts` following the existing test style exactly (see `buildCashFlowCsv`'s test as the closest analog).

3. **`components/admin/ReportCsv.tsx`** — add `DownloadAttendanceCsvButton`, same pattern as `DownloadCashFlowCsvButton`.

4. **`components/admin/ReportPdf.tsx`** — add `downloadAttendancePdf(data)` + `DownloadAttendancePdfButton`, same pattern as `downloadCashFlowPdf`/`DownloadCashFlowPdfButton`. Keep the chart simple (a horizontal bar per labourer, e.g. of wages earned) — don't over-engineer.

5. **`app/admin/attendance/page.tsx`** — add a second section below the existing daily mark-attendance table: "Attendance summary" with a `from`/`to` date-range form (default via `defaultAttendanceRange()`), a `DataTable` of the per-labourer summary, and the two new download buttons in the header of that section. Keep the existing daily-marking UI untouched — this is additive. Fetch labourers with `category` (see `supabase/16_labourer_category.sql` — the column already exists) so the CSV/PDF category column has real data; the existing query in this file uses `.select("id, name, daily_wage")`, extend it.

## Constraints (match the codebase's existing discipline)

- Money/day-count math is app-layer; the DB columns are already `numeric`. Round wages the same way everywhere else does (`wageForStatus`, not ad-hoc arithmetic).
- No comments explaining *what* code does — only ones explaining non-obvious *why* (see the existing files for the house style, e.g. the `ymdLocal` comment in `lib/cashflow.ts`).
- Don't touch Android — this is web-only per the current ask.
- Don't add features beyond this scope (no per-project breakdown, no chart beyond a simple bar chart) unless it's trivial to mirror an existing pattern.

## Verification before you finish

1. `npx tsc --noEmit` — must be clean (run with `export PATH="$PATH:/c/Program Files/nodejs"` if `npx` isn't found).
2. `npm test` — all existing + new tests must pass.
3. Report back concisely: files changed, test count before/after, and confirm both checks passed.

Do not commit or push — that's handled outside this agent.
