# Handover to the client

Everything needed to move Deva Construction's website, app, database and
domain from the developer's accounts to the client's, and to keep them
working afterwards.

Written 24 August 2026. Facts marked **verified** were checked against the
live systems on that date; anything else should be re-confirmed before you
act on it, particularly hosting prices and terms, which change.

---

## 1. Who owns what today

| Account | Purpose |
|---|---|
| `chinmaykumart04@gmail.com` | Developer. Holds the working deployments. |
| `thedeva.co@gmail.com` | **The client.** Everything below must end up here. |

### Vercel projects

| Account | Project | What it is | State (verified 30 Aug 2026) |
|---|---|---|---|
| **client** | **`deva-construction-mjlt`** | **Admin app — the live one** | **Current.** Connected to `thedevaconstructions/deva-construction`; every push to `main` builds and succeeds. Owns `deva-demo.vercel.app`. |
| developer | `deva-demo` | Admin app — **backup copy, deliberately not deployed** | Last deployment 28 days ago, by design. It exists as a spare, not as a running site. Nothing should point at it. |
| developer | `deva-construction-website` | Marketing site | Current. Serves `devaconstructions.in`. |

> **`deva-demo.vercel.app` belongs to the CLIENT's project**, not to the
> developer's project of the same name. That single fact was misread for most
> of a day: because that hostname served current code, the developer's
> `deva-demo` project looked like the healthy one, and `app.devaconstructions.in`
> was moved onto it. That project is a deliberately undeployed backup, so the
> domain now serves a 28-day-old build and needs moving back — see §3.
>
> The client's project was healthy and auto-deploying the whole time. Only one
> admin app is meant to be live: `deva-construction-mjlt`.

### Domains (verified)

| Domain | Resolves to | Serves | Correct? |
|---|---|---|---|
| `devaconstructions.in` | 216.198.79.1 | Marketing site | yes |
| `www.devaconstructions.in` | 64.29.17.1 | Marketing site | yes |
| `app.devaconstructions.in` | 64.29.17.1 | Admin app — **28-day-old build**, because it is attached to the abandoned `deva-demo` project | no — move it to `deva-construction-mjlt` |
| `devaconstrucions.in` | — | nothing | typo: missing the `t` |
| `www.devaconstrucions.in` | — | nothing | same typo |

Registrar is **GoDaddy**, using GoDaddy nameservers with individual records
pointed at Vercel. Vercel may suggest switching to its own nameservers —
don't. It would mean recreating every record including mail, for no gain.

### Other services

| Service | What it holds | Why it matters |
|---|---|---|
| **Supabase** | Every project, client, payment, material, attendance and photo | **The only irreplaceable asset here.** Code can be rebuilt; this cannot. |
| **GitHub** | Admin app: `thedevaconstructions/deva-construction` (origin) + `ChinmayKumarT/deva-construction` (mirror). Website: `thedevaconstructions/deva-construction-website` (origin) + `ChinmayKumarT/Deva-Constructions-website` (mirror, added 30 Aug 2026). Both push to origin and backup on every commit. | Source of truth for both apps |
| **Formcarry** | Contact-form submissions | Enquiries are retained here, not only emailed |
| **Google Play** | `com.construction.manager` | Package name is permanent once published |

---

## 2. The plan decision — read before transferring

**Vercel's Hobby plan does not permit commercial use.** Both accounts are on
Hobby today. A construction firm's lead-generating website and client-facing
project app is commercial. Vercel does act on accounts that look like
businesses, and a suspension would take down the site and the staff app
together.

There is a second, more practical catch:

> **Hobby accounts are single-user. Collaborators cannot be added.**

So if everything moves to the client's Hobby account and they later need a
fix, the only options are handing over their password — which you should not
accept — or upgrading then. Decide now instead.

| Option | Cost | Consequence |
|---|---|---|
| **Vercel Pro** (recommended) | ~$20/month | Permitted for business use, and the developer can be added as a member for ongoing support |
| Stay on Hobby | free | Against the terms; risks suspension of a revenue-facing site; no way to give the developer access |
| Move to Cloudflare Pages / Netlify | free | Their free tiers permit commercial use. Real migration work — scope it properly, don't assume it is a settings change |

**Supabase** free tier permits commercial use, but **pauses a project after
about a week of inactivity**. Daily staff use avoids that; a quiet month does
not. Supabase Pro is ~$25/month. Confirm current pricing before quoting it to
the client.

Budget to present: **~$45/month** for Vercel Pro + Supabase Pro, or a
migration to a free-tier-friendly host instead.

---

## 3. Fix before handing over

Do not transfer a broken arrangement — these get harder to explain later.

- [ ] **Move `app.devaconstructions.in` back to `deva-construction-mjlt`.**
      It is currently on the developer's abandoned `deva-demo` project, which
      last deployed 28 days ago — that is why it serves an old build. Remove
      it from `deva-demo`, add it to `deva-construction-mjlt` in the client's
      account. DNS needs no change; it already points at Vercel. Verify by
      loading `/admin/website`: it should redirect to login, not 404.
- [ ] **Take `app.devaconstructions.in` off the developer's `deva-demo`
      project.** That project is an intentional backup and is not meant to
      serve anything — leaving a live domain pointed at an undeployed spare is
      what made the healthy client project look broken. The project itself can
      stay; nothing should point at it.
