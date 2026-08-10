import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, SubmitButton } from "@/components/admin/Page";
import { CashFlowBarChart } from "@/components/admin/CashFlowBarChart";
import { CashFlowTrendChart } from "@/components/admin/CashFlowTrendChart";
import { DownloadCashFlowPdfButton } from "@/components/admin/ReportPdf";
import { DownloadCashFlowCsvButton } from "@/components/admin/ReportCsv";
import { computeCashFlow, defaultCashFlowRange } from "@/lib/cashflow";

const MATERIALS_COLOR = "#16a34a";
const LABOUR_COLOR = "#0EA5E9";
const WAGES_COLOR = "#A855F7";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { fromStr, toStr } = defaultCashFlowRange();
  const from = searchParams.from || fromStr;
  const to = searchParams.to || toStr;

  const [{ data: projects }, cashFlow] = await Promise.all([
    supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
    computeCashFlow(supabase, from, to),
  ]);

  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const projectIds = new Set([
    ...cashFlow.byProjectMaterials.keys(),
    ...cashFlow.byProjectLabour.keys(),
    ...cashFlow.byProjectWages.keys(),
  ]);

  const rows = Array.from(projectIds).map((id) => {
    const materials = cashFlow.byProjectMaterials.get(id) ?? 0;
    const labour = cashFlow.byProjectLabour.get(id) ?? 0;
    const wages = cashFlow.byProjectWages.get(id) ?? 0;
    return [
      projectName.get(id) ?? "—",
      `₹${materials.toLocaleString()}`,
      `₹${labour.toLocaleString()}`,
      `₹${wages.toLocaleString()}`,
      `₹${(materials + labour + wages).toLocaleString()}`,
    ];
  });

  const bars = [
    { label: "Materials", value: cashFlow.materialsCost, color: MATERIALS_COLOR },
    { label: "Labour payments", value: cashFlow.labourPayments, color: LABOUR_COLOR },
    { label: "Wages (attendance)", value: cashFlow.wages, color: WAGES_COLOR },
  ];

  const pdfData = {
    from, to,
    bars: bars.map((b) => ({ label: b.label, value: b.value, color: b.color })),
    total: cashFlow.total,
    projects: Array.from(projectIds).map((id) => ({
      name: projectName.get(id) ?? "—",
      materials: cashFlow.byProjectMaterials.get(id) ?? 0,
      labour: cashFlow.byProjectLabour.get(id) ?? 0,
      wages: cashFlow.byProjectWages.get(id) ?? 0,
    })),
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Cash flow"
        subtitle="Money going out over a date range: materials (including supplier payments), labour payments and attendance wages, shown separately."
      />

      <form method="get" className="mb-8 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <Field label="From" name="from" type="date" defaultValue={from} />
        <Field label="To" name="to" type="date" defaultValue={to} />
        <SubmitButton>Apply</SubmitButton>
        <a href="/admin/cashflow" className="text-sm font-medium text-brand-700 hover:underline">
          Clear filter
        </a>
        <div className="ml-auto flex gap-2">
          <DownloadCashFlowCsvButton data={pdfData} />
          <DownloadCashFlowPdfButton data={pdfData} />
        </div>
      </form>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Materials cost" value={cashFlow.materialsCost} />
        <SummaryCard label="Labour payments" value={cashFlow.labourPayments} />
        <SummaryCard label="Wages (attendance)" value={cashFlow.wages} />
        <SummaryCard label="Total outflow" value={cashFlow.total} accent />
      </section>

      <div className="mb-8 rounded-xl border border-[var(--line)] bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Cumulative outflow, {from} to {to}
        </h2>
        <CashFlowTrendChart daily={cashFlow.daily} />
      </div>

      <div className="mb-8 rounded-xl border border-[var(--line)] bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Outflow by category</h2>
        <CashFlowBarChart bars={bars} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">By project</h2>
      <DataTable
        columns={["Project", "Materials", "Labour payments", "Wages (attendance)", "Total"]}
        rows={rows}
        empty="No outflow recorded in this date range."
      />
    </AdminPage>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={
        "rounded-xl p-5 transition " +
        (accent ? "bg-brand text-white shadow-sm" : "border border-[var(--line)] bg-white hover:border-brand/40")
      }
    >
      <div className={"text-[11px] uppercase tracking-[0.12em] " + (accent ? "text-white/80" : "text-slate-500")}>
        {label}
      </div>
      <div className={"mt-2 text-2xl font-semibold " + (accent ? "text-white" : "text-ink")}>
        ₹{value.toLocaleString()}
      </div>
    </div>
  );
}
