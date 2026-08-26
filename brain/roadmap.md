---
slug: roadmap
title: Roadmap
role: milestones
updated: "2026-08-26T22:51:49"
---

# Roadmap

## Roadmap

```mermaid
gantt
    title Deva Construction — delivered milestones
    dateFormat YYYY-MM-DD
    section Foundation
    Core schema + RLS + auth              :done, 2025-01-01, 2025-02-01
    Admin dashboard + CRUD                :done, 2025-02-01, 2025-03-01
    Role portals (client/supplier/labour) :done, 2025-03-01, 2025-04-01
    section Operations
    Attendance + wage accrual             :done, 2025-04-01, 2025-05-01
    Reports + CSV/PDF export              :done, 2025-05-01, 2025-06-01
    Budget alerts + P&L + Cash flow       :done, 2025-06-01, 2025-07-01
    section Android
    Full Android parity (Kotlin/Compose)  :done, 2025-04-01, 2025-07-01
    section Security & polish
    Security hardening (Semgrep, audit)   :done, 2025-07-01, 2025-08-01
    Next.js 15 → 16 migration             :done, 2025-08-01, 2025-08-15
    section Recent
    Showcase / website management         :done, 2026-07-01, 2026-08-01
    Manager role restrictions             :done, 2026-08-25, 1d
    Supplier auto-billing                 :done, 2026-08-26, 1d
    Mark paid button on supplier detail   :done, 2026-08-26, 1d
    Budget extensions (web + Android)     :done, 2026-08-26, 1d
    Client payments tracking              :done, 2026-08-26, 1d
    Project detail page redesign          :done, 2026-08-26, 1d
    Supplier "Total paid" on all views    :done, 2026-08-26, 1d
    Pre-assign roles by email             :done, 2026-08-26, 1d
    Superadmin role (web + Android)       :done, 2026-08-26, 1d
```

> **Note**: Exact dates are approximate — reconstructed from git history. The gantt shows the order and rough timeline of major capability drops.

All SQL migrations (up to 44) have been applied to production as of 2026-08-26.

### Known pending work

- **Android: Mark paid button on supplier detail** — web has it, Android supplier detail still shows read-only Pending/Received pair
- **Android: Client payments on project detail** — web shows client payment history on the project page, Android doesn't yet
- **Android: Project detail page redesign** — web got a hero + two-column layout, Android still has the old flat layout
