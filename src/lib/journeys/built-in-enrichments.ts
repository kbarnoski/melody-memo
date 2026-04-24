/**
 * Runtime overlay: merges server-cached aiPromptSequence arrays into
 * built-in journey phases at play time.
 *
 * The built-in journey definitions in journeys.ts only hand-author
 * aiPromptSequence for Ghost. Every other built-in ships with a single
 * aiPrompt per phase, which caches to the same rendered image on repeat
 * and makes playback feel like a slideshow. The admin bulk-backfill
 * endpoint generates multi-variant sequences with Claude and stores
 * them in the built_in_enrichments table. This module fetches that
 * table once at app start, holds it in memory, and lets audio-store
 * overlay the sequences onto the static Journey object before the
 * engine consumes it.
 *
 * Non-admin users benefit the same — the table is readable by every
 * authenticated session.
 */

import type { Journey, JourneyPhase } from "./types";

type EnrichedPhase = { id: string; aiPromptSequence: string[] };
type EnrichmentRow = { journey_id: string; phases: EnrichedPhase[] };

let cache = new Map<string, EnrichedPhase[]>();
let loadPromise: Promise<void> | null = null;
let loaded = false;

export async function loadBuiltInEnrichments(): Promise<void> {
  if (typeof window === "undefined") return;
  if (loaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const res = await fetch("/api/journeys/built-in-enrichments", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const rows: EnrichmentRow[] = Array.isArray(data?.enrichments)
        ? data.enrichments
        : [];
      const next = new Map<string, EnrichedPhase[]>();
      for (const row of rows) {
        if (row.journey_id && Array.isArray(row.phases)) {
          next.set(row.journey_id, row.phases);
        }
      }
      cache = next;
      loaded = true;
    } catch {
      // Silent — built-ins fall back to their single-prompt behavior,
      // which is the pre-rollout state. Next page load retries.
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * Return a copy of `journey` with each phase's aiPromptSequence
 * populated from the enrichment cache. Phases that already have a
 * hand-authored sequence (Ghost, any future built-in with explicit
 * sequences in code) are left untouched.
 */
export function applyBuiltInEnrichment(journey: Journey): Journey {
  const enriched = cache.get(journey.id);
  if (!enriched) return journey;

  const byPhaseId = new Map<string, string[]>();
  for (const p of enriched) {
    if (p?.id && Array.isArray(p.aiPromptSequence)) {
      byPhaseId.set(p.id, p.aiPromptSequence);
    }
  }
  if (byPhaseId.size === 0) return journey;

  const phases: JourneyPhase[] = journey.phases.map((phase) => {
    if (Array.isArray(phase.aiPromptSequence) && phase.aiPromptSequence.length >= 4) {
      return phase;
    }
    const sequence = byPhaseId.get(phase.id);
    if (!sequence) return phase;
    return { ...phase, aiPromptSequence: sequence };
  });

  return { ...journey, phases };
}
