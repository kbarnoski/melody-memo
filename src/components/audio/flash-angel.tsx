"use client";

import { memo, useEffect, useState } from "react";
import { getGhostFlashUrl } from "@/lib/journeys/ghost-flash-images";

interface FlashAngelProps {
  variant: number;
  /** 0-1 fade opacity of the angel. Applied on the img directly (not the
   *  parent) so that ancestors don't create a stacking context that would
   *  isolate the screen blend mode. */
  opacity: number;
  /** Blur radius in px — same reasoning as opacity. */
  blurPx: number;
}

/**
 * Ghost bass-hit flash overlay — the only moment in the Ghost journey where
 * the figure's face is shown directly. Consumes images from the Ghost
 * flash-image pool when available, falls back to the static PNG otherwise.
 *
 * The mix-blend-mode: screen trick only works if no ancestor between this
 * img and the backdrop creates an isolated stacking context, so opacity +
 * filter have to live on the img itself.
 */
export const FlashAngel = memo(function FlashAngel({ variant, opacity, blurPx }: FlashAngelProps) {
  const [src, setSrc] = useState<string>("/images/flash-angel-1.png");

  useEffect(() => {
    const cached = getGhostFlashUrl(variant);
    if (cached) {
      setSrc(cached);
      return;
    }
    let cancelled = false;
    let tries = 0;
    const id = setInterval(() => {
      if (cancelled) return;
      tries++;
      const url = getGhostFlashUrl(variant);
      if (url) {
        setSrc(url);
        clearInterval(id);
      } else if (tries > 10) {
        clearInterval(id);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [variant]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{
        width: "75vmin",
        height: "95vmin",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
        opacity,
        filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
        mixBlendMode: "screen",
      }}
    />
  );
});
