import Image from "next/image";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lineTotal } from "@/lib/money";
import { formatDateTime } from "@/lib/dateFormat";

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
    .select(
      "id, name, status, current_stage, completion_pct, total_cost, start_date, end_date, original_end_date, extension_reason, next_payment_date",
    )
    .eq("client_id", client.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  const projectIds = (projects ?? []).map((p) => p.id);

  const [{ data: updates }, { data: materials }, { data: payments }, { data: wageTotals }, { data: projectLabourers }] = projectIds.length
    ? await Promise.all([
        supabase
          .from("project_updates")
          .select("id, stage, note, image_url, created_at, project_id")
          .in("project_id", projectIds)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("materials")
          .select("project_id, quantity, unit_cost, status")
          .in("project_id", projectIds)
          .is("archived_at", null),
        supabase
          .from("payments")
          .select("id, amount, status, description, created_at, project_id, payee_type")
          .in("project_id", projectIds)
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
        // Attendance wages per project (total only, no labourer detail) via a
        // security-definer RPC -- clients can't read the attendance table.
        supabase.rpc("my_project_wage_totals"),
        // Which labourers worked each project (names/trade only, no wages) --
        // same security-definer scoping as the wage totals RPC above.
        supabase.rpc("my_project_labourers"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const spentByProject = new Map<string, number>();
  for (const m of materials ?? []) {
    if (m.status === "returned") continue;
    spentByProject.set(
      m.project_id!,
      (spentByProject.get(m.project_id!) ?? 0) + lineTotal(m.quantity, m.unit_cost),
    );
  }
  for (const p of payments ?? []) {
    if (p.status !== "paid" && p.status !== "approved") continue;
    if (!p.project_id) continue;
    // Only labour payments add to spend. Supplier payments settle material
    // costs that are already counted above, so including them double-counts.
    if (p.payee_type !== "labour") continue;
    spentByProject.set(p.project_id, (spentByProject.get(p.project_id) ?? 0) + Number(p.amount));
  }
  for (const w of (wageTotals ?? []) as { project_id: string; wage_total: number }[]) {
    if (!w.project_id) continue;
    spentByProject.set(w.project_id, (spentByProject.get(w.project_id) ?? 0) + Number(w.wage_total));
  }

  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));

  const labourersByProject = new Map<string, { name: string; category: string | null }[]>();
  for (const l of (projectLabourers ?? []) as { project_id: string; labourer_name: string; category: string | null }[]) {
    if (!l.project_id) continue;
    const list = labourersByProject.get(l.project_id) ?? [];
    list.push({ name: l.labourer_name, category: l.category });
    labourersByProject.set(l.project_id, list);
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
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
              const remaining = budget - spent;
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
                    <Cell label="Remaining" value={`₹${remaining.toLocaleString()}`} />
                  </dl>
                  {(p.start_date || p.end_date) && (
                    <p className="mt-3 text-xs text-slate-500">
                      {p.start_date ?? "—"} → {p.end_date ?? "—"}
                    </p>
                  )}
                  {p.original_end_date && p.end_date && p.end_date > p.original_end_date && (
                    <div className="mt-2 text-xs font-medium text-red-600">
                      Finish date extended: was {p.original_end_date}, now {p.end_date}
                      {p.extension_reason && (
                        <div className="mt-0.5 font-normal text-slate-500">
                          Reason: {p.extension_reason}
                        </div>
                      )}
                    </div>
                  )}
                  {p.next_payment_date && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                      Next payment due: {p.next_payment_date}
                    </div>
                  )}
                  {(labourersByProject.get(p.id)?.length ?? 0) > 0 && (
                    <div className="mt-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Labour on site</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {labourersByProject.get(p.id)!.map((l, i) => (
                          <span
                            key={i}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                          >
                            {l.name}{l.category ? ` · ${l.category}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
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
                  <Image
                    src={u.image_url} alt="" width={640} height={480} loading="lazy"
                    className="mt-3 max-h-72 w-auto rounded-lg border border-slate-200 object-cover"
                  />
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
                    <td className="px-4 py-2 text-slate-600">{formatDateTime(p.created_at)}</td>
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
