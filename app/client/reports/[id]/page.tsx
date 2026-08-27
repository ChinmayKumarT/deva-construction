import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 60;

export default async function ClientSiteReportPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user } = await requireRole("client");
  const supabase = await createSupabaseServerClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!client) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, completion_pct, total_cost, current_stage, start_date, end_date, agreement_image_url")
    .eq("id", params.id)
    .eq("client_id", client.id)
    .single();
  if (!project) notFound();

  const pct = Number(project.completion_pct);
  const budget = Number(project.total_cost);

  const STATUS_STYLE: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    completed: "bg-blue-50 text-blue-700 ring-blue-200",
    on_hold: "bg-amber-50 text-amber-700 ring-amber-200",
    cancelled: "bg-red-50 text-red-700 ring-red-200",
  };
  const statusCls = STATUS_STYLE[project.status] ?? "bg-slate-50 text-slate-600 ring-slate-200";

  return (
    <main className="min-h-screen">
      <div className="bg-gradient-to-br from-[var(--brand)] via-[var(--brand-deep)] to-slate-900 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link href="/client/reports" className="inline-flex items-center gap-1 text-sm text-white/60 transition hover:text-white">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
            Reports
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusCls}`}>
              {project.status}
            </span>
          </div>
          {project.current_stage && (
            <p className="mt-1 text-sm text-white/60">Stage: {project.current_stage}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 -mt-10">
        {/* Overview cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Completion</div>
            <div className="mt-2 text-xl font-bold text-brand-700">{pct.toFixed(0)}%</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-500"
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Budget</div>
            <div className="mt-2 text-xl font-bold text-slate-800">₹{budget.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Timeline</div>
            <div className="mt-2 text-sm font-medium text-slate-700">
              {project.start_date ?? "—"} → {project.end_date ?? "—"}
            </div>
          </div>
        </div>

        {project.agreement_image_url && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-800">Agreement</h2>
            <Image
              src={project.agreement_image_url} alt="" width={640} height={480} loading="lazy"
              className="max-h-96 w-auto rounded-xl border border-slate-100 object-cover"
            />
            <a
              href={`${project.agreement_image_url}?download`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12M12 16.5V3" /></svg>
              Download agreement
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
