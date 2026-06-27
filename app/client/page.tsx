import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export default async function ClientDashboard() {
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
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-3 text-slate-600">
          Your account isn't linked to a client record yet. Ask the admin to link you in the Clients page.
        </p>
      </main>
    );
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, current_stage, completion_pct, total_cost, start_date, end_date")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  const [{ data: updates }, { data: materials }, { data: payments }] = projectIds.length
    ? await Promise.all([
        supabase
          .from("project_updates")
          .select("id, stage, note, image_url, created_at, project_id")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("materials")
          .select("project_id, quantity, unit_cost, status")
          .in("project_id", projectIds),
        supabase
          .from("payments")
          .select("id, amount, status, description, created_at, project_id, payee_type")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const spentByProject = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.status === "returned") continue;
    spentByProject.set(
      m.project_id!,
      (spentByProject.get(m.project_id!) ?? 0) + Number(m.quantity) * Number(m.unit_cost),
    );
  }
  for (const p of payments ?? []) {
    if (p.status !== "paid" && p.status !== "approved") continue;
    if (!p.project_id) continue;
    spentByProject.set(p.project_id, (spentByProject.get(p.project_id) ?? 0) + Number(p.amount));
  }

  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Client dashboard</p>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      {(projects ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No projects are linked to your account yet.
        </p>
      ) : (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your projects</h2>
          <section className="grid gap-4 sm:grid-cols-2">
            {projects!.map((p) => {
              const spent = spentByProject.get(p.id) ?? 0;
              const budget = Number(p.total_cost);
              const pending = budget - spent;
              return (
                <article key={p.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-baseline justify-between">
                    <div className="font-semibold">{p.name}</div>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Stage: <span className="font-medium">{p.current_stage ?? "—"}</span>
                  </p>
                  <div className="mt-3">
                    <ProgressBar pct={Number(p.completion_pct)} />
                    <div className="mt-1 text-xs text-slate-500">{Number(p.completion_pct).toFixed(1)}% complete</div>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <Cell label="Budget" value={`₹${budget.toLocaleString()}`} />
                    <Cell label="Spent" value={`₹${spent.toLocaleString()}`} />
                    <Cell label="Pending" value={`₹${pending.toLocaleString()}`} />
                  </dl>
                  {(p.start_date || p.end_date) && (
                    <p className="mt-3 text-xs text-slate-500">
                      {p.start_date ?? "—"} → {p.end_date ?? "—"}
                    </p>
                  )}
                </article>
              );
            })}
          </section>

          <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent updates</h2>
          <ul className="space-y-4">
            {(updates ?? []).length === 0 && (
              <li className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No updates posted yet.
              </li>
            )}
            {updates?.map((u) => (
              <li key={u.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-baseline justify-between">
                  <div className="font-medium">{projectName.get(u.project_id!) ?? "—"}</div>
                  <div className="text-xs text-slate-500">{new Date(u.created_at).toLocaleString()}</div>
                </div>
                {u.stage && <div className="mt-1 text-sm text-slate-600">Stage: <span className="font-medium">{u.stage}</span></div>}
                {u.note && <p className="mt-2 text-sm text-slate-700">{u.note}</p>}
                {u.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.image_url} alt="" className="mt-3 max-h-72 rounded-lg border border-slate-200 object-cover" />
                )}
              </li>
            ))}
          </ul>

          <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Payment timeline</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-4 py-2 font-medium">For</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No payments yet.</td></tr>
                )}
                {payments?.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-600">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-slate-600">{projectName.get(p.project_id!) ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{p.payee_type === "supplier" ? "Materials/supplier" : "Labour"}</td>
                    <td className="px-4 py-2 font-medium">₹{Number(p.amount).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_STYLE[p.status] ?? ""}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full bg-emerald-500" style={{ width: `${clamped}%` }} />
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-medium text-slate-800">{value}</div>
    </div>
  );
}
