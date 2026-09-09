import Link from "next/link";

// Scoped 404 for /admin. The root app/not-found.tsx offers "Back to sign in",
// which is the wrong exit for someone already signed in -- most admin 404s are
// a record that has since been deleted or archived, reached from a stale link
// or a bookmarked detail URL. Nested here so the Sidebar (app/admin/layout.tsx)
// survives and only the content area is replaced, same as app/admin/error.tsx.
export default function AdminNotFound() {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 w-full">
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Error 404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">We couldn&apos;t find that record</h1>
        <p className="mt-2 text-sm text-slate-600">
          It may have been deleted, or the link may be out of date.
        </p>
        <Link
          href="/admin"
          className="mt-4 inline-block rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
