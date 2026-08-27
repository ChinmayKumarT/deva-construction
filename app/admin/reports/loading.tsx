export default function ReportsLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 w-full animate-pulse">
      <div className="h-7 w-32 rounded bg-slate-200 mb-2" />
      <div className="h-4 w-80 rounded bg-slate-100 mb-8" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--line)] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 w-28 rounded bg-slate-200" />
              <div className="h-5 w-16 rounded-full bg-slate-100" />
            </div>
            <div className="h-3 w-36 rounded bg-slate-100 mb-4" />
            <div className="h-2 w-full rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
