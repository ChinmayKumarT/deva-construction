"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

function shiftDate(date: string, days: number) {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AttendanceDateNav({ projectId, date }: { projectId: string; date: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const isToday = date === today;

  function go(newDate: string) {
    router.push(`/admin/attendance/${projectId}?date=${newDate}`);
  }

  return (
    <div className="mb-6 flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(shiftDate(date, -1))}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        title="Previous day"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4" /></svg>
      </button>

      <input
        type="date"
        value={date}
        onChange={(e) => { if (e.target.value) go(e.target.value); }}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
      />

      <button
        type="button"
        onClick={() => go(shiftDate(date, 1))}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        title="Next day"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>
      </button>

      {!isToday && (
        <Link
          href={`/admin/attendance/${projectId}`}
          className="ml-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Today
        </Link>
      )}
    </div>
  );
}
