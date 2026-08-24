"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordShowcasePhotos } from "@/app/admin/website/actions";

/**
 * Photo upload for the website showcase.
 *
 * Uploads go BROWSER -> SUPABASE STORAGE directly, not through a server
 * action. The first version posted files to a server action and failed on
 * every real photo:
 *
 *     Error: Body exceeded 1 MB limit.  (statusCode 413)
 *
 * Server Actions cap request bodies at 1 MB by default, and phone photos are
 * 3-8 MB. Raising `serverActions.bodySizeLimit` would not have fixed it
 * either: Vercel's own request limit is around 4.5 MB, so large photos would
 * still fail, just less predictably. Uploading straight to storage removes
 * the limit from the path entirely. Only the resulting URL — a few hundred
 * bytes — goes through the server action.
 *
 * Photos are also resized in the browser before upload, to 2400px on the long
 * edge. Three reasons:
 *
 *   1. A 12 MP phone photo is ~8 MB; at 2400px it is a few hundred KB. The
 *      website never needs more, and every visitor pays for the difference.
 *   2. Re-encoding through a canvas DROPS EXIF, which on a phone photo
 *      includes the GPS coordinates of where it was taken. These are pictures
 *      of clients' homes; publishing their exact location would be a real
 *      privacy failure and is not obvious enough to leave to chance.
 *   3. Upload over site wifi or mobile data finishes in seconds rather than
 *      minutes.
 */

const MAX_EDGE = 2400;
const QUALITY = 0.85;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  // Every image goes through the canvas even when it is already small enough
  // to need no resizing, because that pass is also what strips EXIF. Skipping
  // it for small files would quietly leave GPS coordinates on exactly the
  // photos most likely to be uploaded straight from a phone.
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the image."))),
      "image/jpeg",
      QUALITY,
    );
  });
}

export function ShowcasePhotoUpload({ showcaseId }: { showcaseId: string }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const urls: string[] = [];
      const list = Array.from(files);

      for (const [i, file] of list.entries()) {
        if (!ACCEPTED.includes(file.type)) {
          throw new Error(`${file.name} is not a JPG, PNG, WebP or AVIF image.`);
        }
        setStatus(`Preparing ${i + 1} of ${list.length}…`);
        const blob = await downscale(file);

        setStatus(`Uploading ${i + 1} of ${list.length}…`);
        const path = `showcase/${showcaseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("project-images")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

        urls.push(supabase.storage.from("project-images").getPublicUrl(path).data.publicUrl);
      }

      setStatus("Saving…");
      await recordShowcasePhotos(showcaseId, urls);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong uploading those photos.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={busy}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm disabled:opacity-50"
        />
        {status && (
          <span role="status" className="text-sm text-slate-600">
            {status}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Photos are resized for the web automatically, so pictures taken on your phone are fine.
        Location data stored by the camera is removed before the photo goes online.
      </p>
    </div>
  );
}
