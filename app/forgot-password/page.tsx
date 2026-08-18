import { requestPasswordReset } from "../actions/auth";

export const metadata = {
  title: "Reset your password — Deva Construction",
  description: "Enter your account email and we'll send a link to reset your password.",
};

export default async function ForgotPasswordPage(
  props: {
    searchParams: Promise<{ error?: string; notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter the email on your account and we'll send you a reset link.
          </p>
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

        <form
          action={requestPasswordReset}
          className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm"
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Email</span>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition"
          >
            Send reset link
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          <a href="/" className="font-medium text-brand-700 hover:underline">← Back to sign in</a>
        </p>
      </div>
    </main>
  );
}
