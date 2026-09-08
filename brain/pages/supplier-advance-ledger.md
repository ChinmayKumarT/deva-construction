---
id: supplier-advance-ledger
title: Supplier advances use a ledger-based account system
category: decision
status: active
created: "2026-08-30T01:25:58"
updated: "2026-09-08T18:26:08"
---


<!-- compiled_truth -->
Supplier advances live in one ledger table, `supplier_advances`. A positive row is money handed over; a negative row is credit consumed by a bill. **The balance never goes below zero** -- it only ever shows real money given.

**The model, in the owner's words**: an advance is money that has left, so it settles what is owed, and any surplus leaves you in credit.

**One shared derivation.** `lib/supplierAccount.ts` exports `supplierMoney({payments, advances})`, used by the admin supplier list, the supplier detail page and the supplier's own dashboard. These three drifted apart twice before it existed; do not compute these figures anywhere else.

- `advanceBalance` = given - consumed. Never negative.
- `outstanding`    = bills with status pending or approved.
- `remaining`      = `Math.max(0, outstanding - advanceBalance)`. Credit belongs in one place, so surplus shows as advance balance rather than a negative Remaining.
- `lifetimePayment` = given + paidBills - consumed. **The subtraction is load-bearing**: a bill settled out of an advance is marked paid, but that money was already counted when the advance was handed over. Without it, an advance of 1,000 with a 200 bill settled from it reports 1,200.

**When credit is consumed** -- two moments, and only these:
1. **At delivery** (`deductFromSupplierAdvance`, or `deduct_supplier_advance_for_material` from the supplier's own side): consumed only when the balance covers the WHOLE delivery. A partial deduction would double-count -- the credit spent while the bill still showed its full amount owing. Left alone it stays as credit, and the true position is (outstanding - advanceBalance).
2. **When an advance is given** (`settleOutstandingFromAdvance`): walks outstanding bills oldest-first and settles each one the credit fully covers, flipping it to paid and writing the matching negative row.

Rule 2 exists because rule 1 alone left the numbers stranded: give an advance AFTER a bill was raised and nothing reconciled them. Real case on 2026-09-08 -- supplier s2, bill 100 at 08:02:15, advance 500 at 08:02:36, and 19 minutes before the fix shipped. The ledger showed +500 with no consumption and the bill sat `approved` indefinitely.

**When credit comes back** -- deleting the delivery (Sep 2026). Goods off the books must not leave the advance spent, or the balance understates what the supplier is still holding for us. The rule lives in SQL, `refund_supplier_advance_for_material` (51_supplier_advance_rpcs.sql), and every delete path calls it: the admin's archive (after the archive -- nothing to give back if it failed), the owner's permanent delete (*before* the delete, because `supplier_advances.material_id` is `on delete set null` and the link is unrecoverable afterwards), the supplier portal's `archiveDelivery`, and Android's `archiveMaterial` / `deleteMaterialForever`.

Two properties make it safe, and both are why it is one SQL function rather than three ports of the same arithmetic:
- **An offsetting row, never a row deletion.** The supplier page renders the ledger as a statement, so removing the deduction would move the balance with no line explaining it.
- **Idempotent by net.** It refunds the material's *net* position and only while that is still negative. Deleting a delivery and then its bill -- two buttons for what was one event -- returns the money once, in whichever order they are pressed.

**The supplier portal could never write this table, and that was silently wrong.** 47_supplier_advances.sql gives a supplier SELECT and nothing else; `staff_all_supplier_advances` is the only write policy. So the deduction `recordDelivery` attempted from /supplier (and from Android's `recordSupplierDelivery`) was rejected -- the insert's error was never checked -- while the bill written in the same breath was still marked `paid` because the balance covered it. The money left the balance in the app's arithmetic and stayed in it in the table. Widening the policy is not the fix: a supplier who can insert freely can write a POSITIVE row and claim an advance they were never given. Instead two `security definer` functions (51_supplier_advance_rpcs.sql) are the whole of what the portal may do, and both derive the amount from rows already there rather than from the caller. A supplier may only refund a delivery that is actually archived; staff bypass that check because `deleteMaterial` refunds a beat before the row disappears.

**Reversal history matters here.** For a few hours the rule was "always deduct the full cost, let the balance go negative, a negative balance is what we owe". That was wrong: it stated the same debt twice -- an unpaid bill AND a negative balance -- and for a supplier with no advance it made both Total paid and Remaining fiction. Migration 50 repaired the data. See the timeline.

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
