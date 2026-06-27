# Construction Manager — Android

Native Android version using **Kotlin + Jetpack Compose + Supabase Kotlin SDK**.
Shares the same Supabase backend (auth + Postgres) as the web app.

## Open in Android Studio

1. Launch Android Studio → **File → Open** → select this `android/` folder (not the repo root).
2. Let Gradle sync finish (first time downloads dependencies, can take 5–10 min).
3. Create `local.properties` in the `android/` folder (next to `settings.gradle.kts`) with:
   ```
   sdk.dir=C\:\\Users\\YOUR_NAME\\AppData\\Local\\Android\\Sdk
   SUPABASE_URL=https://npjugegkzhrejepufaol.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   ```
   The `sdk.dir` line is usually auto-added by Android Studio. The two Supabase lines you add yourself — they're read by `app/build.gradle.kts` into `BuildConfig`.
4. Click **Sync Now** if prompted.
5. Run on an emulator or a connected device (▶️ Run 'app').

## What works
- Sign up / sign in (email + password) against the same Supabase project as the web app.
- Role-based routing: after sign-in the app fetches `profiles.role` and shows the matching dashboard.
- Admin dashboard: live metrics (total/active projects, total cost, pending payments, labour count, average completion %).
- The other 4 dashboards (manager/client/supplier/labour) are shells with placeholder values.

## What's not built yet
- CRUD screens (creating projects, clients, suppliers, labourers, materials, payments).
- Attendance check-in for labour.
- Bill generation for supplier.
- Project updates feed for client.
- Reports.

All of those exist in the web version and would need to be ported screen-by-screen. Easy to do incrementally.

## Stack notes
- Compose Material 3
- supabase-kt 3.x with Ktor Android engine
- kotlinx.serialization for model decoding
- ViewModel + StateFlow for state

## Known things to watch on first build
- If Gradle complains about JDK 17: in Android Studio → Settings → Build → Gradle → set Gradle JDK to 17.
- If the auth flow fails with a network error: confirm `SUPABASE_URL` has no trailing slash and is the API URL (`https://<ref>.supabase.co`), not the dashboard URL.
