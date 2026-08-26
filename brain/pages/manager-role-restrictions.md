---
id: manager-role-restrictions
title: "Managers see operations, not financials"
category: decision
status: active
created: "2026-08-26T17:45:08"
updated: "2026-08-26T17:45:08"
---

<!-- compiled_truth -->
Site managers run the work, not the books. As of Aug 2026, the manager role is restricted from:

- **Reports, Cash Flow, P&L** — entire Insights nav group hidden + route guards + RLS (`is_admin()`)
- **Cost tracking** — `/admin/costs` guarded, project budget/spent/remaining cards hidden
- **Personal transactions** — nav hidden + route guard + RLS policy narrowed to admin-only (migration 39)
- **Overview money metrics** — Total Cost, Spending, Pending Payments cards hidden on the dashboard
- **Project budget fields** — total_cost hidden from create/edit forms; `updateProject` only writes total_cost when the field is present (prevents zeroing)

The restriction is layered: nav hiding → server-side `if (role === 'manager') redirect('/admin')\ → RLS policy. All three must agree.

Related: [[rls-is-the-authority]]


## Timeline

- time: 2026-08-26T17:45:08
  kind: decision
  summary: "Created this page: Managers see operations, not financials"
  source: git log e971760..187054c
  affects: [manager-role-restrictions]

- time: 2026-08-26T17:45:08
  kind: decision
  summary: Manager role restricted from all financial views and data
  source: git log
  affects: [manager-role-restrictions]
