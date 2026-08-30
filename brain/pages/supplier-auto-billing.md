---
id: supplier-auto-billing
title: Supplier deliveries auto-create their bill
category: decision
status: active
created: "2026-08-26T17:44:53"
updated: "2026-08-30T18:33:16"
---

<!-- compiled_truth -->
Before Aug 2026, recording a delivery and billing for it were two separate forms. Suppliers often skipped the second form, leaving goods on site with no debt visible on the admin's books.

**Decision**: `recordDelivery()` inserts the material row AND its bill (payment) in one operation. The old `generateBill()` action was deleted entirely.

**Aug 30 2026 — the bill now settles itself too.** Recording the delivery IS the payment event. The bill is written straight to `paid` and the full cost comes off the supplier's advance ledger in the same operation. The `approved` -> `paid` pause and its "Mark paid" button (`MarkPaidButton`, `markPaymentPaid`) were removed entirely: the owner's position is that a supplier's own recorded delivery needs no admin approval.

**The advance balance is allowed to go negative.** `deductFromSupplierAdvance()` used to clamp with `Math.min(balance, cost)` and skip entirely when the balance was <= 0. That hid what we owed. The full cost now always deducts, and a negative balance IS the "what we still owe this supplier" figure. This is the main reason nothing is lost by dropping the approval step.

**Key invariants**:
- `materials.billed` is set to `true` at delivery time — prevents double-counting in `lib/cashflow.ts` (which skips billed materials)
- `payments.material_id` links the bill to its delivery (migration 40) — enables cascade-delete when a delivery is archived
- Unique partial index on `material_id` prevents double-billing at the database level
- Migration 41 backfills legacy bills that were never linked
- Migration 48 flipped the supplier insert RLS policy from requiring `status = 'approved'` to requiring `status = 'paid'`. The policy is what makes this mandatory rather than advisory — a code-only change would be rejected by RLS.

**Labour payments are deliberately excluded.** They keep the `approved` -> `paid` pause, because payday timing is intentionally separate from entry time. The Android admin payments screen still shows a "Paid" button for that reason — it is not dead UI.

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
