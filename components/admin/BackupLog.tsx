import { createSupabaseAdmin } from "@/lib/supabase/admin";

const REPO = "thedevaconstructions/deva-construction";
const WORKFLOW = "daily-backup.yml";

type GitHubRun = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  event: string;
};

type ManualLog = {
  id: string;
  type: string;
  format: string;
  created_at: string;
  table_counts: Record<string, number> | null;
};

type LogEntry = {
  key: string;
  date: string;
  source: "auto" | "manual";
  status: "success" | "failed" | "running" | "unknown";
  label: string;
  sublabel: string;
  href: string | null;
  badge: string;
  format?: string;
};

async function fetchGitHubRuns(): Promise<GitHubRun[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=10`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.workflow_runs ?? [];
  } catch {
    return [];
  }
}

async function fetchManualLogs(): Promise<ManualLog[]> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("backup_logs")
      .select("id, type, format, created_at, table_counts")
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  } catch {
    return [];
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function totalRows(counts: Record<string, number> | null): string {
  if (!counts) return "";
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return `${total.toLocaleString("en-IN")} rows`;
}

export default async function BackupLog() {
  const [runs, manualLogs] = await Promise.all([
    fetchGitHubRuns(),
    fetchManualLogs(),
  ]);

  const entries: LogEntry[] = [];

  for (const run of runs) {
    const success = run.conclusion === "success";
    const failed = run.conclusion === "failure";
    const inProgress = run.status === "in_progress" || run.status === "queued";

    entries.push({
      key: `gh-${run.id}`,
      date: run.created_at,
      source: "auto",
      status: success ? "success" : failed ? "failed" : inProgress ? "running" : "unknown",
      label: formatDate(run.created_at),
      sublabel: `${run.event === "schedule" ? "Scheduled" : "Manual trigger"} · ${relativeTime(run.created_at)}`,
      href: run.html_url,
      badge: success ? "Success" : failed ? "Failed" : inProgress ? "Running" : (run.conclusion ?? run.status),
    });
  }

  for (const log of manualLogs) {
    const rows = totalRows(log.table_counts);
    entries.push({
      key: `manual-${log.id}`,
      date: log.created_at,
      source: "manual",
      status: "success",
      label: formatDate(log.created_at),
      sublabel: `Downloaded ${log.format.toUpperCase()}${rows ? ` · ${rows}` : ""} · ${relativeTime(log.created_at)}`,
      href: null,
      badge: "Download",
      format: log.format,
    });
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const display = entries.slice(0, 15);

  if (display.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="font-semibold text-sm mb-2">Backup log</h3>
        <p className="text-sm text-[var(--muted)]">
          No backup activity yet.{" "}
          <a
            href={`https://github.com/${REPO}/actions/workflows/${WORKFLOW}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--primary)] underline underline-offset-2"
          >
            View on GitHub
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Backup log</h3>
        <a
          href={`https://github.com/${REPO}/actions/workflows/${WORKFLOW}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--primary)] hover:underline"
        >
          View all
        </a>
      </div>
      <div className="space-y-2">
        {display.map((entry) => {
          const Row = entry.href ? "a" : "div";
          const linkProps = entry.href
            ? { href: entry.href, target: "_blank" as const, rel: "noopener noreferrer" }
            : {};

          return (
            <Row
              key={entry.key}
              {...linkProps}
              className={`flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5 transition-colors ${
                entry.href ? "hover:bg-[var(--hover)]" : ""
              }`}
            >
              <span className="shrink-0">
                {entry.source === "manual" ? (
                  <svg className="h-4 w-4 text-blue-500" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14ZM7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z" />
                  </svg>
                ) : entry.status === "success" ? (
                  <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z" />
                  </svg>
                ) : entry.status === "failed" ? (
                  <svg className="h-4 w-4 text-red-500" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.343 13.657A8 8 0 1 1 13.66 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94 6.03 4.97Z" />
                  </svg>
                ) : entry.status === "running" ? (
                  <svg className="h-4 w-4 text-amber-500 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="8" r="6" strokeDasharray="20 12" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm0-2A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{entry.label}</div>
                <div className="text-xs text-[var(--muted)]">{entry.sublabel}</div>
              </div>
              <span
                className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  entry.source === "manual"
                    ? "bg-blue-50 text-blue-700"
                    : entry.status === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : entry.status === "failed"
                    ? "bg-red-50 text-red-700"
                    : entry.status === "running"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {entry.badge}
              </span>
              {entry.href && (
                <svg className="h-4 w-4 text-[var(--muted)] shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              )}
            </Row>
          );
        })}
      </div>
    </div>
  );
}
