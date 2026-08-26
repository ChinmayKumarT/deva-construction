---
slug: stack
title: Tech stack
role: tech-stack choices
updated: "2026-08-26T17:43:33"
---

# Tech stack

## Stack

| Domain | Choice | Rationale |
|---|---|---|
| Web framework | Next.js 16 (App Router, React 18) | Server Components + Server Actions = no API layer to maintain |
| Styling | Tailwind CSS 3 | Utility-first, no component library overhead |
| Backend | Supabase (PostgreSQL 15, Auth, Storage) | Managed Postgres with RLS, auth, and real-time out of the box |
| ORM / query | `@supabase/supabase-js` + `@supabase/ssr` | Direct SDK calls, no ORM — keeps the codebase thin |
| Android | Kotlin + Jetpack Compose + Material 3 | Modern declarative UI, matches the web-first design |
| Android auth | Google Credential Manager + Supabase Kotlin SDK | Native sign-in flow, same Supabase backend |
| PDF generation | jsPDF + jspdf-autotable | Client-side invoice and report PDFs |
| Excel export | exceljs | Replaced SheetJS (xlsx) to clear unfixable CVEs |
| Build / deploy | Vercel (web), manual APK (Android) | Auto-deploys on push to `deva_demo` repo |
| Testing | Vitest | Unit tests for pure business logic (money, wages, attendance, CSV) |
| Security scanning | Semgrep, Gitleaks, npm audit | Local scans; findings addressed in committed fixes |
| Backup | GitHub Actions workflow | Daily Supabase data export to Excel, pruned to last 30 |
| Version control | Two remotes: `origin` (deva-construction) + `backup` (deva_demo / ChinmayKumarT) | Every push goes to both; backup auto-deploys to Vercel |
