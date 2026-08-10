import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DownloadSitePdfButton } from "@/components/admin/ReportPdf";
import { DownloadSiteCsvButton } from "@/components/admin/ReportCsv";
import { lineTotal } from "@/lib/money";
import { formatDateTime } from "@/lib/dateFormat";

export default async function ClientSiteReportPage({ params }: { params: { id: string } }) {
  const { user } = await requireRole("client");
  const supabase = createSupabaseServerClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!client) notFound();

  const [{ data: project }, { data: materials }, { data: payments }, { data: updates }, { data: wageTotals }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, name, status, completion_pct, total_cost, address, current_stage, end_date, original_end_date, extension_reason, client_id, agreement_image_url",
        )
        .eq("id", params.id)
        .eq("client_id", client.id)
        .single(),
      supabase
        .from("materials")
        .select("id, name, unit, quantity, unit_cost, status, ordered_at, delivered_at")
        .eq("project_id", params.id)
        .is("archived_at", null),
      supabase
        .from("payments")
        .select("id, amount, status, description, payee_type, created_at")
        .eq("project_id", params.id)
        .is("archived_at", null),
      supabase
        .from("project_updates")
        .select("id, stage, note, image_url, created_at")
        .eq("project_id", params.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      // Attendance wages for this project (total only, no labourer detail) via a
      // security-definer RPC -- clients can't read the attendance table directly.
      supabase.rpc("my_project_wage_totals"),
    ]);
  if (!project) notFound();

  const wages = Number(
    ((wageTotals ?? []) as { project_id: string; wage_total: number }[]).find(
      (w) => w.project_id === params.id,
    )?.wage_total ?? 0,
  );

  const spent =
    (materials ?? [])
      .filter((m) => m.status !== "returned")
      .reduce((sum, m) => sum + lineTotal(m.quantity, m.unit_cost), 0) +
    (payments ?? [])
      // Labour only: supplier payments settle already-counted material costs.
      .filter((p) => (p.status === "paid" || p.status === "approved") && p.payee_type === "labour")
      .reduce((sum, p) => sum + Number(p.amount), 0) +
    wages;

  const budget = Number(project.total_cost);
  const completionPct = Number(project.completion_pct);

  const transactions = [
    ...(materials ?? []).map((m) => ({
      date: m.delivered_at ?? m.ordered_at ?? null,
      type: "Material",
      description: `${m.name} (${m.quantity} ${m.unit})`,
      amount: lineTotal(m.quantity, m.unit_cost),
      status: m.status,
    })),
    ...(payments ?? []).map((p) => ({
      date: p.created_at ?? null,
      type: p.payee_type === "labour" ? "Payment · labour" : "Payment · supplier",
      description: p.description || "—",
      amount: Number(p.amount),
      status: p.status,
    })),
    // One aggregate line, not per-labourer -- clients don't see individual
    // worker attendance, just the total labour-wage cost on their project.
    ...(wages > 0
      ? [{ date: null, type: "Labour wages", description: "Wages accrued from attendance", amount: wages, status: "" }]
      : []),
  ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const extended =
    project.original_end_date != null && project.end_date != null && project.end_date > project.original_end_date;

  const pdfSite = {
    name: project.name,
    status: project.status,
    completionPct,
    budget,
    spent,
    detail: {
      client: null,
      address: project.address,
      stage: project.current_stage,
      startDate: null,
      endDate: project.end_date,
      extended,
      originalEndDate: project.original_end_date,
      extensionReason: project.extension_reason,
    },
    transactions: transactions.map((t) => ({
      date: formatDateTime(t.date),
      type: t.type,
      description: t.description,
      amount: t.amount,
      status: t.status,
    })),
    updates: (updates ?? []).map((u) => ({
      stage: u.stage,
      note: u.note,
      date: formatDateTime(u.created_at),
      imageUrl: u.image_url,
    })),
  };

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <Link href="/client/reports" className="text-sm text-slate-600 hover:underline">← Reports</Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Report</p>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Status: {project.status}</p>
        </div>
        <div className="flex gap-2">
          <DownloadSiteCsvButton site={pdfSite} />
          <DownloadSitePdfButton site={pdfSite} />
        </div>
      </div>

      {project.agreement_image_url && (
        <div className="mt-6 max-w-xl rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Agreement</h2>
          <Image
            src={project.agreement_image_url} alt="" width={640} height={480} loading="lazy"
            className="max-h-96 w-auto rounded-lg border border-slate-200 object-cover"
          />
          <a
            href={`${project.agreement_image_url}?download`}
            className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
          >
            Download agreement
          </a>
        </div>
      )}
    </main>
  );
}
