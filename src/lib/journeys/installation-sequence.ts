/**
 * Installation-mode loop sequence.
 *
 * Explicit ordering of journey IDs for the kiosk loop. Lives separately
 * from `JOURNEYS` so changing the installation order doesn't affect the
 * /journeys browse page or other surfaces that depend on declaration order.
 *
 * Curation rules per Karel (2026-05-03):
 *   - Target a 10-15 minute cycle so audiences can drop in/out cleanly
 *   - Save Ghost and First Snow for the end (most narrative + iconic)
 *   - Total: ~12 min (5:20 + 3:05 + 3:39)
 *
 * Three-act arc:
 *   1. Ascension — sacred, upward; gentle opener that settles the room
 *   2. First Snow — cooling pivot; strong tonal break before Ghost
 *   3. Ghost — narrative closer; the identity moment
 *
 * Full library available in journeys.ts; pull from there to swap or
 * extend the sequence. Pairings live in paired-tracks.ts.
 */
export const INSTALLATION_SEQUENCE: string[] = [
  "the-ascension",
  "first-snow",
  "ghost",
];
