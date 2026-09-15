---
id: supplier-auto-billing
title: Supplier deliveries auto-create their bill
category: decision
status: active
created: "2026-08-26T17:44:53"
updated: "2026-09-15T12:36:41"
---


<!-- compiled_truth -->
**Reversed on 2026-09-15. Deliveries no longer create a bill.** The owner's instruction: "When a supplier delivers material, the owner should automatically know. There is no need to create any bill... it should show on the admin page for payment only."

**Current model (simple):**
- Recording a delivery -- from the supplier's own portal (`recordDelivery` in app/supplier/actions.ts), the admin material form (`addMaterial`), or `markMaterialDelivered` -- inserts **only** the `materials` row, with `billed = false`. No `payments` row is created and no advance is drawn down at delivery time.
- The delivery then shows in the Payments "Purchase (optional)" picker (the picker query is `billed = false`, `status != returned`, `supplier_id is not null`, filtered to the chosen project). The owner sees it and raises the payment when they choose.
- `createPayment` (app/admin/actions.ts) is the one place a supplier bill is now created. Picking a purchase there sets that material's `billed = true` (so it drops out of the picker, no double-pay) and applies any advance via `apply_supplier_advance_to_bill`.

**Why this doesn't double-count in cash flow:** while `billed = false`, the material's own row carries its cost in `lib/cashflow.ts`; once the owner pays and `billed` flips to `true`, cashflow skips the material and counts the payment instead. Exactly one of the two is ever counted.

**What was removed:** `billSupplierDelivery()` in app/admin/actions.ts (deleted), the bill-insert + advance-apply block inside the supplier's `recordDelivery()`, and both admin auto-bill call sites. The advance system itself is untouched -- advances are still given, and still applied when the owner raises a bill manually or gives an advance ([[supplier-advance-ledger]]).

**Still in place, now dormant / defensive:** migration 40's unique index on `payments.material_id` (still stops one delivery being paid twice through the picker); the delete-cascade archiving from [[delete-cascade-traps]]. `applyAdvanceToBill`, `settleOutstandingFromAdvance`, `refundSupplierAdvanceForMaterial` remain, used by the manual bill and advance paths.

**Historical note (superseded):** everything below described the auto-billing era -- deliveries writing their own `approved`/`paid` bill and drawing the advance at delivery time. That is no longer how it works; kept only to explain the migrations (40, 48, 49, 50, 52) that still exist in the schema.

---

Before Aug 2026, recording a delivery and billing for it were two separate forms. Suppliers often skipped the second form, leaving goods on site with no debt visible on the admin's books. From Aug 2026 to Sep 15 2026 the app auto-created the bill at delivery time (`recordDelivery()` inserting the material AND its bill, the admin path doing the same via `billSupplierDelivery()`), with bill status computed from advance coverage. The 2026-09-15 reversal above ended that.


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

- time: 2026-09-15T12:36:35
  kind: decision
  summary: "Auto-billing removed: a delivery records the material only; the owner raises the payment manually"
  source: "chat + implementation 2026-09-15"
  affects: [supplier-auto-billing]

- time: 2026-09-15T12:36:41
  kind: reversal
  summary: "Auto-billing removed entirely: a delivery records the material only; the owner raises the payment manually from the Payments picker"
  source: "chat + implementation 2026-09-15"
  affects: [supplier-auto-billing]
