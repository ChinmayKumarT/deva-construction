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
 * Photos reuse the existing project-images bucket (public read) under a
 * showcase/ prefix, following the same upload pattern as postProjectUpdate in
 * app/admin/actions.ts.
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

export async function deleteShowcaseProject(fd: FormData) {
  const supabase = await staffClient();
  const id = text(fd, "id");
  if (!id) throw new Error("Project required");

  // Photos cascade with the row (see the FK in 36_showcase.sql). The files
  // themselves stay in the bucket: storage is cheap, and an accidental delete
  // that also destroyed the originals would be unrecoverable.
  const { error } = await supabase.from("showcase_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateShowcase();
  redirect("/admin/website");
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function uploadShowcasePhotos(fd: FormData) {
  const supabase = await staffClient();
  const showcase_id = text(fd, "showcase_id");
  if (!showcase_id) throw new Error("Project required");

  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Choose at least one photo");

  // Continue numbering after whatever is already there, so an upload appends
  // rather than fighting the existing order.
  const { data: existing } = await supabase
    .from("showcase_photos")
    .select("sort_order")
    .eq("showcase_id", showcase_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  let next = (existing?.[0]?.sort_order ?? 0) + 10;

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`${file.name} is not a JPG, PNG, WebP or AVIF image.`);
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new Error(`${file.name} is larger than 10 MB. Please use a smaller file.`);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `showcase/${showcase_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("project-images")
      .upload(path, buf, { contentType: file.type || "image/jpeg", upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: pub } = supabase.storage.from("project-images").getPublicUrl(path);

    const { error } = await supabase.from("showcase_photos").insert({
      showcase_id,
      url: pub.publicUrl,
      sort_order: next,
    });
    if (error) throw new Error(error.message);
    next += 10;
  }

  revalidateShowcase(showcase_id);
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
