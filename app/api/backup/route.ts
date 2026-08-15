import { NextRequest, NextResponse } from "next/server";
import { getSessionAndRole } from "@/lib/supabase/server";
import { generateFullBackup } from "@/lib/backup";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized(msg: string) {
  return NextResponse.json({ error: msg }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  if (bearer) {
    if (!process.env.BACKUP_API_SECRET || bearer !== process.env.BACKUP_API_SECRET) {
      return unauthorized("Invalid token");
    }
  } else {
    const { user, role, isOwner } = await getSessionAndRole();
    if (!user || role !== "admin" || !isOwner) {
      return unauthorized("Owner access required");
    }
  }

  const backup = await generateFullBackup();
  const format = req.nextUrl.searchParams.get("format");

  if (format === "json") {
    return NextResponse.json(backup);
  }

  const wb = XLSX.utils.book_new();

  for (const [table, rows] of Object.entries(backup.tables)) {
    const ws = XLSX.utils.json_to_sheet(rows as Record<string, unknown>[]);
    XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
  }

  const manifestWs = XLSX.utils.json_to_sheet(backup.storageManifest);
  XLSX.utils.book_append_sheet(wb, manifestWs, "storage_manifest");

  const metaRows = Object.entries(backup.metadata.tables).map(([t, c]) => ({
    table: t,
    rows: c,
  }));
  metaRows.push({ table: "storage_files", rows: backup.metadata.storageFiles });
  const metaWs = XLSX.utils.json_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, metaWs, "metadata");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const date = new Date().toISOString().slice(0, 10);

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="deva-backup-${date}.xlsx"`,
    },
  });
}
