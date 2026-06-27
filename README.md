# Construction Manager

Role-based dashboards for a construction site management app.

## Stack
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase auth + Postgres (with RLS)

## Setup

1. Create a Supabase project at https://supabase.com.
2. In the SQL editor, run `supabase/schema.sql` to create the `profiles` table, role enum, RLS policies, and the auto-insert trigger.
3. Copy your project URL and anon key:
   ```bash
   cp .env.local.example .env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
4. Install and run:
   ```bash
   npm install
   npm run dev
   ```
5. Open http://localhost:3000 → "Create an account" → pick a role → sign in.

> Disable "Confirm email" in Supabase Auth settings while developing if you don't want to verify each test account.

## How auth works
- `app/page.tsx` is the sign-in / sign-up form (server actions in `app/actions/auth.ts`).
- On sign-up, the trigger in `schema.sql` inserts a `profiles` row with the chosen role.
- After sign-in, the user is redirected to `/{role}`.
- Each `/{role}` page calls `requireRole(...)` which checks the session and the `profiles.role` column. Mismatches bounce to the correct dashboard.
- `middleware.ts` keeps the session cookies fresh on every request.

## Roles & dashboards
- **admin** — projects, clients, suppliers, labour, payments, reports
- **manager** — same as admin minus user/supplier creation scope
- **client** — read-only progress, cost, payments
- **supplier** — deliveries, bills, payment status
- **labour** — attendance, current site, wages

## Next steps
- Add a Postgres schema for `projects`, `clients`, `suppliers`, `labourers`, `materials`, `payments`, `attendance` (with RLS).
- Replace the `—` metric placeholders with real queries in each dashboard.
- Add admin-only screens for creating projects/clients/suppliers/labourers.
