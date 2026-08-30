---
id: supplier-advance-ledger
title: Supplier advances use a ledger-based account system
category: decision
status: active
created: "2026-08-30T01:25:58"
updated: "2026-08-30T01:26:09"
---

<!-- compiled_truth -->
Supplier advances are tracked via a single ledger table (supplier_advances). Positive amounts are deposits (advance given), negative amounts are auto-deductions. The balance is the sum of all rows for a supplier. Auto-deduction triggers on five cost paths: createMaterial (when delivered), markMaterialDelivered, createPayment (supplier bills), markPaymentPaid (supplier bills), and supplier self-recording delivery. Each deduction is capped at min(balance, cost) so it never goes negative. The advance form appears on both the supplier detail page and the payments index page. Suppliers can see their advance balance in their own portal.


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
