import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminPage, AdminPageHeader } from "@/components/admin/Page";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Result = { type: string; id: string; title: string; subtitle: string; href: string };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  let results: Result[] = [];

  if (q.length >= 2) {
    const supabase = createSupabaseServerClient();
    const like = `%${q}%`;

    const [
      { data: projects },
      { data: clients },
      { data: suppliers },
      { data: labourers },
      { data: materials },
      { data: payments },
    ] = await Promise.all([
      supabase.from("projects").select("id, name, status, current_stage").is("archived_at", null).ilike("name", like).limit(10),
      supabase.from("clients").select("id, name, email, phone").is("archived_at", null).ilike("name", like).limit(10),
      supabase.from("suppliers").select("id, name, email, phone").is("archived_at", null).ilike("name", like).limit(10),
      supabase.from("labourers").select("id, name, phone, category").is("archived_at", null).ilike("name", like).limit(10),
      supabase.from("materials").select("id, name, project_id, status, projects(name)").is("archived_at", null).ilike("name", like).limit(10),
      supabase.from("payments").select("id, amount, description, status, projects(name)").is("archived_at", null).ilike("description", like).limit(10),
    ]);

    for (const p of projects ?? []) {
      results.push({
        type: "Project", id: p.id, title: p.name,
        subtitle: `${p.status}${p.current_stage ? ` · ${p.current_stage}` : ""}`,
        href: `/admin/projects/${p.id}`,
      });
    }
    for (const c of clients ?? []) {
      results.push({
        type: "Client", id: c.id, title: c.name,
        subtitle: [c.email, c.phone].filter(Boolean).join(" · ") || "No contact info",
        href: `/admin/clients/${c.id}`,
      });
    }
    for (const s of suppliers ?? []) {
      results.push({
        type: "Supplier", id: s.id, title: s.name,
        subtitle: [s.email, s.phone].filter(Boolean).join(" · ") || "No contact info",
        href: `/admin/suppliers/${s.id}`,
      });
    }
    for (const l of labourers ?? []) {
      results.push({
        type: "Labourer", id: l.id, title: l.name,
        subtitle: [l.category, l.phone].filter(Boolean).join(" · ") || "No details",
        href: `/admin/labourers`,
      });
    }
    for (const m of materials ?? []) {
      results.push({
        type: "Material", id: m.id, title: m.name,
        // @ts-expect-error relation
        subtitle: `${m.status}${m.projects?.name ? ` · ${m.projects.name}` : ""}`,
        href: `/admin/materials`,
      });
    }
    for (const p of payments ?? []) {
      results.push({
        type: "Payment", id: p.id, title: p.description ?? `₹${Number(p.amount).toLocaleString()}`,
        // @ts-expect-error relation
        subtitle: `${p.status}${p.projects?.name ? ` · ${p.projects.name}` : ""}`,
        href: `/admin/payments`,
      });
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader title="Search" subtitle="Find projects, clients, suppliers, materials, and payments." />

      <form className="mb-6 max-w-xl">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name, description..."
            autoFocus
            className="w-full rounded-lg border border-[var(--line)] bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </form>

      {q.length > 0 && q.length < 2 && (
        <p className="text-sm text-slate-500">Type at least 2 characters to search.</p>
      )}

      {q.length >= 2 && results.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-slate-500">
          No results for &ldquo;{q}&rdquo;.
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2 max-w-xl">
          <p className="text-xs text-slate-500 mb-3">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.map((r) => (
            <Link
              key={`${r.type}-${r.id}`}
              href={r.href}
              className="flex items-center gap-4 rounded-lg border border-[var(--line)] bg-white p-4 hover:border-brand/30 hover:shadow-sm transition"
            >
              <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {r.type}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-sm text-ink truncate">{r.title}</div>
                <div className="text-xs text-slate-500 truncate">{r.subtitle}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
