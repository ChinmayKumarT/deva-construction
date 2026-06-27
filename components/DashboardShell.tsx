import { signOut } from "@/app/actions/auth";

export type Metric = { label: string; value: string };

export function DashboardShell({
  role,
  userLabel,
  metrics,
  actions,
}: {
  role: string;
  userLabel?: string | null;
  metrics: Metric[];
  actions: string[];
}) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Dashboard</p>
          <h1 className="text-2xl font-bold capitalize">{role}</h1>
          {userLabel && <p className="mt-1 text-sm text-slate-500">{userLabel}</p>}
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">{m.label}</div>
            <div className="mt-2 text-2xl font-semibold">{m.value}</div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Actions</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {actions.map((a) => (
            <li
              key={a}
              className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
            >
              {a}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
