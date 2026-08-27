import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lineTotal } from "@/lib/money";

export const revalidate = 60;

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  completed: "bg-blue-50 text-blue-700 ring-blue-200",
  on_hold: "bg-amber-50 text-amber-700 ring-amber-200",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
};

export default async function ClientReportsPage() {
  const { user } = await requireRole("client");
  const supabase = await createSupabaseServerClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("profile_id", user.id)
    .single();

  if (!client) {
    return (
      <main className="mx-auto max-w-2xl p-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your account isn&apos;t linked to a client record yet. Ask the admin to link you in the Clients page.
          </p>
        </div>
      </main>
    );
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, completion_pct, total_cost")
    .eq("client_id", client.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (projects && projects.length === 1) {
    redirect(`/client/reports/${projects[0].id}`);
  }

  const projectIds = (projects ?? []).map((p) => p.id);
  const [{ data: materials }] = projectIds.length
    ? await Promise.all([
        supabase
          .from("materials")
          .select("project_id, quantity, unit_cost, status")
          .in("project_id", projectIds)
          .is("archived_at", null),
      ])
    : [{ data: [] }];

  const spentByProject = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.status === "returned" || !m.project_id) continue;
    spentByProject.set(
      m.project_id,
      (spentByProject.get(m.project_id) ?? 0) + lineTotal(m.quantity, m.unit_cost),
    );
  }

  return (
    <main className="min-h-screen">
      <div className="bg-gradient-to-br from-[var(--brand)] via-[var(--brand-deep)] to-slate-900 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link href="/client" className="inline-flex items-center gap-1 text-sm text-white/60 transition hover:text-white">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-white">Project Reports</h1>
          <p className="mt-1 text-sm text-white/60">Detailed completion and spend breakdown per project.</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 -mt-10">
        {(projects ?? []).length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            No projects linked to your account yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects!.map((p) => {
              const spent = spentByProject.get(p.id) ?? 0;
              const budget = Number(p.total_cost);
              const pct = Number(p.completion_pct);
              const statusCls = STATUS_STYLE[p.status] ?? "bg-slate-50 text-slate-600 ring-slate-200";

              return (
                <Link
                  key={p.id}
                  href={`/client/reports/${p.id}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-brand/30 hover:shadow-md"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-sm font-bold text-brand-700">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <h3 className="font-semibold text-slate-800 group-hover:text-brand-700 transition">{p.name}</h3>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusCls}`}>
                        {p.status}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-500">Progress</span>
                        <span className="font-semibold text-brand-700">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-500"
                          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Budget</div>
                        <div className="text-sm font-semibold text-slate-800">₹{budget.toLocaleString()}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">Spent</div>
                        <div className="text-sm font-semibold text-slate-800">₹{spent.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs font-semibold text-brand-700 transition group-hover:bg-brand/5 sm:px-6">
                    View full report →
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
