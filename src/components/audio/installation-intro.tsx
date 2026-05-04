"use client";

import type { Journey } from "@/lib/journeys/types";

/**
 * Installation loop — intro overlay.
 *
 * Renders BOTH the cycle text ("Resonance — listening room") and the
 * journey text ("Ascension" + credits) simultaneously, with each in
 * its own opacity-transition wrapper. The active one is visible; the
 * other is at opacity 0. Mode swap = parent opacity transition (no
 * remount, no abrupt unmount).
 *
 * The journey-text wrapper has a 1.3s transition delay when fading
 * in, so the cycle text fully fades out (1.5s) before the journey
 * text starts appearing — no morph between two texts at the same
 * position.
 */
type Mode = "cycle" | "fading-cycle" | "empty" | "journey";

interface Props {
  mode?: Mode;
  journey?: Journey | null;
  trackArtist?: string | null;
}

export function InstallationIntro({ mode = "cycle", journey, trackArtist }: Props) {
  return (
    <div className="absolute inset-0 z-50 bg-black">
      {/* Cycle text layer — mounted in "cycle" and "fading-cycle"
          stages. In "fading-cycle", layer opacity transitions to 0
          over 1.5s; parent state then transitions to "empty" which
          unmounts this layer. */}
      {(mode === "cycle" || mode === "fading-cycle") && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 2rem",
            textAlign: "center",
            opacity: mode === "fading-cycle" ? 0 : 1,
            transition: "opacity 1500ms ease-out",
          }}
        >
          <CycleTextInner />
        </div>
      )}

      {/* "empty" stage: nothing rendered — just the bg-black of the
          parent overlay. Brief gap (~400ms) between cycle text fade
          and journey text mount so they never coexist in the DOM. */}

      {/* Journey text layer — mounted only in "journey" stage.
          Inner content has its own slow fade-in animation. Because
          cycle text is fully unmounted by this stage, no overlap. */}
      {mode === "journey" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 2rem",
            textAlign: "center",
          }}
        >
          <JourneyTextInner journey={journey} trackArtist={trackArtist} />
        </div>
      )}

      <style jsx>{`
        @keyframes installationContentFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function CycleTextInner() {
  return (
    <div style={{ animation: "installationContentFade 1400ms ease-out forwards", opacity: 0 }}>
      <div
        className="text-white/90"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 300,
          fontSize: "clamp(3.5rem, 8vw, 6rem)",
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
        }}
      >
        Resonance
      </div>
      <div
        className="text-white/55 mt-3"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: "italic",
          fontWeight: 300,
          fontSize: "clamp(1.1rem, 2.4vw, 1.7rem)",
          letterSpacing: "0.01em",
        }}
      >
        A contemplative listening room
      </div>
      <p
        className="text-white/40 mt-12 max-w-xl mx-auto"
        style={{
          fontFamily: "var(--font-geist-sans)",
          fontWeight: 400,
          fontSize: "clamp(0.85rem, 1.4vw, 1rem)",
          lineHeight: 1.7,
        }}
      >
        Composed music drives a slow audiovisual landscape — shaders, light,
        AI-curated imagery — that never repeats verbatim. Recline. Stay as long
        or as briefly as you wish.
      </p>
      <div
        className="text-white/25 mt-16"
        style={{
          fontFamily: "var(--font-geist-mono)",
          fontSize: "0.72rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        by Karel Barnoski
      </div>
    </div>
  );
}

function JourneyTextInner({ journey, trackArtist }: { journey?: Journey | null; trackArtist?: string | null }) {
  if (!journey) return null;
  const creator = journey.creatorName || "Karel Barnoski";
  return (
    <div>
      <div
        className="text-white/45"
        style={{
          fontFamily: "var(--font-geist-mono)",
          fontSize: "0.72rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: "1.5rem",
        }}
      >
        Journey
      </div>
      <div
        className="text-white/95"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 300,
          fontSize: "clamp(3rem, 6.5vw, 5rem)",
          letterSpacing: "-0.01em",
          lineHeight: 1.05,
        }}
      >
        {journey.name}
      </div>
      {journey.subtitle && (
        <div
          className="text-white/55 mt-3"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic",
            fontSize: "clamp(1rem, 2vw, 1.4rem)",
            letterSpacing: "0.01em",
          }}
        >
          {journey.subtitle}
        </div>
      )}
      <div
        className="text-white/35 mt-10"
        style={{
          fontFamily: "var(--font-geist-mono)",
          fontSize: "0.78rem",
          letterSpacing: "0.05em",
        }}
      >
        by {creator}
        {trackArtist && trackArtist !== creator ? ` · Music by ${trackArtist}` : ""}
      </div>
      {journey.dedication && (
        <div
          className="text-white/40 mt-8 max-w-2xl mx-auto"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic",
            fontSize: "clamp(0.95rem, 1.6vw, 1.15rem)",
            letterSpacing: "0.02em",
          }}
        >
          {journey.dedication}
        </div>
      )}
    </div>
  );
}
