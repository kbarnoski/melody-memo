"use client";

import { memo, useEffect, useRef, useState } from "react";
import { getGhostFlashUrl } from "@/lib/journeys/ghost-flash-images";

interface FlashAngelProps {
  /** 0-1 fade opacity. Applied on the canvas directly. */
  opacity: number;
  /** Blur radius in px, applied via CSS filter. */
  blurPx: number;
}

/**
 * Ghost bass-hit flash overlay — the only moment in the Ghost journey where
 * the figure's face is shown directly.
 *
 * Uses client-side luminance chroma-keying: the image is drawn onto a canvas
 * and each pixel's alpha is derived from its brightness. Black pixels become
 * fully transparent; near-black pixels fade in over a narrow window so the
 * figure's edges blend cleanly into whatever shader backdrop is behind. This
 * is more reliable than mix-blend-mode: screen, which was getting isolated
 * by ancestor stacking contexts AND couldn't handle fal.ai's JPEG near-black
 * (RGB 5,5,5) artifacts.
 */
export const FlashAngel = memo(function FlashAngel({ opacity, blurPx }: FlashAngelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [src, setSrc] = useState<string>("/images/flash-angel-1.png");

  useEffect(() => {
    const cached = getGhostFlashUrl();
    if (cached) {
      setSrc(cached);
      return;
    }
    let cancelled = false;
    let tries = 0;
    const id = setInterval(() => {
      if (cancelled) return;
      tries++;
      const url = getGhostFlashUrl();
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
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      // Luminance chroma-key: map brightness to alpha. Near-black becomes
      // transparent; a narrow falloff smooths edges so the figure doesn't
      // look cut out with a harsh outline.
      const BLACK_THRESHOLD = 18;   // lum below this → fully transparent
      const FALLOFF_END = 70;       // lum above this → fully opaque
      const FALLOFF_RANGE = FALLOFF_END - BLACK_THRESHOLD;
      try {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          if (lum <= BLACK_THRESHOLD) {
            px[i + 3] = 0;
          } else if (lum < FALLOFF_END) {
            px[i + 3] = Math.round(((lum - BLACK_THRESHOLD) / FALLOFF_RANGE) * 255);
          }
          // else: keep native alpha (255 for opaque source pixels)
        }
        ctx.putImageData(data, 0, 0);
      } catch {
        // Tainted canvas (CORS). Leave the raw image drawn — at worst we
        // get the old rectangular look, but the static PNG fallback doesn't
        // suffer CORS issues so this is only a problem for fal.ai outputs
        // without CORS headers.
      }
    };
    img.onerror = () => { /* swallow — static PNG fallback already set */ };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "75vmin",
        height: "95vmin",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
        opacity,
        filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
      }}
      aria-hidden="true"
    />
  );
});
