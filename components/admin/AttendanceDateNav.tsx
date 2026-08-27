"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

function shiftDate(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function AttendanceDateNav({ projectId, date }: { projectId: string; date: string }) {
  const router = useRouter();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
