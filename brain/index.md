# Brain Index

_Auto-generated. Last updated 2026-09-09T06:06:11.841Z._

- [budget-extensions](pages/budget-extensions.md) — category: decision | <current best understanding — replace this with the real content>
- [client-payments-tracking](pages/client-payments-tracking.md) — category: decision | <current best understanding — replace this with the real content>
- [delete-cascade-traps](pages/delete-cascade-traps.md) — category: reference | Two traps that made a permanent delete either impossible or quietly destructive. Both bit on the same day.
- [dev-database-separation](pages/dev-database-separation.md) — category: project | **What happened.** `test_data.sql` was written and run when production was the only Supabase project. It seeded 8 clients, 6 suppliers, 24 l
- [dual-repo-deploy](pages/dual-repo-deploy.md) — category: decision | Every push goes to both remotes:
- [manager-role-restrictions](pages/manager-role-restrictions.md) — category: decision | Site managers run the work, not the books. As of Aug 2026, the manager role is restricted from:
- [no-api-layer](pages/no-api-layer.md) — category: decision | Both the Next.js web app and the Android app use the Supabase client SDK to talk directly to PostgreSQL through Supabase's PostgREST layer.
- [production-error-visibility](pages/production-error-visibility.md) — category: decision | **Next.js redacts the message of any error thrown from a Server Action in production.** `throw new Error("This supplier has 5 bills")` reach
- [project-detail-redesign](pages/project-detail-redesign.md) — category: decision | <current best understanding — replace this with the real content>
- [rls-is-the-authority](pages/rls-is-the-authority.md) — category: decision | The app enforces permissions at three layers — navigation hiding, server-side route guards (`requireRole()`), and PostgreSQL RLS policies —
- [role-reservations](pages/role-reservations.md) — category: decision | <current best understanding — replace this with the real content>
- [sheetjs-to-exceljs](pages/sheetjs-to-exceljs.md) — category: decision | SheetJS (the `xlsx` npm package) had unfixable CVEs that npm audit flagged. Swapped to `exceljs` which covers the same use case (backup Exce
- [superadmin-role](pages/superadmin-role.md) — category: decision | <current best understanding — replace this with the real content>
- [supplier-advance-ledger](pages/supplier-advance-ledger.md) — category: decision | Supplier advances live in one ledger table, `supplier_advances`.
- [supplier-auto-billing](pages/supplier-auto-billing.md) — category: decision | Before Aug 2026, recording a delivery and billing for it were two separate forms. Suppliers often skipped the second form, leaving goods on
- [supplier-material-catalog](pages/supplier-material-catalog.md) — category: decision | tags: [supplier, materials, ux] | Suppliers were retyping the same material, unit and rate on every delivery, because a delivery row *is* the material record — `materials` ca
