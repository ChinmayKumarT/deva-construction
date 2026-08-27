export default function CashFlowLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 w-full animate-pulse">
      <div className="h-7 w-36 rounded bg-slate-200 mb-2" />
      <div className="h-4 w-96 rounded bg-slate-100 mb-8" />

      <div className="mb-8 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="h-9 w-36 rounded-lg bg-slate-100" />
        <div className="h-9 w-36 rounded-lg bg-slate-100" />
        <div className="h-9 w-20 rounded-lg bg-slate-200" />
      </div>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border border-[var(--line)] bg-white p-5">
            <div className="h-3 w-28 rounded bg-slate-100 mb-3" />
            <div className="h-7 w-24 rounded bg-slate-200" />
          </div>
        ))}
      </section>

      <div className="mb-8 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="h-3 w-48 rounded bg-slate-100 mb-4" />
        <div className="h-40 w-full rounded bg-slate-50" />
      </div>

      <div className="mb-8 rounded-xl border border-[var(--line)] bg-white p-5">
        <div className="h-3 w-36 rounded bg-slate-100 mb-4" />
        <div className="h-32 w-full rounded bg-slate-50" />
      </div>
    </div>
  );
}
