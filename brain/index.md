# Brain Index

_Auto-generated. Last updated 2026-08-26T13:21:17.835Z._

- [budget-extensions](pages/budget-extensions.md) — category: decision | <current best understanding — replace this with the real content>
- [client-payments-tracking](pages/client-payments-tracking.md) — category: decision | <current best understanding — replace this with the real content>
- [dual-repo-deploy](pages/dual-repo-deploy.md) — category: decision | Every push goes to both remotes:
- [manager-role-restrictions](pages/manager-role-restrictions.md) — category: decision | Site managers run the work, not the books. As of Aug 2026, the manager role is restricted from:
- [no-api-layer](pages/no-api-layer.md) — category: decision | Both the Next.js web app and the Android app use the Supabase client SDK to talk directly to PostgreSQL through Supabase's PostgREST layer.
- [project-detail-redesign](pages/project-detail-redesign.md) — category: decision | <current best understanding — replace this with the real content>
- [rls-is-the-authority](pages/rls-is-the-authority.md) — category: decision | The app enforces permissions at three layers — navigation hiding, server-side route guards (`requireRole()`), and PostgreSQL RLS policies —
- [sheetjs-to-exceljs](pages/sheetjs-to-exceljs.md) — category: decision | SheetJS (the `xlsx` npm package) had unfixable CVEs that npm audit flagged. Swapped to `exceljs` which covers the same use case (backup Exce
- [supplier-auto-billing](pages/supplier-auto-billing.md) — category: decision | Before Aug 2026, recording a delivery and billing for it were two separate forms. Suppliers often skipped the second form, leaving goods on
