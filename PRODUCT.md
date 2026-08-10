# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Five roles, enforced by Postgres RLS (not app code):

- **admin/manager** — run the business day-to-day: projects, materials, labour, payments, suppliers, team access, reports. Manager shares admin's UI minus a few scope differences. Exactly one profile has `is_owner = true` (the actual business owner, Bangalore-based); only that person can grant admin/manager to anyone else.
- **client** — self-serve signup, scoped to their own project(s): progress, wage totals (never individual wage figures), payments.
- **supplier** — self-serve signup, scoped to their own deliveries and bills.
- **labour** — records only, not app users. A site manager maintains their attendance/wages; they never sign in.

## Product Purpose

Role-based construction site management: plan, track, and hand over projects from one platform, replacing spreadsheets and manual tracking with logged materials, labour, payments, and per-project budget/spend visibility. Today it runs as Deva Construction's own internal system for its own sites.

## Positioning

**Currently single-tenant.** The schema and RLS model assume one company — a single owner-bootstrapped account, no per-tenant data isolation. There is no concept of "which company" a row belongs to; it's all Deva Construction's own data.

**Stated ambition, not yet built:** the owner wants to eventually offer this as a product other construction companies could use. This is an open, undecided direction — multi-tenancy (data isolation between companies, per-tenant branding/subdomain, billing, etc.) does not exist today and needs real design and engineering work before any external company could use it. Do not design or build as if tenant isolation already exists; treat "internal tool for us" as the only confirmed scope until that decision is made concrete.

Differentiation vs. a generic project-tracker or spreadsheet, if/when this becomes a product:
- Authorization lives in Postgres RLS, not app code — the security boundary holds even if a UI check is missing or an API call bypasses the app entirely.
- A single owner-controlled role-grant model: nobody can self-promote to admin/manager; enforced inside a security-definer Postgres function.
- Paise-accurate money math and a project "Spent" figure that never double-counts (supplier payments settle material costs already counted, so they're excluded).
- Archive-by-default deletes preserve the audit trail; only two owner-only operations are genuinely permanent.
- A native Android app (Kotlin/Compose) with full feature parity to web, not a wrapped webview.

## Operating Context

- Admin/manager work from the field or office, on web or the native Android app, day to day.
- Clients and suppliers check in remotely — web, installed PWA, or Android — each scoped to only their own project/deliveries.
- Labourers never sign in; a site manager records their attendance and wages on the admin Attendance screen.
- Materials, labour, attendance, and payments are the daily-use records; Costs/Reports/Cashflow are periodic review surfaces.
- Deployment: web on Vercel (auto-deploys from `main`, pushed to both `origin`/deva_demo and `backup`/deva-construction remotes); Android via Play Store release build or a direct APK download at `/download`; PWA install works on Android and iPhone with no extra setup.

## Capabilities and Constraints

- All money math rounds to paise at the multiplication boundary (`roundMoney`/`lineTotal` on web, mirrored in Android's `Format.kt`) to avoid float drift compounding across totals.
- Wage weighting: `present` = full daily wage, `half_day` = 50%, `absent` = 0%.
- A project's "Spent" = materials (`quantity × unit_cost`, excluding returned items) + labour payments (paid/approved) + attendance-accrued wages. Supplier payments are excluded to avoid double-counting.
- "Delete" in the UI is almost always a reversible archive (`archived_at`); genuine permanent delete is limited to two owner-only Postgres functions.
- Every feature ships to both web and Android in the same pass, with matching RLS policies, wage math, and role rules — a feature present on only one platform is treated as a bug, not a backlog item.
- Google sign-in carries no role metadata; a fresh Google signup is routed through a one-shot role picker (client vs. supplier) before reaching any dashboard.
- Undecided: multi-tenancy (see Positioning) — no per-company boundary exists in the schema today.

## Brand Commitments

- Name: **Deva Construction** (not "Construction Manager") — used consistently across web and Android UI text, titles, and docs. The Android `applicationId`/package (`com.construction.manager`) is intentionally left unchanged to match; that's a separate, more invasive decision requiring its own confirmation.
- Shared palette across web and native Android: brand blue (`#7DA3D6` family), near-black "Forest" (`#242424`), cream (`#E8E1DA`), ink (`#232323`). Android explicitly disables Material You dynamic color so the brand palette doesn't vary per device.
- Fraunces serif is used on the web showcase page.
- Owner is Bangalore-based; conversational voice for this project speaks as the owner ("my company", "my site", "my team") rather than a third-party assistant describing someone else's business.
- Logo asset at `LOGO.png` (repo root).

## Evidence on Hand

- `app/showcase/page.tsx` (untracked, in progress) — a marketing page with stats ("40+ Projects delivered", "12 Site teams") and named projects ("Meridian Row", "Foundry Street"). **Confirmed placeholder, not real** — future work must not treat these as factual company history or reuse them as evidence; replace with real figures/projects before this page is genuinely public-facing.
- No testimonials, case studies, press, pricing, or customer evidence exists. Do not fabricate any.

## Product Principles

1. The security boundary lives in Postgres RLS, not the UI — every screen must assume a hostile or buggy client can't escalate access.
2. Every feature ships to web and native Android together, in the same pass, with matching business rules.
3. Money and audit-trail integrity over convenience: paise-accurate rounding, no double-counted spend, archive-first deletes.
4. The product is single-tenant for Deva Construction's own operations today; "sell to other companies" is a real but explicitly undecided direction — don't design as if tenant isolation already exists.
5. Roles get exactly the access their job needs: admin/manager run the business, clients/suppliers see only their own slice, labour are records, not users.
