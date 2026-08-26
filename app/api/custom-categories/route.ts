import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WORK_CATEGORIES } from "@/lib/workCategories";

export const dynamic = "force-dynamic";

const builtIn = new Set<string>(WORK_CATEGORIES);

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const [{ data: p }, { data: m }, { data: l }] = await Promise.all([
    supabase.from("payments").select("work_category").not("work_category", "is", null).is("archived_at", null),
    supabase.from("materials").select("work_category").not("work_category", "is", null).is("archived_at", null),
    supabase.from("labourers").select("category").not("category", "is", null).is("archived_at", null),
  ]);
  const seen = new Set<string>();
  for (const row of p ?? []) if (row.work_category && !builtIn.has(row.work_category)) seen.add(row.work_category);
  for (const row of m ?? []) if (row.work_category && !builtIn.has(row.work_category)) seen.add(row.work_category);
  for (const row of l ?? []) if (row.category && !builtIn.has(row.category)) seen.add(row.category);
  return NextResponse.json(Array.from(seen).sort());
}
