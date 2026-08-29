import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn, signUp, signInWithGoogle, signInWithMagicLink } from "./actions/auth";
import { getSessionAndRole } from "@/lib/supabase/server";
import { PasswordField } from "@/components/PasswordField";
import { OrganicBlob } from "@/components/ui/OrganicBlob";
import { DottedPattern } from "@/components/ui/DottedPattern";

export default async function LoginPage(
  props: {
    searchParams: Promise<{ error?: string; notice?: string; mode?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { user, role } = await getSessionAndRole();
  if (user && role) redirect(role === "superadmin" || role === "manager" ? "/admin" : `/${role}`);

  const isSignUp = searchParams.mode === "signup";
  const isMagicLink = searchParams.mode === "magic-link";

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-[var(--bg)]">
      <aside className="hidden lg:flex relative overflow-hidden flex-col justify-between bg-forest text-white p-12">
        <DottedPattern className="absolute -right-10 top-24 h-56 w-56 text-white/10" />
        <OrganicBlob className="absolute -left-24 -bottom-28 h-96 w-96 text-brand/25" />
        <OrganicBlob className="absolute -right-16 -top-20 h-72 w-72 text-brand/15" />

        <a
          href="/"
          aria-label="Deva Construction — home"
          className="relative flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Image
            src="/icon.png" alt="" width={36} height={36}
            className="rounded-md" style={{ objectFit: "contain" }}
          />
          <span className="text-xl font-semibold tracking-tight">
            Deva <span className="font-normal text-white/85">Construction</span>
          </span>
        </a>
        <div className="relative max-w-md">
          <h2 className="font-serif text-4xl font-semibold leading-tight">
            Run every site from one screen.
          </h2>
          <p className="mt-4 text-forest-100/80 leading-relaxed">
            Projects, materials, labour, payments. One platform for admin, manager, client and supplier.
          </p>
        </div>
        <div className="relative text-xs text-forest-100/60">
          © {new Date().getFullYear()} Deva Construction
        </div>
      </aside>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <header className="mb-8">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">
              {isSignUp ? "Create your account" : isMagicLink ? "Sign in with a magic link" : "Sign in to Deva Construction"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isSignUp
                ? "Pick the role that matches you on site."
                : isMagicLink
                ? "We'll email you a link to sign in — no password needed."
                : "Welcome back."}
            </p>
            {!isSignUp && !isMagicLink && (
              <p className="mt-3" style={{ fontSize: 16, lineHeight: "24px", color: "#5B6475" }}>
                Sign in to the official Deva Construction dashboard — your projects, payments, and team, all in one secure place.
              </p>
            )}
          </header>

          {searchParams.error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {searchParams.error}
            </div>
          )}
          {searchParams.notice && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
              {searchParams.notice}
            </div>
          )}

          {isMagicLink ? (
            <form
              action={signInWithMagicLink}
              className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm"
            >
              <Field label="Email" name="email" type="email" required />
              <button
                type="submit"
                className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition"
              >
                Send magic link
              </button>
              <p className="text-center text-sm">
                <a href="/" className="font-medium text-brand-700 hover:underline">
                  Use your password instead
                </a>
              </p>
            </form>
          ) : (
            <form
              action={isSignUp ? signUp : signIn}
              className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm"
            >
              {isSignUp && (
                <Field label="Full name" name="full_name" type="text" required />
              )}
              {isSignUp && (
                <Field label="Phone" name="phone" type="tel" />
              )}
              <Field label="Email" name="email" type="email" required />
              <PasswordField />
              {!isSignUp && (
                <p className="flex items-center justify-between text-sm">
                  <a href="/?mode=magic-link" className="font-medium text-brand-700 hover:underline">
                    Sign in with a magic link
                  </a>
                  <a href="/forgot-password" className="font-medium text-brand-700 hover:underline">
                    Forgot password?
                  </a>
                </p>
              )}
              {isSignUp && (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Role</span>
                  <select
                    name="role"
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    defaultValue="client"
                  >
                    <option value="client">Client</option>
                    <option value="supplier">Supplier</option>
                  </select>
                  {/* No "Labour" option: labourers are records the site manager
                      maintains, not app users. handle_new_user() maps a requested
                      'labour' role to 'client' so this can't be bypassed. */}
                  {/* Admin/manager are never self-serve — the owner grants those
                      from the app's Team access screen. handle_new_user() also
                      clamps any other role server-side, so this is UI-only. */}
                </label>
              )}

              <button
                type="submit"
                className="w-full rounded-lg px-4 py-2.5 font-medium text-white transition hover:opacity-90 active:opacity-80"
                style={{ backgroundColor: "#6257F6" }}
              >
                {isSignUp ? "Create account" : "Sign in"}
              </button>

            </form>
          )}

          <div style={{ marginTop: 40 }} className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-[var(--line)]" />
            or
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>


          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 font-medium transition hover:bg-slate-50"
              style={{ border: "1px solid #D9DFEA", color: "#3F4654" }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.27-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
              </svg>
              Continue with Google
            </button>
          </form>

          <a
            href="/download"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 font-medium transition hover:bg-slate-50"
            style={{ border: "1px solid #D9DFEA", color: "#3F4654" }}
          >
            Download app
          </a>

          <p className="mt-5 text-center text-sm text-slate-600">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <a href="/" className="font-medium text-brand-700 hover:underline">Sign in</a>
              </>
            ) : (
              <>
                New here?{" "}
                <a href="/?mode=signup" className="font-medium text-brand-700 hover:underline">Create an account</a>
              </>
            )}
          </p>

          <p className="mt-10 text-center text-xs text-slate-500">
            <a href="/privacy" className="hover:underline">Privacy policy</a>
            <span className="mx-2">·</span>
            <a href="/delete-account" className="hover:underline">Delete account</a>
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  name,
  type,
  required,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}
