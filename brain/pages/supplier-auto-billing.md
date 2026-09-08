---
id: supplier-auto-billing
title: Supplier deliveries auto-create their bill
category: decision
status: active
created: "2026-08-26T17:44:53"
updated: "2026-09-08T23:03:41"
---


<!-- compiled_truth -->
Before Aug 2026, recording a delivery and billing for it were two separate forms. Suppliers often skipped the second form, leaving goods on site with no debt visible on the admin's books.

**Decision**: `recordDelivery()` inserts the material row AND its bill (payment) in one operation. The old `generateBill()` action was deleted entirely. There is still no approval step and no "Mark paid" button for supplier bills -- the status is computed, not clicked. The owner's position is that a supplier's own recorded delivery needs no admin approval.

**How the status is computed now.** The bill is always inserted `approved` -- a real debt -- and then offered to the supplier's advance balance by `apply_supplier_advance_to_bill` (see [[supplier-advance-ledger]]). The credit goes against it as far as it reaches; the bill flips to `paid` only if that clears it in full. Bill first, advance second, because the credit is recorded against the bill's id.

**Two reversals got here, both worth knowing** (details on [[supplier-advance-ledger]]):
- Aug 30 2026 wrote every supplier delivery straight to `paid` and let the advance ledger go negative to carry the debt. Migration 49 undid that: the same debt was being stated twice, and Remaining could never read anything but zero because no supplier bill was ever left outstanding. Migration 50 repaired the data.
- 49's replacement rule was all-or-nothing -- `paid` where an advance covered the whole delivery, `approved` otherwise, and the advance untouched in between. Sep 2026 replaced that with partial application, because 400 of credit against a 1,000 bill left the 400 showing as credit in hand while Remaining already counted it.

**Key invariants**:
- `materials.billed` is set to `true` at delivery time -- prevents double-counting in `lib/cashflow.ts` (which skips billed materials).
- `payments.material_id` links the bill to its delivery (migration 40), and a unique partial index on it stops a delivery being billed twice across the two paths into that table. Migration 41 backfills legacy bills that were never linked.
- `supplier_advances.payment_id` links credit to the bill it settled (migration 52). This is what lets a bill be part-settled without the credit being counted twice.
- The insert RLS policy is what makes the status rule mandatory rather than advisory -- a code-only change would be rejected. Migration 48 required `status = 'paid'`; 49 widened it to `paid` or `approved`, which is what the current flow needs (it inserts `approved`, and the `paid` flip happens inside a `security definer` function).

**Labour payments are deliberately excluded.** They keep the `approved` -> `paid` pause, because payday timing is intentionally separate from entry time. The Android admin payments screen still shows a "Paid" button for that reason -- it is not dead UI.

Related: [[rls-is-the-authority]], [[supplier-advance-ledger]]


## Timeline

- time: 2026-08-26T17:44:53
  kind: decision
  summary: "Created this page: Supplier deliveries auto-create their bill"
  source: git log b4c0a83
  affects: [supplier-auto-billing]

- time: 2026-08-26T17:44:53
  kind: decision
  summary: "Deliveries auto-create bills, replacing the two-form workflow"
  source: git log b4c0a83
  affects: [supplier-auto-billing]

- time: 2026-08-30T18:33:16
  kind: decision
  summary: "Supplier bills now settle themselves; the approved->paid step and Mark paid button are gone"
  source: "chat + commit 89bcb73"
  affects: [supplier-auto-billing]

- time: 2026-09-07T23:01:58
  kind: reversal
  summary: "Advance ledger no longer goes negative; bill status is computed from advance coverage"
  source: "chat + commit c801fac"
  affects: [supplier-auto-billing]

- time: 2026-09-08T17:15:56
  kind: decision
  summary: "The admin path auto-bills too, and Ordered is gone from the pickers"
  source: "session 2026-09-08, commits 7d06c11, e16e647"
  affects: [supplier-auto-billing]

- time: 2026-09-08T23:03:41
  kind: decision
  summary: "Bills are now raised as approved and flipped to paid only if the advance clears them; drops the stale 'always paid, ledger goes negative' rule"
  source: "chat + implementation 2026-09-08"
  affects: [supplier-auto-billing]

- time: 2026-09-08T23:03:41
  kind: reversal
  summary: "Page had still described the Aug 30 'write it straight to paid, let the ledger go negative' rule that migration 49 undid"
  source: session 2026-09-08
  affects: [supplier-auto-billing, supplier-advance-ledger]
