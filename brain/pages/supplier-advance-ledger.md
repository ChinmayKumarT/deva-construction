---
id: supplier-advance-ledger
title: Supplier advances use a ledger-based account system
category: decision
status: active
created: "2026-08-30T01:25:58"
updated: "2026-08-30T01:26:09"
updated: "2026-09-08T17:15:37"
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
1. **At delivery** (`deductFromSupplierAdvance`): consumed only when the balance covers the WHOLE delivery (`if (balance < cost) return false`). A partial deduction would double-count -- the credit spent while the bill still showed its full amount owing. Left alone it stays as credit, and the true position is (outstanding - advanceBalance).
2. **When an advance is given** (`settleOutstandingFromAdvance`): walks outstanding bills oldest-first and settles each one the credit fully covers, flipping it to paid and writing the matching negative row.

Rule 2 exists because rule 1 alone left the numbers stranded: give an advance AFTER a bill was raised and nothing reconciled them. Real case on 2026-09-08 -- supplier s2, bill 100 at 08:02:15, advance 500 at 08:02:36, and 19 minutes before the fix shipped. The ledger showed +500 with no consumption and the bill sat `approved` indefinitely.

**Reversal history matters here.** For a few hours the rule was "always deduct the full cost, let the balance go negative, a negative balance is what we owe". That was wrong: it stated the same debt twice -- an unpaid bill AND a negative balance -- and for a supplier with no advance it made both Total paid and Remaining fiction. Migration 50 repaired the data. See the timeline.

`deleteSupplierAdvance` removes a mistaken advance, but refuses when the balance cannot absorb it, because that money has already settled bills.

Related: [[supplier-auto-billing]], [[rls-is-the-authority]]


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
