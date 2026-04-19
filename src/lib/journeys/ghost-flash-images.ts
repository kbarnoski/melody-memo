/**
 * Ghost flash-angel image pool.
 *
 * The Ghost journey's bass-hit flash shows an angelic figure on the beat.
 * Per the user's direction the flash sequence tells a micro-story:
 *
 *   Flash 1 — DARK possessed angel (hair, dress, wings all black/shadow)
 *   Flash 2 — WHITE angel returned (same figure, white theme back)
 *   Flash 3+ — WHITE angel (same as flash 2)
 *
 * Two images are generated once per session and consumed by `FlashAngel`
 * via `getGhostFlashUrl(variant)`. Rendered with client-side luminance
 * chroma-keying in FlashAngel so pure-black pixels become truly transparent.
 *
 * If generation fails or is slow, `FlashAngel` falls back to its static PNG.
 */

// Shared portrait base — same identity, same pose, same skin, same camera
// in both flashes. The only thing that changes between variants is the
// wardrobe color (hair + dress + wings). Flash #1 shows the white figure
// COSTUME-CHANGED to full black; flash #2 returns to white.
const FLASH_PORTRAIT_BASE =
  "studio isolation shot photorealistic cinematic front view portrait of ONE ethereal angel woman (one single figure, no other people, no duplicates) perfectly isolated against absolute void, " +
  "the background is SOLID RGB 0 0 0 PURE MATHEMATICAL BLACK with zero luminosity, zero color, zero gradient, zero haze, zero particles in the background, zero stars — the figure is the ONLY element visible, " +
  "her face calmly visible with EYES CLOSED peaceful serene expression, BOTH ARMS RAISED high above her head reaching upward in a transcendent gesture, " +
  "pale luminous skin (skin stays pale in both variants), " +
  "hair woven into intricate fibonacci spiral da Vinci fractal braids cascading down her back, each braid wrapped and trailed with dense swirling particles spiraling along its length, the braids flowing seamlessly into her dress so hair and dress read as one continuous ribbon, " +
  "wearing a long floor-length flowing translucent dress of woven mist and light, somewhat see-through, rippling with dense swirling particles, " +
  "ALWAYS TWO LARGE translucent iridescent rainbow-shimmering wings of pure light and particle mist extending symmetrically from her back (BOTH LEFT and RIGHT wings fully visible and symmetrical, NEVER missing a wing, NEVER one-winged, wings are ethereal translucent particle mist with a faint iridescent sheen, NEVER FEATHERED, NEVER bird feathers, NEVER plumage, NEVER bulky — thin wisps of light and particles, not mass), " +
  "strong rim light from above outlining her edges against the void, dramatic chiaroscuro, photographic product-shot isolation, not illustration, not concept art";

const DARK_FLASH_PROMPT =
  FLASH_PORTRAIT_BASE +
  ", wardrobe theme: possessed under a dark spell. hair is JET BLACK, dress is JET BLACK translucent shadow-mist, wings are JET BLACK translucent particle mist with a deep iridescent oil-slick sheen, particles wrapped in her braids and streaming from her dress and wings are BLACK. skin remains pale luminous. same identity same pose same serene expression as the white version — only the costume has changed to black";

const WHITE_FLASH_PROMPT =
  FLASH_PORTRAIT_BASE +
  ", wardrobe theme: returned to light. hair is pure SNOW WHITE (NEVER blonde, NEVER yellow, NEVER gold), dress is SNOW WHITE translucent mist-and-light, wings are SNOW WHITE translucent iridescent particle mist, particles wrapped in her braids and streaming from her dress and wings are WHITE. skin pale luminous";

// Index 0 = dark possessed (shown on flash #1)
// Index 1 = white returned (shown on flash #2+)
const FLASH_PROMPTS = [DARK_FLASH_PROMPT, WHITE_FLASH_PROMPT];

const flashUrls: (string | null)[] = [null, null];
let preparePromise: Promise<void> | null = null;
let currentJourneyId: string | null = null;
let abortController: AbortController | null = null;

// Bass-flash counter for Ghost. Drives BOTH the flash variant shown AND
// the main journey angel theme:
//   count 0        → main journey angel is WHITE (before any flash)
//   count === 1    → flash #1 shows BLACK / possessed angel;
//                    main journey angel is now BLACK (costume change)
//   count >= 2     → flash #2 shows WHITE angel returning;
//                    main journey angel is now WHITE again for the remainder
let ghostFlashCount = 0;
export function incrementGhostFlashCount(): number {
  ghostFlashCount += 1;
  return ghostFlashCount;
}
export function getGhostFlashCount(): number {
  return ghostFlashCount;
}
export function getGhostAngelTheme(): "white" | "black" {
  return ghostFlashCount === 1 ? "black" : "white";
}

export function prepareGhostFlashImages(journeyId: string): Promise<void> {
  if (currentJourneyId !== journeyId) {
    abortController?.abort();
    currentJourneyId = journeyId;
    flashUrls[0] = null;
    flashUrls[1] = null;
    preparePromise = null;
    ghostFlashCount = 0;
  }
  if (preparePromise) return preparePromise;

  const controller = new AbortController();
  abortController = controller;

  preparePromise = (async () => {
    await Promise.all(
      FLASH_PROMPTS.map(async (prompt, idx) => {
        try {
          const res = await fetch("/api/ai-image/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              prompt,
              denoisingStrength: 0.5,
              width: 1024,
              height: 1024,
            }),
          });
          if (!res.ok) return;
          const data = await res.json();
          if (typeof data.image === "string") {
            flashUrls[idx] = data.image;
          }
        } catch {
          // Silent — FlashAngel will fall back to the static PNG. AbortError is expected on journey switch.
        }
      }),
    );
  })();

  return preparePromise;
}

/** Get the flash image URL for a variant. 0 = dark/possessed, 1 = white/returned. */
export function getGhostFlashUrl(variant: 0 | 1 = 1): string | null {
  return flashUrls[variant] ?? null;
}

/** Clear cached flash images and abort any in-flight generation — called on journey stop. */
export function clearGhostFlashImages() {
  abortController?.abort();
  abortController = null;
  currentJourneyId = null;
  preparePromise = null;
  flashUrls[0] = null;
  flashUrls[1] = null;
  ghostFlashCount = 0;
}
