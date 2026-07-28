# Deva Construction — Android

Native Android app: **Kotlin + Jetpack Compose + Supabase Kotlin SDK**, built and run
from Android Studio. It talks to the same Supabase project as the web app (same
`profiles` table, same domain tables, same row-level security), so the two stay in sync
without a separate backend.

## Open in Android Studio

1. **File → Open** → select this `android/` folder (not the repo root).
2. Let Gradle sync finish. The first sync downloads dependencies and can take 5–10 minutes.
3. Create `local.properties` next to `settings.gradle.kts` — copy `local.properties.example`
   and fill in:
   ```
   sdk.dir=C\:\\Users\\YOUR_NAME\\AppData\\Local\\Android\\Sdk
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   ```
   `sdk.dir` is normally added by Android Studio. The two Supabase lines you add yourself;
   `app/build.gradle.kts` reads them into `BuildConfig`. Take both from the Supabase
   dashboard (Project Settings → API), and make sure they match the web app's
   `.env.local` so both clients hit the same database.
4. Run the database migrations first if you have not already — see `../supabase/README.md`.
   All eight files, in order, including the one-time owner bootstrap after #8.
5. Run on an emulator or device (▶️ Run 'app').

## Architecture

| Layer | Where | Notes |
| ----- | ----- | ----- |
| Supabase client | `data/Supabase.kt` | One client, Auth + Postgrest + Storage plugins |
| Queries | `data/Repository.kt` | `Repo` object; every database call lives here |
| Models | `data/Models.kt` | `@Serializable` rows matching the Postgres schema |
| Auth state | `ui/AuthViewModel.kt` | `AuthState` = Loading / SignedOut / SignedIn(role) / NeedsLink |
| Routing | `ui/AppNav.kt` | Picks a dashboard from `profiles.role` |
| Theme | `ui/theme/Theme.kt` | Brand green, kept in sync with `tailwind.config.ts` |

Role routing mirrors `lib/guard.ts` on the web: after sign-in the app reads
`profiles.role` for the current user and shows that role's dashboard. There is no
client-side permission logic beyond that — access is enforced by RLS in Postgres, so a
tampered client still cannot read another role's rows.

## What each role gets

- **Admin / manager** (`ui/dashboards/AdminHome.kt`, `AdminScreens.kt`) — drawer with
  Overview, Projects, Clients, Suppliers, Labourers, Materials, Payments, Attendance,
  Project updates, Cost tracking, Reports. Create forms for projects, clients, suppliers,
  labourers, materials and payments; payment approve / reject / mark-paid; mark material
  delivered; daily attendance marking; posting project updates with a photo upload.
  Manager sees the same screens as admin — same as the web, where `/manager` redirects to
  `/admin` and RLS grants both roles identical access.
- **Team access** — an extra drawer entry visible only to the owner (`profiles.is_owner`),
  next to the two above. Lists every signed-up profile and lets the owner set anyone's role,
  including granting or revoking admin/manager. Backed by the `set_user_role()` RPC from
  `08_owner_admin_approval.sql`, which re-checks ownership server-side — this screen is a
  convenience, not the security boundary. Nobody, including admin/manager, can self-signup
  into admin/manager anymore; see "Owner model" in `../supabase/README.md`.
- **Client** — own projects with completion progress, and the recent updates feed with photos.
- **Supplier** — delivery and bill-submission forms, delivery history, payment status.
- **Labour** — mark today present / half day / absent, current site, daily wage, last 7 days
  with wages.

Sign-out and account deletion (`delete_my_account()` RPC, type-DELETE-to-confirm) are in
every dashboard. Privacy policy and account-deletion info are native screens reachable
from the sign-in screen (`ui/LegalScreens.kt`) — keep them in step with `app/privacy` and
`app/delete-account` on the web, since Play Store links to the web copies.

## Accounts must be linked before data appears

Signing up creates a `profiles` row with the chosen role, but a client / supplier /
labourer only sees data once an admin creates the matching domain row and sets its
`profile_id`. Until then RLS correctly returns nothing and the dashboard shows
"Account not linked to a … record yet." Use the admin **Link to login** dropdown on the
Clients / Suppliers / Labourers screens.

## Stack notes

- Compose Material 3, Compose BOM 2024.08
- supabase-kt 3.x on the Ktor OkHttp engine
- kotlinx.serialization for row decoding
- ViewModel + StateFlow for auth state; screen-local `remember` state elsewhere
- Coil 3 for project photos

## Troubleshooting

- **JDK** — use the JetBrains Runtime bundled with Android Studio (currently OpenJDK 21);
  Settings → Build → Gradle → Gradle JDK → the `jbr` entry. Do not install a separate JDK.
  The `sourceCompatibility = 17` in `app/build.gradle.kts` sets the output bytecode level and
  does not mean the toolchain has to be 17 — Gradle 8.13 and AGP 8.13.2 both run on 21.
- **Auth fails with a network error** — check `SUPABASE_URL` has no trailing slash and is
  the API URL (`https://<ref>.supabase.co`), not the dashboard URL.
- **Signed in but every list is empty** — expected until an admin links your profile to a
  domain row (see above), or the migrations in `../supabase/` have not all been run.
