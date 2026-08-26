---
id: sheetjs-to-exceljs
title: "Replaced SheetJS (xlsx) with exceljs to clear CVEs"
category: decision
status: active
created: "2026-08-26T17:45:18"
updated: "2026-08-26T17:45:18"
---

<!-- compiled_truth -->
SheetJS (the `xlsx` npm package) had unfixable CVEs that npm audit flagged. Swapped to `exceljs` which covers the same use case (backup Excel export) with no known vulnerabilities.

The backup workflow (`lib/backup.ts`) and the GitHub Actions daily export both use exceljs now.


## Timeline

- time: 2026-08-26T17:45:18
  kind: decision
  summary: "Created this page: Replaced SheetJS (xlsx) with exceljs to clear CVEs"
  source: git log dae2adf
  affects: [sheetjs-to-exceljs]

- time: 2026-08-26T17:45:18
  kind: decision
  summary: Security-driven dependency swap
  source: git log dae2adf
  affects: [sheetjs-to-exceljs]
