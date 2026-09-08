---
id: dev-database-separation
title: "deva-dev is the test database; production is not for seeding"
category: project
status: active
created: "2026-09-08T17:16:30"
updated: "2026-09-08T17:16:30"
---

<!-- compiled_truth -->
**What happened.** `test_data.sql` was written and run when production was the only Supabase project. It seeded 8 clients, 6 suppliers, 24 labourers, 12 projects, 29 materials and 44 payments straight into the live database, alongside 13 real projects and 127 real client payments. Cash flow, P&L and cost reports included fake sites for over a week. Cleaned out on 2026-09-08 by prefix-matched deletes; no real record was attached to a test project, so nothing genuine was lost.

**The setup now:**

- **production** `iaypfgmovbfmrjumgbpu` -- real business data.
- **deva-dev** `wcxlwxewdtevenqokhje` -- free second project, full schema plus the seed. Working copy at `D:\deva_app_test`, its own `.env.local`.

**How the seed stays safe.** Every seeded row uses a fixed id prefix -- clients `a0000001-`, suppliers `b0000001-`, labourers `c0000001-`, projects `d0000001-`, materials `e0000001-`, payments `fa000001-`/`fb000002-`, client payments `fc000001-`. Real rows use random UUIDs and cannot collide. `test_data.sql` opens by deleting exactly those prefixes, so it is re-runnable, and the same block doubles as the removal script if the seed ever lands somewhere it should not.

`supabase/setup_all.sql` concatenates schema.sql + 02..49 for standing up a fresh project in one paste. It is **generated** -- re-run `bash supabase/build-setup-all.sh` after adding a migration or it silently goes stale, which is the same class of problem it exists to solve.

**Vercel scoping still matters.** Environment variables default to all environments, so production credentials left unscoped mean every preview deployment writes to live data. Production values belong to the Production environment only.

**A trap worth remembering**: `NEXT_PUBLIC_*` values are compiled into the bundle at build time, including for server code. Changing them in the Vercel dashboard does nothing until a fresh build runs with the cache off.


## Timeline

- time: 2026-09-08T17:16:30
  kind: decision
  summary: "Created this page: deva-dev is the test database; production is not for seeding"
  source: session 2026-09-08
  affects: [dev-database-separation]

- time: 2026-09-08T17:16:30
  kind: decision
  summary: "Second Supabase project for testing, after test data reached production"
  source: session 2026-09-08
  affects: [dev-database-separation]
