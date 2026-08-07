# Deva Construction

Role-based construction site management, built as a Next.js web app and a native
Android app sharing one Supabase backend. Admin/manager run the business,
clients track their projects, suppliers manage deliveries and bills, and
labourers are records the site manager maintains (they don't sign in).

- **Web**: Next.js 14 (App Router) + TypeScript + Tailwind, deployed on Vercel
- **Android**: Kotlin + Jetpack Compose, native app talking to the same backend
- **Backend**: Supabase (Postgres + Auth + Storage), all authorization enforced
  by Postgres Row-Level Security — not by app code

---

## 1. Prerequisites

- Node.js 18+ and npm
- A free [Supabase](https://supabase.com) account
- For Android: JDK 17, Android Studio (or just the command-line SDK tools),
  `ANDROID_HOME` pointing at your SDK install
- Optional, only if you want outgoing email (password reset / magic link) to
  actually deliver: a [Resend](https://resend.com) account (or any SMTP
  provider) and a domain you can add DNS records to

## 2. Set up the Supabase project (do this first — both apps depend on it)

1. Create a project at supabase.com. Note its **Project URL** and **anon public
   key** (Project Settings → API) — you'll need both in a minute.
2. Open the **SQL editor** and run every file in `supabase/` **in this exact
   order** (each one depends on the ones before it):

   ```
   schema.sql
   02_domain.sql
   03_storage.sql
   04_account.sql
   05_profiles_staff_access.sql
   06_supplier_deliveries.sql
   07_supplier_bills.sql
   08_owner_admin_approval.sql
   09_project_date_extension.sql
   10_archive.sql
   11_archive_updates.sql
   12_owner_delete.sql
   13_next_payment_date.sql
   14_work_category.sql
   15_retire_labour_self_access.sql
   16_labourer_category.sql
   17_client_wage_totals.sql
   18_oauth_role_pending.sql
   19_client_project_labourers.sql
   20_admin_delete_user.sql
   21_personal_transactions.sql
   22_auto_create_client.sql
   23_client_payments.sql
   24_next_payment_amount.sql
   25_multi_site_attendance.sql
   26_supplier_bills_auto_approved.sql
   ```

   `supabase/README.md` has a one-line description of what each file does if
   you want the detail.

3. **Disable "Confirm email"** in Authentication → Providers → Email while
   developing, unless you want to click a confirmation link for every test
   account you create.
4. **Bootstrap yourself as the owner.** Sign up through the app once (any
   role — the trigger clamps it to `client`), then run this once in the SQL
   editor:
   ```sql
   update public.profiles set is_owner = true, role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
   Exactly one profile should have `is_owner = true`. That person can then
   grant admin/manager to anyone else from the **Team access** screen — nobody
   else can ever self-promote (enforced in Postgres, see §5).

## 3. Run the web app

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# from step 2

npm install
npm run dev
```

Open http://localhost:3000. Verify with `npm test` (Vitest) and
`npx tsc --noEmit` before committing anything.

## 4. Run the Android app

```bash
cd android
cp local.properties.example local.properties
# fill in SUPABASE_URL / SUPABASE_ANON_KEY (same project as the web app —
# they must match or roles/data won't line up between platforms)
```

Open the `android/` folder in Android Studio, or build from the command line:

```bash
./gradlew assembleDebug        # -> app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest
```

## 5. Optional integrations

These aren't needed to run the app locally, only for the features they power.
Full step-by-step instructions (Google Cloud Console screenshots-in-words,
exact redirect URLs, email template HTML) live in **`supabase/README.md`** —
this is just the map of what exists and why:

| Feature | What it needs | Where to set it up |
|---|---|---|
| Google sign-in (web + Android) | One shared "Web application" OAuth client in Google Cloud, plus an **Android**-type client (package + SHA-1) purely so Credential Manager's backend trusts the calling app — the Android client isn't referenced in code | `supabase/README.md` → "Google sign-in setup"; Android needs `GOOGLE_WEB_CLIENT_ID` in `local.properties` too |
| Password reset / magic link | Custom Supabase email templates that route through `/reset-password/confirm` first (see §7) instead of Supabase's default directly-clickable link | `supabase/README.md` → "Password reset setup" / "Magic link setup" |
| Outgoing email delivery | Supabase's built-in sender is rate-limited (testing only) — production needs Custom SMTP (Resend or similar) configured in Project Settings → Auth → SMTP Settings | Any SMTP provider; Resend's free tier works |
| PWA install (Android + iPhone) | Nothing to set up — `app/manifest.ts` and the service worker are already wired. Visit the site in Chrome ("Install app") or Safari (Share → Add to Home Screen) | — |
| Direct APK download | Nothing to set up — `/download` serves `public/downloads/deva-construction.apk` directly. Rebuild and re-copy the APK there after changes if you want the link to stay current | `app/download/page.tsx` |

---

## 6. How the app is organized

```
app/                    Next.js routes (one folder per URL)
  admin/                Admin & manager dashboard + all CRUD pages
  client/  supplier/    Read-mostly dashboards for those roles
  actions/, admin/actions.ts   Server Actions — all writes go through these
components/             Shared React components (admin/Page.tsx has the
                         reusable primitives most admin pages build on)
lib/                    Pure helper functions (money rounding, wages, guard)
supabase/               SQL migrations, run in order (see §2) + supabase/README.md
android/app/src/main/java/com/construction/manager/
  data/                 Repository.kt (all Supabase calls), Models.kt
  ui/                   Screens, shared components, theme
```

## 7. Core logic and business rules

### Roles and the owner model
Five roles: `admin`, `manager`, `client`, `supplier`, `labour`.
- **admin/manager** run the business (manager shares admin's UI, minus a few
  scope differences). Signup can never produce these — `handle_new_user()`
  clamps any requested role to `client`/`supplier` server-side. The **only**
  way a profile becomes admin/manager is the owner-only `set_user_role()` RPC.
- **client/supplier** self-serve at signup, read-only-ish access scoped to
  their own projects/deliveries.
- **labour** are *records*, not app users — a site manager maintains their
  attendance/wages on the admin Attendance screen. The enum value is kept for
  legacy accounts and as a future anchor for biometric attendance hardware,
  but signup no longer offers it and it has zero RLS access
  (`15_retire_labour_self_access.sql`).
- Exactly one profile has `is_owner = true` (bootstrapped by hand, §2 step 4).
  Only the owner can call `set_user_role()` or `admin_delete_user()` —
  enforced by an `is_owner()` check inside the Postgres function itself, so a
  compromised or buggy client can't bypass it. Column-level `UPDATE` on
  `profiles.role`/`is_owner` is revoked from `authenticated` entirely.
- **Google sign-in carries no role metadata.** A fresh Google signup gets
  `role_pending = true` and lands on a role picker (client vs. supplier)
  before reaching any dashboard — resolved by the narrow, self-service,
  one-shot `choose_role()` RPC (`18_oauth_role_pending.sql`).

### Authorization: Postgres RLS, not app code
Every table has Row-Level Security policies — `admin`/`manager` get full
access via `staff_all_*` policies, everyone else is scoped to their own rows
(a client sees only their own projects; a supplier sees only their own
deliveries). This means the security boundary holds even if a UI check is
missing or a raw API call bypasses the app entirely.

### Money and wages
- All money math is rounded to paise at the multiplication boundary
  (`roundMoney`/`lineTotal` in `lib/money.ts`, mirrored in Android's
  `Format.kt`) — floats like `2.5 * 33.33` produce sub-paisa garbage
  otherwise, which then compounds across totals.
- Wage weighting: `present` = full daily wage, `half_day` = 50%, `absent` =
  0% (`WAGE_FACTOR` in `lib/wages.ts`).
- A project's "Spent" = materials (`quantity × unit_cost`, excluding returned
  items) + labour payments (`payee_type = 'labour'`, status paid/approved) +
  attendance-accrued wages. Supplier payments are **not** added — they settle
  material costs already counted, so including them would double-count.
- Clients see a project's wage **total** via the security-definer
  `my_project_wage_totals()` RPC, and (as of `19_client_project_labourers.sql`)
  **which labourers** worked their project — but never individual wage
  figures. Clients have no direct access to the `attendance`/`labourers`
  tables at all.

### Archive vs. permanent delete
"Delete" in the UI is almost always a reversible **archive** (`archived_at`
timestamp) — the foreign keys cascade, so a real `DELETE` on a project would
destroy every material/payment/update row tied to it, contradicting the
retention promise in the privacy policy. Two things are genuinely permanent:
`owner_delete_row()` (owner-only, whitelisted tables) and
`admin_delete_user()` (owner-only account deletion — deletes only the login;
`profiles`/`clients`/`suppliers`/`labourers` FKs are `on delete cascade`/
`set null` so business records survive).

### Auth flows
- **Password / Google / magic link** all funnel through `/auth/callback`,
  which exchanges the PKCE `code` and redirects by role.
- **Password reset and magic link emails are prefetch-safe.** Gmail/Outlook
  silently pre-fetch links in emails to scan them, which — with Supabase's
  *default* directly-clickable link — burns the one-time token before the
  user ever clicks (`error=access_denied&error_code=otp_expired`). Both email
  templates instead point at `/reset-password/confirm`, which only calls
  `verifyOtp` after an explicit button tap. That page also detects an Android
  `redirect_to` and hands the *unconsumed* token off to the app's deep link
  instead of consuming it in the browser.
- Session cookies are kept fresh on every request by `middleware.ts`.

### Web ↔ Android parity
Every feature is built on both platforms in the same pass — same RLS
policies, same wage math, same role rules. `Repository.kt` is Android's
equivalent of the Next.js Server Actions: every Supabase call goes through it.

---

## 8. Deployment

- **Web**: pushing to `main` auto-deploys via Vercel (already connected).
  Push to both `origin` (deva_demo, live) and `backup` (deva-construction
  mirror) remotes.
- **Android**: `./gradlew assembleRelease` once `RELEASE_STORE_*` is filled in
  `local.properties` (generate the keystore once, back it up outside the
  repo — losing it means you can never update the app on Play Store). For
  casual sharing without Play Store, `/download` on the web app serves the
  debug APK directly.
