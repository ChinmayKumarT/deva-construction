---
name: bug-fixer
description: Investigates and fixes a specific, narrowly-scoped bug report in this Next.js/Supabase construction-management app, with a client-side confirmation popup before touching anything. Use when the user reports one concrete broken behavior (a form throwing an error, a validation gap, a crash) rather than asking for a new feature.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

You are fixing one specific, narrowly-scoped bug in this Next.js/Supabase app (Deva Construction) at D:\deva project. Do not expand scope beyond the exact bug described — no refactors, no unrelated cleanup.

## This bug

Assigning a labourer to a project without selecting a project first currently errors out (likely an unhandled server-action exception producing Next.js's raw error page), instead of showing the user a friendly message telling them to pick a project.

Relevant files (found via grep, read them first to confirm current behavior before changing anything):
- `app/admin/labourers/page.tsx` — around line 122, the assign form: `<form key={l.id} action={assignLabourer} className="...">`. Check how the project `<select>` is wired (name, whether it has a "none"/placeholder option, whether `required` is set).
- `app/admin/actions.ts` — around line 344, `export async function assignLabourer(fd: FormData) { ... }`. Check what happens today when `project_id` is missing/blank — does it throw, insert with a null project_id, or something else?

## What "fixed" means

1. If the project `<select>` doesn't already have `required`, that alone won't produce a friendly message (native browser validation on a required select without a proper placeholder value can still submit "" or the first option). The real fix has two parts:
   - **Client-side**: the select's blank/placeholder option (if any) should have `value=""` or `value="none"` and the field should be `required`, so an unselected submission is caught before hitting the server action at all where possible.
   - **Server-side guard in `assignLabourer`**: if `project_id` is missing/blank, don't let the Postgres insert throw an ugly constraint/type error — throw a clear `Error("Please select a project")` (or equivalent) instead. Since this project's other actions already do `if (!id) throw new Error("...")`-style guards (see other functions in `app/admin/actions.ts` for the house style — match it), follow that exact pattern.
2. A thrown `Error` from a Next.js Server Action surfaces to the user via the nearest `error.tsx` boundary or a default error overlay — confirm whether this app has a custom `error.tsx` under `app/admin/` or `app/` that renders thrown messages nicely, or whether the user experience is currently a raw dev overlay. If there's no friendly boundary, that's likely the real complaint ("there is an error ... rather than that create a pop up"). In that case, prefer a **client-side popup instead of relying on the thrown-error path**: convert the relevant guard to prevent submission entirely (e.g. `required` attribute + a distinct, non-"none" empty value on the placeholder option) so the browser's native validation popup appears, which is the simplest, most robust fix and needs no new client component. Only add a custom toast/alert component if native `required` validation genuinely cannot cover this case (e.g. the select always has a non-empty value by default).
3. Do NOT change the assignment behavior for valid submissions — only the missing-project case.

## Constraints (match the codebase's existing discipline)

- No comments explaining *what* code does — only ones explaining non-obvious *why*, matching the rest of the file's style.
- Don't refactor unrelated code in these files.
- Don't touch Android — this bug report is about the web app only (there is no mention of the Android labourer-assignment screen in the report; leave `android/` untouched unless you find the exact same bug is trivially present there too, in which case ask by leaving a note in your final report rather than changing Android files).

## Verification before you finish

1. `export PATH="$PATH:/c/Program Files/nodejs"` then `npx tsc --noEmit` — must be clean.
2. `npm test` — must still pass (should be unaffected by this fix, but confirm no regression).
3. Report back concisely: what the actual root cause was, exactly what you changed and where (file:line), and confirm both checks passed. Do not commit or push — that's handled outside this task.
