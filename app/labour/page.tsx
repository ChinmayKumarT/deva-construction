import { requireRole } from "@/lib/guard";

// Deliberately a dead end: labourers are records managed by the site manager,
// not users of the app. Attendance and wages are recorded for them on the
// admin Attendance page, so there is nothing here to read or do -- and the
// matching RLS policies were dropped in supabase/15_retire_labour_self_access.sql,
// so this page fetches nothing at all.
export default async function LabourHome() {
  const { user } = await requireRole("labour");

  return (
    <main className="mx-auto max-w-2xl p-10">
      <p className="text-xs uppercase tracking-wide text-slate-500">Deva Construction</p>
      <h1 className="mt-1 text-2xl font-bold">You&apos;re signed in</h1>
      <p className="mt-1 text-sm text-slate-500">{user.email}</p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-slate-700">
          Your attendance and wages are recorded by your site manager — there&apos;s nothing for you
          to fill in here.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          To check your days worked or wages owed, please speak to your site manager.
        </p>
      </div>
    </main>
  );
}