- [ ] **Remove the typo domains** from every Vercel project. Decide separately
      whether `devaconstrucions.in` is worth renewing as a defensive
      registration or was bought by mistake.
- [x] ~~Replace the placeholder contact details.~~ Done 25 Aug 2026: the site
      now carries +91 99801 44405 and 114 BK Layout, Thindlu, Vidyaranyapura,
      Bengaluru 560097. Two details were normalised from what was supplied and
      are worth a glance: "Bangalore 97" was expanded to 560097, and the
      locality is spelled Vidyaranyapura.
- [ ] **Decide the Android question.** The Play Store build is the **native
      Kotlin app** (`com.construction.manager`) — `capacitor.config.ts` exists
      but no Capacitor project was ever generated, so the wrapper is not what
      ships. Features added to the web app, including the Website section, do
      **not** appear in the Android app automatically. Either build them
      natively or move to the Capacitor wrapper. Remove
      `capacitor.config.ts` and the `@capacitor/*` dependencies if the wrapper
      is abandoned — it currently declares a different app id
      (`com.deva.construction`) from the one that ships, which will mislead
      whoever reads it next.
- [ ] **Set up email on the domain.** `devaconstructions.in` has **no MX
      records** — verified 30 Aug 2026, the DNS returns an SOA rather than an
      answer, and there is no SPF record either. `hello@devaconstructions.in`
      therefore bounces. The site now shows `thedeva.co@gmail.com` instead,
      which works but reads as a personal address on a company site. Zoho Mail
      has a free tier that covers this; Google Workspace is the paid option.
      Once MX records exist, switch the site back — the address appears in
      `app/contact/actions.ts` (the form's failure fallback),
      `app/contact/page.tsx`, `site-header.tsx` and `site-footer.tsx`.
- [ ] **Confirm the figures on the site.** The home and about pages claim
      "40+ projects delivered", "1.2M sq. ft. built", "80+ on-site team" and
      "Founded in Bangalore in 2018". These were written before the owner
      supplied copy and have never been confirmed. They are specific, checkable
      numbers on a business site.
- [ ] **Add real project photography.** Showcase projects currently fall back
      to an animated placeholder. Upload via Admin → Website.

---

## 4. Transfer order

Order matters: access first, data second, DNS last, so nothing goes dark
while something else is still moving.

1. [ ] Client creates their Vercel account (or upgrades) to **Pro** on
       `thedeva.co@gmail.com`.
2. [ ] Client adds the developer as a **team member**, so the following steps
       can be done without sharing passwords.
3. [ ] **Transfer the Vercel projects** — Project → Settings → General →
       Transfer. Move `deva-construction-website` and the surviving admin app.
4. [ ] **Re-add environment variables.** They do **not** transfer with the
       project. Required:
       - marketing site: `NEXT_PUBLIC_SUPABASE_URL`,
         `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `FORMCARRY_FORM_ID`
       - admin app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
         (plus any others listed in that project's settings — copy them all
         before transferring, they are hard to recover afterwards)
5. [ ] **Transfer the Supabase project** to an organisation owned by the
       client. Take a backup first (`lib/backup.ts` powers Admin → Backup).
6. [ ] **Transfer the GitHub repositories** to the client's organisation. Add
       the developer as a collaborator. Keep the backup mirror until the
       client's copy is confirmed working.
7. [ ] **Transfer the domain** at GoDaddy to the client's account. DNS records
       stay as they are; only account ownership changes.
8. [ ] **Move Formcarry** to the client's email, or recreate the form there and
       update `FORMCARRY_FORM_ID`. Export existing submissions first.
9. [ ] **Google Play Console** — transfer the app listing, or confirm it is
       already under the client's developer account.

---

## 5. Verify after transferring

Check these against the live systems, not against the dashboards.

- [ ] `devaconstructions.in` and `www.` both load
- [ ] `devaconstructions.in/projects` lists the published projects
- [ ] A project's own page loads, e.g. `/projects/jayanagar-villa`
- [ ] Contact form: send one test enquiry, confirm it arrives in the inbox
      **and** appears in the Formcarry dashboard
- [ ] `app.devaconstructions.in` loads and sign-in works
- [ ] Admin → Website: add a photo, confirm it appears on the public site
      within a minute
- [ ] Archive a project, confirm it disappears from the public site; restore it
- [ ] **Security check.** With the public anon key, confirm the private tables
      return nothing:
      ```
      curl -s "$SUPABASE_URL/rest/v1/projects?select=id&limit=1" \
        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
      ```
      Expect `[]` for `projects`, `clients`, `payments`, `profiles`. Anything
      else means costs or client names are reachable from the public website —
      stop and fix before going further.
- [ ] Android app still signs in and loads

---

## 6. What the client must keep

Written down somewhere that is not one person's laptop:

- Vercel, Supabase, GitHub, GoDaddy, Formcarry and Google Play logins
- Which Vercel project serves which domain
- That `supabase/*.sql` files are run **in order** in the Supabase SQL editor,
  and that the editor may run only the highlighted statement — a partial run
  has silently broken things twice on this project (see
  `37_showcase_policies_repair.sql`)
- That `content/projects.ts` in the website repo is a **fallback only**. Once
  Supabase is configured the app is authoritative and that file goes stale by
  design
