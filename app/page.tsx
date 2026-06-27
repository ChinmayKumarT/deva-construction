import { redirect } from "next/navigation";
import { signIn, signUp } from "./actions/auth";
import { getSessionAndRole } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; notice?: string; mode?: string };
}) {
  const { user, role } = await getSessionAndRole();
  if (user && role) redirect(role === "manager" ? "/admin" : `/${role}`);

  const isSignUp = searchParams.mode === "signup";

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-[var(--bg)]">
      <aside className="hidden lg:flex flex-col justify-between bg-forest text-white p-12">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand text-white font-semibold">B</span>
          <span className="text-lg font-semibold tracking-wide">Builder</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Run every site from one screen.
          </h2>
          <p className="mt-4 text-forest-100/80 leading-relaxed">
            Projects, materials, labour, payments. One platform for admin, manager, client, supplier and labour.
          </p>
        </div>
        <div className="text-xs text-forest-100/60">
          © Construction Manager
        </div>
      </aside>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {isSignUp ? "Create your account" : "Sign in"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isSignUp ? "Pick the role that matches you on site." : "Welcome back."}
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
            action={isSignUp ? signUp : signIn}
            className="space-y-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm"
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
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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
              className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition"
            >
              {isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>

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
