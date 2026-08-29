import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, AdminContent, DataTable, Field, SubmitButton } from "@/components/admin/Page";
import { DownloadAttendancePdfButton } from "@/components/admin/ReportPdf";
import { DownloadAttendanceCsvButton } from "@/components/admin/ReportCsv";
import { reduceAttendance, defaultAttendanceRange } from "@/lib/attendance";

export default async function AttendanceIndexPage(
  props: {
    searchParams: Promise<{ from?: string; to?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createSupabaseServerClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const { fromStr, toStr } = defaultAttendanceRange();
  const from = searchParams.from || fromStr;
  const to = searchParams.to || toStr;

  const [{ data: projects }, { data: labourers }, { data: rangeRows }, { data: todayRows }] = await Promise.all([
    supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
    supabase.from("labourers").select("id, name, daily_wage, category").is("archived_at", null).eq("active", true).order("name"),
    supabase.from("attendance").select("labourer_id, status, project_id, date").gte("date", from).lte("date", to),
    supabase.from("attendance").select("project_id").eq("date", todayStr),
  ]);

  const markedTodayByProject = new Map<string, number>();
  for (const r of todayRows ?? []) {
    if (!r.project_id) continue;
    markedTodayByProject.set(r.project_id, (markedTodayByProject.get(r.project_id) ?? 0) + 1);
  }

  const summary = reduceAttendance(rangeRows ?? [], labourers ?? [], from, to);
  const summaryRows = summary.map((s) => [
    s.name,
    s.category ?? "—",
    s.present,
    s.halfDay,
    s.absent,
    s.daysWorked,
    `₹${s.wages.toLocaleString()}`,
  ]);
  const exportData = {
    from,
    to,
    labourers: summary.map((s) => ({
      name: s.name,
      category: s.category,
      present: s.present,
      halfDay: s.halfDay,
      absent: s.absent,
      daysWorked: s.daysWorked,
      wages: s.wages,
    })),
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title="Attendance"
        subtitle="Pick a site to mark today's attendance. A labourer can be marked at more than one site on the same day."
      />
      <AdminContent>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(projects ?? []).length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
            No projects yet.
          </p>
        )}
        {(projects ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/admin/attendance/${p.id}`}
            className="rounded-xl border border-[var(--line)] bg-white p-5 hover:border-brand hover:shadow-sm transition"
          >
            <div className="font-semibold">{p.name}</div>
            <p className="mt-2 text-sm text-slate-600">
              {markedTodayByProject.get(p.id) ?? 0} marked today
            </p>
            <p className="mt-3 text-sm font-medium text-brand-700">Mark attendance →</p>
          </Link>
        ))}
      </div>

      <AdminPageHeader title="Attendance summary" subtitle="Per-labourer counts and wages over a date range." />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <Field label="From" name="from" type="date" defaultValue={from} />
        <Field label="To" name="to" type="date" defaultValue={to} />
        <SubmitButton>Apply</SubmitButton>
        <a href="/admin/attendance" className="text-sm font-medium text-brand-700 hover:underline">
          Clear filter
        </a>
        <div className="ml-auto flex gap-2">
          <DownloadAttendanceCsvButton data={exportData} />
          <DownloadAttendancePdfButton data={exportData} />
        </div>
      </form>

      <DataTable
        columns={["Labourer", "Category", "Present", "Half day", "Absent", "Days worked", "Wages earned"]}
        rows={summaryRows}
        empty="No attendance recorded in this date range."
      />
      </AdminContent>
    </AdminPage>
  );
}
