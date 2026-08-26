---
id: supplier-auto-billing
title: Supplier deliveries auto-create their bill
category: decision
status: active
created: "2026-08-26T17:44:53"
updated: "2026-08-26T17:44:53"
---

<!-- compiled_truth -->
Before Aug 2026, recording a delivery and billing for it were two separate forms. Suppliers often skipped the second form, leaving goods on site with no debt visible on the admin's books.

**Decision**: `recordDelivery()` now inserts the material row AND its bill (payment) in one operation. The old `generateBill()` action was deleted entirely.

**Key invariants**:
- `materials.billed` is set to `true` at delivery time — prevents double-counting in `lib/cashflow.ts` (which skips billed materials)
- `payments.material_id` links the bill to its delivery (migration 40) — enables cascade-delete when a delivery is archived
- Unique partial index on `material_id` prevents double-billing at the database level
- Migration 41 backfills legacy bills that were never linked

Related: [[rls-is-the-authority]]


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
