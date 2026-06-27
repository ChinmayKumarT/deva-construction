# Capacitor + Vercel playbook

Workflow: deploy the Next.js web app to Vercel, then Capacitor wraps that URL into an installable Android APK. Daily development happens in the browser; Android Studio is only opened when you need to produce a signed APK for Play Store.

---

## One-time setup

### 1. Install the new dependencies
```powershell
npm install
```

### 2. Deploy the web app to Vercel

1. Push the project to GitHub:
   ```powershell
   git init
   git add .
   git commit -m "Initial"
   gh repo create construction-manager --public --source=. --push
   # or do this manually via github.com if you don't have gh CLI
   ```
2. Go to https://vercel.com → **Add New… → Project** → import the GitHub repo.
3. **Environment variables** (in the Vercel project settings):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://npjugegkzhrejepufaol.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy**. After ~1 min you'll get a URL like `https://construction-manager.vercel.app`.
5. Visit the URL in your browser — confirm the sign-in page loads.

### 3. Point Capacitor at your Vercel URL

Open [capacitor.config.ts](capacitor.config.ts), change the `server.url` to your real Vercel URL (the one from step 2.4).

### 4. Initialize the Android shell
```powershell
npm run cap:add
```
This creates an `android-cap/` folder (a thin native Android wrapper, NOT to be confused with the heavy `android/` Kotlin project — feel free to delete that one).

Then:
```powershell
npm run cap:sync
npm run cap:open
```
Last command opens the Android project in Android Studio. **This is a much lighter project than the Kotlin one.** Gradle still runs, but it's just configuring a webview shell — no Compose, no Supabase SDK to compile.

### 5. Run on your phone
In Android Studio → device dropdown → pick your phone → ▶️.

The app launches your Vercel-deployed Next.js app inside a fullscreen webview. Sign in, navigate, everything works — because it IS the web app.

---

## Daily workflow

You no longer touch Android Studio for most work:

```powershell
npm run dev       # iterate on the web app at localhost:3000
```

When you want changes on the phone:

```powershell
git push          # Vercel auto-redeploys in ~30s
```
The next time you open the app on your phone, you get the new version. **No rebuild, no reinstall.** That's the whole point.

You only open Android Studio when:
- Changing the app icon, splash, or native config.
- Generating a signed AAB for Play Store.

---

## Producing a signed AAB for Play Store

```powershell
npm run cap:sync       # only needed if web changed
npm run cap:open       # opens Android Studio
```
In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle** → follow the wizard (use the keystore you created per `PLAY_STORE_RELEASE.md`).

Output: `android-cap/app/build/outputs/bundle/release/app-release.aab`.

Upload to Play Console.

---

## What to delete

You can safely remove the old heavy Kotlin project:
```powershell
Remove-Item -Recurse -Force android
```
It's no longer needed. Everything Play-Store-ready is now in `android-cap/`.

If you ever want to go back to native Kotlin later, the project is still in git history.

---

## Play Store caveat (read this)

Google occasionally flags "webview-only" apps as low-effort wrappers. To avoid this:

1. Your app has a clear functional purpose (construction site management) — that's already true.
2. Capacitor adds native splash/icon, not just a browser tab — handled.
3. The privacy policy + delete account flows are reachable from inside the app — already done.
4. In the Play Console store listing, emphasize the management features, not "view our website on mobile".

Apps like this routinely get approved. The risky cases are personal blogs or news sites that just `WebView.loadUrl(homepage)` with nothing else.

---

## Troubleshooting

- **App opens but stays blank**: the Vercel URL is wrong in `capacitor.config.ts`, or Vercel hasn't finished deploying. Open the URL in the phone's Chrome to verify.
- **"Net::ERR_CACHE_MISS" in app**: phone is offline. The wrapped app needs internet — it loads the URL fresh on each launch (no offline mode unless we add it).
- **Want offline support**: out of scope for this playbook. Would require shipping static HTML in the APK and doing client-only Supabase calls. Real work; ask later if needed.
