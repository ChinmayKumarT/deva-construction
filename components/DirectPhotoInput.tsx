"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Optional photo field that uploads straight from the browser to the
 * project-images bucket and submits only the resulting URL, as the hidden
 * field `uploaded_image_url`. Sending the file through a Server Action hit
 * Vercel's ~4.5 MB request cap, so ordinary phone photos failed with "An
 * unexpected response was received from the server".
 *
 * While an upload is in flight the file input is marked invalid, so the
 * browser won't submit the form until the photo is ready.
 */
export function DirectPhotoInput({ folder, className }: { folder: string; className?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A successful save resets the form; drop this photo with it so the next
  // entry doesn't silently reuse it.
  useEffect(() => {
    const form = fileRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setUrl("");
      setStatus(null);
      setError(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  async function handle(input: HTMLInputElement) {
    const file = input.files?.[0];
    setUrl("");
    setError(null);
    setStatus(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      input.value = "";
      setError("Choose a photo.");
      return;
    }
    input.setCustomValidity("Photo is still uploading — wait a moment.");
    setStatus("Uploading photo…");
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("project-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      setUrl(supabase.storage.from("project-images").getPublicUrl(path).data.publicUrl);
      setStatus("Photo ready");
    } catch (e) {
      input.value = "";
      setStatus(null);
      setError(`Photo upload failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      input.setCustomValidity("");
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className={className}
        onChange={(e) => void handle(e.currentTarget)}
      />
      <input type="hidden" name="uploaded_image_url" value={url} />
      {status && <span className="mt-1 block text-xs text-slate-500">{status}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-red-600">{error}</span>}
    </>
  );
}
