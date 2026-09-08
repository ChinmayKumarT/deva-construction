import { cookies } from "next/headers";

/**
 * Carries a failure message from a Server Action back to the next page render.
 *
 * Next.js redacts the message of any error thrown from a Server Action in
 * production, so `throw new Error("This supplier has 5 bills")` reaches the
 * user as "Minified React error #441" and nothing else. That has cost real
 * debugging time three times over: the website page, the supplier delete, and
 * the advance ledger.
 *
 * A cookie rather than a redirect + query string, because these actions are
 * plain `<form action={...}>` submits scattered across a dozen pages -- none of
 * them know their own URL, and adding an `?error=` param would mean touching
 * every page's searchParams. The header reads this instead, so one change
 * covers every admin screen.
 *
 * Deliberately short-lived: the banner should show once, on the render that
 * follows the failure, and then go. A page render is not allowed to delete a
 * cookie, so it expires on its own instead.
 */
const KEY = "deva_flash_error";
const TTL_SECONDS = 15;

export async function setFlashError(message: string) {
  const jar = await cookies();
  jar.set(KEY, message.slice(0, 400), {
    maxAge: TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function readFlashError(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(KEY)?.value ?? null;
}
