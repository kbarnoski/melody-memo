/** Journeys paired with specific tracks — title search patterns (SQL ILIKE) */
export const PAIRED_TRACKS: Record<string, string> = {
  "first-snow": "%KB_SFLAKE%",
  "inferno": "%KB_REALIZED%",
  "cosmic-drift": "%17th St 61%",
  "neural-link": "%17th St 64%",
  "ghost": "%KB_GHOST_REF%",
};

/** Storage file search patterns — fallback when track isn't in recordings table */
export const PAIRED_STORAGE: Record<string, string> = {};

/**
 * Resolve the recording IDs for all journey-paired tracks.
 * Used by the library to show these tracks as read-only for non-owner users.
 */
export async function resolvePairedTrackIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<string[]> {
  const patterns = Object.values(PAIRED_TRACKS);
  if (patterns.length === 0) return [];

  // Build an OR filter of ILIKE patterns
  const orFilter = patterns.map((p) => `title.ilike.${p}`).join(",");
  const { data, error } = await supabase
    .from("recordings")
    .select("id")
    .or(orFilter);

  if (error || !data) return [];

  // Deduplicate
  return [...new Set((data as { id: string }[]).map((r) => r.id))];
}
