"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/guard";

/**
 * Website showcase — the projects shown publicly on devaconstructions.in.
 *
 * These rows live in showcase_projects / showcase_photos, deliberately apart
 * from public.projects: the marketing site reads them anonymously, and
 * public.projects carries total_cost and client_id. See supabase/36_showcase.sql.
 *
 * Photos live in the existing project-images bucket (public read) under a
 * showcase/ prefix. They are uploaded straight from the browser rather than
 * through these actions — see recordShowcasePhotos below for why.
 */

const KINDS = ["Residential", "Commercial", "Renovation"] as const;
type Kind = (typeof KINDS)[number];

/** Every write here is staff-only; the public site only ever reads. */
async function staffClient() {
  await requireRole(["admin", "manager"]);
  return createSupabaseServerClient();
}

function text(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

/**
 * Turn a project name into a web address.
 *
 * Generated rather than typed, because a slug is a public URL and hand-typed
 * ones arrive with capitals, spaces and apostrophes that break links on some
 * servers while working locally.
 */
function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    // Strip the combining accents NFKD leaves behind, so "Château" becomes
    // "chateau" rather than "ch-teau".
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function requireKind(value: string): Kind {
  if (!(KINDS as readonly string[]).includes(value)) {
    throw new Error(`Category must be one of: ${KINDS.join(", ")}`);
  }
  return value as Kind;
}

/** Refresh both the admin screens and the public pages that read this data. */
function revalidateShowcase(id?: string) {
  revalidatePath("/admin/website");
  if (id) revalidatePath(`/admin/website/${id}`);
}

export async function createShowcaseProject(fd: FormData) {
  const supabase = await staffClient();

  const name = text(fd, "name");
  if (!name) throw new Error("Project name is required");

  // Slug comes from the name unless one was typed explicitly.
  const slug = slugify(text(fd, "slug") || name);
  if (!slug) throw new Error("Could not build a web address from that name");

  const { data, error } = await supabase
    .from("showcase_projects")
    .insert({
      name,
      slug,
      location: text(fd, "location"),
      year: text(fd, "year"),
      kind: requireKind(text(fd, "kind")),
      area: text(fd, "area"),
      summary: text(fd, "summary") || null,
      // New entries start unpublished. Someone has to look at it and decide
      // it is ready before it appears on the live website.
      published: false,
      sort_order: Number(fd.get("sort_order") ?? 0) || 0,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        `Another project already uses the web address "${slug}". Give this one a slightly different name.`,
      );
    }
    throw new Error(error.message);
  }

  revalidateShowcase();
  redirect(`/admin/website/${data.id}`);
}

