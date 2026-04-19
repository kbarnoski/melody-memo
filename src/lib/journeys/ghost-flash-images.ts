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

const DARK_FLASH_PROMPT =
  "studio isolation shot photorealistic cinematic front view portrait of one possessed angel woman under a dark spell, perfectly isolated against absolute void, " +
  "the background is SOLID RGB 0 0 0 PURE MATHEMATICAL BLACK with zero luminosity, zero color, zero gradient, zero haze, zero particles in the background, zero stars — the figure is the ONLY element visible, " +
  "her face calmly visible with EYES CLOSED peaceful serene expression, BOTH ARMS RAISED high above her head reaching upward in a transcendent gesture, " +
  "very long pure JET BLACK hair woven into intricate fibonacci spiral braids cascading down her back and flowing seamlessly into her dress so hair and dress read as one continuous dark ribbon, " +
  "wearing a long floor-length flowing translucent JET BLACK dress of woven shadow and dark mist, somewhat see-through, rippling with dense swirling BLACK particles inside the fabric, " +
  "ALWAYS TWO LARGE transparent translucent JET BLACK wings of pure shadow and dark mist extending symmetrically from her back (BOTH LEFT and RIGHT wings fully visible and symmetrical, NEVER missing a wing, NEVER one-winged, wings made of translucent dark mist NEVER FEATHERED NOT bird feathers NOT plumage), " +
  "pale luminous skin that is the only brightness against the deep shadow wardrobe, strong rim light from above outlining her edges against the void, dark particles ON HER BODY and WINGS and DRESS only (never in the surrounding darkness), dramatic chiaroscuro, " +
  "the figure reads as possessed under a spell — entirely black wardrobe, entirely black hair, but same identity same pose same serene expression as the white version, photographic product-shot isolation, not illustration, not concept art";

const WHITE_FLASH_PROMPT =
  "studio isolation shot photorealistic cinematic front view portrait of one ethereal angel woman perfectly isolated against absolute void, " +
  "the background is SOLID RGB 0 0 0 PURE MATHEMATICAL BLACK with zero luminosity, zero color, zero gradient, zero haze, zero particles in the background, zero stars, zero atmosphere — the figure is the ONLY element visible. " +
  "her face calmly visible with EYES CLOSED peaceful serene expression, BOTH ARMS RAISED high above her head reaching upward in a transcendent gesture, " +
  "very long pure SNOW WHITE hair (NEVER blonde, NEVER yellow, NEVER gold) woven into intricate fibonacci spiral da Vinci fractal braids cascading down her back and flowing seamlessly into the dress so hair and dress read as one continuous translucent white ribbon, " +
  "wearing a long floor-length flowing translucent white dress of woven mist and light, somewhat see-through, rippling with dense swirling white particles, " +
  "ALWAYS TWO LARGE transparent translucent white wings of pure light and mist extending symmetrically from her back (BOTH LEFT and RIGHT wings fully visible and symmetrical, NEVER missing a wing, NEVER one-winged, wings made of translucent mist and light NEVER FEATHERED NOT bird feathers NOT plumage), " +
  "pale luminous skin catching soft rim light, dense swirling white particles ON HER BODY and WINGS and DRESS (never in the surrounding darkness), strong rim light from above outlining her edges against the void, dramatic chiaroscuro, photographic product-shot isolation, not illustration, not concept art";

// Index 0 = dark possessed (shown on flash #1)
// Index 1 = white returned (shown on flash #2+)
const FLASH_PROMPTS = [DARK_FLASH_PROMPT, WHITE_FLASH_PROMPT];

const flashUrls: (string | null)[] = [null, null];
let preparePromise: Promise<void> | null = null;
let currentJourneyId: string | null = null;
let abortController: AbortController | null = null;

export function prepareGhostFlashImages(journeyId: string): Promise<void> {
  if (currentJourneyId !== journeyId) {
    abortController?.abort();
    currentJourneyId = journeyId;
    flashUrls[0] = null;
    flashUrls[1] = null;
    preparePromise = null;
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
}
