---
id: delete-cascade-traps
title: Two schema traps that break permanent delete
category: reference
status: active
created: "2026-09-08T17:16:46"
updated: "2026-09-08T17:16:46"
---

<!-- compiled_truth -->
Two traps that made a permanent delete either impossible or quietly destructive. Both bit on the same day.

**1. `ON DELETE SET NULL` versus the payments CHECK.** `payments.supplier_id` and `payments.labourer_id` are `ON DELETE SET NULL`, but the same row carries a CHECK (02_domain.sql):

    (payee_type = 'supplier' and supplier_id is not null and labourer_id is null) or
    (payee_type = 'labour'   and labourer_id is not null and supplier_id is null)

So deleting a supplier or labourer nulls the column and immediately trips the check. The delete **can never succeed on its own** once they have a single bill or wage payment. `ownerDeleteRow` therefore removes the linked payments first. Symptom before the fix: a redacted 500 -- see [[production-error-visibility]].

**2. The `billed` flag and vanishing costs.** `lib/cashflow.ts` skips any material flagged `billed`, because its cost is counted through the supplier payment instead. Delete that payment without clearing the flag and the cost disappears from cash flow and the cost reports altogether -- the delivery still happened and was still paid for, so the site simply looks cheaper than it was.

Anything that deletes a supplier bill must reset `billed = false` on the linked material. Anything that creates one must set `billed = true` only AFTER the insert succeeds.

**On the product side**: permanent delete now warns with the real figures -- the number of bills, their total, and that cash flow, P&L and cost reports will move -- rather than refusing. Archiving remains the option that keeps history, and is what "delete" usually means to the person clicking it.

Related: [[supplier-auto-billing]]


## Timeline

- time: 2026-09-08T17:16:46
  kind: decision
  summary: "Created this page: Two schema traps that break permanent delete"
  source: session 2026-09-08
  affects: [delete-cascade-traps]

- time: 2026-09-08T17:16:46
  kind: decision
  summary: "The payments CHECK vs SET NULL trap, and the billed flag"
  source: "session 2026-09-08, commit a80e20e"
  affects: [delete-cascade-traps]
