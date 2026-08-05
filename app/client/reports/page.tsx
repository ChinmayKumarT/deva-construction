import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lineTotal } from "@/lib/money";

export default async function ClientReportsPage() {
  const { user } = await requireRole("client");
  const supabase = createSupabaseServerClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("profile_id", user.id)
    .single();

  if (!client) {
    return (
      <main className="mx-auto max-w-2xl p-10">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-3 text-slate-600">
          Your account isn't linked to a client record yet. Ask the admin to link you in the Clients page.
        </p>
      </main>
    );
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, completion_pct, total_cost")
    .eq("client_id", client.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);
  const [{ data: materials }, { data: payments }] = projectIds.length
    ? await Promise.all([
        supabase
          .from("materials")
          .select("project_id, quantity, unit_cost, status")
          .in("project_id", projectIds)
          .is("archived_at", null),
        supabase
          .from("payments")
          .select("project_id, amount, status, payee_type")
          .in("project_id", projectIds)
          .is("archived_at", null),
      ])
    : [{ data: [] }, { data: [] }];

  const spentByProject = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.status === "returned" || !m.project_id) continue;
    spentByProject.set(
      m.project_id,
      (spentByProject.get(m.project_id) ?? 0) + lineTotal(m.quantity, m.unit_cost),
    );
  }
  for (const p of payments ?? []) {
    if (!p.project_id) continue;
    if (p.status !== "paid" && p.status !== "approved") continue;
    // Labour only: supplier payments settle already-counted material costs.
    if (p.payee_type !== "labour") continue;
    spentByProject.set(p.project_id, (spentByProject.get(p.project_id) ?? 0) + Number(p.amount));
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-slate-500">Reports</p>
        <h1 className="text-2xl font-bold">Your project reports</h1>
        <p className="mt-1 text-sm text-slate-500">Pick a project to see its completion, spend and transactions.</p>
      </div>

      {(projects ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No projects are linked to your account yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects!.map((p) => {
            const spent = spentByProject.get(p.id) ?? 0;
            return (
              <Link
                key={p.id}
                href={`/client/reports/${p.id}`}
                className="rounded-xl border border-slate-200 bg-white p-5 hover:border-brand hover:shadow-sm transition"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold">{p.name}</div>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    {p.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {Number(p.completion_pct).toFixed(1)}% complete
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Budget ₹{Number(p.total_cost).toLocaleString()} · Spent ₹{spent.toLocaleString()}
                </p>
                <p className="mt-3 text-sm font-medium text-brand-700">View report →</p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
