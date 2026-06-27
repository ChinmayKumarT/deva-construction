import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";
import { markAttendance } from "../actions";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createSupabaseServerClient();
  const date = searchParams.date ?? new Date().toISOString().slice(0, 10);

  const [{ data: labourers }, { data: assignments }, { data: rows }, { data: projects }] = await Promise.all([
    supabase.from("labourers").select("id, name, daily_wage").eq("active", true).order("name"),
    supabase.from("project_labourers").select("labourer_id, project_id, assigned_at, unassigned_at").is("unassigned_at", null),
    supabase.from("attendance").select("labourer_id, status, project_id").eq("date", date),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const currentSite = new Map((assignments ?? []).map((a) => [a.labourer_id, a.project_id]));
  const today = new Map((rows ?? []).map((r) => [r.labourer_id, r.status]));

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
    </AdminPage>
  );
}
