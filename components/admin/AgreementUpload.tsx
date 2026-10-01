"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { saveProjectAgreement } from "@/app/admin/actions";

// ponytail: 20 MB is a sane cap for a scanned agreement; raise it (up to the
// bucket's own limit) if real files are bigger.
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Project agreement upload: a photo or a PDF, sent straight from the browser
 * to the project-images bucket, then saved by URL. Same reason as
 * ShowcasePhotoUpload -- a file passed through a Server Action is capped by
 * Vercel at ~4.5 MB, which most PDFs exceed.
 */
export function AgreementUpload({ projectId, replace = false }: { projectId: string; replace?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Choose a photo or a PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That file is over 20 MB. Please choose a smaller one.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
      const path = `${projectId}/agreement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("project-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      const url = supabase.storage.from("project-images").getPublicUrl(path).data.publicUrl;
      await saveProjectAgreement(projectId, url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong uploading the agreement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        className={`inline-flex cursor-pointer items-center rounded-lg px-3 py-1.5 text-sm shadow-sm transition ${
          replace
            ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            : "bg-slate-900 font-medium text-white hover:bg-slate-800"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {busy ? "Uploading…" : replace ? "Replace" : "Upload agreement (photo or PDF)"}
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
