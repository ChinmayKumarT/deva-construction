import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader, DataTable, Field, SubmitButton } from "@/components/admin/Page";
import { DownloadAttendancePdfButton } from "@/components/admin/ReportPdf";
import { DownloadAttendanceCsvButton } from "@/components/admin/ReportCsv";
import { reduceAttendance, defaultAttendanceRange } from "@/lib/attendance";
import { markAttendance } from "../actions";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { date?: string; from?: string; to?: string };
}) {
  const supabase = createSupabaseServerClient();
  const date = searchParams.date ?? new Date().toISOString().slice(0, 10);
  const { fromStr, toStr } = defaultAttendanceRange();
  const from = searchParams.from || fromStr;
  const to = searchParams.to || toStr;
  const rangeCoversDate = date >= from && date <= to;

  const [{ data: labourers }, { data: assignments }, { data: rows }, { data: rangeRows }, { data: projects }] = await Promise.all([
    supabase.from("labourers").select("id, name, daily_wage, category").is("archived_at", null).eq("active", true).order("name"),
    supabase.from("project_labourers").select("labourer_id, project_id, assigned_at, unassigned_at").is("unassigned_at", null),
    rangeCoversDate
      ? Promise.resolve({ data: null as { labourer_id: string; status: string; project_id: string | null }[] | null })
      : supabase.from("attendance").select("labourer_id, status, project_id").eq("date", date),
    supabase.from("attendance").select("labourer_id, status, project_id, date").gte("date", from).lte("date", to),
    supabase.from("projects").select("id, name").is("archived_at", null).order("name"),
  ]);

  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const currentSite = new Map((assignments ?? []).map((a) => [a.labourer_id, a.project_id]));
  const todaySource = rangeCoversDate
    ? (rangeRows ?? []).filter((r) => r.date === date)
    : rows ?? [];
  const today = new Map(todaySource.map((r) => [r.labourer_id, r.status]));

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
      <AdminPageHeader title="Attendance" subtitle="Mark daily attendance per labourer." />

      <form method="get" className="mb-6 flex items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Date</span>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </label>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Load
        </button>
        <Link href="/admin/attendance" className="text-sm text-slate-600 hover:underline">Today</Link>
      </form>

      {(!labourers || labourers.length === 0) && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No active labourers. Add one in <Link className="underline" href="/admin/labourers">Labourers</Link>.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Labourer</th>
              <th className="px-4 py-2 font-medium">Current site</th>
              <th className="px-4 py-2 font-medium">Daily wage</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Mark</th>
            </tr>
          </thead>
          <tbody>
            {labourers?.map((l) => {
              const siteId = currentSite.get(l.id);
              const status = today.get(l.id);
              return (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{l.name}</td>
                  <td className="px-4 py-2 text-slate-600">{siteId ? projectName.get(siteId) ?? "—" : "—"}</td>
                  <td className="px-4 py-2 text-slate-600">₹{Number(l.daily_wage).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        status === "present"
                          ? "text-emerald-700"
                          : status === "half_day"
                          ? "text-amber-700"
                          : status === "absent"
                          ? "text-red-700"
                          : "text-slate-400"
                      }
                    >
                      {status ?? "not marked"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {(["present", "half_day", "absent"] as const).map((s) => (
                        <form key={s} action={markAttendance}>
                          <input type="hidden" name="labourer_id" value={l.id} />
                          <input type="hidden" name="project_id" value={siteId ?? ""} />
                          <input type="hidden" name="date" value={date} />
                          <input type="hidden" name="status" value={s} />
                          <button
                            className={
                              "rounded-md border px-2 py-1 text-xs " +
                              (status === s
                                ? "border-slate-800 bg-slate-900 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100")
                            }
                          >
                            {s.replace("_", " ")}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
    </AdminPage>
  );
}
