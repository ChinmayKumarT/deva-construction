---
slug: flow
title: Key flows
role: key flows
updated: "2026-08-26T17:43:51"
---

# Key flows

## Flow — Supplier delivery to payment

The most important end-to-end path: a supplier delivers materials, and the money shows up on the admin's books.

```mermaid
sequenceDiagram
    participant S as Supplier
    participant DB as Supabase (RLS)
    participant A as Admin

    S->>DB: recordDelivery(project, material, qty, unit_cost)
    Note over DB: INSERT materials (status=delivered, billed=true)
    DB-->>DB: Auto-INSERT payments (status=approved, material_id=↑)
    Note over DB: Bill appears instantly — no second form

    A->>DB: GET /admin/suppliers/[id]
    DB-->>A: Shows Remaining ₹X, list of pending/approved bills

    A->>DB: markPaymentPaid(payment_id)
    Note over DB: UPDATE payments SET status=paid, paid_at=now()
    DB-->>A: Remaining drops, bill shows "paid" badge

    Note over A: /admin/payments Purchase picker<br>only shows materials where billed=false<br>→ auto-billed deliveries never appear
```

### Other key flows
- **Attendance → wage accrual**: staff marks attendance (present/half_day/absent) → `wageForStatus()` computes daily wage → accrued wages show on overview and reports
- **Client project visibility**: client signs in → RLS filters to projects where `client_id` matches → client sees progress, materials, payments on their own sites
- **Admin approval chain**: supplier bill lands as `approved` (auto) → admin marks paid → payment moves to `paid` status → shows in cash flow and P&L
- **Backup**: GitHub Actions cron → hits Supabase API → exports all tables to Excel → commits to repo → prunes old backups
