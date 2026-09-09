---
id: supplier-material-catalog
title: "Supplier price list is a typing shortcut, not a constraint"
category: decision
status: active
tags: [supplier, materials, ux]
created: "2026-09-09T11:35:44"
updated: "2026-09-09T11:36:11"
---

<!-- compiled_truth -->
Suppliers were retyping the same material, unit and rate on every delivery, because a delivery row *is* the material record — `materials` carries its own free-text `name`, and there was never a material master table.

**The decision:** `supplier_materials` (54_supplier_material_catalog.sql) is an admin-managed price list per supplier, and it is **deliberately not a foreign key** from `materials`. It feeds one-tap quick picks above the Record Delivery form and nothing else.

Why it stays a shortcut rather than a constraint:

- `materials.name` / `unit` / `unit_cost` remain free text, so removing a price-list entry never orphans or rewrites a past delivery, and a supplier can always deliver something nobody listed.
- The prefilled rate is **editable**. Rates move (cement, diesel); locking the field would block a delivery until the office got around to an edit, and deliveries are reviewed anyway.
- Quick picks fall back to the supplier's own history, ranked by how often they record a material, so the feature works on day one with an empty price list.

**Ranking lives in two places on purpose.** `lib/materialQuickPicks.ts` and `materialQuickPicks()` in `android/.../data/Models.kt` are deliberate twins with mirrored test suites — the same supplier must see the same chips in the same order on web and phone. Both require history passed **most-recent-first**; the offered rate and the frequency tie-break both depend on that order, which is why `Repo.supplierMaterials()` gained an explicit `ordered_at desc`.

Unlike [[supplier-advance-ledger]], this table needs **no SECURITY DEFINER RPC**. RLS gives suppliers SELECT only, and nothing on the supplier side ever writes to it, so the silent-write-rejection trap that forced RPCs for advances does not apply here. See also [[supplier-auto-billing]] and [[rls-is-the-authority]].


## Timeline

- time: 2026-09-09T11:35:44
  kind: decision
  summary: "Created this page: Supplier price list is a typing shortcut, not a constraint"
  source: "Supplier portal quick-picks feature, Sep 2026"
  affects: [supplier-material-catalog]

- time: 2026-09-09T11:36:11
  kind: decision
  summary: "Captured why the supplier price list is a prefill rather than a foreign key or a rate lock, and why the ranking is mirrored in TS and Kotlin"
  source: brain update-truth
  affects: [supplier-material-catalog]
