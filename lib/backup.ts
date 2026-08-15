import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const TABLES = [
  "profiles",
  "clients",
  "suppliers",
  "labourers",
  "projects",
  "project_labourers",
  "materials",
  "payments",
  "attendance",
  "project_updates",
  "personal_transactions",
  "project_change_orders",
  "client_payments",
] as const;

const PAGE_SIZE = 1000;

async function fetchAllRows(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  table: string,
) {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export interface BackupResult {
  metadata: {
    timestamp: string;
    tables: Record<string, number>;
    storageFiles: number;
  };
  tables: Record<string, Record<string, unknown>[]>;
  storageManifest: { name: string; url: string }[];
}

export async function generateFullBackup(): Promise<BackupResult> {
  const supabase = createSupabaseAdmin();
  const tables: Record<string, Record<string, unknown>[]> = {};
  const tableCounts: Record<string, number> = {};

  for (const table of TABLES) {
    const rows = await fetchAllRows(supabase, table);
    tables[table] = rows;
    tableCounts[table] = rows.length;
  }

  const storageManifest: { name: string; url: string }[] = [];
  async function listRecursive(prefix: string) {
    const { data: items } = await supabase.storage
      .from("project-images")
      .list(prefix, { limit: 10000 });
    if (!items) return;
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.metadata) {
        const { data: urlData } = supabase.storage
          .from("project-images")
          .getPublicUrl(path);
        storageManifest.push({ name: path, url: urlData.publicUrl });
      } else {
        await listRecursive(path);
      }
    }
  }
  await listRecursive("");

  return {
    metadata: {
      timestamp: new Date().toISOString(),
      tables: tableCounts,
      storageFiles: storageManifest.length,
    },
    tables,
    storageManifest,
  };
}
