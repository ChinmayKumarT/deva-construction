---
id: superadmin-role
title: Superadmin role sits above admin with Team Access
category: decision
status: active
created: "2026-08-26T22:51:15"
updated: "2026-09-26T12:57:49"
---

<!-- compiled_truth -->
**Roles, top down:** superadmin > admin > manager > client/supplier. Superadmin is never self-serve (the signup trigger clamps it); it is granted by SQL or from Team access.

**Owner is a flag, not a role.** `profiles.is_owner` is set once by hand on a fresh database (`update public.profiles set is_owner = true, role = 'superadmin' where id = ...`). Only the owner can call `set_user_role` -- a superadmin who is not the owner sees "only the owner can change roles". Forgetting `is_owner` on a new Supabase project is the first thing that breaks.

**What "superadmin or owner" gates** (`canTeamAccess` in `app/admin/layout.tsx`, `requireOwnerOrSuperadmin()` in `lib/guard.ts`, `is_owner_or_superadmin()` in SQL):
- Team access
- Backup
- Website (showcase projects shown on devaconstructions.in) -- added 2026-09-26, migration 58. Admins and managers no longer see or edit it. RLS on showcase_projects / showcase_photos and a restrictive storage policy on the `showcase/` prefix enforce it.

Related: [[manager-role-restrictions]], [[rls-is-the-authority]]


## Timeline

- time: 2026-08-26T22:51:15
  kind: decision
  summary: "Created this page: Superadmin role sits above admin with Team Access"
  source: implementation 2026-08-26
  affects: [superadmin-role]

- time: 2026-09-26T12:57:48
  kind: decision
  summary: "Superadmin/owner gate covers Team access, Backup and Website"
  source: session 2026-09-26
  affects: [superadmin-role]

- time: 2026-09-26T12:57:49
  kind: decision
  summary: "Website section restricted to superadmin and owner (UI, route guard, RLS migration 58)"
  source: session 2026-09-26
  affects: [superadmin-role]
