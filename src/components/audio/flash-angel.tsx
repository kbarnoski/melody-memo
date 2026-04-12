"use client";

import { memo } from "react";

interface FlashAngelProps {
  variant: 0 | 1;
}

export const FlashAngel = memo(function FlashAngel({ variant }: FlashAngelProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/flash-angel-1.png"
      alt=""
      style={{
        width: "75vmin",
        height: "95vmin",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
      }}
    />
  );
});
