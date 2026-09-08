---
id: supplier-advance-ledger
title: Supplier advances use a ledger-based account system
category: decision
status: active
created: "2026-08-30T01:25:58"
updated: "2026-09-08T23:03:05"
---


<!-- compiled_truth -->
Supplier advances live in one ledger table, `supplier_advances`. A positive row is money handed over; a negative row is credit put against a bill. **The balance never goes below zero** -- it only ever shows real money given.

**The model, in the owner's words**: an advance is money that has left, so it settles what is owed, and any surplus leaves you in credit.

**An advance settles a bill as far as it goes.** 400 in hand against a 1,000 delivery leaves the balance at 0 and 600 owing. (Until Sep 2026 this was all-or-nothing -- see the reversal below.)

**One shared derivation.** `lib/supplierAccount.ts` exports `supplierMoney({payments, advances})`, used by the admin supplier list, the supplier detail page and the supplier's own dashboard. These three drifted apart twice before it existed; do not compute these figures anywhere else. `lib/supplierAccount.test.ts` pins every case below.

- `advanceBalance` = given - applied. Never negative.
- `outstanding`    = for each pending/approved bill, its amount less what the advance has already put against it.
- `remaining`      = `Math.max(0, outstanding - advanceBalance)`. Credit belongs in one place, so surplus shows as advance balance rather than a negative Remaining.
- `lifetimePayment` = given + paidBills - **applied to PAID bills**. The subtraction is load-bearing: a bill settled out of an advance is marked paid, but that money was already counted when the advance was handed over. Only credit sitting against a *paid* bill is subtracted -- credit against a bill still owing has not been counted anywhere else.

**Every consumption row names the bill it went to** (`payment_id`, 52_partial_advance_application.sql). That link is what makes partial settlement possible at all: a bill's own amount is not what is owed on it, and without the link the split between "credit against paid bills" and "credit against open bills" could only be guessed from totals. Guessing it is exactly why the rule used to be all-or-nothing.

**One function applies credit, everywhere**: `apply_supplier_advance_to_bill(payment_id)`. Bill first, then the advance -- the credit is applied against the bill's id, so the bill is always inserted as `approved` and the function flips it to `paid` only if it clears it. Called by the admin's own purchase billing (`billSupplierDelivery`, `createPayment`), the supplier portal and Android's `recordSupplierDelivery`, and by `settleOutstandingFromAdvance` when an advance is handed over against bills already raised (oldest first). The three used to hold three copies of the rule.

**When credit comes back** -- deleting the delivery (Sep 2026). Goods off the books must not leave the advance spent, or the balance understates what the supplier is still holding for us. `refund_supplier_advance_for_material` refunds the material's *net* ledger position, only while that is still negative, stamped with the same `payment_id` so the bill goes back to owing its full amount and any `paid` status is undone. Every delete path calls it: the admin's archive (after the archive -- nothing to give back if it failed), the owner's permanent delete (*before* the delete, because `material_id` is `on delete set null` and the link is unrecoverable afterwards), the supplier portal's `archiveDelivery`, and Android's `archiveMaterial` / `deleteMaterialForever`. It writes an offsetting row rather than deleting the deduction: the supplier page renders the ledger as a statement, so a silent removal would move the balance with no line explaining it. Idempotent by net -- delete a delivery and then its bill, two buttons for what was one event, and the money comes back once, in whichever order.

**The supplier portal could never write this table, and that was silently wrong.** 47_supplier_advances.sql gives a supplier SELECT and nothing else; `staff_all_supplier_advances` is the only write policy. So the deduction `recordDelivery` attempted from /supplier (and from Android) was rejected -- the insert's error was never checked -- while the bill written in the same breath was still marked `paid` because the balance covered it. Widening the policy is not the fix: a supplier who can insert freely can write a POSITIVE row and claim an advance they were never given. The two `security definer` functions are the whole of what the portal may do, and both derive the amount from rows already there rather than from the caller. A supplier may only refund a delivery that is actually archived; staff bypass that because `deleteMaterial` refunds a beat before the row disappears.

**Reversal history matters here.** Two of them, and they pull in opposite directions -- read both before touching this.
1. For a few hours the rule was "always deduct the full cost, let the balance go negative, a negative balance is what we owe". Wrong: it stated the same debt twice, as an unpaid bill AND a negative balance. Migration 50 repaired the data. **The balance still stops at zero.**
2. All-or-nothing deduction replaced it, and was itself wrong in a quieter way: with 400 against a 1,000 bill the advance sat untouched at 400 while Remaining already read 600 -- the same 400 shown as both credit in hand and credit applied. Partial application (52) is the fix, and it is not a return to (1): the balance stops at zero, and the part of the bill the credit could not reach stays a debt on the bill.

`deleteSupplierAdvance` removes a mistaken advance, but refuses when the balance cannot absorb it, because that money has already settled bills.

Related: [[supplier-auto-billing]], [[rls-is-the-authority]], [[delete-cascade-traps]]


## Timeline

- time: 2026-08-30T01:25:58
  kind: decision
  summary: "Created this page: Supplier advances use a ledger-based account system"
  source: implementation 2026-08-30
  affects: [supplier-advance-ledger]

- time: 2026-08-30T01:26:09
  kind: decision
  summary: Ledger-based advance accounting with auto-deduction across all supplier cost paths
  source: implementation 2026-08-30
  affects: [supplier-advance-ledger]

- time: 2026-09-08T17:15:37
  kind: decision
  summary: "Rewritten: advance is money that has left; one shared derivation; ledger never negative"
  source: "session 2026-09-08, commits 7d06c11..e16e647"
  affects: [supplier-advance-ledger]

- time: 2026-09-08T18:25:59
  kind: decision
  summary: "Deleting a delivery returns the advance; the rule moved into SQL because the supplier portal had no write access to the ledger"
  source: "chat + implementation 2026-09-08"
  affects: [supplier-advance-ledger]

- time: 2026-09-08T18:26:08
  kind: evidence
  summary: "Supplier-portal ledger writes were silently rejected by RLS: bills marked paid with no deduction row"
  source: "session 2026-09-08, migration 51"
  affects: [supplier-advance-ledger, rls-is-the-authority]

- time: 2026-09-08T23:03:05
  kind: decision
  summary: "An advance now settles a bill as far as it goes; consumption rows name their bill so the arithmetic stays honest"
  source: "chat + implementation 2026-09-08"
  affects: [supplier-advance-ledger]

- time: 2026-09-08T23:03:05
  kind: reversal
  summary: "All-or-nothing deduction overturned: 400 of credit against a 1,000 bill now takes the balance to zero and leaves 600 owing"
  source: "owner report 2026-09-08, migration 52"
  affects: [supplier-advance-ledger, supplier-auto-billing]
