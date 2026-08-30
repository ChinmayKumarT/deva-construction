---
slug: background
title: Project background
role: project background
updated: "2026-08-30T01:25:49"
---

# Project background

## Background — Deva Construction Management Platform

Deva Construction is a **construction management platform** built by a Bangalore-based construction company (Deva Construction / devaconstructions.in) to run its own operations — project tracking, supplier billing, labour attendance, client visibility, and financial oversight.

### Why it exists
The owner needed a single system to replace spreadsheets and WhatsApp coordination for managing multiple construction sites. Every stakeholder — admin, site manager, client, supplier, labourer — gets a role-specific view of the same data, accessible from any phone or browser.

### Target users
- **Admin / Owner** — full financial + operational visibility, approvals, backup, team management
- **Manager** — runs day-to-day site operations (materials, attendance, updates) without seeing company financials
- **Client** — tracks their own project's progress, materials, and payments
- **Supplier** — records deliveries, sees bills, payment status, and advance balance
- **Labour** — checks attendance, sees wage accrual and assigned site

### Core capabilities
- **Multi-project management** — budgets, timelines, completion stages, change orders, budget extensions
- **Material tracking** — ordering, delivery tracking, automatic cost calculation, work-category tagging
- **Daily attendance** — half-day support, automatic wage computation, per-project tracking
- **Payment processing** — supplier bills, labourer wages, batch payments, client payment collection
- **Supplier advance accounts** — advance deposits with automatic deduction on every delivery or bill
- **Reports & analytics** — cash-flow analysis, profit-and-loss, cost tracking with budget alerts, CSV/PDF export
- **Showcase website builder** — add completed projects with photos to generate a public portfolio
- **Role-based team access** — owner, superadmin, admin, manager roles with granular permissions
- **Authentication** — Google sign-in, email/password, magic-link login
- **Platforms** — Next.js web app (Vercel) + native Android app (Kotlin/Jetpack Compose)

### Non-goals
- This is **not a marketplace** — it manages one company's own projects, not a multi-tenant SaaS
- No bidding, no contractor discovery, no public-facing project listings
- Financial reporting is for the owner's internal use, not regulatory compliance
