/**
 * Accept a photo URL only if it points into our own public project-images
 * bucket -- browser uploads hand the server a URL, and without this check a
 * caller could attach any third-party image. Empty stays null.
 */
export function ownStorageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/project-images/`;
  if (!url.startsWith(base)) throw new Error("Unexpected photo location — upload rejected.");
  return url;
}
