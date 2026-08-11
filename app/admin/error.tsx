"use client";

// Catches any thrown error from admin pages/Server Actions (validation
// errors like the attendance overlap guard, "Amount cannot be negative",
// etc.) and shows it inline instead of Next's default crash screen. Scoped
// to /admin so the Sidebar (rendered by app/admin/layout.tsx, a parent of
// this boundary) stays usable -- only the content area is replaced.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 w-full">
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-semibold text-red-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-red-800">{error.message || "An unexpected error occurred."}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
