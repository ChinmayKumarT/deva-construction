export default function AdminLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 w-full animate-pulse">
      <div className="h-7 w-40 rounded bg-slate-200 mb-2" />
      <div className="h-4 w-64 rounded bg-slate-100 mb-8" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border border-[var(--line)] bg-white p-5">
            <div className="h-3 w-24 rounded bg-slate-100 mb-3" />
            <div className="h-6 w-20 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-white">
        <div className="bg-slate-50 px-4 py-3 flex gap-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 w-16 rounded bg-slate-200" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-t border-[var(--line)] px-4 py-3 flex gap-8">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="h-3 w-20 rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
