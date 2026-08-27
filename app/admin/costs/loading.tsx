export default function CostsLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 w-full animate-pulse">
      <div className="h-7 w-44 rounded bg-slate-200 mb-2" />
      <div className="h-4 w-72 rounded bg-slate-100 mb-8" />

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-3 w-24 rounded bg-slate-100 mb-3" />
            <div className="h-7 w-28 rounded bg-slate-200" />
          </div>
        ))}
      </section>

      <div className="rounded-xl border border-[var(--line)] bg-white">
        <div className="bg-slate-50 px-4 py-3 flex gap-8">
          {["Project", "Status", "Budget", "Materials", "Wages", "Spent", "Remaining"].map((_, i) => (
            <div key={i} className="h-3 w-16 rounded bg-slate-200" />
          ))}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border-t border-[var(--line)] px-4 py-3 flex gap-8">
            {[...Array(7)].map((_, j) => (
              <div key={j} className="h-3 w-16 rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
