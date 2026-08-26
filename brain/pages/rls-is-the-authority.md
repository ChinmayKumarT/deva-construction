---
id: rls-is-the-authority
title: "RLS is the real permission boundary, not UI hiding"
category: decision
status: active
created: "2026-08-26T17:44:38"
updated: "2026-08-26T17:44:38"
---

<!-- compiled_truth -->
The app enforces permissions at three layers — navigation hiding, server-side route guards (`requireRole()`), and PostgreSQL RLS policies — but **RLS is the authority**. UI hiding is a convenience; the route guard is a safety net; the RLS policy is the wall.

This means every permission change must land an RLS migration (in `supabase/`) before it is considered complete. Hiding a nav item or redirecting from a page without a matching RLS policy is a bug, not a feature.

**Key functions**: `is_staff()`, `is_admin()`, `current_role()` power every policy. The manager restriction work (Aug 2026) added `is_admin()` to distinguish admin from manager at the RLS level.

Related: [[manager-role-restrictions]]


## Timeline

- time: 2026-08-26T17:44:38
  kind: decision
  summary: "Created this page: RLS is the real permission boundary, not UI hiding"
  source: "code + git log"
  affects: [rls-is-the-authority]

- time: 2026-08-26T17:44:38
  kind: decision
  summary: RLS as the single source of truth for permissions
  source: code review
  affects: [rls-is-the-authority]
