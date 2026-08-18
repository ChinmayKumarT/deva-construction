import { redirect } from "next/navigation";
import { getSessionAndRole } from "@/lib/supabase/server";
import { updatePassword } from "../actions/auth";
import { PasswordField } from "@/components/PasswordField";

export const metadata = {
  title: "Set a new password — Deva Construction",
  description: "Choose a new password for your Deva Construction account.",
};

export default async function ResetPasswordPage(
  props: {
    searchParams: Promise<{ error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  // Only reachable with the recovery session the /auth/callback exchange
  // just set up -- anyone landing here cold (no session) came the wrong way.
  const { user } = await getSessionAndRole();
  if (!user) redirect("/?error=" + encodeURIComponent("That reset link is invalid or has expired."));

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Set a new password</h1>
          <p className="mt-1 text-sm text-slate-600">Choose a new password for your account.</p>
        </header>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form
          action={updatePassword}
          className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm"
        >
          <PasswordField name="password" label="New password" />
          <PasswordField name="confirm" label="Confirm new password" />
          <button
            type="submit"
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition"
          >
            Update password
          </button>
        </form>
      </div>
    </main>
  );
}
