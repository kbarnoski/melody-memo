"use client";

/**
 * Client-side tracklist with hover/touch audio preload.
 *
 * Moving the list out of the server page so we can attach pointer
 * handlers that warm the browser cache for a track's audio file
 * before the user actually clicks. By the time they commit, the
 * file is usually already downloaded, so the transition from path
 * screen → in-room journey feels instant.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

interface TrackRow {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  share_token: string | null;
  recording_id: string | null;
}

interface TracklistProps {
  journeys: TrackRow[];
  isInAppContext: boolean;
  pathToken: string;
  accent: string;
}

export function Tracklist({ journeys, isInAppContext, pathToken, accent }: TracklistProps) {
  const router = useRouter();
  const preloadedRef = useRef(new Set<string>());

  const preloadTrack = useCallback(
    (journey: TrackRow) => {
      if (!journey.recording_id) return;
      const key = journey.id;
      if (preloadedRef.current.has(key)) return;
      preloadedRef.current.add(key);

      // Warm the audio file cache. /api/audio/[id] returns a signed URL
      // (JSON) — we follow it to actually fetch the audio bytes so they
      // sit in the browser cache ready for the real <audio> play().
      (async () => {
        try {
          const res = await fetch(`/api/audio/${journey.recording_id}`);
          if (!res.ok) return;
          const data = await res.json();
          if (typeof data.url === "string") {
            // Small range request is enough for the browser to warm the
            // connection and the first couple of audio frames. We use a
            // low-priority fetch so it doesn't block interaction.
            fetch(data.url, { priority: "low" as RequestPriority }).catch(() => {});
          }
        } catch {
          // Best-effort preload — silently ignore failures
        }
      })();

      // Prefetch the destination route too so Next.js has the RSC
      // payload ready. Links already get viewport-prefetched but
      // hover/touch is an even stronger intent signal.
      try {
        if (isInAppContext) {
          router.prefetch(`/room?customJourneyId=${journey.id}&pathToken=${pathToken}`);
        } else if (journey.share_token) {
          router.prefetch(`/journey/${journey.share_token}?pathToken=${pathToken}`);
        }
      } catch {}
    },
    [isInAppContext, pathToken, router],
  );

  return (
    <div className="space-y-2">
      {journeys.map((j, idx) => {
        const num = String(idx + 1).padStart(2, "0");
        const href = isInAppContext
          ? `/room?customJourneyId=${j.id}&pathToken=${pathToken}`
          : j.share_token
            ? `/journey/${j.share_token}?pathToken=${pathToken}`
            : "#";
        return (
          <Link
            key={j.id}
            href={href}
            prefetch
            onMouseEnter={() => preloadTrack(j)}
            onTouchStart={() => preloadTrack(j)}
            onFocus={() => preloadTrack(j)}
            className="group block rounded-xl px-5 py-4 transition-all hover:bg-white/[0.04]"
            style={{
              border: "1px solid rgba(255,255,255,0.07)",
              backgroundColor: "rgba(255,255,255,0.015)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 pt-0.5"
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: "0.7rem",
                  letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.35)",
                  minWidth: "1.75rem",
                }}
              >
                {num}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="transition-colors group-hover:text-white"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontStyle: "italic",
                    fontSize: "1.35rem",
                    color: "rgba(255,255,255,0.9)",
                    lineHeight: 1.3,
                  }}
                >
                  {j.name}
                </div>
                {j.subtitle && (
                  <div
                    className="mt-0.5"
                    style={{
                      fontFamily: "var(--font-geist-mono)",
                      fontSize: "0.7rem",
                      color: "rgba(255,255,255,0.4)",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {j.subtitle}
                  </div>
                )}
                {j.description && (
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: "var(--font-geist-sans)",
                      fontSize: "0.8rem",
                      color: "rgba(255,255,255,0.55)",
                      lineHeight: 1.55,
                    }}
                  >
                    {j.description}
                  </p>
                )}
              </div>
              <div
                className="flex-shrink-0 self-center transition-opacity opacity-40 group-hover:opacity-100"
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: accent,
                }}
              >
                Play →
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
