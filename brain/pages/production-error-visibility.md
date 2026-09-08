---
id: production-error-visibility
title: Production hides thrown Server Action errors
category: decision
status: active
created: "2026-09-08T17:16:11"
updated: "2026-09-08T17:16:12"
---

<!-- compiled_truth -->
**Next.js redacts the message of any error thrown from a Server Action in production.** `throw new Error("This supplier has 5 bills")` reaches the user as *"Minified React error #441"* and nothing else. The digest is in the Vercel function log; the user sees a blank red card.

This cost real debugging time three separate times in one day -- the website showcase page, a supplier delete, and the advance ledger -- each presenting as an identical, meaningless "Something went wrong".

**The fix**: `lib/flash.ts`. A Server Action calls `setFlashError(message)` and returns instead of throwing; `AdminPageHeader` reads it with `readFlashError()` and renders a banner. A 15-second cookie, because a page render is not allowed to delete a cookie -- it expires on its own.

**Why a cookie and not `?error=`**: these are plain `<form action={...}>` submits across a dozen admin pages. None of them know their own URL, and threading an error param would mean touching every page's searchParams. The header covers every admin screen with one change.

**The rule for new code**: any Server Action whose failure a user needs to understand should `setFlashError` and return, not throw. Throwing is still correct for programmer errors ("id required") that should never reach a user.

There is an older precedent for the same problem: `createPayment` and `recordDelivery` return `{error}` through `useFormState` for exactly this reason. That works too, but only where the form is already a client component.

Related: [[rls-is-the-authority]]


## Timeline

- time: 2026-09-08T17:16:11
  kind: decision
  summary: "Created this page: Production hides thrown Server Action errors"
  source: session 2026-09-08
  affects: [production-error-visibility]

- time: 2026-09-08T17:16:12
  kind: decision
  summary: "Server Actions must not throw user-facing messages; use the flash cookie"
  source: "session 2026-09-08, commit 0d48993"
  affects: [production-error-visibility]
