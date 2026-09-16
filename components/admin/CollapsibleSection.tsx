import type { ReactNode } from "react";

/**
 * A list section that collapses behind a click-to-open card header -- the same
 * disclosure used for "Account activity". Native <details>, so it needs no
 * client JS and works instantly. Use it to tidy pages that stack several lists.
 *
 *   <CollapsibleSection title="Deliveries" count={12} defaultOpen>
 *     <table>…</table>
 *   </CollapsibleSection>
 */
export function CollapsibleSection({
  title,
  count,
  subtitle,
  defaultOpen = false,
  children,
  className = "mt-10",
}: {
  title: string;
  count?: number;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group ${className}`} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand hover:bg-brand/5 [&::-webkit-details-marker]:hidden">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-400 transition-transform group-open:rotate-90"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        {title}
        {count != null && (
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">{count}</span>
        )}
        {subtitle && <span className="ml-auto text-xs font-normal text-slate-400">{subtitle}</span>}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
