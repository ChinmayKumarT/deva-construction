export function AdminPageHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </header>
  );
}

export function AdminPage({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 w-full">{children}</div>;
}

export function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  step,
  min,
  max,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  step?: string;
  min?: string | number;
  max?: string | number;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        step={step}
        min={min}
        max={max}
        maxLength={maxLength}
        className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
    </label>
  );
}

export function Select({
  label,
  name,
  children,
  defaultValue,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        {children}
      </select>
    </label>
  );
}

export { SubmitButton } from "./SubmitButton";

// `accent` calls out the headline figure (e.g. "Total cost" among a row of
// otherwise-equal stats) with a colored number, not a solid fill -- a full-
// color tile reads as a marketing stat, not a dashboard figure.
// `warn` paints the value amber (80-99% of budget); `danger` paints it red (>=100%).
export function CostBox({ label, value, accent, warn, danger }: { label: string; value: number; accent?: boolean; warn?: boolean; danger?: boolean }) {
  const color = danger ? "text-red-600" : warn ? "text-amber-600" : accent ? "text-brand-600" : "text-ink";
  const border = danger ? "border-red-200" : warn ? "border-amber-200" : "border-[var(--line)]";
  return (
    <div className={`rounded-lg border ${border} bg-white p-5 transition hover:shadow-sm`}>
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}>
        ₹{value.toLocaleString()}
      </div>
    </div>
  );
}

export function BudgetAlert({ budget, spent }: { budget: number; spent: number }) {
  if (budget <= 0) return null;
  const pct = (spent / budget) * 100;
  if (pct < 80) return null;
  const over = pct >= 100;
  return (
    <div className={`mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
      over
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-amber-200 bg-amber-50 text-amber-800"
    }`}>
      <span className="text-lg">{over ? "⚠" : "⚡"}</span>
      <span>
        <span className="font-semibold">
          {over ? "Over budget" : "Approaching budget"}
        </span>
        {" — "}
        {pct.toFixed(1)}% of ₹{budget.toLocaleString()} spent
        {over && ` (₹${(spent - budget).toLocaleString()} over)`}
      </span>
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  empty = "No rows yet.",
}: {
  columns: string[];
  rows: (string | number | null)[][];
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
        {empty}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-forest-50 text-left text-[11px] uppercase tracking-wider text-forest-800/70">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-3 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[var(--line)] hover:bg-forest-50/50">
              {r.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-slate-700 whitespace-nowrap">{cell ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
