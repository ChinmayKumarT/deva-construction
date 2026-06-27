import { redirect } from "next/navigation";
import { signIn, signUp } from "./actions/auth";
import { getSessionAndRole } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; notice?: string; mode?: string };
}) {
  const { user, role } = await getSessionAndRole();
  if (user && role) redirect(`/${role}`);

  const isSignUp = searchParams.mode === "signup";

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Construction Manager</h1>
          <p className="mt-2 text-slate-600">{isSignUp ? "Create an account" : "Sign in to continue"}</p>
        </header>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}
        {searchParams.notice && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {searchParams.notice}
          </div>
        )}

        <form
          action={isSignUp ? signUp : signIn}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {isSignUp && (
            <Field label="Full name" name="full_name" type="text" required />
          )}
          <Field label="Email" name="email" type="email" required />
          <Field label="Password" name="password" type="password" required />
          {isSignUp && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Role</span>
              <select
                name="role"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                defaultValue="client"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="client">Client</option>
                <option value="supplier">Supplier</option>
                <option value="labour">Labour</option>
              </select>
            </label>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
          >
            {isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <a href="/" className="font-medium text-slate-900 underline">
                Sign in
              </a>
            </>
          ) : (
            <>
              New here?{" "}
              <a href="/?mode=signup" className="font-medium text-slate-900 underline">
                Create an account
              </a>
            </>
          )}
        </p>

        <p className="mt-8 text-center text-xs text-slate-500">
          <a href="/privacy" className="underline">Privacy policy</a>
          <span className="mx-2">·</span>
          <a href="/delete-account" className="underline">Delete account</a>
        </p>
      </div>
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
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
      />
    </label>
  );
}
