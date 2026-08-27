export default function MaterialsLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 w-full animate-pulse">
      <div className="h-7 w-36 rounded bg-slate-200 mb-2" />
      <div className="h-4 w-64 rounded bg-slate-100 mb-8" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--line)] bg-white p-5">
            <div className="h-5 w-24 rounded bg-slate-200 mb-3" />
            <div className="h-3 w-36 rounded bg-slate-100 mb-2" />
            <div className="h-3 w-28 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
