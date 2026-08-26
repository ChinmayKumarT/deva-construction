---
id: no-api-layer
title: "No REST/GraphQL API — both clients talk directly to Supabase"
category: decision
status: active
created: "2026-08-26T17:45:42"
updated: "2026-08-26T17:45:42"
---

<!-- compiled_truth -->
Both the Next.js web app and the Android app use the Supabase client SDK to talk directly to PostgreSQL through Supabase's PostgREST layer. There are no custom API endpoints, no REST controllers, no GraphQL resolvers.

**Why**: the app is a single-company tool, not a platform. Supabase's RLS + SDK gives us auth, permissions, and CRUD without maintaining a middle tier. Server Actions handle web-side mutations; the Android app uses the Kotlin SDK for the same operations.

**Consequence**: any new feature must work through Supabase's query builder. Complex aggregations are done client-side in the page component (e.g., `lib/cashflow.ts`, `lib/wages.ts`), not in SQL views or stored procedures.


## Timeline

- time: 2026-08-26T17:45:42
  kind: decision
  summary: "Created this page: No REST/GraphQL API — both clients talk directly to Supabase"
  source: code review
  affects: [no-api-layer]

- time: 2026-08-26T17:45:42
  kind: decision
  summary: "Direct Supabase SDK calls, no custom API"
  source: code review
  affects: [no-api-layer]