export async function updateShowcaseProject(fd: FormData) {
  const supabase = await staffClient();
  const id = text(fd, "id");
  if (!id) throw new Error("Project required");

  const name = text(fd, "name");
  if (!name) throw new Error("Project name is required");

  const { error } = await supabase
    .from("showcase_projects")
    .update({
      name,
      location: text(fd, "location"),
      year: text(fd, "year"),
      kind: requireKind(text(fd, "kind")),
      area: text(fd, "area"),
      summary: text(fd, "summary") || null,
      featured: fd.get("featured") === "on",
      sort_order: Number(fd.get("sort_order") ?? 0) || 0,
      // NOTE: slug is deliberately not editable here. It is a public web
      // address; changing it breaks every shared link and search result
      // pointing at the project.
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidateShowcase(id);
}

export async function setShowcasePublished(fd: FormData) {
  const supabase = await staffClient();
  const id = text(fd, "id");
  const published = text(fd, "published") === "true";
  if (!id) throw new Error("Project required");

  const { error } = await supabase
    .from("showcase_projects")
    .update({ published })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidateShowcase(id);
}

/**
 * Archive / restore a showcase project.
 *
 * Distinct from unpublishing, and both are useful:
 *   unpublish — temporarily off the website, still in the working list
 *   archive   — finished with: out of the list and off the website, but the
 *               write-up and photographs are kept and can be brought back
 *
 * The public site cannot see archived projects regardless of their published
 * flag; that is enforced by the row-level policy in 38_showcase_archive.sql
 * rather than by a filter here, so it holds for every reader.
 */
async function setShowcaseArchived(id: string, archived: boolean) {
  const supabase = await staffClient();
  if (!id) throw new Error("Project required");

  const { error } = await supabase
    .from("showcase_projects")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateShowcase(id);
}

export async function archiveShowcaseProject(fd: FormData) {
  await setShowcaseArchived(text(fd, "id"), true);
  redirect("/admin/website");
}

export async function unarchiveShowcaseProject(fd: FormData) {
  await setShowcaseArchived(text(fd, "id"), false);
}

export async function deleteShowcaseProject(fd: FormData) {
  const supabase = await staffClient();
  const id = text(fd, "id");
  if (!id) throw new Error("Project required");

  // Permanent. Archiving is the reversible option — this is the one that
  // actually throws the write-up away.
  //
  // Photos cascade with the row (see the FK in 36_showcase.sql). The files
  // themselves stay in the bucket: storage is cheap, and an accidental delete
  // that also destroyed the originals would be unrecoverable.
  const { error } = await supabase.from("showcase_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateShowcase();
  redirect("/admin/website");
}

/**
 * Record photos that the browser has already uploaded to storage.
 *
 * The files never pass through here. An earlier version accepted them as
 * FormData and failed on every real photo with "Body exceeded 1 MB limit"
 * (413) — Server Actions cap bodies at 1 MB and phone photos are several
 * times that. Raising the limit would not have been enough either; Vercel
 * caps request bodies around 4.5 MB. See components/admin/ShowcasePhotoUpload.
 */
export async function recordShowcasePhotos(showcaseId: string, urls: string[]) {
  const supabase = await staffClient();
  if (!showcaseId) throw new Error("Project required");
  if (urls.length === 0) return;

  // Only accept URLs in our own public bucket. Without this the action would
  // happily store any URL a caller sent, putting arbitrary third-party images
  // on the public website.
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/project-images/`;
  for (const url of urls) {
    if (!url.startsWith(base)) throw new Error("Unexpected photo location — upload rejected.");
  }

  // Continue numbering after whatever is already there, so an upload appends
  // rather than fighting the existing order.
  const { data: existing } = await supabase
    .from("showcase_photos")
    .select("sort_order")
    .eq("showcase_id", showcaseId)
    .order("sort_order", { ascending: false })
    .limit(1);
  let next = existing?.[0]?.sort_order ?? 0;

  const rows = urls.map((url) => ({ showcase_id: showcaseId, url, sort_order: (next += 10) }));
  const { error } = await supabase.from("showcase_photos").insert(rows);
  if (error) throw new Error(error.message);

  revalidateShowcase(showcaseId);
}

export async function deleteShowcasePhoto(fd: FormData) {
  const supabase = await staffClient();
  const id = text(fd, "id");
  const showcase_id = text(fd, "showcase_id");
  if (!id) throw new Error("Photo required");

  const { error } = await supabase.from("showcase_photos").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateShowcase(showcase_id);
}

/**
 * Move a photo one place earlier or later.
 *
 * Swapping sort_order with the neighbour keeps this to two writes and avoids
 * renumbering the whole set, which matters because the FIRST photo is the
 * cover shown on the website's cards.
 */
export async function moveShowcasePhoto(fd: FormData) {
  const supabase = await staffClient();
  const id = text(fd, "id");
  const showcase_id = text(fd, "showcase_id");
  const direction = text(fd, "direction");
  if (!id || !showcase_id) throw new Error("Photo required");

  const { data: photos, error } = await supabase
    .from("showcase_photos")
    .select("id, sort_order")
    .eq("showcase_id", showcase_id)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  if (!photos) return;

  const i = photos.findIndex((p) => p.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= photos.length) return; // already at the end

  await supabase
    .from("showcase_photos")
    .update({ sort_order: photos[j].sort_order })
    .eq("id", photos[i].id);
  await supabase
    .from("showcase_photos")
    .update({ sort_order: photos[i].sort_order })
    .eq("id", photos[j].id);

  revalidateShowcase(showcase_id);
}
