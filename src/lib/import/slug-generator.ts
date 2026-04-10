/**
 * Slug generation utilities for the Import API.
 * Extracted from realman-import.ts for reuse across entity processors.
 */

/** Convert any string to a URL-safe slug. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a unique slug for a given table.
 * Appends -2, -3, etc. if the base slug is taken.
 */
export async function generateUniqueSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: "properties" | "brokers" | "agencies" | "branches",
  title: string,
  fallback = "item",
): Promise<string> {
  const baseSlug = slugify(title || fallback);
  let slug = baseSlug;
  let counter = 1;

  for (;;) {
    const { data } = await supabase
      .from(table)
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;
    counter++;
    slug = `${baseSlug}-${counter}`;
    if (counter > 100) return `${baseSlug}-${Date.now()}`; // safety valve
  }
}
