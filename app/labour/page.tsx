import Link from "next/link";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";
import { selfCheckIn } from "./actions";

const WAGE_FACTOR: Record<"present" | "half_day" | "absent", number> = {
  present: 1,
  half_day: 0.5,
  absent: 0,
};

export default async function LabourDashboard() {
  const { user } = await requireRole("labour");
  const supabase = createSupabaseServerClient();

  const { data: labourer } = await supabase
    .from("labourers")
    .select("id, name, daily_wage")
    .eq("profile_id", user.id)
    .single();

  if (!labourer) {
    return (
      <main className="mx-auto max-w-2xl p-10">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <p className="mt-3 text-slate-600">
          Your account isn't linked to a labourer record yet. Ask the admin to link you in the Labourers page.
        </p>
        <form action={signOut} className="mt-6">
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">Sign out</button>
        </form>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const [{ data: assignment }, { data: todayRow }, { data: history }] = await Promise.all([
    supabase
      .from("project_labourers")
      .select("project_id, projects(name)")
      .eq("labourer_id", labourer.id)
      .is("unassigned_at", null)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("status, check_in")
      .eq("labourer_id", labourer.id)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("date, status, projects(name)")
      .eq("labourer_id", labourer.id)
      .gte("date", weekStartStr)
      .order("date", { ascending: false }),
  ]);

  const wage = Number(labourer.daily_wage);
  const weekly =
    (history ?? []).reduce((s, r) => s + (WAGE_FACTOR[r.status as keyof typeof WAGE_FACTOR] ?? 0), 0) * wage;

  // @ts-expect-error relation
  const currentSite = assignment?.projects?.name ?? "unassigned";

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Labour dashboard</p>
          <h1 className="text-2xl font-bold">{labourer.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <form action={signOut}>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">Sign out</button>
          </form>
          <DeleteAccountButton />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Today's status" value={todayRow?.status?.replace("_", " ") ?? "not marked"} />
        <Stat label="Current site" value={currentSite} />
        <Stat label="Daily wage" value={`₹${wage.toLocaleString()}`} />
        <Stat label="This week's wage" value={`₹${weekly.toLocaleString()}`} />
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Mark today</h2>
        <div className="flex flex-wrap gap-2">
          {(["present", "half_day", "absent"] as const).map((s) => (
            <form key={s} action={selfCheckIn}>
              <input type="hidden" name="status" value={s} />
              <button
                className={
                  "rounded-lg border px-3 py-1.5 text-sm " +
                  (todayRow?.status === s
                    ? "border-slate-800 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100")
                }
              >
                {s.replace("_", " ")}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Last 7 days</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Site</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Wage</th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No attendance recorded.</td></tr>
              )}
              {history?.map((r) => (
                <tr key={r.date} className="border-t border-slate-100">
                  <td className="px-4 py-2">{r.date}</td>
                  {/* @ts-expect-error relation */}
                  <td className="px-4 py-2 text-slate-600">{r.projects?.name ?? "—"}</td>
                  <td className="px-4 py-2">{r.status.replace("_", " ")}</td>
                  <td className="px-4 py-2 text-slate-700">
                    ₹{(WAGE_FACTOR[r.status as keyof typeof WAGE_FACTOR] * wage).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold capitalize">{value}</div>
    </div>
  );
}
