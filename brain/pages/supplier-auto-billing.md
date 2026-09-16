---
id: supplier-auto-billing
title: Supplier deliveries auto-create their bill
category: decision
status: active
created: "2026-08-26T17:44:53"
updated: "2026-09-16T11:13:47"
---


<!-- compiled_truth -->
**The model as of 2026-09-15 (this supersedes the auto-billing era below).** A supplier delivery no longer creates a bill. The unpaid purchase (the `materials` row) IS the debt. Recording a delivery -- supplier portal `recordDelivery`, admin `addMaterial` (delivered), or `markMaterialDelivered` -- inserts the material with `billed = false` and then calls `apply_supplier_advance_to_material` (migration 57). A `payments` row is created only when real money leaves.

**What the advance does at delivery time** (the owner's spec, checked for the double-count/scope holes first):
- Advance is applied to THAT purchase, partial allowed, recorded as a negative `supplier_advances` row with `material_id` set and `payment_id` null.
- Covered in full -> the material is marked `billed = true`, drops out of the Payments "Purchase" picker, and shows a **"Paid from advance"** badge on the deliveries tables.
- Covered in part -> stays in the picker, and the picker prefills the **net** still owed (line total − advance applied), never the full total, so it can't be overpaid; badge reads "₹X from advance".
- An advance handed over LATER settles open purchases oldest-first via `settle_supplier_purchases_from_advance` (called from `giveSupplierAdvance`), so credit given after a delivery still reaches it.
- Deleting a purchase hands its advance back (`refund_supplier_advance_for_material`).

**The money figures** ([[supplier-advance-ledger]], `lib/supplierAccount.ts` — `supplierMoney` now also takes `materials`):
- `Remaining` = open purchases (billed=false) owing their line total less advance applied, PLUS any legacy/ad-hoc bills still pending/approved. The two never overlap (a purchase with a bill is billed=true).
- `Lifetime payment` = money that actually left = advances given + supplier payments marked paid. A new purchase never inflates it; a purchase settled from advance creates no payment row, so it is counted once (as the advance given).

**Cash flow / Costs / P&L / Overview** (`lib/cashflow.ts`, and the Costs/P&L pages which were already material-based): a purchase is counted once, through its material at full line total, whether paid in cash, from advance, or still owing. A supplier payment that carries a `material_id` is a settlement of an already-counted material and is skipped; only ad-hoc supplier payments (no material) count on their own. Advances never enter cash flow.

**Why the whole double-count/scope class is closed:** advance is allocated per-purchase (a ledger row names the material), so "is this purchase covered" is answerable per purchase; `≥` handles exact cover; each application zeroes the correct side.

---

**Historical (auto-billing era, Aug 2026 – 15 Sep 2026, now removed).** Deliveries used to auto-create their bill (`recordDelivery`/`billSupplierDelivery` inserting a `payments` row, status computed from advance coverage; `materials.billed` set at delivery so cash flow counted the cost via the bill). This was removed in two steps in Sep 2026: first the bill creation was torn out entirely (delivery records material only), then the advance settlement above was added back at the material level. The migrations from that era (40 unique material_id index, 48/49 status policies, 52 partial application on bills) still exist and still serve legacy bills and manual supplier bills.


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

- time: 2026-09-15T18:35:19
  kind: decision
  summary: "Final model: a delivery records the material and settles from any advance; no bill is created, the net still owed shows in the Payments picker, and a fully advance-covered purchase reads 'paid from advance'"
  source: "chat + implementation 2026-09-15"
  affects: [supplier-auto-billing]

- time: 2026-09-15T19:25:09
  kind: decision
  summary: "Added one-click Paid / Undo paid on the admin supplier profile deliveries table (payDelivery/unpayDelivery): pays the net still owed, marks the delivery billed (drops from picker), and Undo archives the payment and reopens it"
  source: "chat + implementation 2026-09-15"
  affects: [supplier-auto-billing]

- time: 2026-09-16T11:13:47
  kind: decision
  summary: "Payments form supplier branch reworked: pick a supplier -> see Remaining/Lifetime/Advance, multi-select (with Select all) their open purchases, amount autofills to net; amount above the selected purchases goes to advance (credit) or a plain payment (no credit), chosen by a toggle. Settles each purchase via shared settleDeliveryAsPaid; surplus advance auto-settles other open purchases"
  source: "chat + implementation 2026-09-16"
  affects: [supplier-auto-billing]
