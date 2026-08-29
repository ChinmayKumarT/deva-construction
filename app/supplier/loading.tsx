export default function SupplierLoading() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="bg-gradient-to-br from-[var(--brand)] via-[var(--brand-deep)] to-slate-900 px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="h-4 w-28 rounded bg-white/20" />
          <div className="mt-2 h-8 w-48 rounded bg-white/30" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 -mt-14">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="mt-3 h-6 w-20 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="mt-10 mb-4 flex items-center gap-3">
          <div className="h-5 w-36 rounded bg-slate-200" />
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-3 w-20 rounded bg-slate-100 mb-2" />
                <div className="h-9 w-full rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 mb-4 flex items-center gap-3">
          <div className="h-5 w-28 rounded bg-slate-200" />
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`flex gap-4 px-5 py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}>
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="h-4 w-20 rounded bg-slate-100" />
              <div className="h-4 w-16 rounded bg-slate-100" />
              <div className="h-4 w-20 rounded bg-slate-200 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
