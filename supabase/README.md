# Database setup

Run these in the Supabase SQL editor **in order**:

1. `schema.sql` — `profiles` table, role enum, signup trigger.
2. `02_domain.sql` — projects, clients, suppliers, labourers, materials, payments, attendance, project_updates, plus RLS.
3. `03_storage.sql` — `project-images` storage bucket with public read + authenticated write.
4. `04_account.sql` — `delete_my_account()` RPC for self-service account deletion (required by Play Store).
5. `05_profiles_staff_access.sql` — lets admin/manager read all `profiles` (needed for the "Link to login" dropdowns on the Clients/Suppliers admin pages).
6. `06_supplier_deliveries.sql` — lets suppliers self-record material deliveries against any project.
7. `07_supplier_bills.sql` — lets suppliers submit pending bills (payments) for their own deliveries.
8. `08_owner_admin_approval.sql` — closes self-serve admin/manager signup. See "Owner model" below.
   Includes a one-time bootstrap you must run by hand afterwards.
9. `09_project_date_extension.sql` — adds `original_end_date`/`extension_reason` to `projects`
   and a trigger that stamps `extension_updated_at` whenever `end_date` changes, so clients can
   see when a project's finish date has slipped from what was originally planned.
10. `10_archive.sql` — soft-delete: `archived_at` on the domain tables so "delete" is a
    reversible archive (the FKs cascade, so a hard delete would wipe history).
11. `11_archive_updates.sql` — `archived_at` on `project_updates` too.
12. `12_owner_delete.sql` — `owner_delete_row()` RPC: permanent, owner-only hard delete
    (whitelisted tables), the one genuinely irreversible action.
13. `13_next_payment_date.sql` — `next_payment_date` on `projects`, shown to the client.
14. `14_work_category.sql` — `work_category` on `materials` and `payments` for the
    "Spend by work category" report (fixed trade list, see `lib/workCategories.ts`).
15. `15_retire_labour_self_access.sql` — drops the six labourer self-access policies and
    stops signup minting `labour` accounts. Labourers are records the site manager maintains,
    not app users. See "Roles" below.
16. `16_labourer_category.sql` — `category` (trade) on `labourers`, same fixed list as #14.
17. `17_client_wage_totals.sql` — `my_project_wage_totals()`, a security-definer RPC that
    returns per-project attendance-wage **totals** scoped to the calling client's own projects
    (no per-labourer detail), so a client's "Spent" matches the admin's without exposing the
    attendance table.

## Entity map (matches the diagram)

| Diagram label                  | Table(s)                                  |
| ------------------------------ | ----------------------------------------- |
| Projects / sites               | `projects`                                |
| Clients / Suppliers / Labour   | `clients`, `suppliers`, `labourers`       |
| Material info / stock          | `materials`                               |
| Cost tracking / Total Cost     | `projects.total_cost` + `materials`       |
| Payments / pending / approval  | `payments` (status pending→approved→paid) |
| Attendance monitoring          | `attendance`                              |
| Current site / Assigned site   | `project_labourers`                       |
| Images of work / Recent updates| `project_updates`                         |
| Bill generation                | `payments` where `payee_type = 'supplier'`|
| Weekly wages                   | aggregate `attendance` × `labourers.daily_wage` |

## RLS summary

- **admin / manager** → full read+write everywhere.
- **client** → own profile, own projects, updates/materials/payments on those projects (read-only).
- **supplier** → own profile, materials they supply, payments to them (read-only).
- **labour** → no data access. As of `15_retire_labour_self_access.sql` the labourer
  self-access policies are gone: labourers are records the site manager maintains, not app
  users. The role still exists (see "Roles") but a labour account can read nothing.

## Roles

Labourers do **not** sign in. A site manager records their attendance and wages, and only
admin/manager hold labour information (attendance is expected to come from biometric hardware
later, writing straight into `attendance`). The `labour` enum value is kept so any pre-existing
account still resolves to a route instead of breaking, and so `labourers.profile_id` remains a
valid anchor for future biometric identity linking — but signup no longer offers it and
`handle_new_user()` maps a requested `labour` role to `client`.

## Owner model

Signup can only ever produce `client` or `supplier` — `handle_new_user()`
(rewritten by `08_owner_admin_approval.sql`, updated by `15_retire_labour_self_access.sql`)
clamps any other requested role to `client`.
Nobody can self-promote either: column-level `UPDATE` privilege on `profiles.role` and
`profiles.is_owner` is revoked from `authenticated` entirely, so no RLS policy (present or
future) can write those columns. The **only** way a row becomes `admin` or `manager` is the
`set_user_role(target_id, new_role)` RPC, which checks `is_owner()` itself and raises an
exception for everyone else.

Exactly one profile should have `is_owner = true`. Bootstrap it once, by hand, after that
person has signed up through the app:

```sql
update public.profiles set is_owner = true, role = 'admin'
where id = (select id from auth.users where email = 'the-owner@example.com');
```

The owner then grants admin/manager to anyone else from the Android app's **Team access**
screen (visible only to them), which calls `set_user_role`.

## Linking auth users to entities

