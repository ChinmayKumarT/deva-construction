import { redirect } from "next/navigation";
import { getSessionAndRole } from "@/lib/supabase/server";
import { chooseRole } from "../actions/auth";

export default async function ChooseRolePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Only reachable with a session -- Google sign-in has no other route that
  // lands here (see /auth/callback), so a cold visit came the wrong way.
  const { user } = await getSessionAndRole();
  if (!user) redirect("/");

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">One more thing</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pick the role that matches you on site before continuing.
          </p>
        </header>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}

        <form action={chooseRole} className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <button
            type="submit"
            name="role"
            value="client"
            className="w-full rounded-lg border border-[var(--line)] px-4 py-3 text-left font-medium text-slate-700 hover:border-brand hover:bg-brand/5 transition"
          >
            Client
            <span className="block text-sm font-normal text-slate-500">
              I&apos;m having a project built and want to track its progress.
            </span>
          </button>
          <button
            type="submit"
            name="role"
            value="supplier"
            className="w-full rounded-lg border border-[var(--line)] px-4 py-3 text-left font-medium text-slate-700 hover:border-brand hover:bg-brand/5 transition"
          >
            Supplier
            <span className="block text-sm font-normal text-slate-500">
              I deliver materials and submit bills for projects.
            </span>
          </button>
        </form>
      </div>
    </main>
  );
}
