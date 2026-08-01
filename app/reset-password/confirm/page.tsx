"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Gmail/Outlook prefetch links in emails to scan them, which silently
// consumes a one-time recovery token before the user ever clicks it. Landing
// here first -- and only verifying on an explicit tap -- keeps that prefetch
// from burning the token, since scanners don't run JS or click buttons.
function ConfirmContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const tokenHash = params.get("token_hash");
  const redirectTo = params.get("redirect_to");
  const isAndroid = redirectTo?.startsWith("com.construction.manager://") ?? false;

  if (!tokenHash) {
    return (
      <p className="text-sm text-red-700">
        That reset link is invalid or has expired.{" "}
        <a href="/forgot-password" className="font-medium text-brand-700 hover:underline">
          Request a new one
        </a>
        .
      </p>
    );
  }

  if (isAndroid) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Continue in the Deva Construction app to finish resetting your password.</p>
        <button
          onClick={() => {
            window.location.href = `${redirectTo}?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
          }}
          className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition"
        >
          Open the app
        </button>
      </div>
    );
  }

  async function handleContinue() {
    setPending(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "recovery" });
    if (error) {
      setError("That reset link is invalid or has expired.");
      setPending(false);
      return;
    }
    router.push("/reset-password");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Continue to set a new password for your account.</p>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      <button
        onClick={handleContinue}
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition disabled:opacity-60"
      >
        {pending ? "Continuing…" : "Continue"}
      </button>
    </div>
  );
}

export default function ResetPasswordConfirmPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Reset your password</h1>
        </header>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <Suspense fallback={null}>
            <ConfirmContent />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
