export function AdminPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-8">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
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
        className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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
        className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        {children}
      </select>
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 active:bg-brand-800 transition"
    >
      {children}
    </button>
  );
}

export function CostBox({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={
        "rounded-2xl p-5 transition " +
        (accent ? "bg-forest text-white shadow-sm" : "border border-[var(--line)] bg-white hover:border-brand/40")
      }
    >
      <div className={"text-[11px] uppercase tracking-[0.12em] " + (accent ? "text-white/60" : "text-slate-500")}>
        {label}
      </div>
      <div className={"mt-2 font-serif text-3xl font-semibold " + (accent ? "text-white" : "text-ink")}>
        ₹{value.toLocaleString()}
      </div>
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
                <td key={j} className="px-4 py-3 text-slate-700">{cell ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
