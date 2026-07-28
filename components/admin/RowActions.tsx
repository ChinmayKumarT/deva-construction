import Link from "next/link";

/**
 * Shared Edit / Archive / Restore controls for the admin list pages.
 * "Archive" is a reversible hide, never a DELETE -- see supabase/10_archive.sql
 * for why (the foreign keys cascade and would destroy dependent records).
 */

export function RowActions({
  editHref,
  id,
  name,
  archiveAction,
}: {
  editHref: string;
  id: string;
  name: string;
  archiveAction: (fd: FormData) => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={editHref}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
      >
        Edit
      </Link>
      <form action={archiveAction}>
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          title={`Hide ${name} from lists. Nothing is deleted and it can be restored.`}
          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
        >
          Archive
        </button>
      </form>
    </div>
  );
}

export function RestoreAction({
  id,
  action,
}: {
  id: string;
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
      >
        Restore
      </button>
    </form>
  );
}

export function ArchivedToggle({
  basePath,
  showArchived,
  archivedCount,
  label,
}: {
  basePath: string;
  showArchived: boolean;
  archivedCount: number | null;
  label: string;
}) {
  // basePath may already carry a query string (e.g. a ?project= filter), so
  // join with & in that case rather than a second ?.
  const withArchived = `${basePath}${basePath.includes("?") ? "&" : "?"}archived=1`;
  if (showArchived) {
    return (
      <Link href={basePath} className="text-sm font-medium text-brand-700 hover:underline">
        ← Back to active {label}
      </Link>
    );
  }
  if (!archivedCount) return null;
  return (
    <Link href={withArchived} className="text-sm font-medium text-brand-700 hover:underline">
      View {archivedCount} archived {label} →
    </Link>
  );
}

/** Card wrapper used by the per-row manage sections on the list pages. */
export function ManageCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 text-sm font-medium">{title}</div>
      {children}
    </div>
  );
}

export function ManageSection({
  showArchived,
  children,
}: {
  showArchived: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {showArchived ? "Restore" : "Manage"}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
