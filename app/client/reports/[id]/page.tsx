import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ClientSiteReportPage({ params }: { params: { id: string } }) {
  const { user } = await requireRole("client");
  const supabase = createSupabaseServerClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!client) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, agreement_image_url")
    .eq("id", params.id)
    .eq("client_id", client.id)
    .single();
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <Link href="/client/reports" className="text-sm text-slate-600 hover:underline">← Reports</Link>
      <div className="mt-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Report</p>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Status: {project.status}</p>
      </div>

      {project.agreement_image_url && (
        <div className="mt-6 max-w-xl rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Agreement</h2>
          <Image
            src={project.agreement_image_url} alt="" width={640} height={480} loading="lazy"
            className="max-h-96 w-auto rounded-lg border border-slate-200 object-cover"
          />
          <a
            href={`${project.agreement_image_url}?download`}
            className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
          >
            Download agreement
          </a>
        </div>
      )}
    </main>
  );
}
