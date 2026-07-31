import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, CostBox } from "@/components/admin/Page";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function PaymentsIndexPage({
  searchParams,
}: {
  searchParams: { archived?: string };
}) {
  const showArchived = searchParams.archived === "1";
  const supabase = createSupabaseServerClient();

  const [{ data: projects }, { data: payments }, { count: archivedCount }] = await Promise.all([
    supabase.from("projects").select("id, name, status").is("archived_at", null).order("name"),
    showArchived
      ? supabase.from("payments").select("id, project_id, amount, status").not("archived_at", "is", null)
      : supabase.from("payments").select("id, project_id, amount, status").is("archived_at", null),
    supabase.from("payments").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
  ]);

  const byProject = new Map<string, { count: number; spend: number }>();
  let unassignedCount = 0;
  let unassignedSpend = 0;
  for (const p of payments ?? []) {
    const spend = p.status === "rejected" ? 0 : Number(p.amount);
    if (p.project_id) {
      const cur = byProject.get(p.project_id) ?? { count: 0, spend: 0 };
      byProject.set(p.project_id, { count: cur.count + 1, spend: cur.spend + spend });
    } else {
      unassignedCount++;
      unassignedSpend += spend;
    }
  }

  const suffix = showArchived ? "?archived=1" : "";
  const totalCost = Array.from(byProject.values()).reduce((sum, s) => sum + s.spend, 0) + unassignedSpend;

  return (
    <AdminPage>
      <AdminPageHeader
        title={showArchived ? "Archived payments" : "Payments"}
        subtitle={
          showArchived
            ? "Pick a site to see its archived payments."
            : "Pick a site to see its bills and wages. Pending → approved → paid."
        }
      />

      {!showArchived && archivedCount ? (
        <div className="mb-6">
          <Link href="/admin/payments?archived=1" className="text-sm font-medium text-brand-700 hover:underline">
            View {archivedCount} archived {archivedCount === 1 ? "payment" : "payments"} →
          </Link>
        </div>
      ) : showArchived ? (
        <div className="mb-6">
          <Link href="/admin/payments" className="text-sm font-medium text-brand-700 hover:underline">
            ← Back to active payments
          </Link>
        </div>
      ) : null}

      {!showArchived && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CostBox label="Total cost" value={totalCost} accent />
          {(projects ?? []).length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
              No projects yet.
            </p>
          )}
          {(projects ?? []).map((p) => (
            <Link key={p.id} href={`/admin/payments/${p.id}`}>
              <CostBox label={p.name} value={byProject.get(p.id)?.spend ?? 0} />
            </Link>
          ))}
          {unassignedCount > 0 && (
            <Link href="/admin/payments/unassigned">
              <CostBox label="No project" value={unassignedSpend} />
            </Link>
          )}
        </div>
      )}

      {showArchived && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
              No projects yet.
            </p>
          )}
          {(projects ?? []).map((p) => {
            const stats = byProject.get(p.id) ?? { count: 0, spend: 0 };
            return (
              <Link
                key={p.id}
                href={`/admin/payments/${p.id}${suffix}`}
                className="rounded-xl border border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
              >
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold">{p.name}</div>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    {p.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {stats.count} {stats.count === 1 ? "payment" : "payments"} archived
                </p>
                <p className="mt-3 text-sm font-medium text-brand-700">View payments →</p>
              </Link>
            );
          })}

          {unassignedCount > 0 && (
            <Link
              href={`/admin/payments/unassigned${suffix}`}
              className="rounded-xl border border-dashed border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
            >
              <div className="font-semibold text-slate-700">No project</div>
              <p className="mt-2 text-sm text-slate-600">
                {unassignedCount} {unassignedCount === 1 ? "payment" : "payments"} archived
              </p>
              <p className="mt-3 text-sm font-medium text-brand-700">View payments →</p>
            </Link>
          )}
        </div>
      )}
    </AdminPage>
  );
}
