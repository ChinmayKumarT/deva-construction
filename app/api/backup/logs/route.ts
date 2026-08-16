import { NextResponse } from "next/server";
import { getSessionAndRole } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, role, isOwner } = await getSessionAndRole();
  if (!user || role !== "admin" || !isOwner) {
    return NextResponse.json({ error: "Owner access required" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("backup_logs")
    .select("id, type, format, created_at, table_counts")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ logs: [] });
  }

  return NextResponse.json({ logs: data ?? [] });
}