A `profiles` row is created on signup with the chosen role. To wire a profile to its domain row, set `profile_id = profiles.id` on the matching `clients` / `suppliers` row (labourers don't sign in, so their `profile_id` stays null for now). Until that link is set, the user can sign in but RLS will return empty results — admin must create the linking row.

We can automate that later (e.g., a server action that creates the domain row at the moment admin invites a user).

## Google sign-in setup

The code (web's "Continue with Google" button, Android's Credential Manager flow) is already
wired up and pushed. It won't work until this one-time external setup is done — none of it can
be done from here, it all requires your own Google Cloud and Supabase dashboard access.

1. **Google Cloud Console** (https://console.cloud.google.com/apis/credentials), same project for both steps below:
   - **APIs & Services → OAuth consent screen**: configure it if you haven't (app name, support email, scopes — email/profile/openid are enough).
   - **Credentials → Create credentials → OAuth client ID → Web application.** This is the
     *one* client ID both platforms share.
     - **Authorized redirect URIs**: add `https://<your-project-ref>.supabase.co/auth/v1/callback`
       (find `<your-project-ref>` in `NEXT_PUBLIC_SUPABASE_URL`). This is Supabase's own callback,
       not the app's — leave it as the only redirect URI on this client.
     - Save. Copy the **Client ID** and **Client secret**.
2. **Supabase Dashboard → Authentication → Providers → Google**: paste the Client ID and Client
   secret from step 1, enable the provider, save.
3. **Supabase Dashboard → Authentication → URL Configuration**: add your app's own callback to
   **Redirect URLs** (not the Google Cloud one from step 1) — `http://localhost:3000/auth/callback`
   for local dev and `https://<your-vercel-domain>/auth/callback` for production. This is where
   `app/auth/callback/route.ts` lives.
4. **Android**: put the *same* Web application Client ID from step 1 into
   `android/local.properties` as `GOOGLE_WEB_CLIENT_ID=...` (same file that already holds
   `SUPABASE_URL`/`SUPABASE_ANON_KEY`; gitignored, never committed). Credential Manager uses it
   as the audience the Google ID token must match — no separate "Android" OAuth client or SHA-1
   registration is needed for this flow.

Once steps 1–3 are done, web sign-in works immediately (no rebuild needed — it's server-side
config only). Step 4 needs an Android rebuild to take effect.

## Password reset setup

Code is already wired on both platforms (forgot-password → email link → set new password).
Two external steps, same dashboard as above:

1. **Supabase Dashboard → Authentication → URL Configuration**:
   - **Site URL**: set this to your production domain (e.g. `https://deva-demo.vercel.app`).
     This is a *different* field from Redirect URLs below — it's the base Supabase uses to
     build `{{ .SiteURL }}` in email templates. Leaving it on the default `http://localhost:3000`
     means every email link points at localhost regardless of what's in Redirect URLs.
   - **Redirect URLs**: add these three (the first two are the same ones from the Google setup
     above, reused, so only the third is new if you've already done that):
     - `http://localhost:3000/auth/callback` (local dev)
     - `https://<your-vercel-domain>/auth/callback` (production)
     - `com.construction.manager://reset-password` (Android — this exact scheme+host is what
       `Supabase.kt`'s Auth config and the `AndroidManifest.xml` intent-filter both use; Supabase
       requires every redirect target on this allowlist regardless of whether it's http(s) or a
       custom scheme, so this one won't work until it's added here too).

2. **Supabase Dashboard → Authentication → Email Templates → Reset Password**: replace the
   default template's link with one that points at our own confirm page instead of Supabase's
   directly-clickable verify link:
   ```html
   <h2>Reset Password</h2>
   <p>Follow this link to reset the password for your user:</p>
   <p><a href="{{ .SiteURL }}/reset-password/confirm?token_hash={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}">Reset Password</a></p>
   ```
   **Why**: Supabase's default template links straight to its own `/auth/v1/verify` endpoint,
   which consumes the one-time recovery token as soon as it's fetched. Gmail and Outlook both
   prefetch links in emails to scan them for safety *before* the user clicks — which silently
   burns the token, so by the time the user taps the link it's already expired
   (`error=access_denied&error_code=otp_expired`). Landing on `/reset-password/confirm` first and
   only verifying the token after an explicit button tap (see `app/reset-password/confirm/page.tsx`)
   avoids that, since scanners don't run JavaScript or click buttons. This template is shared by
   both platforms — the confirm page detects an Android `redirect_to` and hands the unconsumed
   token off to the app's deep link instead of verifying it in the browser.

## Magic link setup

Code is already wired on both platforms ("Sign in with a magic link" on web, "Magic link
instead" on Android) — no new external setup if you've already done the Password reset setup
above, since magic link reuses the exact same redirect URLs (web's `/auth/callback`, Android's
`com.construction.manager://reset-password`). Email auth (on by default) is all magic link
needs from the Supabase side; there's no separate provider toggle like Google's.

Android reuses the password-recovery deep link rather than a second one, since the OTP
provider in this app's Supabase Kotlin SDK version has no per-call redirect override —
`MainActivity` tells the two flows apart via the imported session's own `type` field
(`"recovery"` vs anything else), not the URL.
