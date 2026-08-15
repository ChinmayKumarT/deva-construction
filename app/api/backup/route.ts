import { NextRequest, NextResponse } from "next/server";
import { getSessionAndRole } from "@/lib/supabase/server";
import { generateFullBackup } from "@/lib/backup";
import JSZip from "jszip";

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

  const zip = new JSZip();
  zip.file("metadata.json", JSON.stringify(backup.metadata, null, 2));
  zip.file("storage-manifest.json", JSON.stringify(backup.storageManifest, null, 2));
  for (const [table, rows] of Object.entries(backup.tables)) {
    zip.file(`${table}.json`, JSON.stringify(rows, null, 2));
  }

  const date = new Date().toISOString().slice(0, 10);
  const buf = await zip.generateAsync({ type: "arraybuffer" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="deva-backup-${date}.zip"`,
    },
  });
}
