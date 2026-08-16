const REPO = "thedevaconstructions/deva-construction";
const WORKFLOW = "daily-backup.yml";

type Run = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  run_started_at: string;
  event: string;
};

async function fetchRuns(): Promise<Run[]> {
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

export default async function BackupLog() {
  const runs = await fetchRuns();

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="font-semibold text-sm mb-2">Backup log</h3>
        <p className="text-sm text-[var(--muted)]">
          No backup runs found.{" "}
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
        {runs.map((run) => {
          const success = run.conclusion === "success";
          const failed = run.conclusion === "failure";
          const inProgress = run.status === "in_progress" || run.status === "queued";

          return (
            <a
              key={run.id}
              href={run.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5 hover:bg-[var(--hover)] transition-colors"
            >
              <span className="shrink-0">
                {success && (
                  <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z" />
                  </svg>
                )}
                {failed && (
                  <svg className="h-4 w-4 text-red-500" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.343 13.657A8 8 0 1 1 13.66 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94 6.03 4.97Z" />
                  </svg>
                )}
                {inProgress && (
                  <svg className="h-4 w-4 text-amber-500 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="8" r="6" strokeDasharray="20 12" />
                  </svg>
                )}
                {!success && !failed && !inProgress && (
                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm0-2A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {formatDate(run.created_at)}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {run.event === "schedule" ? "Scheduled" : "Manual"} · {relativeTime(run.created_at)}
                </div>
              </div>
              <span
                className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  success
                    ? "bg-emerald-50 text-emerald-700"
                    : failed
                    ? "bg-red-50 text-red-700"
                    : inProgress
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {success ? "Success" : failed ? "Failed" : inProgress ? "Running" : run.conclusion ?? run.status}
              </span>
              <svg className="h-4 w-4 text-[var(--muted)] shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </a>
          );
        })}
      </div>
    </div>
  );
}
