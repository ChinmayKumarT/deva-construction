# Publishing to Google Play — checklist

A step-by-step guide for getting Construction Manager from local source to the Play Store.

---

## 1. Pre-flight (in this order)

- [ ] Bump `versionCode` and `versionName` in [android/app/build.gradle.kts](android/app/build.gradle.kts).
- [ ] Deploy the web app somewhere with a stable HTTPS URL (Vercel/Netlify are easy).
  - Privacy policy URL: `https://YOURDOMAIN/privacy`
  - Account deletion URL: `https://YOURDOMAIN/delete-account`
  - Replace `thedeva.co@gmail.com` and `DEVELOPER_NAME` in [app/privacy/page.tsx](app/privacy/page.tsx) with your real support email + legal name.
- [ ] Run all 4 SQL files in Supabase (`schema.sql`, `02_domain.sql`, `03_storage.sql`, `04_account.sql`).
- [ ] In Supabase: upgrade to **Pro** plan, configure real SMTP (Resend/SendGrid), re-enable "Confirm email".

## 2. Generate the upload keystore (ONE TIME — do not lose this file)

```bash
keytool -genkeypair -v -keystore release.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias upload
```

You'll be prompted for two passwords (store + key) and your details. Save `release.jks` **outside the repo** (e.g. `~/keystores/construction-manager.jks`). Back it up. **If you lose it, you can never update the app on Play Store** — you'd have to publish a new app with a new package name.

Add the path + passwords to `android/local.properties`:

```
RELEASE_STORE_FILE=/Users/you/keystores/construction-manager.jks
RELEASE_STORE_PASSWORD=••••••
RELEASE_KEY_ALIAS=upload
RELEASE_KEY_PASSWORD=••••••
```

## 3. Build a signed bundle

From the `android/` directory:

```bash
./gradlew bundleRelease
```

(Or **Build → Generate Signed Bundle / APK → Android App Bundle** in Android Studio.) Output:
`android/app/build/outputs/bundle/release/app-release.aab`

This is what you upload to Play Store. Do NOT upload an APK — the Play Store wants AABs.

## 4. Create your Play Console account

- $25 one-time at https://play.google.com/console
- Account verification can take 1–3 days.

## 5. Create the app in Play Console

- **App name**: Construction Manager (≤ 30 chars)
- **Default language**: English (or your choice)
- **Type**: App
- **Free or paid**: pick

## 6. Fill out store listing

| Asset | Specs |
|---|---|
| App icon | 512×512 PNG, ≤ 1MB. Render your adaptive icon at this size. |
| Feature graphic | 1024×500 PNG/JPG |
| Phone screenshots | At least 2 (16:9 or 9:16), 320–3840 px |
| 7" tablet screenshots | Optional but recommended |
| Short description | ≤ 80 chars |
| Full description | ≤ 4000 chars |

To capture phone screenshots quickly: run the app on a Pixel 6 Pro emulator (1080×2400) and use the camera icon in the emulator toolbar.

## 7. Content rating + data safety

- **Content rating questionnaire**: it's a business productivity app — most answers are "no".
- **Data safety section** (the long form):
  - Data collected: Email address, Name, App activity (in-app interactions), App info and performance (crash logs), Photos.
  - Data shared: None.
  - Encrypted in transit: Yes.
  - User can request data deletion: Yes — provide `https://YOURDOMAIN/delete-account`.

## 8. Required URLs (in app details)

- **Privacy Policy**: `https://YOURDOMAIN/privacy`
- **Account deletion**: `https://YOURDOMAIN/delete-account`
- **Support email**: your real email
- **Website**: your domain (or the same as privacy)

## 9. Release tracks

Do NOT push straight to Production. Order:

1. **Internal testing** — invite yourself + 2–3 friends by email. Updates roll out in minutes.
2. **Closed testing** — open to a list of testers; required for at least 14 days of testing with ≥ 12 unique testers before you can apply for production access (new accounts only — old accounts may skip this).
3. **Production** — submit for review. First review can take 2–7 days.

For each track: upload the `app-release.aab`, fill in release notes (≤ 500 chars), submit for review.

## 10. After approval

- Monitor crashes in Play Console → Quality → Crashes.
- Reply to user reviews from Play Console.
- Updates require bumping `versionCode` (integer, must increase every upload).

---

## Things to know

- **You don't have a release-signing certificate.** Google Play App Signing handles the actual production signing. You upload an "upload" certificate; Google re-signs with a separate "app signing key" that lives in Google's HSM. Your `release.jks` is the upload key.
- **Once published with one package name (`com.construction.manager`)**, you're stuck with it forever. Pick wisely.
- **Target SDK 34** is the current Play Store requirement (Aug 2024 minimum). Already set in `build.gradle.kts`.
