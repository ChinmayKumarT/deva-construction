"use client";

import { useTransition, useState } from "react";

// A thrown error from a Server Action has no friendly presentation here --
// Next.js just replaces the page with its generic "Application error" crash
// screen, whether the thrown message is clean or not. So instead of relying
// on the <select required> to stop an empty submission (which isn't reliably
// enforced in every browser/WebView), validate before ever calling the
// action and show a real popup if nothing's selected.
export function AssignLabourerForm({
  labourerId,
  labourerName,
  currentSite,
  projects,
  action,
}: {
  labourerId: string;
  labourerName: string;
  currentSite: string;
  projects: { id: string; name: string }[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [projectId, setProjectId] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    if (!projectId) {
      window.alert("Select a project before assigning.");
      return;
    }
    const fd = new FormData();
    fd.set("labourer_id", labourerId);
    fd.set("project_id", projectId);
    startTransition(() => {
      action(fd);
    });
  }

  return (
    <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-800">{labourerName}</div>
        <div className="text-xs text-slate-500">currently: {currentSite}</div>
      </div>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
      >
        <option value="">— project —</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleAssign}
        disabled={pending}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        Assign
      </button>
    </div>
  );
}
